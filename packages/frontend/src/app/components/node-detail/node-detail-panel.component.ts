import { Component, inject, computed, signal, effect, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
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
  private cdr = inject(ChangeDetectorRef);

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

  // ── Draft ──────────────────────────────────────────────────────────────────

  protected isDraft = computed(() => !!this.selectedNode()?.attributes['_isDraft']);

  protected canSave = computed(() => {
    const node = this.selectedNode();
    return !!node && node.label.trim().length > 0 && node.label !== 'New Node';
  });

  protected saveDraft() {
    const node = this.selectedNode();
    if (!node) return;
    const { _isDraft, ...cleanAttrs } = node.attributes;
    this.store.updateNode(node.id, { attributes: cleanAttrs });
  }

  protected discardDraft() {
    const node = this.selectedNode();
    if (node) this.store.deleteNode(node.id);
  }

  // ── Geocode ────────────────────────────────────────────────────────────────

  protected geocodeStatus = signal<'idle' | 'loading' | 'success' | 'not-found'>('idle');

  @ViewChild('labelInput') private labelInputRef?: ElementRef<HTMLInputElement>;

  constructor() {
    effect(() => {
      this.store.selectedNodeId();
      this.geocodeStatus.set('idle');
      this.addingConnection.set(false);
      this.newConnDirection.set('out');
      this.confirmingDelete.set(false);
      this.confirmingDeleteEdgeId.set(null);

      if (this.selectedNode()?.attributes['_isDraft']) {
        setTimeout(() => {
          this.labelInputRef?.nativeElement.focus();
          this.labelInputRef?.nativeElement.select();
        });
      }
    });
  }

  protected async runGeocode(inputValue: string) {
    const node = this.selectedNode();
    if (!node) return;
    const query = inputValue.trim() || node.label;
    this.geocodeStatus.set('loading');
    this.cdr.markForCheck();

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Tapestry/1.0 (knowledge graph application)' } });
      const data = await res.json() as Array<{ lat: string; lon: string }>;

      if (data.length > 0) {
        const coords = { x: parseFloat(data[0].lon), y: parseFloat(data[0].lat) };
        const { _geocodeFailed, ...cleanAttrs } = node.attributes;
        this.store.updateNode(node.id, { attributes: { ...cleanAttrs, coordinates: coords } });
        this.geocodeStatus.set('success');
      } else {
        this.geocodeStatus.set('not-found');
      }
    } catch {
      this.geocodeStatus.set('not-found');
    }
    this.cdr.markForCheck();
  }

  // ── General ────────────────────────────────────────────────────────────────

  protected otherNodes = computed(() => {
    const id = this.store.selectedNodeId();
    return this.store.nodes()
      .filter(n => n.id !== id)
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  protected addingConnection = signal(false);
  protected newConnDirection = signal<'out' | 'in'>('out');

  protected submitConnection(targetNodeId: string, predicate: string) {
    const node = this.selectedNode();
    if (!node || !targetNodeId || !predicate.trim()) return;
    const normalised = predicate.trim().toUpperCase().replace(/\s+/g, '_');
    this.store.addEdge(
      this.newConnDirection() === 'out'
        ? { sourceId: node.id, targetId: targetNodeId, predicate: normalised }
        : { sourceId: targetNodeId, targetId: node.id, predicate: normalised }
    );
    this.addingConnection.set(false);
    this.newConnDirection.set('out');
  }

  protected confirmingDelete = signal(false);
  protected confirmingDeleteEdgeId = signal<string | null>(null);
  protected editingEdgeId = signal<string | null>(null);

  protected startEditEdge(edgeId: string) {
    this.confirmingDeleteEdgeId.set(null);
    this.editingEdgeId.set(edgeId);
  }

  protected saveEdgePredicate(edgeId: string, value: string) {
    const normalised = value.trim().toUpperCase().replace(/\s+/g, '_');
    if (normalised) this.store.updateEdge(edgeId, normalised);
    this.editingEdgeId.set(null);
  }

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
