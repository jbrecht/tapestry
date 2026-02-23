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
  protected showLabels = signal<boolean>(true);
  protected graphDensity = signal<number>(50); // 1 to 100
  protected filterText = signal<string>('');
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

    effect(() => {
      // Track the signals that require redrawing
      this.showLabels();
      this.filterText();
      // Redraw canvas if context acts
      if (this.ctx) {
        requestAnimationFrame(() => this.draw());
      }
    });

    effect(() => {
      const density = this.graphDensity();
      
      if (this.simulation) {
          // Map 1-100 density to physical forces.
          // Lower density = nodes pushed further apart (stronger negative charge, longer links)
          // Higher density = nodes packed tighter.
          // Note: The slider value '50' is default. Range 1 - 100
          
          // Inverse relationship: High slider value -> low charge magnitude, low distance
          const chargeStrength = -1500 + (density * 12); // e.g. 50 -> -900, 1 -> -1488, 100 -> -300
          const linkDistance = 150 - density; // e.g. 50 -> 100, 1 -> 149, 100 -> 50

          this.simulation.force('charge', d3.forceManyBody().strength(chargeStrength));
          
          const linkForce = this.simulation.force('link') as d3.ForceLink<SimulationNode, SimulationLink>;
          if (linkForce) {
             linkForce.distance(linkDistance);
          }
          
          this.simulation.alpha(1).restart();
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
        .filter((event) => {
            // If shift is held, prevent zoom/pan so drag can handle it
            if (event.shiftKey) {
                return false;
            }
            return event.type !== 'dblclick'; // Default d3.zoom filter behavior (except we allow mousedown)
        })
        .on('zoom', (event) => {
            this.transform = event.transform;
            
            // If a tooltip is open, we either need to move it, or hide it.
            // Hiding it during pan/zoom is the standard behavior for D3 canvases
            // as it prevents jittering and detached labels.
            if (this.hoveredNode() || this.hoveredEdge()) {
                 this.hoveredNode.set(null);
                 this.hoveredEdge.set(null);
            }
            
            this.draw();
        });

    d3.select(canvas).call(zoomBehavior);

        // Setup Drag
    const dragBehavior = d3.drag<HTMLCanvasElement, unknown>()
        .filter((event) => event.shiftKey) // Only drag if shift is held
        .subject((event) => {
            if (!this.simulation) return undefined;
            
            // Extract the local coordinates efficiently using D3's helper
            // D3 drag events don't have .clientX, we have to look inside .sourceEvent
            const [localX, localY] = d3.pointer(event.sourceEvent, canvas);

            // Get transform-adjusted world coordinates
            const worldX = (localX - this.transform.x) / this.transform.k;
            const worldY = (localY - this.transform.y) / this.transform.k;

            // Find the active node
            const node = this.simulation.nodes().find(n => {
                if (n.x === undefined || n.y === undefined) return false;
                const dx = worldX - n.x;
                const dy = worldY - n.y;
                return (dx * dx + dy * dy) < (20 * 20); // hit test using radius
            });
            // subject must return an object with x and y for d3 drag, or null/undefined
            return node ? node : undefined;
        })
        .on('start', (event) => {
            const subject = event.subject as SimulationNode;
            if (!subject) return;
            if (!event.active && this.simulation) this.simulation.alphaTarget(0.3).restart();
            subject.fx = subject.x;
            subject.fy = subject.y;
        })
        .on('drag', (event) => {
            const subject = event.subject as SimulationNode;
            if (!subject) return;
            // Because the subject gives us scaled coordinates but d3.drag expects raw displacement
            // we have to adjust event.dx and event.dy via the current zoom scale
            subject.fx! += event.dx / this.transform.k;
            subject.fy! += event.dy / this.transform.k;
        })
        .on('end', (event) => {
            const subject = event.subject as SimulationNode;
            if (!subject) return;
            if (!event.active && this.simulation) this.simulation.alphaTarget(0);
            subject.fx = null;
            subject.fy = null;
        });

    d3.select(canvas).call(dragBehavior as any);

    // Add mouse event listeners
    // Note: d3-zoom and d3-drag handle mouse events for interaction
    // We listen to 'mousemove' and 'mouseout' natively to build the custom hover tooltip states.
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
    const canvas = this.canvasRef()!.nativeElement;
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = canvas.parentElement!.getBoundingClientRect();
    
    // Canvas-local coordinates for D3 physics hit testing
    const localX = event.clientX - canvasRect.left;
    const localY = event.clientY - canvasRect.top;
    
    // Apply inverse transform to get world coordinates
    const worldX = (localX - this.transform.x) / this.transform.k;
    const worldY = (localY - this.transform.y) / this.transform.k;
    
    // HTML Tooltips live in the DOM over the canvas container, 
    // so they need container-relative coordinates, NOT world coordinates!
    this.mousePosition = { 
        x: event.clientX - containerRect.left, 
        y: event.clientY - containerRect.top 
    };

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
            .force('charge', d3.forceManyBody().strength(-900))
            .force('x', d3.forceX(this.width / 2).strength(0.05))
            .force('y', d3.forceY(this.height / 2).strength(0.05))
            .force('collide', d3.forceCollide().radius(50))
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

    const hn = this.hoveredNode();
    const he = this.hoveredEdge();
    const showLabels = this.showLabels();

    const highlightNodes = new Set<SimulationNode>();
    const highlightEdges = new Set<SimulationLink>();

    if (hn) {
       highlightNodes.add(hn);
       for (const link of this.links) {
           const s = link.source as unknown as SimulationNode;
           const t = link.target as unknown as SimulationNode;
           if (s === hn || t === hn) {
               highlightEdges.add(link);
               highlightNodes.add(s);
               highlightNodes.add(t);
           }
       }
    } else if (he) {
       const s = he.source as unknown as SimulationNode;
       const t = he.target as unknown as SimulationNode;
       highlightEdges.add(he);
       highlightNodes.add(s);
       highlightNodes.add(t);
    }
    
    const isHighlightMode = highlightNodes.size > 0;

    // Calculate concealed nodes based on text filter
    const filterTextRaw = this.filterText();
    const filterText = filterTextRaw ? filterTextRaw.toLowerCase() : '';
    const concealedNodes = new Set<SimulationNode>();
    
    if (filterText) {
        for (const node of this.nodes) {
            let matches = node.label.toLowerCase().includes(filterText) || 
                          node.type.toLowerCase().includes(filterText);
            
            if (!matches && node.description) {
                matches = node.description.toLowerCase().includes(filterText);
            }
            if (!matches && node.attributes) {
                // simple search through values
                matches = Object.values(node.attributes).some(v => 
                   v !== null && v !== undefined && String(v).toLowerCase().includes(filterText)
                );
            }
            if (!matches) {
                concealedNodes.add(node);
            }
        }
    }

    // Draw Links
    ctx.lineCap = 'round';
    for (const link of this.links) {
        // D3 replaces source/target string IDs with Node objects after initialization
        const source = link.source as unknown as SimulationNode;
        const target = link.target as unknown as SimulationNode;
        
        if (concealedNodes.has(source) || concealedNodes.has(target)) continue;
        
        const isHovered = he === link;
        const isHighlighted = highlightEdges.has(link);

        if (source.x !== undefined && source.y !== undefined && target.x !== undefined && target.y !== undefined) {
             ctx.beginPath();
             ctx.moveTo(source.x, source.y);
             ctx.lineTo(target.x, target.y);
             
             ctx.globalAlpha = isHighlightMode && !isHighlighted ? 0.1 : 1.0;

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
             
             // Reset shadow and alpha
             ctx.shadowColor = 'transparent';
             ctx.shadowBlur = 0;
             ctx.globalAlpha = 1.0;
        }
    }

    // Draw Nodes
    for (const node of this.nodes) {
        if (node.x === undefined || node.y === undefined) continue;
        if (concealedNodes.has(node)) continue;
        
        const isHovered = hn === node;
        const isHighlighted = highlightNodes.has(node);

        ctx.globalAlpha = isHighlightMode && !isHighlighted ? 0.1 : 1.0;

        ctx.beginPath();
        // Constant node size matching hit area
        // Note: scaling the context scales everything, including the node radius.
        // If we want nodes to stay the same visual size while zooming, we'd divide radius by k.
        // But typically zooming in means seeing things larger, so simple scale is fine.
        ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);
        if (isHovered) {
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

        // Reset shadow and alpha
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        // Label
        if (showLabels || isHighlighted) {
            ctx.globalAlpha = isHighlightMode && !isHighlighted ? 0.1 : 1.0;
            ctx.fillStyle = '#000';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.label, node.x, node.y + 35);
            ctx.globalAlpha = 1.0;
        }
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
