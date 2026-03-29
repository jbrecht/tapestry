import { Component, inject, ChangeDetectionStrategy, viewChild, ElementRef, effect, OnDestroy, AfterViewInit, signal } from '@angular/core';
import { TapestryNode, TapestryStore } from '../store/tapestry.store';
import * as d3 from 'd3';

// ─── Constants ───────────────────────────────────────────────────────────────

const AXIS_HEIGHT = 40;
const LEFT_MARGIN = 80;
const RIGHT_MARGIN = 20;
const ROW_HEIGHT = 52;
const NODE_RADIUS = 10;
const PILL_HEIGHT = 22;
const ITEM_GAP = 20;    // min px gap between items in the same row
const LABEL_ABOVE = 16; // px above node top to baseline of label
const WIDE_PILL = 80;   // pill must be this wide to receive an inside label

const LANE_TYPES = ['Person', 'Event', 'Place', 'Thing'] as const;
type LaneType = typeof LANE_TYPES[number];

const COLORS: Record<LaneType, string> = {
  Person: '#ff7f0e',
  Event:  '#d62728',
  Place:  '#2ca02c',
  Thing:  '#1f77b4',
};

// ─── Internal types ──────────────────────────────────────────────────────────

interface LaneItem {
  node: TapestryNode;
  startDate: Date;
  endDate: Date | null;
  row: number;
  inferred: boolean;
  inferredFromLabel: string;
}

interface Lane {
  type: LaneType;
  color: string;
  items: LaneItem[];
  rowCount: number;
}

interface HitItem {
  node: TapestryNode;
  cx: number;
  cy: number;
  x2: number;
}

