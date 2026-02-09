import { Component, inject } from '@angular/core';
import { TapestryStore } from '../../store/tapestry.store';

@Component({
  selector: 'app-perspective-switcher',
  standalone: true,
  templateUrl: './perspective-switcher.component.html',
  styleUrl: './perspective-switcher.component.scss'
})
export class PerspectiveSwitcherComponent {
  private store = inject(TapestryStore);
  
  currentPerspective = this.store.activePerspective;
  
  perspectives = [
    { id: 'abstract', label: '🕸️ Graph' },
    { id: 'map', label: '🗺️ Map' },
    { id: 'timeline', label: '⏳ Timeline' }
  ];

  setPerspective(id: any) {
    this.store.updatePerspective(id);
  }
}
