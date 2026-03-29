import { Component, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { TapestryNode, TapestryStore } from '../../store/tapestry.store';
import { attrLabel } from '../../utils/attr-label';

interface Connection {
  edgeId: string;
  direction: 'out' | 'in';
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  predicate: string;
}

interface AttrEntry {
  key: string;
  label: string;
  value: string;
}

const SKIP_ATTRS = new Set(['coordinates']);

@Component({
  selector: 'app-node-detail-panel',
  standalone: true,
  templateUrl: './node-detail-panel.component.html',
  styleUrl: './node-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.open]': '!!store.selectedNodeId()' },
})
export class NodeDetailPanelComponent {
  protected store = inject(TapestryStore);

  protected selectedNode = computed(() => {
    const id = this.store.selectedNodeId();
    return id ? (this.store.nodes().find(n => n.id === id) ?? null) : null;
  });

  protected visibleAttributes = computed((): AttrEntry[] => {
    const node = this.selectedNode();
    if (!node) return [];
    return Object.entries(node.attributes)
      .filter(([key, value]) =>
        !SKIP_ATTRS.has(key) && !key.startsWith('_') && value !== null && value !== undefined && value !== ''
      )
      .map(([key, value]) => ({
        key,
        label: attrLabel(key),
        value: String(value),
      }));
  });

  protected connections = computed((): Connection[] => {
    const node = this.selectedNode();
    if (!node) return [];
    const nodeMap = new Map(this.store.nodes().map(n => [n.id, n]));
    const result: Connection[] = [];

    for (const edge of this.store.edges()) {
      if (edge.sourceId === node.id) {
        const target = nodeMap.get(edge.targetId);
        if (target) result.push({
          edgeId: edge.id, direction: 'out',
          nodeId: target.id, nodeLabel: target.label, nodeType: target.type,
          predicate: edge.predicate,
        });
      } else if (edge.targetId === node.id) {
        const source = nodeMap.get(edge.sourceId);
        if (source) result.push({
          edgeId: edge.id, direction: 'in',
          nodeId: source.id, nodeLabel: source.label, nodeType: source.type,
          predicate: edge.predicate,
        });
      }
    }

    return result;
  });

  protected confirmingDelete = signal(false);
  protected confirmingDeleteEdgeId = signal<string | null>(null);

  protected startPinning(nodeId: string) {
    this.store.setPinningNode(nodeId);
    this.store.setPerspective('map');
  }

  protected close() {
    this.store.selectNode(null);
    this.confirmingDelete.set(false);
    this.confirmingDeleteEdgeId.set(null);
  }

  protected deleteNode() {
    const node = this.selectedNode();
    if (node) this.store.deleteNode(node.id);
    // selectedNodeId is cleared by the store, panel closes automatically
  }

  protected deleteEdge(edgeId: string) {
    this.store.deleteEdge(edgeId);
    this.confirmingDeleteEdgeId.set(null);
  }

  protected updateType(event: Event) {
    const value = (event.target as HTMLSelectElement).value as TapestryNode['type'];
    const node = this.selectedNode();
    if (node && value !== node.type) this.store.updateNode(node.id, { type: value });
  }

  protected updateLabel(event: Event) {
    const value = (event.target as HTMLInputElement).value.trim();
    const node = this.selectedNode();
    if (node && value && value !== node.label) {
      this.store.updateNode(node.id, { label: value });
    }
  }

  protected updateDescription(event: Event) {
    const value = (event.target as HTMLTextAreaElement).value.trim() || null;
    const node = this.selectedNode();
    if (node) this.store.updateNode(node.id, { description: value });
  }

  protected updateAttribute(key: string, event: Event) {
    const value = (event.target as HTMLInputElement).value.trim();
    const node = this.selectedNode();
    if (node) {
      this.store.updateNode(node.id, {
        attributes: { ...node.attributes, [key]: value || null },
      });
    }
  }

  protected selectConnection(nodeId: string) {
    this.store.selectNode(nodeId);
  }
}
