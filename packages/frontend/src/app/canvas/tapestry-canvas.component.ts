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

  protected hoveredNode = signal<SimulationNode | null>(null);
  protected hoveredEdgeGroup = signal<SimulationLink[] | null>(null);
  protected showLabels = signal<boolean>(true);
  protected graphDensity = signal<number>(50);
  protected mousePosition = { x: 0, y: 0 };

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
      if (this.ctx) this.handlePerspective(nodes, edges, perspective);
    });

    effect(() => {
      this.showLabels();
      this.store.filterText();
      this.store.selectedNodeId();
      if (this.ctx) requestAnimationFrame(() => this.draw());
    });

    effect(() => {
      this.simulation.updateForces(this.graphDensity());
    });
  }

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

    this.handlePerspective(this.store.nodes(), this.store.edges(), this.store.activePerspective());
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
  }

  private handlePerspective(nodes: TapestryNode[], edges: TapestryEdge[], perspective: PerspectiveType): void {
    if (perspective !== 'abstract') {
      this.simulation.destroy();
      this.ctx?.clearRect(0, 0, this.width, this.height);
      return;
    }
    if (!this.simulation.isInitialized) {
      this.simulation.initialize(this.width, this.height, () => this.draw());
    }
    this.simulation.update(nodes, edges);
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
      selectedNodeId: this.store.selectedNodeId()
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
    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .filter(event => !event.shiftKey && event.type !== 'dblclick')
      .on('zoom', event => {
        this.transform = event.transform;
        this.hoveredNode.set(null);
        this.hoveredEdgeGroup.set(null);
        this.draw();
      });
    d3.select(canvas).call(zoomBehavior);
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
    const currentId = this.store.selectedNodeId();
    // Toggle off if clicking the already-selected node
    this.store.selectNode(node && node.id !== currentId ? node.id : null);
  };

  private onMouseOut = (): void => {
    this.hoveredNode.set(null);
    this.hoveredEdgeGroup.set(null);
    this.draw();
  };
}
