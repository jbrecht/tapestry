import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { TapestryState } from "./state.js";
import { TapestryExtractionSchema, TapestryNode, TapestryEdge } from "./schema.js";
import { v4 as uuidv4 } from "uuid";

type ExtractionResult = z.infer<typeof TapestryExtractionSchema>;

export function applyExtractionResult(
  currentNodes: TapestryNode[],
  currentEdges: TapestryEdge[],
  result: ExtractionResult
): { nodes: TapestryNode[]; edges: TapestryEdge[] } {
  const updatedNodes = [...currentNodes];
  let updatedEdges = [...currentEdges];

  // 1. Process New Nodes (or update existing)
  result.extractedNodes.forEach(newNode => {
    const cleanedAttributes = Object.fromEntries(
      Object.entries(newNode.attributes || {}).filter(([_, v]) => v !== null)
    );
    const existing = updatedNodes.find(n => n.label.toLowerCase() === newNode.label.toLowerCase());
    if (existing) {
      existing.attributes = { ...existing.attributes, ...cleanedAttributes };
      if (newNode.description) existing.description = newNode.description;
    } else {
      updatedNodes.push({
        id: uuidv4(),
        label: newNode.label,
        type: newNode.type,
        description: newNode.description || '',
        attributes: cleanedAttributes
      });
    }
  });

  // 2. Process New Edges
  const pendingRemovals = [...(result.edgesToRemove ?? [])];
  result.extractedEdges.forEach(newEdge => {
    const source = updatedNodes.find(n => n.label.toLowerCase() === newEdge.sourceLabel.toLowerCase());
    const target = updatedNodes.find(n => n.label.toLowerCase() === newEdge.targetLabel.toLowerCase());
    if (source && target) {
      if (newEdge.predicate.toUpperCase().startsWith("NOT_")) {
        pendingRemovals.push({
          sourceLabel: newEdge.sourceLabel,
          targetLabel: newEdge.targetLabel,
          predicate: newEdge.predicate.substring(4)
        });
      } else {
        updatedEdges.push({
          id: uuidv4(),
          sourceId: source.id,
          targetId: target.id,
          predicate: newEdge.predicate
        } as TapestryEdge);
      }
    }
  });

  // 3. Process Edge Removals
  pendingRemovals.forEach(edgeToRemove => {
    const source = updatedNodes.find(n => n.label.toLowerCase() === edgeToRemove.sourceLabel.toLowerCase());
    const target = updatedNodes.find(n => n.label.toLowerCase() === edgeToRemove.targetLabel.toLowerCase());
    if (source && target) {
      updatedEdges = updatedEdges.filter(e =>
        !(e.sourceId === source.id && e.targetId === target.id && e.predicate === edgeToRemove.predicate)
      );
    }
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}

export async function extractionNode(state: typeof TapestryState.State) {
  const model = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });
  const structuredModel = model.withStructuredOutput(TapestryExtractionSchema, { name: "extract_tapestry_v2", strict: true });

  const systemPrompt = `You are the Loom. Weave the input into the current Knowledge Graph.
    Current Nodes: ${JSON.stringify(state.nodes)}

    Rules:
    1. Entity Resolution: If an entity exists (check 'label'), do NOT create a new node.
    2. Attributes: Add new info to 'attributes' (must use 'startTime' and 'endTime' for Events). NEVER extract an absolute date or time as a standalone node. Dates and times must ALWAYS be attributes. DO NOT USE a 'timestamp' attribute.
    3. Links: Create edges between nodes using labels.
    4. Follow-up: Ask the user a question to gather more information about the graph. Focus on missing connections or details. Do not ask if they want to know more.
    5. Deletions: If the user says a relationship doesn't exist or is not true (e.g., 'X is not Y'), put it in 'edgesToRemove'. Do NOT create an edge with a 'NOT_' predicate.`;

  const result = await structuredModel.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
  ]);

  const { nodes, edges } = applyExtractionResult(state.nodes, state.edges, result);

  return {
    nodes,
    edges,
    nextPrompt: result.suggestedFollowUp
  };
}
