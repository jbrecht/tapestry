import { Component, inject, ChangeDetectionStrategy, viewChild, ElementRef, effect, OnDestroy, AfterViewInit, signal } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { TapestryNode, TapestryEdge, TapestryStore, PerspectiveType } from '../store/tapestry.store';
import { attrLabel } from '../utils/attr-label';
import * as d3 from 'd3';
import { GraphSimulationService, SimulationNode, SimulationLink } from './graph-simulation.service';
import { CanvasRendererService } from './canvas-renderer.service';

@Component({
  selector: 'app-tapestry-canvas',
  standalone: true,
  imports: [KeyValuePipe],
  templateUrl: './tapestry-canvas.component.html',
  styleUrl: './tapestry-canvas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [GraphSimulationService, CanvasRendererService]
})
export class TapestryCanvasComponent implements AfterViewInit, OnDestroy {
  protected store = inject(TapestryStore);
  private simulation = inject(GraphSimulationService);
  private renderer = inject(CanvasRendererService);
  private canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('graphCanvas');

  private width = 800;
  private height = 600;
  private ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private transform: d3.ZoomTransform = d3.zoomIdentity;
  private zoomBehavior: d3.ZoomBehavior<HTMLCanvasElement, unknown> | null = null;

  protected hoveredNode = signal<SimulationNode | null>(null);
  protected hoveredEdgeGroup = signal<SimulationLink[] | null>(null);
  protected showLabels = signal<boolean>(true);
  protected graphDensity = signal<number>(50);
  protected minDegree = signal<number>(1);
  protected kCoreDepth = signal<number>(0);
  protected mousePosition = { x: 0, y: 0 };
  protected multiSelectedIds = signal<Set<string>>(new Set());
  protected readonly emptySet = new Set<string>();

  protected edgeGroupSource(group: SimulationLink[]): SimulationNode {
    return group[0].source as unknown as SimulationNode;
  }

  protected edgeGroupTarget(group: SimulationLink[]): SimulationNode {
    return group[0].target as unknown as SimulationNode;
  }

  protected attrLabel = attrLabel;

  constructor() {
    effect(() => {
      const nodes = this.store.nodes();
      const edges = this.store.edges();
      const perspective = this.store.activePerspective();
      const minDeg = this.minDegree();
      const kDepth = this.kCoreDepth();
      if (this.ctx) this.handlePerspective(this.applyGraphFilters(nodes, edges, minDeg, kDepth), perspective);
    });

    effect(() => {
      this.showLabels();
      this.store.filterText();
      this.store.selectedNodeId();
      this.multiSelectedIds();
      if (this.ctx) requestAnimationFrame(() => this.draw());
    });

    effect(() => {
      this.simulation.updateForces(this.graphDensity());
    });

    effect(() => {
      const selectedId = this.store.selectedNodeId();
      if (!selectedId || !this.zoomBehavior) return;
      const node = this.simulation.nodes.find(n => n.id === selectedId);
      if (!node || node.x == null || node.y == null) return;
      const canvas = this.canvasRef()?.nativeElement;
      if (!canvas) return;
      d3.select(canvas)
        .transition().duration(350)
        .call(this.zoomBehavior.translateTo, node.x, node.y);
    });
  }

