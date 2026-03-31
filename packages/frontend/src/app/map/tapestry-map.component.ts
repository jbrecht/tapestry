import { Component, inject, ChangeDetectionStrategy, viewChild, ElementRef, effect, untracked, OnDestroy, AfterViewInit, signal } from '@angular/core';
import { TapestryNode, TapestryStore } from '../store/tapestry.store';
import * as L from 'leaflet';
import 'leaflet.markercluster';

const COLORS: Record<string, string> = {
  Person: '#ff7f0e',
  Event:  '#d62728',
  Place:  '#2ca02c',
  Thing:  '#1f77b4',
};

const NODE_TYPES = ['Person', 'Place', 'Thing', 'Event'] as const;

interface TileProvider {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

const TILE_PROVIDERS: TileProvider[] = [
  {
    id: 'osm',
    name: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  {
    id: 'natgeo',
    name: 'NatGeo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — National Geographic, Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
  },
  {
    id: 'satellite',
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Esri, Maxar, GeoEye, Earthstar Geographics',
    maxZoom: 19,
  },
  {
    id: 'topo',
    name: 'Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Style: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17,
  },
  {
    id: 'dark',
    name: 'Dark',
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 20,
  },
];

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
  protected store = inject(TapestryStore);
  private mapRef = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private clusterGroup: L.MarkerClusterGroup | null = null; // leaflet.markercluster augments L namespace
  private markers = new Map<string, L.Marker>();
  private initialBoundsSet = false;

  protected readonly providers = TILE_PROVIDERS;
  protected readonly nodeTypes = NODE_TYPES;
  protected activeProviderId = signal<string>('osm');
  protected hiddenTypes = signal<Set<string>>(new Set());

  constructor() {
    effect(() => {
      const nodes = this.store.mapNodes();
      const hidden = this.hiddenTypes();
      if (this.map) this.syncMarkers(nodes.filter(n => !hidden.has(n.type)));
    });

    effect(() => {
      const selectedId = this.store.selectedNodeId();
      if (this.map) this.updateSelectedMarker(selectedId);
    });

    effect(() => {
      const pinningId = this.store.pinningNodeId();
      if (this.map) {
        this.map.getContainer().style.cursor = pinningId ? 'crosshair' : '';
      }
    });
  }

  ngAfterViewInit() {
    const el = this.mapRef()?.nativeElement;
    if (!el) return;

    this.map = L.map(el, { zoomControl: true }).setView([20, 0], 2);
    this.applyTileProvider('osm');

    this.clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });
    this.map.addLayer(this.clusterGroup);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const pinningId = this.store.pinningNodeId();
      if (!pinningId) return;
      const node = this.store.nodes().find(n => n.id === pinningId);
      if (!node) return;
      this.store.updateNode(pinningId, {
        attributes: { ...node.attributes, coordinates: { x: e.latlng.lng, y: e.latlng.lat } },
      });
      this.store.setPinningNode(null);
    });

    const hidden = this.hiddenTypes();
    this.syncMarkers(this.store.mapNodes().filter(n => !hidden.has(n.type)));
  }

  ngOnDestroy() {
    this.map?.remove();
    this.map = null;
  }

  private syncMarkers(nodes: TapestryNode[]) {
    if (!this.map || !this.clusterGroup) return;
    const selectedId = untracked(() => this.store.selectedNodeId());
    const incomingIds = new Set(nodes.map(n => n.id));

    // Remove stale markers
    for (const [id, marker] of this.markers) {
      if (!incomingIds.has(id)) {
        this.clusterGroup.removeLayer(marker);
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
            if (this.store.pinningNodeId()) return;
            const currentId = this.store.selectedNodeId();
            this.store.selectNode(node.id === currentId ? null : node.id);
          });
        this.clusterGroup.addLayer(marker);
        this.markers.set(node.id, marker);
      }
    }

    // Fit bounds only on initial load
    if (!this.initialBoundsSet && this.markers.size > 0) {
      const validLatLngs = nodes
        .map(n => n.attributes['coordinates'] as { x: number; y: number } | null)
        .filter((c): c is { x: number; y: number } => c != null)
        .map(c => [c.y, c.x] as L.LatLngTuple);
      if (validLatLngs.length > 0) {
        this.map.fitBounds(validLatLngs, { padding: [40, 40], maxZoom: 10 });
        this.initialBoundsSet = true;
      }
    }
  }

  private updateSelectedMarker(selectedId: string | null) {
    const allNodes = untracked(() => this.store.nodes());

    for (const [id, marker] of this.markers) {
      const node = allNodes.find(n => n.id === id);
      if (!node) continue;
      const color = COLORS[node.type] ?? COLORS['Thing'];
      marker.setIcon(makeIcon(color, id === selectedId));
    }

    // Pan to selected node
    if (selectedId) {
      const node = allNodes.find(n => n.id === selectedId);
      if (node?.attributes['coordinates']) {
        const { x: lng, y: lat } = node.attributes['coordinates'] as { x: number; y: number };
        this.map?.panTo([lat, lng], { animate: true });
      }
    }
  }

  private applyTileProvider(id: string): void {
    if (!this.map) return;
    const provider = TILE_PROVIDERS.find(p => p.id === id);
    if (!provider) return;
    if (this.tileLayer) this.tileLayer.remove();
    this.tileLayer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
    }).addTo(this.map);
  }

  protected switchProvider(id: string): void {
    this.activeProviderId.set(id);
    this.applyTileProvider(id);
  }

  protected toggleType(type: string): void {
    this.hiddenTypes.update(set => {
      const next = new Set(set);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  protected typeColor(type: string): string {
    return COLORS[type] ?? COLORS['Thing'];
  }

  protected pinningNodeLabel(id: string): string {
    return this.store.nodes().find(n => n.id === id)?.label ?? '';
  }

  protected fitAll() {
    if (!this.map || this.markers.size === 0) return;
    const latLngs = Array.from(this.markers.values()).map(m => m.getLatLng());
    this.map.fitBounds(latLngs.map(ll => [ll.lat, ll.lng] as L.LatLngTuple), { padding: [40, 40], maxZoom: 10 });
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
