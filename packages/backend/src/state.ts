import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { TapestryNode, TapestryEdge } from "./schema.js";

/**
 * The State Definition
 * We use the Annotation.Root pattern to define the 'shape' of our graph's memory.
 */
export const TapestryState = Annotation.Root({
  // 'messages' keeps a running log of the conversation
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // 'nodes' stores our entities. The extractor will return the FULL updated list
  nodes: Annotation<TapestryNode[]>({
    reducer: (x, y) => y, // Overwrite with the newly woven graph
    default: () => [],
  }),

  // 'edges' stores our relationships.
  edges: Annotation<TapestryEdge[]>({
    reducer: (x, y) => y,
    default: () => [],
  }),

  // 'nextPrompt' is the string the AI wants to say back to the user
  nextPrompt: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "Welcome to the Tapestry. Name 3 People, Places, or Things to begin.",
  }),
});