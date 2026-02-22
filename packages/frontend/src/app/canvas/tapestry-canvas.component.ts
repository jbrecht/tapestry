import { Component, inject, ChangeDetectionStrategy, viewChild, ElementRef, effect, OnDestroy, AfterViewInit, signal } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { TapestryEdge, TapestryNode, TapestryStore, PerspectiveType } from '../store/tapestry.store';
import * as d3 from 'd3';

// Extend the store types for D3 simulation
interface SimulationNode extends d3.SimulationNodeDatum, TapestryNode {}
interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode>, TapestryEdge {}

@Component({
  selector: 'app-tapestry-canvas',
  standalone: true,
  imports: [KeyValuePipe],
  templateUrl: './tapestry-canvas.component.html',
  styleUrl: './tapestry-canvas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TapestryCanvasComponent implements AfterViewInit, OnDestroy {
  private store = inject(TapestryStore);
  private canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('graphCanvas');
  
  private simulation: d3.Simulation<SimulationNode, SimulationLink> | null = null;
  private nodes: SimulationNode[] = [];
  private links: SimulationLink[] = [];
  private width = 800;
  private height = 600;
  private ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  
  protected hoveredNode = signal<SimulationNode | null>(null);
  protected hoveredEdge = signal<SimulationLink | null>(null);
  protected mousePosition = { x: 0, y: 0 };

  constructor() {
    effect(() => {
      const nodes = this.store.nodes();
      const edges = this.store.edges();
      const perspective = this.store.activePerspective();

      if (this.ctx) {
         this.updateSimulation(nodes, edges, perspective);
      }
    });
  }

  // ... imports
  private transform: d3.ZoomTransform = d3.zoomIdentity;

  ngAfterViewInit() {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    this.ctx = canvas.getContext('2d');
    
    // Handle resizing
    this.resizeObserver = new ResizeObserver(entries => {
      // Wrap in requestAnimationFrame to avoid "ResizeObserver loop limit exceeded" error
      requestAnimationFrame(() => {
        if (!this.resizeObserver) return; // Check if destroyed
        
        for (const entry of entries) {
            this.width = entry.contentRect.width;
            this.height = entry.contentRect.height;
            canvas.width = this.width;
            canvas.height = this.height;
            if (this.simulation) {
                this.simulation.force('x', d3.forceX(this.width / 2).strength(0.05));
                this.simulation.force('y', d3.forceY(this.height / 2).strength(0.05));
                this.simulation.alpha(1).restart();
            }
            this.draw(); // Redraw on resize
        }
      });
    });
    this.resizeObserver.observe(canvas); // Observe the canvas directly

    // Setup Zoom
    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
        .scaleExtent([0.1, 8])
        .on('zoom', (event) => {
            this.transform = event.transform;
            this.draw();
        });

    d3.select(canvas).call(zoomBehavior);

    // Add mouse event listeners
    // Note: d3-zoom handles mouse events for zooming/panning, but we still need our own for hover effects.
    // However, d3-zoom consumes some events. We might need to listen to 'mousemove' on the canvas still, 
    // but we need to be careful about coordinate systems.
    canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    canvas.addEventListener('mouseout', this.onMouseOut.bind(this));

    // Force initial simulation update in case effect ran before view init
    this.updateSimulation(
      this.store.nodes(),
      this.store.edges(),
      this.store.activePerspective()
    );
  }

  ngOnDestroy() {
    // if (this.simulation) this.simulation.stop();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas) {
        canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
        canvas.removeEventListener('mouseout', this.onMouseOut.bind(this));
    }
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.simulation) return;

    // We can't simply take clientX/Y because d3-zoom might be active.
    // But we are listening to native mousemove.
    const rect = this.canvasRef()!.nativeElement.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;
    
    // Apply inverse transform to get world coordinates
    const worldX = (clientX - this.transform.x) / this.transform.k;
    const worldY = (clientY - this.transform.y) / this.transform.k;
    
    this.mousePosition = { x: worldX, y: worldY };

    // Find node under mouse using WORLD coordinates
    const node = this.simulation.nodes().find(n => {
        if (n.x === undefined || n.y === undefined) return false;
        const dx = worldX - n.x;
        const dy = worldY - n.y;
        return (dx * dx + dy * dy) < (20 * 20); // 20 is radius
    });

    this.hoveredNode.set(node || null);
    
    // If no node is hovered, check for edges
    if (!node) {
       // Simple point-to-line distance check
       const edge = this.simulation.force<d3.ForceLink<SimulationNode, SimulationLink>>('link')?.links().find(l => {
          const source = l.source as unknown as SimulationNode;
          const target = l.target as unknown as SimulationNode;
          if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return false;
          
          return this.isPointNearLine(worldX, worldY, source.x, source.y, target.x, target.y, 5); // 5px tolerance
       });
       this.hoveredEdge.set(edge || null);
    } else {
       this.hoveredEdge.set(null);
    }

    this.draw(); // Redraw to show hover effect
  }

  private onMouseOut() {
    this.hoveredNode.set(null);
    this.hoveredEdge.set(null);
    this.draw();
  }

  private isPointNearLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number, tolerance: number): boolean {
     const A = px - x1;
     const B = py - y1;
     const C = x2 - x1;
     const D = y2 - y1;
     
     const dot = A * C + B * D;
     const len_sq = C * C + D * D;
     let param = -1;
     if (len_sq !== 0) // in case of 0 length line
         param = dot / len_sq;
     
     let xx, yy;
     
     if (param < 0) {
       xx = x1;
       yy = y1;
     }
     else if (param > 1) {
       xx = x2;
       yy = y2;
     }
     else {
       xx = x1 + param * C;
       yy = y1 + param * D;
     }
     
     const dx = px - xx;
     const dy = py - yy;
     return (dx * dx + dy * dy) < (tolerance * tolerance);
  }

  private updateSimulation(storeNodes: TapestryNode[], storeEdges: TapestryEdge[], perspective: PerspectiveType) {
    if (!this.ctx) return;
    
    // Stop any existing simulation if we are switching away from standard, 
    // or if we need to re-initialize.
    // For now, we only implement the 'abstract' (standard) view.
    
    if (perspective !== 'abstract') {
        // Handle other perspectives or cleanup
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
            this.ctx.clearRect(0, 0, this.width, this.height);
        }
        return;
    }

    // Merge new data with existing simulation data to preserve positions
    // This simple approach rebuilds the arrays but tries to keep objects if IDs match
    const oldNodes = new Map(this.nodes.map(n => [n.id, n]));
    
    this.nodes = storeNodes.map(node => {
        const existing = oldNodes.get(node.id);
        if (existing) {
            // Keep position and velocity
            return Object.assign(existing, node);
        }
        // New node
        return { ...node } as SimulationNode;
    });

    const nodeIds = new Set(this.nodes.map(n => n.id));

    this.links = storeEdges
        .filter(edge => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId))
        .map(edge => ({
        ...edge,
        source: edge.sourceId,
        target: edge.targetId
    } as SimulationLink));

    if (!this.simulation) {
        this.simulation = d3.forceSimulation<SimulationNode, SimulationLink>(this.nodes)
            .force('link', d3.forceLink<SimulationNode, SimulationLink>(this.links).id((d: SimulationNode) => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('x', d3.forceX(this.width / 2).strength(0.05))
            .force('y', d3.forceY(this.height / 2).strength(0.05))
            .force('collide', d3.forceCollide().radius(30))
            .on('tick', () => this.draw());
    } else {
        this.simulation.nodes(this.nodes);
        const linkForce = this.simulation.force('link') as d3.ForceLink<SimulationNode, SimulationLink>;
        linkForce.links(this.links);
        this.simulation.alpha(1).restart();
    }
  }

  private draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    
    ctx.clearRect(0, 0, this.width, this.height);
    
    ctx.save();
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.k, this.transform.k);

    // Draw Links
    ctx.lineCap = 'round';
    for (const link of this.links) {
        // D3 replaces source/target string IDs with Node objects after initialization
        const source = link.source as unknown as SimulationNode;
        const target = link.target as unknown as SimulationNode;
        
        const isHovered = this.hoveredEdge() === link;

        if (source.x !== undefined && source.y !== undefined && target.x !== undefined && target.y !== undefined) {
             ctx.beginPath();
             ctx.moveTo(source.x, source.y);
             ctx.lineTo(target.x, target.y);
             
             if (isHovered) {
                 ctx.strokeStyle = '#555';
                 ctx.lineWidth = 4;
                 ctx.shadowColor = 'rgba(0,0,0,0.3)';
                 ctx.shadowBlur = 4;
             } else {
                 ctx.strokeStyle = '#999';
                 ctx.lineWidth = 2; // Thicker default edge
                 ctx.shadowColor = 'transparent';
                 ctx.shadowBlur = 0;
             }
             
             ctx.stroke();
             
             // Reset shadow
             ctx.shadowColor = 'transparent';
             ctx.shadowBlur = 0;
        }
    }

    // Draw Nodes
    for (const node of this.nodes) {
        if (node.x === undefined || node.y === undefined) continue;
        
        ctx.beginPath();
        // Constant node size matching hit area
        // Note: scaling the context scales everything, including the node radius.
        // If we want nodes to stay the same visual size while zooming, we'd divide radius by k.
        // But typically zooming in means seeing things larger, so simple scale is fine.
        ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);
        if (this.hoveredNode() === node) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 10;
          ctx.fillStyle = d3.color(this.getNodeColor(node.type))?.brighter(0.5).toString() || this.getNodeColor(node.type);
        } else {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.fillStyle = this.getNodeColor(node.type);
        }
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = '#000';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y + 35);
    }
    
    ctx.restore();
  }

  private getNodeColor(type: string): string {
      switch (type) {
          case 'Person': return '#ff7f0e';
          case 'Place': return '#2ca02c';
          case 'Event': return '#d62728';
          case 'Thing': return '#1f77b4';
          default: return '#9467bd';
      }
  }
}
