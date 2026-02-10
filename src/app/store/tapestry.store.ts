import { signalStore, withState, withMethods, patchState, withComputed, withHooks } from '@ngrx/signals';
import { computed, effect } from '@angular/core';

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

const STORAGE_KEY = 'tapestry-store-v1';

export interface TapestryState {
  nodes: TapestryNode[];
  edges: TapestryEdge[];
  messages: ChatMessage[];
  activePerspective: PerspectiveType;
  isLoading: boolean;
}

function loadInitialState(): Partial<TapestryState> {
  // Check if localStorage is available (it might not be in SSR or some environments)
  if (typeof localStorage === 'undefined') {
      console.warn('[TapestryStore] localStorage is undefined, skipping load.');
      return {};
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  console.log(`[TapestryStore] Reading from key '${STORAGE_KEY}'. Found:`, stored ? `${stored.length} bytes` : 'null');

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      console.log('[TapestryStore] Parsed state from localStorage:', parsed);
      return parsed;
    } catch (e) {
      console.error('[TapestryStore] Failed to parse stored state', e);
    }
  }
  return {};
}

const initialState: TapestryState = {
  nodes: [] as TapestryNode[],
  edges: [] as TapestryEdge[],
  messages: [] as ChatMessage[],
  activePerspective: 'abstract' as PerspectiveType,
  isLoading: false,
};

export const TapestryStore = signalStore(
  { providedIn: 'root' },
  withState(() => ({
    ...initialState,
    ...loadInitialState(),
    isLoading: false
  })),
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
  })),
  withHooks({
    onInit(store) {
      effect(() => {
        const state = {
          nodes: store.nodes(),
          edges: store.edges(),
          messages: store.messages(),
          activePerspective: store.activePerspective()
        };
        
        if (typeof localStorage !== 'undefined') {
             const serialized = JSON.stringify(state);
             console.log(`[TapestryStore] Saving state to localStorage (${serialized.length} bytes):`, state);
             localStorage.setItem(STORAGE_KEY, serialized);
        }
      });
    }
  })
);