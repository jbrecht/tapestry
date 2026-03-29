import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { SimulationNode, SimulationLink } from './graph-simulation.service';

export interface DrawOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  transform: d3.ZoomTransform;
  nodes: SimulationNode[];
  links: SimulationLink[];
  hoveredNode: SimulationNode | null;
  hoveredEdgeGroup: SimulationLink[] | null;
  showLabels: boolean;
  filterText: string;
  selectedNodeId: string | null;
  multiSelectedIds: Set<string>;
}

@Injectable()
export class CanvasRendererService {
  draw(opts: DrawOptions): void {
    const { ctx, width, height, transform, nodes, links, hoveredNode: hn, hoveredEdgeGroup: he, showLabels, filterText, selectedNodeId, multiSelectedIds } = opts;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const { highlightNodes, highlightEdgeIds } = this.buildHighlightSets(hn, he, links);
    const isHighlightMode = highlightNodes.size > 0;
    const concealedNodes = this.buildConcealedSet(nodes, filterText);
    const linkGroups = this.groupLinks(links);

    this.drawLinks(ctx, linkGroups, concealedNodes, highlightEdgeIds, isHighlightMode, he);
    this.drawNodes(ctx, nodes, concealedNodes, highlightNodes, isHighlightMode, hn, showLabels, selectedNodeId, multiSelectedIds);

    ctx.restore();
  }

  getNodeColor(type: string): string {
    switch (type) {
      case 'Person': return '#ff7f0e';
      case 'Place':  return '#2ca02c';
      case 'Event':  return '#d62728';
      case 'Thing':  return '#1f77b4';
      default:       return '#9467bd';
    }
  }

  // Group links by directed node pair (sourceId|targetId)
  private groupLinks(links: SimulationLink[]): Map<string, SimulationLink[]> {
    const groups = new Map<string, SimulationLink[]>();
    for (const link of links) {
      const key = `${link.sourceId}|${link.targetId}`;
      const group = groups.get(key);
      if (group) {
        group.push(link);
      } else {
        groups.set(key, [link]);
      }
    }
    return groups;
  }

  private buildHighlightSets(
    hn: SimulationNode | null,
    he: SimulationLink[] | null,
    links: SimulationLink[]
  ): { highlightNodes: Set<SimulationNode>; highlightEdgeIds: Set<string> } {
    const highlightNodes = new Set<SimulationNode>();
    const highlightEdgeIds = new Set<string>(); // keyed by sourceId|targetId pair

    if (hn) {
      highlightNodes.add(hn);
      for (const link of links) {
        const s = link.source as unknown as SimulationNode;
        const t = link.target as unknown as SimulationNode;
        if (s === hn || t === hn) {
          highlightEdgeIds.add(`${link.sourceId}|${link.targetId}`);
          highlightNodes.add(s);
          highlightNodes.add(t);
        }
      }
    } else if (he && he.length > 0) {
      const first = he[0];
      highlightEdgeIds.add(`${first.sourceId}|${first.targetId}`);
      highlightNodes.add(first.source as unknown as SimulationNode);
      highlightNodes.add(first.target as unknown as SimulationNode);
    }

    return { highlightNodes, highlightEdgeIds };
  }

  private buildConcealedSet(nodes: SimulationNode[], filterText: string): Set<SimulationNode> {
    if (!filterText) return new Set();
    const filter = filterText.toLowerCase();
    return new Set(nodes.filter(n => !this.matchesFilter(n, filter)));
  }

  private matchesFilter(node: SimulationNode, filter: string): boolean {
    if (node.label.toLowerCase().includes(filter)) return true;
    if (node.type.toLowerCase().includes(filter)) return true;
    if (node.description?.toLowerCase().includes(filter)) return true;
    return Object.values(node.attributes ?? {}).some(
      v => v !== null && v !== undefined && String(v).toLowerCase().includes(filter)
    );
  }

  private drawLinks(
    ctx: CanvasRenderingContext2D,
    linkGroups: Map<string, SimulationLink[]>,
    concealedNodes: Set<SimulationNode>,
    highlightEdgeIds: Set<string>,
    isHighlightMode: boolean,
    hoveredGroup: SimulationLink[] | null
  ): void {
    const hoveredKey = hoveredGroup && hoveredGroup.length > 0
      ? `${hoveredGroup[0].sourceId}|${hoveredGroup[0].targetId}`
      : null;

    ctx.lineCap = 'round';
    for (const [key, group] of linkGroups) {
      const representative = group[0];
      const source = representative.source as unknown as SimulationNode;
      const target = representative.target as unknown as SimulationNode;

      if (concealedNodes.has(source) || concealedNodes.has(target)) continue;
      if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) continue;

      const isHovered = key === hoveredKey;
      const isHighlighted = highlightEdgeIds.has(key);
      ctx.globalAlpha = isHighlightMode && !isHighlighted ? 0.1 : 1.0;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      if (isHovered) {
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2 + group.length + 2; // slightly thicker on hover
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 4;
      } else {
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1 + group.length; // 2 for single edge, 3 for two, etc.
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
    }
  }

  private drawNodes(
    ctx: CanvasRenderingContext2D,
    nodes: SimulationNode[],
    concealedNodes: Set<SimulationNode>,
    highlightNodes: Set<SimulationNode>,
    isHighlightMode: boolean,
    hoveredNode: SimulationNode | null,
    showLabels: boolean,
    selectedNodeId: string | null,
    multiSelectedIds: Set<string>
  ): void {
    for (const node of nodes) {
      if (node.x === undefined || node.y === undefined) continue;
      if (concealedNodes.has(node)) continue;

      const isHovered = hoveredNode === node;
      const isSelected = node.id === selectedNodeId;
      const isMultiSelected = multiSelectedIds.has(node.id);
      const isHighlighted = highlightNodes.has(node);
      ctx.globalAlpha = isHighlightMode && !isHighlighted ? 0.1 : 1.0;

      // Multi-select ring — dashed blue
      if (isMultiSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 27, 0, 2 * Math.PI);
        ctx.strokeStyle = '#4a90d9';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 3]);
        ctx.shadowColor = 'rgba(74,144,217,0.4)';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // Single-selection ring — solid amber
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 26, 0, 2 * Math.PI);
        ctx.strokeStyle = '#f5a623';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(245,166,35,0.5)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);

      if (isHovered) {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = d3.color(this.getNodeColor(node.type))?.brighter(0.5).toString() ?? this.getNodeColor(node.type);
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillStyle = this.getNodeColor(node.type);
      }
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;

      if (showLabels || isHighlighted || isSelected) {
        ctx.globalAlpha = isHighlightMode && !isHighlighted ? 0.1 : 1.0;
        ctx.fillStyle = isSelected ? '#b37700' : '#000';
        ctx.font = isSelected ? 'bold 12px sans-serif' : '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y + 35);
        ctx.globalAlpha = 1.0;
      }
    }
  }
}
