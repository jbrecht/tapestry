import { signalStore, withState, withMethods, patchState, withComputed, withHooks } from '@ngrx/signals';
import { computed, inject, effect } from '@angular/core';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, of } from 'rxjs';
import { switchMap, tap, catchError, debounceTime, filter, map } from 'rxjs/operators';
import { ProjectService, Project } from '../services/project.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export type PerspectiveType = 'abstract' | 'map' | 'timeline' | 'family-tree' | 'ledger';

export interface TapestryNode {
  id: string;
  label: string;
  type: 'Person' | 'Place' | 'Thing' | 'Event';
  description: string | null;
  attributes: {
    coordinates?: { x: number; y: number };
    startTime?: string;
    endTime?: string;
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

export interface TapestryState {
  projectId: string | null;
  projectName: string;
  projectList: Project[];
  nodes: TapestryNode[];
  edges: TapestryEdge[];
  messages: ChatMessage[];
  activePerspective: PerspectiveType;
  isLoading: boolean;
  isSaving: boolean;
  projectsLoaded: boolean;
  isInitialEmpty: boolean;
  selectedNodeId: string | null;
  filterText: string;
  undoStack: Array<{ nodes: TapestryNode[]; edges: TapestryEdge[] }>;
  redoStack: Array<{ nodes: TapestryNode[]; edges: TapestryEdge[] }>;
}

const initialState: TapestryState = {
  projectId: null,
  projectName: 'No Project Selected',
  projectList: [],
  nodes: [],
  edges: [],
  messages: [],
  activePerspective: 'abstract',
  isLoading: false,
  isSaving: false,
  projectsLoaded: false,
  isInitialEmpty: false,
  selectedNodeId: null,
  filterText: '',
  undoStack: [],
  redoStack: [],
};

export const TapestryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ nodes, edges, undoStack, redoStack }) => ({
    // Perspective Helpers
    mapNodes: computed(() => nodes().filter(n => !!n.attributes.coordinates)),
    timelineNodes: computed(() =>
      nodes()
        .filter(n => !!n.attributes['startTime'])
        .sort((a, b) => {
           const timeA = String(a.attributes['startTime'] || '');
           const timeB = String(b.attributes['startTime'] || '');
           return timeA.localeCompare(timeB);
        })
    ),
    // World Stats (Fun for the UI)
    nodeCount: computed(() => nodes().length),
    edgeCount: computed(() => edges().length),
    isWorldEmpty: computed(() => nodes().length === 0),
    canUndo: computed(() => undoStack().length > 0),
    canRedo: computed(() => redoStack().length > 0),
  })),
  // 1. Basic Methods & Data-only methods
  withMethods((store) => {
    const projectService = inject(ProjectService);
    
    return {
      saveToHistory() {
        patchState(store, state => ({
          undoStack: [...state.undoStack, { nodes: state.nodes, edges: state.edges }].slice(-50),
          redoStack: [],
        }));
      },
      undo() {
        patchState(store, state => {
          if (state.undoStack.length === 0) return state;
          const prev = state.undoStack[state.undoStack.length - 1];
          return {
            nodes: prev.nodes,
            edges: prev.edges,
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [...state.redoStack, { nodes: state.nodes, edges: state.edges }].slice(-50),
          };
        });
      },
      redo() {
        patchState(store, state => {
          if (state.redoStack.length === 0) return state;
          const next = state.redoStack[state.redoStack.length - 1];
          return {
            nodes: next.nodes,
            edges: next.edges,
            redoStack: state.redoStack.slice(0, -1),
            undoStack: [...state.undoStack, { nodes: state.nodes, edges: state.edges }].slice(-50),
          };
        });
      },
      addNode(node: Omit<TapestryNode, 'id'>) {
        patchState(store, state => ({
          undoStack: [...state.undoStack, { nodes: state.nodes, edges: state.edges }].slice(-50),
          redoStack: [],
          nodes: [...state.nodes, { ...node, id: crypto.randomUUID() }],
        }));
      },
      updateGraph(nodes: TapestryNode[], edges: TapestryEdge[]) {
        patchState(store, state => ({
          undoStack: [...state.undoStack, { nodes: state.nodes, edges: state.edges }].slice(-50),
          redoStack: [],
          nodes,
          edges,
        }));
      },
      addChatMessage(role: 'user' | 'assistant', content: string) {
        patchState(store, (state) => ({
          messages: [...state.messages, { role, content, timestamp: Date.now() }]
        }));
      },
      setPerspective(activePerspective: PerspectiveType) {
        patchState(store, { activePerspective });
      },
      selectNode(selectedNodeId: string | null) {
        patchState(store, { selectedNodeId });
      },
      setFilterText(filterText: string) {
        patchState(store, { filterText });
      },
      updateNode(nodeId: string, changes: { label?: string; description?: string | null; attributes?: TapestryNode['attributes'] }) {
        patchState(store, state => ({
          undoStack: [...state.undoStack, { nodes: state.nodes, edges: state.edges }].slice(-50),
          redoStack: [],
          nodes: state.nodes.map(n => n.id === nodeId ? { ...n, ...changes } : n)
        }));
      },
      deleteNode(nodeId: string) {
        patchState(store, state => ({
          undoStack: [...state.undoStack, { nodes: state.nodes, edges: state.edges }].slice(-50),
          redoStack: [],
          nodes: state.nodes.filter(n => n.id !== nodeId),
          edges: state.edges.filter(e => e.sourceId !== nodeId && e.targetId !== nodeId),
          selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        }));
      },
      deleteEdge(edgeId: string) {
        patchState(store, state => ({
          undoStack: [...state.undoStack, { nodes: state.nodes, edges: state.edges }].slice(-50),
          redoStack: [],
          edges: state.edges.filter(e => e.id !== edgeId),
        }));
      },
      setLoading(isLoading: boolean) {
        patchState(store, { isLoading });
      },
      
      // Single Project CRUD - Save
      saveProject: rxMethod<{ id: string, name: string, data: any }>(
        pipe(
          tap(() => patchState(store, { isSaving: true })),
          switchMap(({ id, name, data }) => projectService.updateProject(id, name, data).pipe(
             tap(() => patchState(store, { isSaving: false })),
             catchError((err) => {
                 console.error('Auto-save failed', err);
                 patchState(store, { isSaving: false });
                 return of(null);
             })
          ))
        )
      ),

      loadProject: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { isLoading: true })),
          switchMap((id) => projectService.getProject(id).pipe(
            tap((project) => {
              const data = project.data || {};
              patchState(store, {
                projectId: project.id,
                projectName: project.name,
                nodes: data.nodes || project.nodes || [],
                edges: data.edges || project.edges || [],
                messages: data.messages || project.messages || [],
                activePerspective: (data.activePerspective as PerspectiveType) || (project.activePerspective as PerspectiveType) || 'abstract',
                isLoading: false,
                undoStack: [],
                redoStack: [],
              });
            }),
            catchError((err) => {
              console.error('Failed to load project', err);
              patchState(store, { isLoading: false });
              return of(null);
            })
          ))
        )
      ),

      deleteProject: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { isLoading: true })),
          switchMap((id) => projectService.deleteProject(id).pipe(
            tap(() => {
              patchState(store, (state) => ({
                isLoading: false,
                projectList: state.projectList.filter(p => p.id !== id),
                ...(state.projectId === id ? {
                  projectId: null,
                  projectName: 'No Project Selected',
                  nodes: [],
                  edges: [],
                  messages: []
                } : {})
              }));
            }),
            catchError((err) => {
              console.error('Failed to delete project', err);
              patchState(store, { isLoading: false });
              return of(null);
            })
          ))
        )
      )
    };
  }),

  // 2. Methods dependent on loadProject
  withMethods((store) => {
    const projectService = inject(ProjectService);
    return {
      // Load Project List
      loadProjectList: rxMethod<void>(
        pipe(
          switchMap(() => projectService.getProjects().pipe(
            tap((projects) => {
              let initialProject = null;
              if (!store.projectId()) {
                const lastProjectId = localStorage.getItem('tapestry_last_project_id');
                if (lastProjectId && projects.find(p => p.id === lastProjectId)) {
                  initialProject = lastProjectId;
                } else if (projects.length > 0) {
                  initialProject = projects[0].id;
                }
              }
              
              patchState(store, { 
                projectList: projects,
                projectsLoaded: true,
                isInitialEmpty: projects.length === 0 && !store.projectId()
              });

              if (initialProject) {
                store.loadProject(initialProject);
              }
            }),
            catchError((err) => {
              console.error('Failed to load projects', err);
              return of([]);
            })
          ))
        )
      )
    };
  }),

  // 3. Methods dependent on loadProjectList
  withMethods((store) => {
    const projectService = inject(ProjectService);
    return {
      createProject: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { isLoading: true })),
          switchMap((name) => projectService.createProject(name).pipe(
            tap((project) => {
              patchState(store, {
                projectId: project.id,
                projectName: project.name,
                nodes: [],
                edges: [],
                messages: [],
                isLoading: false,
                isInitialEmpty: false
              });
              store.loadProjectList(); 
            }),
            catchError((err) => {
              console.error('Failed to create project', err);
              patchState(store, { isLoading: false });
              return of(null);
            })
          ))
        )
      )
    };
  }),
  // 3. Aliases for Component Usage
  withMethods((store) => ({
      startNewProject(name: string) {
        store.createProject(name);
      },
      switchProject(projectId: string) {
        store.loadProject(projectId);
      }
  })),
  // 4. Hooks & Effects
  withHooks({
    onInit(store) {
      const authService = inject(AuthService);

      // A. Auto-load project list when user logs in
      effect(() => {
        const user = authService.currentUser();
        if (user) {
          store.loadProjectList();
        } else {
            // Clear state on logout
            patchState(store, {
                projectId: null,
                projectName: 'No Project Selected',
                projectList: [],
                nodes: [],
                edges: [],
                messages: [],
                projectsLoaded: false,
                isInitialEmpty: false
            });
        }
      });

      // B. Persist current project to local storage
      effect(() => {
        const currentProjectId = store.projectId();
        if (currentProjectId) {
          localStorage.setItem('tapestry_last_project_id', currentProjectId);
        }
      });

      // C. Auto-save Effect
      // Create a signal that represents the complete saveable state
      const saveState = computed(() => ({
        id: store.projectId(),
        name: store.projectName(),
        data: {
          nodes: store.nodes(),
          edges: store.edges(),
          messages: store.messages(),
          activePerspective: store.activePerspective()
        }
      }));

      // Use rxMethod to pipe this signal through debounce and filter
      rxMethod<{ id: string | null, name: string, data: any }>(
        pipe(
          debounceTime(2000), // Wait for 2 seconds of inactivity
          filter((state): state is { id: string, name: string, data: any } => !!state.id), // Only save if we have a project ID
          tap((state) => {
            console.log('[TapestryStore] Auto-saving project...', state.id);
            store.saveProject(state);
          })
        )
      )(saveState);
    }
  })
);