  private onDocKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.multiSelectedIds.set(new Set());
  };

  ngAfterViewInit() {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    this.ctx = canvas.getContext('2d');
    this.setupResizeObserver(canvas);
    this.setupZoom(canvas);
    this.setupDrag(canvas);

    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseout', this.onMouseOut);
    canvas.addEventListener('click', this.onClick);
    document.addEventListener('keydown', this.onDocKeyDown);

    this.handlePerspective(
      this.applyGraphFilters(this.store.nodes(), this.store.edges(), this.minDegree(), this.kCoreDepth()),
      this.store.activePerspective()
    );
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.simulation.destroy();
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas) {
      canvas.removeEventListener('mousemove', this.onMouseMove);
      canvas.removeEventListener('mouseout', this.onMouseOut);
      canvas.removeEventListener('click', this.onClick);
    }
    document.removeEventListener('keydown', this.onDocKeyDown);
  }

  private applyGraphFilters(
    nodes: TapestryNode[],
    edges: TapestryEdge[],
    minDeg: number,
    kDepth: number
  ): { nodes: TapestryNode[]; edges: TapestryEdge[] } {
    let filteredNodes = nodes;
    let filteredEdges = edges;

    if (kDepth >= 2) {
      // k-core decomposition: iteratively remove nodes with fewer than k connections
      const degree = new Map<string, number>();
      const inSet = new Set(nodes.map(n => n.id));
      for (const e of edges) {
        if (inSet.has(e.sourceId) && inSet.has(e.targetId)) {
          degree.set(e.sourceId, (degree.get(e.sourceId) ?? 0) + 1);
          degree.set(e.targetId, (degree.get(e.targetId) ?? 0) + 1);
        }
      }
      let changed = true;
      while (changed) {
        changed = false;
        for (const id of inSet) {
          if ((degree.get(id) ?? 0) < kDepth) {
            inSet.delete(id);
            changed = true;
            for (const e of edges) {
              if (e.sourceId === id && inSet.has(e.targetId)) {
                degree.set(e.targetId, (degree.get(e.targetId) ?? 1) - 1);
              }
              if (e.targetId === id && inSet.has(e.sourceId)) {
                degree.set(e.sourceId, (degree.get(e.sourceId) ?? 1) - 1);
              }
            }
          }
        }
      }
      filteredNodes = nodes.filter(n => inSet.has(n.id));
      filteredEdges = edges.filter(e => inSet.has(e.sourceId) && inSet.has(e.targetId));
    } else if (minDeg > 1) {
      // Degree filter: hide nodes below minimum connection count
      const degree = new Map<string, number>();
      for (const e of edges) {
        degree.set(e.sourceId, (degree.get(e.sourceId) ?? 0) + 1);
        degree.set(e.targetId, (degree.get(e.targetId) ?? 0) + 1);
      }
      const keep = new Set(nodes.filter(n => (degree.get(n.id) ?? 0) >= minDeg).map(n => n.id));
      filteredNodes = nodes.filter(n => keep.has(n.id));
      filteredEdges = edges.filter(e => keep.has(e.sourceId) && keep.has(e.targetId));
    }

    return { nodes: filteredNodes, edges: filteredEdges };
  }

  private handlePerspective(filtered: { nodes: TapestryNode[]; edges: TapestryEdge[] }, perspective: PerspectiveType): void {
    if (perspective !== 'abstract') {
      this.simulation.destroy();
      this.ctx?.clearRect(0, 0, this.width, this.height);
      return;
    }
    if (!this.simulation.isInitialized) {
      this.simulation.initialize(this.width, this.height, () => this.draw());
    }
    this.simulation.update(filtered.nodes, filtered.edges);
  }

  private draw(): void {
    if (!this.ctx) return;
    this.renderer.draw({
      ctx: this.ctx,
      width: this.width,
      height: this.height,
      transform: this.transform,
      nodes: this.simulation.nodes,
      links: this.simulation.links,
      hoveredNode: this.hoveredNode(),
      hoveredEdgeGroup: this.hoveredEdgeGroup(),
      showLabels: this.showLabels(),
      filterText: this.store.filterText(),
      selectedNodeId: this.store.selectedNodeId(),
      multiSelectedIds: this.multiSelectedIds(),
    });
  }

  private setupResizeObserver(canvas: HTMLCanvasElement): void {
    this.resizeObserver = new ResizeObserver(entries => {
      requestAnimationFrame(() => {
        if (!this.resizeObserver) return;
        for (const entry of entries) {
          this.width = entry.contentRect.width;
          this.height = entry.contentRect.height;
          canvas.width = this.width;
          canvas.height = this.height;
          this.simulation.updateSize(this.width, this.height);
          this.draw();
        }
      });
    });
    this.resizeObserver.observe(canvas);
  }

  private setupZoom(canvas: HTMLCanvasElement): void {
    this.zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .filter(event => !event.shiftKey && event.type !== 'dblclick')
      .on('zoom', event => {
        this.transform = event.transform;
        this.hoveredNode.set(null);
        this.hoveredEdgeGroup.set(null);
        this.draw();
      });
    d3.select(canvas).call(this.zoomBehavior);
  }

  private setupDrag(canvas: HTMLCanvasElement): void {
    const dragBehavior = d3.drag<HTMLCanvasElement, unknown>()
      .filter(event => event.shiftKey)
      .subject(event => {
        const [localX, localY] = d3.pointer(event.sourceEvent, canvas);
        const worldX = (localX - this.transform.x) / this.transform.k;
        const worldY = (localY - this.transform.y) / this.transform.k;
        return this.simulation.findNodeAt(worldX, worldY);
      })
      .on('start', event => {
        const node = event.subject as SimulationNode;
        if (!node) return;
        if (!event.active) this.simulation.startDrag();
        node.fx = node.x;
        node.fy = node.y;
      })
      .on('drag', event => {
        const node = event.subject as SimulationNode;
        if (!node) return;
        node.fx! += event.dx / this.transform.k;
        node.fy! += event.dy / this.transform.k;
      })
      .on('end', event => {
        const node = event.subject as SimulationNode;
        if (!node) return;
        if (!event.active) this.simulation.endDrag();
        node.fx = null;
        node.fy = null;
      });
    d3.select(canvas).call(dragBehavior as any);
  }

  private onMouseMove = (event: MouseEvent): void => {
    const canvas = this.canvasRef()!.nativeElement;
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = canvas.parentElement!.getBoundingClientRect();

    const localX = event.clientX - canvasRect.left;
    const localY = event.clientY - canvasRect.top;
    const worldX = (localX - this.transform.x) / this.transform.k;
    const worldY = (localY - this.transform.y) / this.transform.k;

    this.mousePosition = {
      x: event.clientX - containerRect.left,
      y: event.clientY - containerRect.top
    };

    const node = this.simulation.findNodeAt(worldX, worldY) ?? null;
    this.hoveredNode.set(node);
    const edgeGroup = node ? [] : this.simulation.findEdgesAt(worldX, worldY);
    this.hoveredEdgeGroup.set(edgeGroup.length > 0 ? edgeGroup : null);
    this.draw();
  };

  private onClick = (event: MouseEvent): void => {
    const canvas = this.canvasRef()!.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const worldX = (localX - this.transform.x) / this.transform.k;
    const worldY = (localY - this.transform.y) / this.transform.k;

    const node = this.simulation.findNodeAt(worldX, worldY) ?? null;

    if (event.metaKey || event.ctrlKey) {
      // Cmd/Ctrl+click: toggle multi-selection
      if (!node) return;
      this.multiSelectedIds.update(prev => {
        const next = new Set(prev);
        next.has(node.id) ? next.delete(node.id) : next.add(node.id);
        return next;
      });
      // Clear single-selection when starting multi-select
      this.store.selectNode(null);
    } else {
      // Plain click: clear multi-selection and single-select
      this.multiSelectedIds.set(new Set());
      const currentId = this.store.selectedNodeId();
      this.store.selectNode(node && node.id !== currentId ? node.id : null);
    }
  };

  protected deleteSelected(): void {
    const ids = [...this.multiSelectedIds()];
    if (ids.length === 0) return;
    this.store.deleteNodes(ids);
    this.multiSelectedIds.set(new Set());
  }

  private onMouseOut = (): void => {
    this.hoveredNode.set(null);
    this.hoveredEdgeGroup.set(null);
    this.draw();
  };
}
