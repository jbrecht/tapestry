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

const ACTIVE_PROJECT_KEY = 'tapestry-active-project';
const PROJECT_PREFIX = 'tapestry-project-';

export interface TapestryState {
  projectName: string;
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

  const activeProject = localStorage.getItem(ACTIVE_PROJECT_KEY) || 'default-project';
  const storageKey = PROJECT_PREFIX + activeProject;

  const stored = localStorage.getItem(storageKey);
  console.log(`[TapestryStore] Reading from key '${storageKey}'. Found:`, stored ? `${stored.length} bytes` : 'null');

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      console.log('[TapestryStore] Parsed state from localStorage:', parsed);
      // Ensure the loaded state uses the active project name
      return { ...parsed, projectName: activeProject };
    } catch (e) {
      console.error('[TapestryStore] Failed to parse stored state', e);
    }
  }
  return { projectName: activeProject };
}

const initialState: TapestryState = {
  projectName: 'default-project',
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
    },
    startNewProject(projectName: string) {
      patchState(store, {
        projectName,
        nodes: [],
        edges: [],
        messages: [],
        activePerspective: 'abstract',
        isLoading: false
      });
      // Immediately update the active project key so a reload picks it up
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACTIVE_PROJECT_KEY, projectName);
      }
    }
  })),
  withHooks({
    onInit(store) {
      effect(() => {
        const state = {
          // We don't necessarily need to store projectName inside the project blob, but it doesn't hurt.
          projectName: store.projectName(),
          nodes: store.nodes(),
          edges: store.edges(),
          messages: store.messages(),
          activePerspective: store.activePerspective()
        };
        
        if (typeof localStorage !== 'undefined') {
             const storageKey = PROJECT_PREFIX + store.projectName();
             const serialized = JSON.stringify(state);
             console.log(`[TapestryStore] Saving state to localStorage key '${storageKey}' (${serialized.length} bytes)`);
             localStorage.setItem(storageKey, serialized);
             
             // Also ensure active project is set (redundant but safe)
             localStorage.setItem(ACTIVE_PROJECT_KEY, store.projectName());
        }
      });
    }
  })
);