import express from "express";
import cors from "cors";
import multer from "multer";
import { PDFParse } from "pdf-parse";
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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

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
app.use(express.json({ limit: '10mb' }));

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

// ── Shared chunked extraction pipeline ───────────────────────────────────────
async function runChunkedExtraction(
  sourceText: string,
  nodes: any[],
  edges: any[],
  send: (data: object) => void
): Promise<void> {
  const chunks = chunkText(sourceText);
  console.log(`[extract] Processing ${chunks.length} chunk(s) from ${sourceText.length} chars`);
  send({ type: 'start', total: chunks.length });

  const prevIds = new Set(nodes.map((n: any) => n.id));
  let currentNodes = [...nodes];
  let currentEdges = [...edges];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`[extract] Chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
    send({ type: 'progress', chunk: i + 1, total: chunks.length });
    const prevNodeIds = new Set(currentNodes.map((n: any) => n.id));
    const result = await tapestryApp.invoke({
      messages: [new HumanMessage(chunks[i])],
      nodes: currentNodes,
      edges: currentEdges,
    });
    currentNodes = result.nodes;
    currentEdges = result.edges;

    // Count new nodes by type for the progress report
    const added = currentNodes.filter((n: any) => !prevNodeIds.has(n.id));
    const byType: Record<string, number> = {};
    for (const n of added) byType[n.type] = (byType[n.type] ?? 0) + 1;
    send({ type: 'chunk_done', chunk: i + 1, total: chunks.length, added: added.length, byType, nodes: currentNodes, edges: currentEdges });
  }

  // Link pass: after chunking, find cross-document relationships that chunked processing may have missed.
  // Skip if too many new nodes — the output JSON would exceed model token limits.
  const LINK_PASS_MAX = 80;
  if (chunks.length > 1) {
    const newNodes = currentNodes.filter((n: any) => !prevIds.has(n.id));
    if (newNodes.length >= 2 && newNodes.length <= LINK_PASS_MAX) {
      console.log(`[extract] Link pass: connecting ${newNodes.length} new nodes`);
      send({ type: 'linking', message: 'Finding cross-document relationships…' });
      const entityList = newNodes.map((n: any) => `${n.label} (${n.type})`).join(', ');
      const result = await tapestryApp.invoke({
        messages: [new HumanMessage(
          `Entity link pass for a document processed in ${chunks.length} chunks. ` +
          `All entities found: ${entityList}. ` +
          `Find relationships between these entities that may have been missed when processing text in separate chunks. ` +
          `Focus especially on connections between entities that appear in different parts of the document.`
        )],
        nodes: currentNodes,
        edges: currentEdges,
      });
      currentNodes = result.nodes;
      currentEdges = result.edges;
    } else if (newNodes.length > LINK_PASS_MAX) {
      console.log(`[extract] Link pass skipped — ${newNodes.length} nodes exceeds limit of ${LINK_PASS_MAX}`);
    }
  }

  const addedNodes = currentNodes.filter((n: any) => !prevIds.has(n.id));
  const addedEdges = currentEdges.length - edges.length;
  send({
    type: 'result',
    nodes: currentNodes,
    edges: currentEdges,
    summary: `Processed ${chunks.length} chunk${chunks.length !== 1 ? 's' : ''}. Added ${addedNodes.length} node${addedNodes.length !== 1 ? 's' : ''}, ${Math.max(0, addedEdges)} edge${addedEdges !== 1 ? 's' : ''}.`
  });
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

    await runChunkedExtraction(sourceText, nodes || [], edges || [], send);
  } catch (error) {
    console.error("Extract Error:", error);
    send({ type: 'error', message: 'Extraction failed. Check server logs.' });
  } finally {
    res.end();
  }
});

// 5. Extract-file endpoint — SSE stream, file upload (txt, md, pdf)
app.post("/extract-file", upload.single('file'), async (req: any, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      send({ type: 'error', message: 'No file uploaded.' });
      res.end();
      return;
    }

    const nodes = req.body.nodes ? JSON.parse(req.body.nodes) : [];
    const edges = req.body.edges ? JSON.parse(req.body.edges) : [];

    let sourceText: string;
    const filename = file.originalname.toLowerCase();

    if (filename.endsWith('.pdf') || file.mimetype === 'application/pdf') {
      send({ type: 'fetching', message: `Reading PDF: ${file.originalname}…` });
      const parser = new PDFParse({ data: file.buffer });
      const result = await parser.getText();
      sourceText = result.text;
      console.log(`[extract-file] PDF parsed: ${sourceText.length} chars`);
    } else {
      // .txt, .md, and any other text format
      sourceText = file.buffer.toString('utf-8');
      console.log(`[extract-file] Text file read: ${sourceText.length} chars`);
    }

    if (!sourceText.trim()) {
      send({ type: 'error', message: 'Could not extract text from file.' });
      res.end();
      return;
    }

    await runChunkedExtraction(sourceText, nodes, edges, send);
  } catch (error) {
    console.error("Extract File Error:", error);
    send({ type: 'error', message: 'File extraction failed. Check server logs.' });
  } finally {
    res.end();
  }
});

// 6. Start Server
app.listen(PORT, () => {
  console.log(`🧶 Tapestry server spinning on port ${PORT}`);
});
