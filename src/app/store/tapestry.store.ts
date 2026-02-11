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
const PROJECT_LIST_KEY = 'tapestry-project-list';

export interface TapestryState {
  projectName: string;
  projectList: string[];
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
  
  // Load Project List
  let projectList: string[] = [];
  const storedList = localStorage.getItem(PROJECT_LIST_KEY);
  if (storedList) {
    try {
      projectList = JSON.parse(storedList);
    } catch (e) {
      console.error('[TapestryStore] Failed to parse project list', e);
    }
  }
  
  // Migration/Init: If list is empty but we have an active project, ensure it's in the list
  if (!projectList.includes(activeProject)) {
    projectList.push(activeProject);
    localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(projectList));
  }

  const storageKey = PROJECT_PREFIX + activeProject;
  const stored = localStorage.getItem(storageKey);
  console.log(`[TapestryStore] Reading from key '${storageKey}'. Found:`, stored ? `${stored.length} bytes` : 'null');

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      console.log('[TapestryStore] Parsed state from localStorage:', parsed);
      // Ensure the loaded state uses the active project name and current list
      return { ...parsed, projectName: activeProject, projectList };
    } catch (e) {
      console.error('[TapestryStore] Failed to parse stored state', e);
    }
  }
  return { projectName: activeProject, projectList };
}

const initialState: TapestryState = {
  projectName: 'default-project',
  projectList: ['default-project'],
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
      patchState(store, (state) => {
        // Check if project already exists to prevent overwriting
        if (state.projectList.includes(projectName)) {
          console.log(`[TapestryStore] Project '${projectName}' already exists. Switching to it instead of overwriting.`);
          
          // Load existing data
          let loadedState: Partial<TapestryState> = {};
          if (typeof localStorage !== 'undefined') {
            const storageKey = PROJECT_PREFIX + projectName;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
              try {
                loadedState = JSON.parse(stored);
              } catch (e) {
                console.error('[TapestryStore] Failed to parse existing project state', e);
              }
            }
          }

          return {
            ...state,
            ...loadedState,
            projectName,
            activePerspective: (loadedState.activePerspective || 'abstract') as PerspectiveType,
            isLoading: false
          };
        }

        const newProjectList = [...state.projectList, projectName];
        
        // Save list immediately
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(newProjectList));
          localStorage.setItem(ACTIVE_PROJECT_KEY, projectName);
        }

        return {
          projectName,
          projectList: newProjectList,
          nodes: [] as TapestryNode[],
          edges: [] as TapestryEdge[],
          messages: [] as ChatMessage[],
          activePerspective: 'abstract' as PerspectiveType,
          isLoading: false
        };
      });
    },
    switchProject(projectName: string) {
      if (typeof localStorage === 'undefined') return;

      // 1. Load data for the target project
      const storageKey = PROJECT_PREFIX + projectName;
      const stored = localStorage.getItem(storageKey);
      
      let newState: Partial<TapestryState> = {
        projectName,
        nodes: [],
        edges: [],
        messages: [],
        activePerspective: 'abstract' as PerspectiveType
      };

      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          newState = { ...newState, ...parsed };
        } catch (e) {
          console.error('[TapestryStore] Failed to parse target project state', e);
        }
      }

      // 2. Update state
      patchState(store, (state) => ({
        ...state,
        ...newState,
        projectList: state.projectList // Keep existing list
      }));

      // 3. Update active key
      localStorage.setItem(ACTIVE_PROJECT_KEY, projectName);
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