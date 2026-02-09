import { signalStore, withState, withMethods, patchState, withComputed } from '@ngrx/signals';
import { computed } from '@angular/core';

export type PerspectiveType = 'abstract' | 'map' | 'timeline' | 'family-tree' | 'ledger';

export interface TapestryNode {
  id: string;               // Unique UUID
  label: string;            // The "Name" (e.g., "Drakkenheim")
  type: string;             // Broad category: 'Person', 'Place', 'Thing', 'Event'
  
  // AI-managed metadata
  metadata: {
    lastUpdated: number;    // Unix timestamp
    confidence: number;     // 0-1 (How certain is the AI about this node?)
    isOrphaned: boolean;    // Derived: True if it has no edges
  };

  // The "Flex" Data - This powers the Perspectives
  attributes: {
    description?: string;
    
    // For Map Perspective
    coordinates?: { x: number; y: number }; 
    locationType?: 'city' | 'region' | 'point-of-interest';

    // For Timeline Perspective
    timestamp?: string;      // ISO string or a custom world-date string
    epoch?: string;          // e.g., "The Age of Fire"

    // For Table/Ledger Perspective
    [key: string]: any;      // Catch-all for custom user-defined properties
  };
}

export interface TapestryEdge {
  id: string;
  sourceId: string;         // The ID of the "From" Node
  targetId: string;         // The ID of the "To" Node
  
  // The semantic meaning of the connection
  predicate: string;        // e.g., 'SPOUSE_OF', 'LOCATED_IN', 'PARTICIPATED_IN'
  
  // Meta-info about the link
  metadata: {
    strength: number;       // 0-1 (Weighting for the Force-Directed Graph)
    isDirected: boolean;    // Is this a one-way or two-way street?
    isSecret?: boolean;     // Useful for DM/Writing modes
  };

  attributes: {
    since?: string;         // When the relationship began
    description?: string;   // "They met at the tavern in 1922"
    [key: string]: any;
  };
}

export interface Message {
  content: string;
  timestamp: Date;
}

export interface TapestryState {
  nodes: TapestryNode[];
  edges: TapestryEdge[];
  messages: Message[]; // For chat history
}

export const TapestryStore = signalStore(
  { providedIn: 'root' },
  withState({
    nodes: [] as TapestryNode[],
    edges: [] as TapestryEdge[],
    messages: [] as Message[],
    activePerspective: 'abstract' as PerspectiveType,
    isLoading: false,
  }),
  withComputed(({ nodes, edges }) => ({
    // Derived state for the Timeline perspective
    timelineNodes: computed(() => 
      nodes().filter(n => !!n.attributes.timestamp)
             .sort((a, b) => compareDates(a.attributes.timestamp, b.attributes.timestamp))
    ),
    // Derived state for the Map perspective
    mapNodes: computed(() => 
      nodes().filter(n => !!n.attributes.coordinates)
    )
  })),
  withMethods((store) => ({
    addNode(node: TapestryNode) {
      patchState(store, (state) => ({ nodes: [...state.nodes, node] }));
    },
    addEdge(edge: TapestryEdge) {
      patchState(store, (state) => ({ edges: [...state.edges, edge] }));
    },
    addMessage(message: string) {
      patchState(store, (state) => ({
        messages: [...state.messages, { content: message, timestamp: new Date() }]
      }));
    },
    updatePerspective(type: PerspectiveType) {
      patchState(store, { activePerspective: type });
    }
  }))
);

function compareDates(a: string | undefined, b: string | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}
