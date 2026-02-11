import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TapestryStore } from '../../store/tapestry.store';

@Component({
  selector: 'app-perspective-switcher',
  standalone: true,
  imports: [FormsModule, MatButtonToggleModule],
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
    this.store.setPerspective(id);
  }
}
