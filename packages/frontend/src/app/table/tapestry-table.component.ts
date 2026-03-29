import { Component, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { TapestryNode, TapestryStore } from '../store/tapestry.store';
import { attrLabel } from '../utils/attr-label';

const SKIP_ATTRS = new Set(['coordinates', '_geocodeFailed']);

function matchesFilter(node: TapestryNode, filter: string): boolean {
  if (node.label.toLowerCase().includes(filter)) return true;
  if (node.type.toLowerCase().includes(filter)) return true;
  if (node.description?.toLowerCase().includes(filter)) return true;
  return Object.values(node.attributes ?? {}).some(
    v => v !== null && v !== undefined && String(v).toLowerCase().includes(filter)
  );
}

@Component({
  selector: 'app-tapestry-table',
  standalone: true,
  templateUrl: './tapestry-table.component.html',
  styleUrl: './tapestry-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TapestryTableComponent {
  protected store = inject(TapestryStore);

  private expandedIds = signal<Set<string>>(new Set());

  protected filteredNodes = computed(() => {
    const filter = this.store.filterText().toLowerCase();
    const nodes = this.store.nodes();
    return filter ? nodes.filter(n => matchesFilter(n, filter)) : nodes;
  });

  protected visibleAttrs(node: TapestryNode) {
    return Object.entries(node.attributes)
      .filter(([key, value]) =>
        !SKIP_ATTRS.has(key) &&
        !key.startsWith('_') &&
        value !== null &&
        value !== undefined &&
        value !== ''
      )
      .map(([key, value]) => ({ label: attrLabel(key), value: String(value) }));
  }

  protected connectionsFor(node: TapestryNode) {
    const nodeMap = new Map(this.store.nodes().map(n => [n.id, n]));
    const result: { edgeId: string; direction: 'out' | 'in'; otherId: string; otherLabel: string; predicate: string }[] = [];
    for (const edge of this.store.edges()) {
      if (edge.sourceId === node.id) {
        const other = nodeMap.get(edge.targetId);
        if (other) result.push({ edgeId: edge.id, direction: 'out', otherId: other.id, otherLabel: other.label, predicate: edge.predicate });
      } else if (edge.targetId === node.id) {
        const other = nodeMap.get(edge.sourceId);
        if (other) result.push({ edgeId: edge.id, direction: 'in', otherId: other.id, otherLabel: other.label, predicate: edge.predicate });
      }
    }
    return result;
  }

  protected isExpanded(id: string) {
    return this.expandedIds().has(id);
  }

  protected toggle(id: string) {
    this.expandedIds.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  protected selectNode(id: string) {
    this.store.selectNode(id);
  }
}
