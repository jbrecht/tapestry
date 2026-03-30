import express from "express";
import cors from "cors";
import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, BaseMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { parse as parseHtml } from "node-html-parser";
import { FRONTEND_URL, PORT } from "./config.js";
import { TapestryState } from "./state.js";
import { extractionNode, sanitizeForPrompt } from "./extractor.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import userRoutes from "./routes/users.js";

// ── URL → plain text ──────────────────────────────────────────────────────────
async function fetchUrlAsText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Tapestry/1.0 (knowledge graph; contact via github.com/tapestry)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();

  // If it's plain text (e.g. .txt, .md), return as-is
  if (!contentType.includes('html')) return raw;

  const root = parseHtml(raw);

  // Remove non-content elements
  for (const tag of ['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript', 'figure']) {
    root.querySelectorAll(tag).forEach(el => el.remove());
  }

  // Prefer article/main content if present
  const article = root.querySelector('article') ?? root.querySelector('main') ?? root.querySelector('#mw-content-text') ?? root.querySelector('.mw-body-content');
  const textRoot = article ?? root;

  // Convert to readable text: paragraphs separated by newlines
  const text = textRoot.innerText
    .replace(/\n{3,}/g, '\n\n')   // collapse excess blank lines
    .replace(/[ \t]+/g, ' ')       // collapse spaces
    .trim();

  if (text.length < 200) {
    throw new Error('Page returned too little usable text — it may be paywalled or bot-protected.');
  }

  return text;
}

const app = express();

// 1. Middleware
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/projects", projectRoutes);
app.use("/users", userRoutes);

app.get("/server-test", (req, res) => {
  res.send("Server available");
});

// 2. Compile the Tapestry Graph
const workflow = new StateGraph(TapestryState)
  .addNode("extractor", extractionNode)
  .addEdge(START, "extractor")
  .addEdge("extractor", END);

const tapestryApp = workflow.compile();

// 3. Weave endpoint — SSE stream: reply tokens first, then graph delta
app.post("/weave", async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const { message, history, nodes, edges } = req.body;

    const systemPrompt = `You are the Loom, a thoughtful assistant helping build a knowledge graph.
Current nodes: ${JSON.stringify(sanitizeForPrompt(nodes || []))}
Respond conversationally and helpfully. Ask a follow-up question to gather more detail.`;

    const chatHistory: BaseMessage[] = (history || []).map((msg: any) =>
      msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
    );

    const streamingModel = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0.4, streaming: true });

    // Run streaming reply and structured extraction in parallel
    const [streamResult, extractResult] = await Promise.all([
      // A) Stream conversational reply tokens
      (async () => {
        const stream = await streamingModel.stream([
          new SystemMessage(systemPrompt),
          ...chatHistory,
          new HumanMessage(message),
        ]);
        let fullReply = '';
        for await (const chunk of stream) {
          const token = typeof chunk.content === 'string' ? chunk.content : '';
          if (token) {
            fullReply += token;
            send({ type: 'token', text: token });
          }
        }
        return fullReply;
      })(),
      // B) Structured extraction for graph update
      tapestryApp.invoke({
        messages: [new HumanMessage(message)],
        nodes: nodes || [],
        edges: edges || [],
      }),
    ]);

    send({
      type: 'result',
      nodes: extractResult.nodes,
      edges: extractResult.edges,
      reply: streamResult,
    });
  } catch (error) {
    console.error("Loom Error:", error);
    send({ type: 'error', message: "The loom snagged a thread. Check server logs." });
  } finally {
    res.end();
  }
});

// ── Chunking helper ──────────────────────────────────────────────────────────
// Split text into overlapping chunks so entities near boundaries aren't missed.
// Each chunk is processed sequentially, inheriting the nodes/edges found so far,
// so entity resolution works across the full document.
function chunkText(text: string, maxChars = 8000, overlap = 400): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    // Step back by overlap so entities near the boundary appear in both chunks
    start = end - overlap;
  }
  return chunks;
}

// 4. Extract endpoint — SSE stream, chunked document ingestion (text or URL)
app.post("/extract", async (req, res) => {
  const { text, url, nodes, edges } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    let sourceText: string;

    if (url && url.trim()) {
      send({ type: 'fetching', message: `Fetching ${url}…` });
      try {
        sourceText = await fetchUrlAsText(url.trim());
        console.log(`[extract] Fetched ${url} → ${sourceText.length} chars`);
      } catch (err: any) {
        send({ type: 'error', message: err.message ?? 'Failed to fetch URL.' });
        res.end();
        return;
      }
    } else if (text && text.trim()) {
      sourceText = text.trim();
    } else {
      send({ type: 'error', message: 'Provide either text or a URL.' });
      res.end();
      return;
    }

    const chunks = chunkText(sourceText);
    console.log(`[extract] Processing ${chunks.length} chunk(s) from ${sourceText.length} chars`);
    send({ type: 'start', total: chunks.length });

    const prevIds = new Set((nodes || []).map((n: any) => n.id));
    let currentNodes = nodes || [];
    let currentEdges = edges || [];

    for (let i = 0; i < chunks.length; i++) {
      console.log(`[extract] Chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
      send({ type: 'progress', chunk: i + 1, total: chunks.length });
      const result = await tapestryApp.invoke({
        messages: [new HumanMessage(chunks[i])],
        nodes: currentNodes,
        edges: currentEdges,
      });
      currentNodes = result.nodes;
      currentEdges = result.edges;
    }

    const addedNodes = currentNodes.filter((n: any) => !prevIds.has(n.id));
    const addedEdges = currentEdges.length - (edges || []).length;
    send({
      type: 'result',
      nodes: currentNodes,
      edges: currentEdges,
      summary: `Processed ${chunks.length} chunk${chunks.length !== 1 ? 's' : ''}. Added ${addedNodes.length} node${addedNodes.length !== 1 ? 's' : ''}, ${Math.max(0, addedEdges)} edge${addedEdges !== 1 ? 's' : ''}.`
    });
  } catch (error) {
    console.error("Extract Error:", error);
    send({ type: 'error', message: 'Extraction failed. Check server logs.' });
  } finally {
    res.end();
  }
});

// 4. Start Server
app.listen(PORT, () => {
  console.log(`🧶 Tapestry server spinning on port ${PORT}`);
});
