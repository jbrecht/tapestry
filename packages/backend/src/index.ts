import express from "express";
import cors from "cors";
import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import { FRONTEND_URL, PORT } from "./config.js";
import { TapestryState } from "./state.js";
import { extractionNode } from "./extractor.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import userRoutes from "./routes/users.js";

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

// 3. API Endpoint
app.post("/weave", async (req, res) => {
  try {
    const { message, history, nodes, edges } = req.body;

    const messageHistory: BaseMessage[] = (history || []).map((msg: any) =>
      msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
    );

    const initialState = {
      messages: [new HumanMessage(message)],
      nodes: nodes || [],
      edges: edges || [],
    };

    const result = await tapestryApp.invoke(initialState);

    res.json({
      nodes: result.nodes,
      edges: result.edges,
      reply: result.nextPrompt
    });
  } catch (error) {
    console.error("Loom Error:", error);
    res.status(500).json({ error: "The loom snagged a thread. Check server logs." });
  }
});

// 4. Extract endpoint — document ingestion without chat history
app.post("/extract", async (req, res) => {
  try {
    const { text, nodes, edges } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "No text provided." });
    }

    const initialState = {
      messages: [new HumanMessage(text)],
      nodes: nodes || [],
      edges: edges || [],
    };

    const result = await tapestryApp.invoke(initialState);

    const prevIds = new Set((nodes || []).map((n: any) => n.id));
    const addedNodes = result.nodes.filter((n: any) => !prevIds.has(n.id));
    const addedEdges = result.edges.length - (edges || []).length;

    res.json({
      nodes: result.nodes,
      edges: result.edges,
      summary: `Added ${addedNodes.length} node${addedNodes.length !== 1 ? 's' : ''}, ${Math.max(0, addedEdges)} edge${addedEdges !== 1 ? 's' : ''}.`
    });
  } catch (error) {
    console.error("Extract Error:", error);
    res.status(500).json({ error: "Extraction failed. Check server logs." });
  }
});

// 4. Start Server
app.listen(PORT, () => {
  console.log(`🧶 Tapestry server spinning on port ${PORT}`);
});
