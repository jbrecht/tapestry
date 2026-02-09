import { Component, inject, ChangeDetectionStrategy, viewChild, ElementRef, effect } from '@angular/core';
import { TapestryEdge, TapestryNode, TapestryStore } from '../store/tapestry.store';
import { PerspectiveType } from '../store/tapestry.store';

@Component({
  selector: 'app-tapestry-canvas',
  standalone: true,
  templateUrl: './tapestry-canvas.component.html',
  styleUrl: './tapestry-canvas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TapestryCanvasComponent {
private store = inject(TapestryStore);
  private canvasElement = viewChild<ElementRef>('graphCanvas');

  constructor() {
    effect(() => {
      const nodes = this.store.nodes();
      const edges = this.store.edges();
      const perspective = this.store.activePerspective();

      // Trigger the "Morph" animation based on the perspective
      this.renderGraph(nodes, edges, perspective);
    });
  }

  private renderGraph(nodes: TapestryNode[], edges: TapestryEdge[], type: PerspectiveType) {
    if (type === 'timeline') {
      // Use D3 to transition nodes to a linear X-axis
    } else if (type === 'map') {
      // Cross-fade to a map background and snap pins to coordinates
    } else {
      // Standard Force-Directed Graph
    }
  }
}
