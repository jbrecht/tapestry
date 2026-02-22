import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, BaseMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { TapestryState } from "./state.js";
import { extractionNode } from "./extractor.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 1. Middleware
// Replace 'http://localhost:4200' with your Railway frontend URL later
app.use(cors()); 
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/projects", projectRoutes);

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

    // Convert raw history back into LangChain Message objects
    const messageHistory: BaseMessage[] = (history || []).map((msg: any) => 
      msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
    );

    // Initial state for this execution turn
    const initialState = {
      messages: [new HumanMessage(message)],
      nodes: nodes || [],
      edges: edges || [],
    };

    // Execute the LangGraph
    const result = await tapestryApp.invoke(initialState);

    // Return the updated graph and the AI's response
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

// 4. Start Server
app.listen(port, () => {
  console.log(`🧶 Tapestry server spinning on port ${port}`);
});