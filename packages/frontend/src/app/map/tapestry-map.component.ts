import { Component, inject, ChangeDetectionStrategy, viewChild, ElementRef, effect, OnDestroy, AfterViewInit } from '@angular/core';
import { TapestryNode, TapestryStore } from '../store/tapestry.store';
import * as L from 'leaflet';

const COLORS: Record<string, string> = {
  Person: '#ff7f0e',
  Event:  '#d62728',
  Place:  '#2ca02c',
  Thing:  '#1f77b4',
};

function makeIcon(color: string, selected: boolean): L.DivIcon {
  const size = selected ? 18 : 14;
  const border = selected ? `3px solid #f5a623` : `2px solid #fff`;
  const shadow = selected ? `0 0 0 2px rgba(245,166,35,0.4), 0 2px 6px rgba(0,0,0,0.35)` : `0 2px 4px rgba(0,0,0,0.3)`;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${color};
      border:${border};
      box-shadow:${shadow};
      box-sizing:border-box;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

@Component({
  selector: 'app-tapestry-map',
  standalone: true,
  templateUrl: './tapestry-map.component.html',
  styleUrl: './tapestry-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TapestryMapComponent implements AfterViewInit, OnDestroy {
  private store = inject(TapestryStore);
  private mapRef = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  private map: L.Map | null = null;
  // nodeId -> marker
  private markers = new Map<string, L.Marker>();

  constructor() {
    effect(() => {
      const nodes = this.store.mapNodes();
      if (this.map) this.syncMarkers(nodes);
    });

    effect(() => {
      const selectedId = this.store.selectedNodeId();
      if (this.map) this.updateSelectedMarker(selectedId);
    });
  }

  ngAfterViewInit() {
    const el = this.mapRef()?.nativeElement;
    if (!el) return;

    this.map = L.map(el, { zoomControl: true }).setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    this.syncMarkers(this.store.mapNodes());
  }

  ngOnDestroy() {
    this.map?.remove();
    this.map = null;
  }

  private syncMarkers(nodes: TapestryNode[]) {
    if (!this.map) return;
    const selectedId = this.store.selectedNodeId();
    const incomingIds = new Set(nodes.map(n => n.id));

    // Remove stale markers
    for (const [id, marker] of this.markers) {
      if (!incomingIds.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }

    // Add or update markers
    for (const node of nodes) {
      const { x: lng, y: lat } = node.attributes['coordinates'] as { x: number; y: number };
      if (lat == null || lng == null) continue;

      const color = COLORS[node.type] ?? COLORS['Thing'];
      const isSelected = node.id === selectedId;

      if (this.markers.has(node.id)) {
        const marker = this.markers.get(node.id)!;
        marker.setLatLng([lat, lng]);
        marker.setIcon(makeIcon(color, isSelected));
        marker.getPopup()?.setContent(this.popupContent(node));
      } else {
        const marker = L.marker([lat, lng], { icon: makeIcon(color, isSelected) })
          .bindPopup(this.popupContent(node), { maxWidth: 240, closeButton: false })
          .on('click', () => {
            const currentId = this.store.selectedNodeId();
            this.store.selectNode(node.id === currentId ? null : node.id);
          });
        marker.addTo(this.map!);
        this.markers.set(node.id, marker);
      }
    }

    // Fit bounds if we have markers and no prior view set
    if (nodes.length > 0 && this.markers.size > 0) {
      const validLatLngs = nodes
        .map(n => n.attributes['coordinates'] as { x: number; y: number } | null)
        .filter(c => c != null)
        .map(c => [c!.y, c!.x] as L.LatLngTuple);
      if (validLatLngs.length > 0) {
        this.map.fitBounds(validLatLngs, { padding: [40, 40], maxZoom: 10 });
      }
    }
  }

  private updateSelectedMarker(selectedId: string | null) {
    for (const [id, marker] of this.markers) {
      const node = this.store.nodes().find(n => n.id === id);
      if (!node) continue;
      const color = COLORS[node.type] ?? COLORS['Thing'];
      marker.setIcon(makeIcon(color, id === selectedId));
    }

    // Pan to selected node
    if (selectedId) {
      const node = this.store.nodes().find(n => n.id === selectedId);
      if (node?.attributes['coordinates']) {
        const { x: lng, y: lat } = node.attributes['coordinates'] as { x: number; y: number };
        this.map?.panTo([lat, lng], { animate: true });
      }
    }
  }

  private popupContent(node: TapestryNode): string {
    const color = COLORS[node.type] ?? COLORS['Thing'];
    const desc = node.description ? `<div class="pm-desc">${node.description}</div>` : '';
    const loc = node.attributes['locationType']
      ? `<div class="pm-loc">${node.attributes['locationType']}</div>` : '';
    return `
      <div class="pm-wrap">
        <div class="pm-header">
          <span class="pm-badge" style="background:${color}">${node.type}</span>
          <span class="pm-label">${node.label}</span>
        </div>
        ${loc}${desc}
      </div>`;
  }
}
