import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TapestryStore } from '../../store/tapestry.store';

@Component({
  selector: 'app-tapestry-stats',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="stats-row">
      <div class="stat-item" title="Nodes">
        <mat-icon>hub</mat-icon>
        <span>{{ store.nodes().length }}</span>
      </div>
      <div class="stat-item" title="Edges">
        <mat-icon>polyline</mat-icon>
        <span>{{ store.edges().length }}</span>
      </div>
      <div class="stat-item" title="Messages">
        <mat-icon>chat</mat-icon>
        <span>{{ store.messages().length }}</span>
      </div>
    </div>
  `,
  styles: [`
    .stats-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 0 16px;
      color: var(--text-secondary, #666);
      
      .stat-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.85rem;
        
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          opacity: 0.8;
        }
        
        span {
          font-weight: 500;
        }
      }
    }
  `]
})
export class TapestryStatsComponent {
  store = inject(TapestryStore);
}
