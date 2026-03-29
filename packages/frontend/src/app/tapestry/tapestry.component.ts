import { Component, ChangeDetectionStrategy, inject, effect, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { TapestryStore } from '../store/tapestry.store';
import { ProjectCreateDialogComponent } from '../components/project/project-create-dialog.component';
import { ChatComponent } from '../chat/chat.component';
import { TapestryCanvasComponent } from '../canvas/tapestry-canvas.component';
import { TapestryTimelineComponent } from '../timeline/tapestry-timeline.component';
import { TapestryMapComponent } from '../map/tapestry-map.component';
import { TapestryTableComponent } from '../table/tapestry-table.component';
import { ProjectComponent } from '../components/project/project.component';
import { PerspectiveSwitcherComponent } from '../components/perspective-switcher/perspective-switcher.component';
import { UserMenuComponent } from '../components/user-menu.component';
import { NodeDetailPanelComponent } from '../components/node-detail/node-detail-panel.component';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  selector: 'app-tapestry',
  standalone: true,
  imports: [ChatComponent, TapestryCanvasComponent, TapestryTimelineComponent, TapestryMapComponent, TapestryTableComponent, MatSidenavModule, ProjectComponent, PerspectiveSwitcherComponent, UserMenuComponent, NodeDetailPanelComponent],
  templateUrl: './tapestry.component.html',
  styleUrl: './tapestry.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TapestryComponent implements OnDestroy {
  store = inject(TapestryStore);
  dialog = inject(MatDialog);
  private document = inject(DOCUMENT);
  private keydownListener = (e: KeyboardEvent) => this.onKeyDown(e);

  constructor() {
    effect(() => {
      if (this.store.isInitialEmpty()) {
        const dialogRef = this.dialog.open(ProjectCreateDialogComponent, {
          width: '400px',
          disableClose: true,
          data: { title: 'Name your first Tapestry Project' }
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result) {
            this.store.startNewProject(result);
          }
        });
      }
    });

    this.document.addEventListener('keydown', this.keydownListener);
  }

  ngOnDestroy() {
    this.document.removeEventListener('keydown', this.keydownListener);
  }

  private onKeyDown(event: KeyboardEvent) {
    const tag = (this.document.activeElement as HTMLElement)?.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';
    const ctrlOrCmd = event.metaKey || event.ctrlKey;

    if (event.key === 'Escape') {
      this.store.setPinningNode(null);
      this.store.selectNode(null);
    } else if (!isTyping && ctrlOrCmd && event.shiftKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      this.store.redo();
    } else if (!isTyping && ctrlOrCmd && !event.shiftKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      this.store.undo();
    }
  }

  exportJson() {
    const data = { nodes: this.store.nodes(), edges: this.store.edges() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = this.document.createElement('a');
    a.href = url;
    a.download = `${this.store.projectName().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJson(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const nodes = Array.isArray(data.nodes) ? data.nodes : [];
        const edges = Array.isArray(data.edges) ? data.edges : [];
        if (nodes.length === 0 && edges.length === 0) return;

        // Merge: existing IDs win; incoming nodes/edges with new IDs are added
        const existingNodeIds = new Set(this.store.nodes().map((n: any) => n.id));
        const existingEdgeIds = new Set(this.store.edges().map((e: any) => e.id));
        const newNodes = [...this.store.nodes(), ...nodes.filter((n: any) => !existingNodeIds.has(n.id))];
        const newEdges = [...this.store.edges(), ...edges.filter((e: any) => !existingEdgeIds.has(e.id))];
        this.store.updateGraph(newNodes, newEdges);
      } catch {
        // silently ignore malformed files
      }
      // Reset so the same file can be re-imported if needed
      (event.target as HTMLInputElement).value = '';
    };
    reader.readAsText(file);
  }
}
