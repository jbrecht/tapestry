import { Component, inject, ChangeDetectionStrategy, viewChild, ElementRef, effect, OnDestroy, AfterViewInit } from '@angular/core';
import { TapestryEdge, TapestryNode, TapestryStore, PerspectiveType } from '../store/tapestry.store';
import * as d3 from 'd3';

// Extend the store types for D3 simulation
interface SimulationNode extends d3.SimulationNodeDatum, TapestryNode {}
interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode>, TapestryEdge {}

@Component({
  selector: 'app-tapestry-canvas',
  standalone: true,
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
                this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
                this.simulation.alpha(1).restart();
            }
        }
      });
    });
    this.resizeObserver.observe(canvas.parentElement!); // Observe the container
  }

  ngOnDestroy() {
    // if (this.simulation) this.simulation.stop();
    if (this.resizeObserver) this.resizeObserver.disconnect();
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
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
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
    
    // Draw Links
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const link of this.links) {
        // D3 replaces source/target string IDs with Node objects after initialization
        const source = link.source as unknown as SimulationNode;
        const target = link.target as unknown as SimulationNode;
        if (source.x !== undefined && source.y !== undefined && target.x !== undefined && target.y !== undefined) {
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
        }
    }
    ctx.stroke();

    // Draw Nodes
    for (const node of this.nodes) {
        if (node.x === undefined || node.y === undefined) continue;
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);
        ctx.fillStyle = this.getNodeColor(node.type);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Label
        ctx.fillStyle = '#000';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y + 35);
    }
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