interface LabelBox {
  x1: number; x2: number;
  y1: number; y2: number;
}

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

  private hitItems: HitItem[] = [];

  protected hoveredNode = signal<TapestryNode | null>(null);
  protected mousePosition = { x: 0, y: 0 };

  constructor() {
    effect(() => {
      const nodes = this.store.timelineNodes();
      this.store.filterText();
      if (this.ctx) {
        this.updateScales(nodes);
        requestAnimationFrame(() => this.draw());
      }
    });

    effect(() => {
      this.hoveredNode();
      if (this.ctx) requestAnimationFrame(() => this.draw());
    });

    effect(() => {
      this.store.selectedNodeId();
      if (this.ctx) requestAnimationFrame(() => this.draw());
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
      .on('zoom', event => {
        this.transform = event.transform;
        if (this.initialTimeScale) {
          this.timeScale = event.transform.rescaleX(this.initialTimeScale);
        }
        this.hoveredNode.set(null);
        this.draw();
      });

    d3.select(canvas).call(zoomBehavior);

    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseout', this.onMouseOut);
    canvas.addEventListener('click', this.onClick);

    this.updateScales(this.store.timelineNodes());
    this.draw();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas) {
      canvas.removeEventListener('mousemove', this.onMouseMove);
      canvas.removeEventListener('mouseout', this.onMouseOut);
      canvas.removeEventListener('click', this.onClick);
    }
  }

  // ─── Date parsing ───────────────────────────────────────────────────────────

  private parseDate(value: unknown): Date | null {
    if (!value) return null;
    const str = typeof value === 'number' ? value.toString() : value;
    if (typeof str !== 'string') return null;

    const standard = new Date(str);
    if (!isNaN(standard.getTime())) return standard;

    const yearMatch = str.match(/\d{3,4}/);
    if (yearMatch) {
      const d = new Date(0);
      d.setFullYear(parseInt(yearMatch[0], 10), 0, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return null;
  }

  private formatDate(str: string): string {
    if (/^\d{3,4}$/.test(str.trim())) return str.trim();
    try {
      return new Date(str).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return str;
    }
  }

  // ─── Scale management ───────────────────────────────────────────────────────

  private updateScales(nodes: TapestryNode[]) {
    const dates: Date[] = [];
    for (const n of nodes) {
      const s = this.parseDate(n.attributes['startTime']);
      if (s) dates.push(s);
      const e = this.parseDate(n.attributes['endTime']);
      if (e) dates.push(e);
    }

    if (dates.length === 0) {
      this.initialTimeScale = d3.scaleTime()
        .domain([new Date(2020, 0, 1), new Date(2030, 0, 1)])
        .range([LEFT_MARGIN, this.width - RIGHT_MARGIN]);
    } else {
      const min = new Date(Math.min(...dates.map(d => d.getTime())));
      const max = new Date(Math.max(...dates.map(d => d.getTime())));
      const pad = Math.max((max.getTime() - min.getTime()) * 0.1, 86400000 * 365);
      this.initialTimeScale = d3.scaleTime()
        .domain([new Date(min.getTime() - pad), new Date(max.getTime() + pad)])
        .range([LEFT_MARGIN, this.width - RIGHT_MARGIN]);
    }

    this.timeScale = this.transform.rescaleX(this.initialTimeScale);
  }

  private matchesFilter(node: TapestryNode, filter: string): boolean {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return node.label.toLowerCase().includes(f) ||
      node.type.toLowerCase().includes(f) ||
      (node.description?.toLowerCase().includes(f) ?? false) ||
      Object.values(node.attributes ?? {}).some(
        v => v !== null && v !== undefined && String(v).toLowerCase().includes(f)
      );
  }

  // ─── Layout ─────────────────────────────────────────────────────────────────

  private computeLanes(ts: d3.ScaleTime<number, number>): Lane[] {
    type NodeEntry = { node: TapestryNode; startDate: Date; endDate: Date | null; inferredFromLabel: string };
    const nodesByType = new Map<LaneType, NodeEntry[]>(LANE_TYPES.map(t => [t, []]));
    const addedIds = new Set<string>();

    const filterText = this.store.filterText();

    // Pass 1: nodes with a direct startTime
    for (const node of this.store.timelineNodes()) {
      const startDate = this.parseDate(node.attributes['startTime']);
      if (!startDate) continue;
      if (!this.matchesFilter(node, filterText)) continue;
      const type = LANE_TYPES.includes(node.type as LaneType) ? node.type as LaneType : 'Thing';
      nodesByType.get(type)!.push({
        node,
        startDate,
        endDate: this.parseDate(node.attributes['endTime']),
        inferredFromLabel: '',
      });
      addedIds.add(node.id);
    }

    // Pass 2: nodes with no date that connect to a dated Event node (1-hop inference)
    const datedEvents = new Map(
      this.store.timelineNodes()
        .filter(n => n.type === 'Event')
        .map(n => [n.id, n])
    );

    for (const edge of this.store.edges()) {
      const pairs: [TapestryNode | undefined, string][] = [
        [datedEvents.get(edge.targetId), edge.sourceId],
        [datedEvents.get(edge.sourceId), edge.targetId],
      ];
      for (const [event, otherId] of pairs) {
        if (!event || addedIds.has(otherId)) continue;
        const other = this.store.nodes().find(n => n.id === otherId);
        if (!other) continue;
        if (!this.matchesFilter(other, filterText)) continue;
        const startDate = this.parseDate(event.attributes['startTime']);
        if (!startDate) continue;
        const type = LANE_TYPES.includes(other.type as LaneType) ? other.type as LaneType : 'Thing';
        nodesByType.get(type)!.push({
          node: other,
          startDate,
          endDate: this.parseDate(event.attributes['endTime']),
          inferredFromLabel: event.label,
        });
        addedIds.add(otherId);
      }
    }

    const lanes: Lane[] = [];

    for (const type of LANE_TYPES) {
      const entries = nodesByType.get(type)!;
      if (entries.length === 0) continue;

      const sorted = entries.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      const rowEnds: number[] = [];

      const items: LaneItem[] = sorted.map(({ node, startDate, endDate, inferredFromLabel }) => {
        const startPx = ts(startDate);
        const endPx = endDate ? ts(endDate) : startPx;
        const itemEnd = Math.max(endPx, startPx + NODE_RADIUS * 2) + ITEM_GAP;
        const itemStart = startPx - NODE_RADIUS;

        let row = rowEnds.findIndex(end => end <= itemStart);
        if (row === -1) { row = rowEnds.length; rowEnds.push(itemEnd); }
        else { rowEnds[row] = itemEnd; }

        return { node, startDate, endDate, row, inferred: !!inferredFromLabel, inferredFromLabel };
      });

      lanes.push({ type, color: COLORS[type], items, rowCount: Math.max(1, rowEnds.length) });
    }

    return lanes;
  }

  // ─── Drawing ────────────────────────────────────────────────────────────────

  private draw() {
    if (!this.ctx || !this.timeScale) return;
    const ctx = this.ctx;
    const ts = this.timeScale;

    ctx.clearRect(0, 0, this.width, this.height);

    const lanes = this.computeLanes(ts);
    if (lanes.length === 0) {
      this.drawEmptyState(ctx);
      return;
    }

    const availableHeight = this.height - AXIS_HEIGHT;
    const totalRows = lanes.reduce((sum, lane) => sum + lane.rowCount, 0);
    const laneHeights = lanes.map(lane => (lane.rowCount / totalRows) * availableHeight);
    const laneOrigins: number[] = [];
    let cumY = 0;
    for (const h of laneHeights) { laneOrigins.push(cumY); cumY += h; }

    // Draw vertical gridlines (behind everything)
    const ticks = ts.ticks(Math.floor(this.width / 100));
    ctx.beginPath();
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1;
    for (const tick of ticks) {
      const tx = ts(tick);
      ctx.moveTo(tx, 0);
      ctx.lineTo(tx, availableHeight);
    }
    ctx.stroke();

    // Draw lane backgrounds and labels
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const originY = laneOrigins[i];

      const lh = laneHeights[i];

      // Background band
      ctx.fillStyle = lane.color + '14';
      ctx.fillRect(LEFT_MARGIN, originY, this.width - LEFT_MARGIN - RIGHT_MARGIN, lh);

      // Left gutter tinted strip
      ctx.fillStyle = lane.color + '28';
      ctx.fillRect(0, originY, LEFT_MARGIN, lh);

      // Lane type label in gutter
      ctx.fillStyle = lane.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lane.type.toUpperCase(), LEFT_MARGIN / 2, originY + lh / 2);

      // Separator line between lanes
      if (i > 0) {
        ctx.beginPath();
        ctx.moveTo(0, originY);
        ctx.lineTo(this.width, originY);
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Left margin divider
    ctx.beginPath();
    ctx.moveTo(LEFT_MARGIN, 0);
    ctx.lineTo(LEFT_MARGIN, availableHeight);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.stroke();

    this.hitItems = [];
    const hn = this.hoveredNode();
    const selectedId = this.store.selectedNodeId();
    const drawnLabels: LabelBox[] = [];

    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const originY = laneOrigins[i];
      const centerY = originY + laneHeights[i] / 2;

      const rowOffset = (row: number) =>
        centerY + (row - (lane.rowCount - 1) / 2) * ROW_HEIGHT;

      for (const item of lane.items) {
        const x = ts(item.startDate);
        const y = rowOffset(item.row);
        const x2 = item.endDate ? ts(item.endDate) : null;
        const isHovered = hn === item.node;
        const isSelected = item.node.id === selectedId;

        this.hitItems.push({ node: item.node, cx: x, cy: y, x2: x2 ?? x });
        this.drawItem(ctx, item, x, y, x2, isHovered, isSelected, item.inferred, lane.color, drawnLabels);
      }
    }

    // Draw "Now" marker
    this.drawNowMarker(ctx, ts, availableHeight);

    // Draw time axis on top
    this.drawAxis(ctx, ts, ticks);
  }

  private drawItem(
    ctx: CanvasRenderingContext2D,
    item: LaneItem,
    x: number, y: number, x2: number | null,
    isHovered: boolean,
    isSelected: boolean,
    inferred: boolean,
    color: string,
    drawnLabels: LabelBox[]
  ) {
    const fillColor = isHovered
      ? (d3.color(color)?.brighter(0.6).toString() ?? color)
      : inferred
        ? (d3.color(color)?.brighter(0.8).toString() ?? color)
        : color;

    // Selection ring (drawn first, behind the shape)
    if (isSelected) {
      ctx.shadowColor = 'rgba(245,166,35,0.5)';
      ctx.shadowBlur = 8;
      if (x2 !== null) {
        const pillW = Math.max(x2 - x, NODE_RADIUS * 2);
        ctx.beginPath();
        ctx.roundRect(x - 4, y - PILL_HEIGHT / 2 - 4, pillW + 8, PILL_HEIGHT + 8, (PILL_HEIGHT + 8) / 2);
        ctx.strokeStyle = '#f5a623';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = '#f5a623';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    if (isHovered) {
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 10;
    }

    ctx.globalAlpha = inferred ? 0.72 : 1.0;

    if (x2 !== null) {
      const pillW = Math.max(x2 - x, NODE_RADIUS * 2);
      ctx.beginPath();
      ctx.roundRect(x, y - PILL_HEIGHT / 2, pillW, PILL_HEIGHT, PILL_HEIGHT / 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      if (inferred) ctx.setLineDash([4, 3]);
      ctx.strokeStyle = inferred ? color : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = isHovered ? 2 : 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, NODE_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = fillColor;
      ctx.fill();
      if (inferred) ctx.setLineDash([3, 2]);
      ctx.strokeStyle = inferred ? color : 'rgba(255,255,255,0.8)';
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1.0;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    if (isHovered) {
      this.drawHoverLabel(ctx, item, x, y, x2);
    } else if (isSelected) {
      // Always show label for selected items (ignoring collision)
      const pillW = x2 !== null ? Math.max(x2 - x, NODE_RADIUS * 2) : 0;
      const lx = x2 !== null ? x + pillW / 2 : x;
      const ly = y - (x2 !== null ? PILL_HEIGHT / 2 : NODE_RADIUS) - LABEL_ABOVE;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#b37700';
      ctx.fillText(item.node.label, lx, ly);
    } else if (x2 !== null) {
      const pillW = Math.max(x2 - x, NODE_RADIUS * 2);
      if (pillW >= WIDE_PILL) {
        this.drawLabelInPill(ctx, item.node.label, x, y, pillW, inferred);
      } else {
        const lx = x + pillW / 2;
        const ly = y - PILL_HEIGHT / 2 - LABEL_ABOVE;
        this.tryDrawLabelAbove(ctx, item.node.label, lx, ly, drawnLabels, inferred);
      }
    } else {
      const ly = y - NODE_RADIUS - LABEL_ABOVE;
      this.tryDrawLabelAbove(ctx, item.node.label, x, ly, drawnLabels, inferred);
    }
  }

  /** White label clipped inside a wide pill. */
  private drawLabelInPill(
    ctx: CanvasRenderingContext2D,
    label: string,
    x: number, y: number, pillW: number,
    inferred = false
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 1, y - PILL_HEIGHT / 2 + 1, pillW - 2, PILL_HEIGHT - 2, PILL_HEIGHT / 2);
    ctx.clip();
    ctx.font = inferred ? 'italic bold 11px sans-serif' : 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = inferred ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.92)';
    ctx.fillText(label, x + pillW / 2, y);
    ctx.restore();
  }

  /** Draw label above an item only if it doesn't collide with an already-drawn label. */
  private tryDrawLabelAbove(
    ctx: CanvasRenderingContext2D,
    label: string,
    lx: number, ly: number,
    drawnLabels: LabelBox[],
    inferred = false
  ) {
    ctx.font = inferred ? 'italic 11px sans-serif' : '11px sans-serif';
    const textW = ctx.measureText(label).width;
    const pad = 3;
    const box: LabelBox = {
      x1: lx - textW / 2 - pad,
      x2: lx + textW / 2 + pad,
      y1: ly - 12,
      y2: ly + pad,
    };

    const overlaps = drawnLabels.some(
      r => box.x1 < r.x2 && box.x2 > r.x1 && box.y1 < r.y2 && box.y2 > r.y1
    );
    if (overlaps) return;

    drawnLabels.push(box);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#333';
    ctx.fillText(label, lx, ly);
  }

  /** Full hover label: bold name + date/via string, drawn regardless of collisions. */
  private drawHoverLabel(
    ctx: CanvasRenderingContext2D,
    item: LaneItem,
    x: number, y: number, x2: number | null
  ) {
    const pillW = x2 !== null ? Math.max(x2 - x, NODE_RADIUS * 2) : 0;
    const lx = x2 !== null ? x + pillW / 2 : x;
    const ly = y - (x2 !== null ? PILL_HEIGHT / 2 : NODE_RADIUS) - LABEL_ABOVE;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    let subtitleY = ly - 2;

    if (item.inferred) {
      // "via EventName" in amber
      ctx.font = 'italic 11px sans-serif';
      ctx.fillStyle = '#b37700';
      ctx.fillText(`via ${item.inferredFromLabel}`, lx, subtitleY);
      subtitleY -= 14;
    } else {
      // Date string
      const start = item.node.attributes['startTime'] ?? '';
      const end = item.node.attributes['endTime'];
      const dateStr = end
        ? `${this.formatDate(String(start))} – ${this.formatDate(String(end))}`
        : this.formatDate(String(start));
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText(dateStr, lx, subtitleY);
      subtitleY -= 14;
    }

    // Node label
    ctx.font = item.inferred ? 'italic bold 13px sans-serif' : 'bold 13px sans-serif';
    ctx.fillStyle = '#111';
    ctx.fillText(item.node.label, lx, subtitleY);
  }

  private drawAxis(
    ctx: CanvasRenderingContext2D,
    ts: d3.ScaleTime<number, number>,
    ticks: Date[]
  ) {
    const axisY = this.height - AXIS_HEIGHT;

    // Axis background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, axisY, this.width, AXIS_HEIGHT);

    ctx.beginPath();
    ctx.moveTo(LEFT_MARGIN, axisY);
    ctx.lineTo(this.width - RIGHT_MARGIN, axisY);
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 1;
    ctx.stroke();

    const fmt = ts.tickFormat(ticks.length);

    ctx.fillStyle = '#555';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const tick of ticks) {
      const tx = ts(tick);
      if (tx < LEFT_MARGIN || tx > this.width - RIGHT_MARGIN) continue;
      ctx.beginPath();
      ctx.moveTo(tx, axisY);
      ctx.lineTo(tx, axisY + 6);
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillText(fmt(tick), tx, axisY + 9);
    }
  }

  private drawNowMarker(ctx: CanvasRenderingContext2D, ts: d3.ScaleTime<number, number>, availableHeight: number) {
    const nowX = ts(new Date());
    if (nowX < LEFT_MARGIN || nowX > this.width - RIGHT_MARGIN) return;

    ctx.beginPath();
    ctx.moveTo(nowX, 0);
    ctx.lineTo(nowX, availableHeight);
    ctx.strokeStyle = 'rgba(211, 47, 47, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(211, 47, 47, 0.75)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Now', nowX, 6);
  }

  private drawEmptyState(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No timeline data yet. Add events with start dates to see them here.', this.width / 2, this.height / 2);
  }

  // ─── Interaction ────────────────────────────────────────────────────────────

  private onMouseMove = (event: MouseEvent): void => {
    const canvas = this.canvasRef()!.nativeElement;
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = canvas.parentElement!.getBoundingClientRect();

    const lx = event.clientX - canvasRect.left;
    const ly = event.clientY - canvasRect.top;

    this.mousePosition = {
      x: event.clientX - containerRect.left,
      y: event.clientY - containerRect.top,
    };

    let found: TapestryNode | null = null;
    for (const item of this.hitItems) {
      const isPoint = item.cx === item.x2;
      if (isPoint) {
        const dx = lx - item.cx, dy = ly - item.cy;
        if (dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS * 2) { found = item.node; break; }
      } else {
        const pillW = Math.max(item.x2 - item.cx, NODE_RADIUS * 2);
        if (lx >= item.cx - 4 && lx <= item.cx + pillW + 4 &&
            ly >= item.cy - PILL_HEIGHT / 2 - 4 && ly <= item.cy + PILL_HEIGHT / 2 + 4) {
          found = item.node; break;
        }
      }
    }

    this.hoveredNode.set(found);
    this.draw();
  };

  private onClick = (event: MouseEvent): void => {
    const canvas = this.canvasRef()!.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const lx = event.clientX - rect.left;
    const ly = event.clientY - rect.top;

    let found: TapestryNode | null = null;
    for (const item of this.hitItems) {
      const isPoint = item.cx === item.x2;
      if (isPoint) {
        const dx = lx - item.cx, dy = ly - item.cy;
        if (dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS * 2) { found = item.node; break; }
      } else {
        const pillW = Math.max(item.x2 - item.cx, NODE_RADIUS * 2);
        if (lx >= item.cx - 4 && lx <= item.cx + pillW + 4 &&
            ly >= item.cy - PILL_HEIGHT / 2 - 4 && ly <= item.cy + PILL_HEIGHT / 2 + 4) {
          found = item.node; break;
        }
      }
    }

    const currentId = this.store.selectedNodeId();
    this.store.selectNode(found && found.id !== currentId ? found.id : null);
  };

  private onMouseOut = (): void => {
    this.hoveredNode.set(null);
    this.draw();
  };
}
