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
    },
    deleteProject(projectName: string) {
      patchState(store, (state) => {
        const newProjectList = state.projectList.filter(p => p !== projectName);
        
        // Remove from localStorage
        if (typeof localStorage !== 'undefined') {
          const storageKey = PROJECT_PREFIX + projectName;
          localStorage.removeItem(storageKey);
          localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(newProjectList));
        }

        // If deleting current project, switch to default or first available
        if (state.projectName === projectName) {
          const nextProject = newProjectList.length > 0 ? newProjectList[0] : 'default-project';
          
          // If we are falling back to 'default-project' and it wasn't in the list (e.g. list empty), ensure it is created
          if (newProjectList.length === 0 && nextProject === 'default-project') {
             // We can just return state and let a subsequent effect or action handle init, 
             // but simpler to just set it up here.
             // Actually, simplest is to just perform a switchProject-like logic effectively by returning new state
             // But we need to load that new project's data.
             
             // To keep it simple: we will just update the list and active project name here.
             // The effect or a separate call might be needed to load data if we want to be pure.
             // But `withMethods` allows us to call other methods? No, not easily within patchState.
             
             // Let's do the side effect of loading the "next" project data here manually or assume switchProject will be called?
             // We cannot call `switchProject` from within `patchState`.
             // So we have to duplicate the load logic or move it to a helper.
             
             // Refactoring load logic is better, but for now let's just do a tailored load for the next project.
             
             let nextState: Partial<TapestryState> = {
                projectName: nextProject,
                nodes: [],
                edges: [],
                messages: [],
                activePerspective: 'abstract' as PerspectiveType
             };

             if (typeof localStorage !== 'undefined') {
                const nextKey = PROJECT_PREFIX + nextProject;
                const stored = localStorage.getItem(nextKey);
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        nextState = { ...nextState, ...parsed };
                    } catch(e) { /* ignore */ }
                }
                localStorage.setItem(ACTIVE_PROJECT_KEY, nextProject);
                
                // If the list was empty and we forced default, make sure default is in the saved list
                if (newProjectList.length === 0) {
                    newProjectList.push('default-project');
                    localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(newProjectList));
                }
             }
             
             return {
                 ...state,
                 ...nextState,
                 projectList: newProjectList
             };
          }
          
           // Normal switch where next project exists
           let nextState: Partial<TapestryState> = {
                projectName: nextProject,
                nodes: [],
                edges: [],
                messages: [],
                activePerspective: 'abstract' as PerspectiveType
             };

             if (typeof localStorage !== 'undefined') {
                const nextKey = PROJECT_PREFIX + nextProject;
                const stored = localStorage.getItem(nextKey);
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        nextState = { ...nextState, ...parsed };
                    } catch(e) { /* ignore */ }
                }
                localStorage.setItem(ACTIVE_PROJECT_KEY, nextProject);
             }
             
             return {
                 ...state,
                 ...nextState,
                 projectList: newProjectList
             };

        }

        return {
            ...state,
            projectList: newProjectList
        };
      });
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