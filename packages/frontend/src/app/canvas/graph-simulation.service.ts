import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { TapestryNode, TapestryEdge } from '../store/tapestry.store';

export interface SimulationNode extends d3.SimulationNodeDatum, TapestryNode {}
export interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode>, TapestryEdge {}

const NODE_RADIUS = 20;
const EDGE_HIT_TOLERANCE = 5;

@Injectable()
export class GraphSimulationService {
  private sim: d3.Simulation<SimulationNode, SimulationLink> | null = null;

  nodes: SimulationNode[] = [];
  links: SimulationLink[] = [];

  get isInitialized(): boolean {
    return this.sim !== null;
  }

  initialize(width: number, height: number, onTick: () => void): void {
    this.sim = d3.forceSimulation<SimulationNode, SimulationLink>(this.nodes)
      .force('link', d3.forceLink<SimulationNode, SimulationLink>(this.links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-900))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))
      .force('collide', d3.forceCollide().radius(50))
      .on('tick', onTick);
  }

  update(storeNodes: TapestryNode[], storeEdges: TapestryEdge[]): void {
    const oldNodes = new Map(this.nodes.map(n => [n.id, n]));

    this.nodes = storeNodes.map(node => {
      const existing = oldNodes.get(node.id);
      return existing ? Object.assign(existing, node) : { ...node } as SimulationNode;
    });

    const nodeIds = new Set(this.nodes.map(n => n.id));
    this.links = storeEdges
      .filter(e => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
      .map(e => ({ ...e, source: e.sourceId, target: e.targetId } as SimulationLink));

    if (!this.sim) return;
    this.sim.nodes(this.nodes);
    (this.sim.force('link') as d3.ForceLink<SimulationNode, SimulationLink>).links(this.links);
    this.sim.alpha(1).restart();
  }

  updateForces(density: number): void {
    if (!this.sim) return;
    const chargeStrength = -1500 + (density * 12);
    const linkDistance = 150 - density;
    this.sim.force('charge', d3.forceManyBody().strength(chargeStrength));
    const linkForce = this.sim.force('link') as d3.ForceLink<SimulationNode, SimulationLink>;
    if (linkForce) linkForce.distance(linkDistance);
    this.sim.alpha(1).restart();
  }

  updateSize(width: number, height: number): void {
    if (!this.sim) return;
    this.sim.force('x', d3.forceX(width / 2).strength(0.05));
    this.sim.force('y', d3.forceY(height / 2).strength(0.05));
    this.sim.alpha(1).restart();
  }

  findNodeAt(worldX: number, worldY: number): SimulationNode | undefined {
    return this.sim?.nodes().find(n => {
      if (n.x === undefined || n.y === undefined) return false;
      const dx = worldX - n.x;
      const dy = worldY - n.y;
      return (dx * dx + dy * dy) < (NODE_RADIUS * NODE_RADIUS);
    });
  }

  findEdgeAt(worldX: number, worldY: number): SimulationLink | undefined {
    return (this.sim?.force<d3.ForceLink<SimulationNode, SimulationLink>>('link'))
      ?.links()
      .find(l => {
        const source = l.source as unknown as SimulationNode;
        const target = l.target as unknown as SimulationNode;
        if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return false;
        return isPointNearLine(worldX, worldY, source.x, source.y, target.x, target.y, EDGE_HIT_TOLERANCE);
      });
  }

  startDrag(): void {
    this.sim?.alphaTarget(0.3).restart();
  }

  endDrag(): void {
    this.sim?.alphaTarget(0);
  }

  destroy(): void {
    this.sim?.stop();
    this.sim = null;
  }
}

function isPointNearLine(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
  tolerance: number
): boolean {
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  const lenSq = C * C + D * D;
  const param = lenSq !== 0 ? (A * C + B * D) / lenSq : -1;
  const xx = param < 0 ? x1 : param > 1 ? x2 : x1 + param * C;
  const yy = param < 0 ? y1 : param > 1 ? y2 : y1 + param * D;
  const dx = px - xx, dy = py - yy;
  return (dx * dx + dy * dy) < (tolerance * tolerance);
}
