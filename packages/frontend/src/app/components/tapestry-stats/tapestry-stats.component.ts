import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TapestryStore } from '../../store/tapestry.store';

@Component({
  selector: 'app-tapestry-stats',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './tapestry-stats.component.html',
  styleUrl: './tapestry-stats.component.scss'
})
export class TapestryStatsComponent {
  store = inject(TapestryStore);
}
