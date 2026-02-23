import { Component, inject, ChangeDetectionStrategy, viewChild, ElementRef, effect, OnDestroy, AfterViewInit, signal } from '@angular/core';
import { TapestryNode, TapestryStore } from '../store/tapestry.store';
import * as d3 from 'd3';

@Component({
  selector: 'app-tapestry-timeline',
  standalone: true,
  templateUrl: './tapestry-timeline.component.html',
  styleUrl: './tapestry-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TapestryTimelineComponent implements AfterViewInit, OnDestroy {
  private store = inject(TapestryStore);
  private canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('timelineCanvas');
  
  private ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  
  private width = 800;
  private height = 600;
  
  private transform: d3.ZoomTransform = d3.zoomIdentity;
  private timeScale: d3.ScaleTime<number, number> | null = null;
  private initialTimeScale: d3.ScaleTime<number, number> | null = null;
  
  protected hoveredNode = signal<TapestryNode | null>(null);
  protected mousePosition = { x: 0, y: 0 };
  
  // Cache the layout calculations to avoid re-grouping every frame
  private layoutCache: { node: TapestryNode, parsedDate: Date, stackIndex: number }[] = [];
  
  constructor() {
    effect(() => {
      const nodes = this.store.timelineNodes();
      
      if (this.ctx) {
          this.updateScales(nodes);
          requestAnimationFrame(() => this.draw());
      }
    });

    effect(() => {
        // Tracker for draw
        this.hoveredNode();
        if (this.ctx) {
            requestAnimationFrame(() => this.draw());
        }
    });
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    this.ctx = canvas.getContext('2d');
    
    this.resizeObserver = new ResizeObserver(entries => {
      requestAnimationFrame(() => {
        if (!this.resizeObserver) return;
        
        for (const entry of entries) {
            this.width = entry.contentRect.width;
            this.height = entry.contentRect.height;
            canvas.width = this.width;
            canvas.height = this.height;
            
            this.updateScales(this.store.timelineNodes());
            this.draw();
        }
      });
    });
    this.resizeObserver.observe(canvas);
    
    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
        .scaleExtent([0.1, 1000])
        .on('zoom', (event) => {
            this.transform = event.transform;
            if (this.initialTimeScale) {
                // Apply zoom transform to the initial time scale
                this.timeScale = event.transform.rescaleX(this.initialTimeScale);
            }
            if (this.hoveredNode()) {
                 this.hoveredNode.set(null);
            }
            this.draw();
        });

    d3.select(canvas).call(zoomBehavior);

    canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    canvas.addEventListener('mouseout', this.onMouseOut.bind(this));
    
    this.updateScales(this.store.timelineNodes());
    this.draw();
  }

  ngOnDestroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas) {
        canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
        canvas.removeEventListener('mouseout', this.onMouseOut.bind(this));
    }
  }

  private parseDate(timestampStr: string | undefined): Date | null {
      if (!timestampStr) return null;
      // Try standard parsing first
      const standardDate = new Date(timestampStr);
      if (!isNaN(standardDate.getTime())) {
          return standardDate;
      }
      
      // Fallback: look for a 3 or 4 digit year, e.g. "1337" or "1327-1377"
      const yearMatch = timestampStr.match(/\\d{3,4}/);
      if (yearMatch) {
          const year = parseInt(yearMatch[0], 10);
          // Set to Jan 1st of that year
          const d = new Date(0);
          d.setFullYear(year, 0, 1);
          d.setHours(0,0,0,0);
          return d;
      }
      return null;
  }

  private updateScales(nodes: TapestryNode[]) {
      // Filter strictly to nodes that yield a valid parsed date
      const validNodes = nodes.filter(n => this.parseDate(n.attributes.timestamp) !== null);

      if (!this.initialTimeScale && validNodes.length === 0) {
          this.initialTimeScale = d3.scaleTime()
             .domain([new Date(2020, 0, 1), new Date(2030, 0, 1)])
             .range([50, this.width - 50]);
      } else if (validNodes.length > 0) {
          const dates = validNodes.map(n => this.parseDate(n.attributes.timestamp)!);
          const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
          const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
          
          let range = maxDate.getTime() - minDate.getTime();
          if (range === 0) {
              range = 86400000 * 365 * 10; // default 10 years padding if only 1 node
          }
          
          const paddedMin = new Date(minDate.getTime() - range * 0.1);
          const paddedMax = new Date(maxDate.getTime() + range * 0.1);

          this.initialTimeScale = d3.scaleTime()
             .domain([paddedMin, paddedMax])
             .range([50, this.width - 50]);
      }
      if (this.initialTimeScale) {
          this.timeScale = this.transform.rescaleX(this.initialTimeScale);
      }
      
      this.updateLayoutCache(nodes);
  }

  private updateLayoutCache(nodes: TapestryNode[]) {
      this.layoutCache = [];
      
      // Group by timestamp string or getTime() to stack events that occur at the exact same time
      const dateGroups = new Map<number, TapestryNode[]>();
      
      for (const node of nodes) {
          const date = this.parseDate(node.attributes.timestamp);
          if (date) {
              const time = date.getTime();
              if (!dateGroups.has(time)) {
                  dateGroups.set(time, []);
              }
              dateGroups.get(time)!.push(node);
              
              // Sort the group by label to ensure consistent stacking order
              dateGroups.get(time)!.sort((a,b) => a.label.localeCompare(b.label));
          }
      }
      
      for (const [time, groupNodes] of dateGroups.entries()) {
          const parsedDate = new Date(time);
          groupNodes.forEach((node, index) => {
              this.layoutCache.push({ node, parsedDate, stackIndex: index });
          });
      }
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.timeScale || !this.ctx) return;
    
    const canvas = this.canvasRef()!.nativeElement;
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = canvas.parentElement!.getBoundingClientRect();
    
    const localX = event.clientX - canvasRect.left;
    const localY = event.clientY - canvasRect.top;
    
    const axisY = this.height / 2;
    let foundNode: TapestryNode | null = null;
    
    for (const layout of this.layoutCache) {
        const nx = this.timeScale(layout.parsedDate);
        // Stack vertically: 50px spacing between nodes, going upwards from axis
        const ny = axisY - (layout.stackIndex * 50);
        
        const dx = localX - nx;
        const dy = localY - ny;
        if ((dx * dx + dy * dy) < (20 * 20)) { // 20px radius hit test
            foundNode = layout.node;
            break; // take first match for now
        }
    }
    
    this.mousePosition = { 
        x: event.clientX - containerRect.left, 
        y: event.clientY - containerRect.top 
    };
    
    this.hoveredNode.set(foundNode);
    this.draw();
  }

  private onMouseOut() {
      this.hoveredNode.set(null);
      this.draw();
  }

  private draw() {
    if (!this.ctx || !this.timeScale) return;
    const ctx = this.ctx;
    
    ctx.clearRect(0, 0, this.width, this.height);
    
    const axisY = this.height / 2;
    
    // Draw Axis Line
    ctx.beginPath();
    ctx.moveTo(0, axisY);
    ctx.lineTo(this.width, axisY);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    const ticks = this.timeScale.ticks(10);
    const tickFormat = this.timeScale.tickFormat(10);
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    
    for (const tick of ticks) {
        const tx = this.timeScale(tick);
        ctx.beginPath();
        ctx.moveTo(tx, axisY - 5);
        ctx.lineTo(tx, axisY + 5);
        ctx.stroke();
        
        ctx.fillText(tickFormat(tick), tx, axisY + 10);
    }
    
    const hn = this.hoveredNode();
    
    // Draw vertical connection lines for stacked nodes first
    for (const layout of this.layoutCache) {
        if (layout.stackIndex > 0) {
            const nx = this.timeScale(layout.parsedDate);
            const ny = axisY - (layout.stackIndex * 50);
            ctx.beginPath();
            ctx.moveTo(nx, axisY);
            ctx.lineTo(nx, ny);
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    for (const layout of this.layoutCache) {
        const node = layout.node;
        const nx = this.timeScale(layout.parsedDate);
        const ny = axisY - (layout.stackIndex * 50);
        
        const isHovered = hn === node;
        
        ctx.beginPath();
        ctx.arc(nx, ny, 10, 0, 2 * Math.PI);
        if (isHovered) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 10;
            ctx.fillStyle = d3.color(this.getNodeColor(node.type))?.brighter(0.5).toString() || this.getNodeColor(node.type);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#fff';
        } else {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.fillStyle = this.getNodeColor(node.type);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#fff';
        }
        ctx.fill();
        ctx.stroke();
        
        if (isHovered) {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            
            ctx.fillStyle = '#000';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(node.label, nx, ny - 15);
            
            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#666';
            
            const dateStr = node.attributes.timestamp || '';
            let parsedStr = dateStr;
            try {
                parsedStr = new Date(dateStr).toLocaleDateString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            } catch(e) {}
            
            ctx.fillText(parsedStr, nx, ny - 32);
        } else {
            // Unhovered labels
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#333';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(node.label, nx, ny - 15);
        }
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
