import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { TapestryNode, TapestryExtractionSchema } from "./src/schema.js";

async function run() {
  const model = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });
  const structuredModel = model.withStructuredOutput(TapestryExtractionSchema, { name: "extract_tapestry", strict: true });
  
  const systemPrompt = `You are the Loom. Weave the input into the current Knowledge Graph.
    Current Nodes: []
    
    Rules:
    1. Entity Resolution: If an entity exists (check 'label'), do NOT create a new node.
    2. Attributes: Add new info to 'attributes' (must use 'startTime' and 'endTime' for Events). NEVER extract an absolute date or time as a standalone node. Dates and times must ALWAYS be attributes. DO NOT USE a 'timestamp' attribute.
    3. Links: Create edges between nodes using labels.
    4. Follow-up: Ask the user a question to gather more information about the graph. Focus on missing connections or details. Do not ask if they want to know more.
    5. Deletions: If the user says a relationship doesn't exist or is not true (e.g., 'X is not Y'), put it in 'edgesToRemove'. Do NOT create an edge with a 'NOT_' predicate.`;

  const result = await structuredModel.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage("The US Civil War started in 1861 and ended in 1865.")
  ]);

  console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
