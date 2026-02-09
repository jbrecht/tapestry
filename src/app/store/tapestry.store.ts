import { signalStore, withState, withMethods, patchState, withComputed } from '@ngrx/signals';
import { computed } from '@angular/core';

export type PerspectiveType = 'abstract' | 'map' | 'timeline' | 'family-tree' | 'ledger';

export interface TapestryNode {
  id: string;
  label: string;
  type: 'Person' | 'Place' | 'Thing' | 'Event';
  description: string | null;
  attributes: {
    coordinates?: { x: number; y: number };
    timestamp?: string;
    locationType?: string;
    extraInfo?: string | null;
    [key: string]: any;
  };
}

export interface TapestryEdge {
  id: string;
  sourceId: string;
  targetId: string;
  predicate: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export const TapestryStore = signalStore(
  { providedIn: 'root' },
  withState({
    nodes: [] as TapestryNode[],
    edges: [] as TapestryEdge[],
    messages: [] as ChatMessage[],
    activePerspective: 'abstract' as PerspectiveType,
    isLoading: false,
  }),
  withComputed(({ nodes, edges }) => ({
    // Perspective Helpers
    mapNodes: computed(() => nodes().filter(n => !!n.attributes.coordinates)),
    timelineNodes: computed(() => 
      nodes()
        .filter(n => !!n.attributes.timestamp)
        .sort((a, b) => (a.attributes.timestamp || '').localeCompare(b.attributes.timestamp || ''))
    ),
    // World Stats (Fun for the UI)
    nodeCount: computed(() => nodes().length),
    edgeCount: computed(() => edges().length),
    isWorldEmpty: computed(() => nodes().length === 0)
  })),
  withMethods((store) => ({
    updateGraph(nodes: TapestryNode[], edges: TapestryEdge[]) {
      patchState(store, { nodes, edges });
    },
    addChatMessage(role: 'user' | 'assistant', content: string) {
      patchState(store, (state) => ({
        messages: [...state.messages, { role, content, timestamp: Date.now() }]
      }));
    },
    setPerspective(activePerspective: PerspectiveType) {
      patchState(store, { activePerspective });
    },
    setLoading(isLoading: boolean) {
      patchState(store, { isLoading });
    }
  }))
);