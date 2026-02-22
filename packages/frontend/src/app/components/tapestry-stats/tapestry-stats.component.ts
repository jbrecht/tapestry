import { Component, inject } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { TapestryStore } from '../../store/tapestry.store';

@Component({
  selector: 'app-tapestry-stats',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './tapestry-stats.component.html',
  styleUrl: './tapestry-stats.component.scss'
})
export class TapestryStatsComponent {
  store = inject(TapestryStore);
}
