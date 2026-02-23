import { Component, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TapestryStore } from '../store/tapestry.store';
import { ProjectCreateDialogComponent } from '../components/project/project-create-dialog.component';
import { ChatComponent } from '../chat/chat.component';
import { TapestryCanvasComponent } from '../canvas/tapestry-canvas.component';
import { ProjectComponent } from '../components/project/project.component';
import { TapestryStatsComponent } from '../components/tapestry-stats/tapestry-stats.component';
import { UserMenuComponent } from '../components/user-menu.component';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  selector: 'app-tapestry',
  standalone: true,
  imports: [ChatComponent, TapestryCanvasComponent, MatSidenavModule, ProjectComponent, TapestryStatsComponent, UserMenuComponent],
  templateUrl: './tapestry.component.html',
  styleUrl: './tapestry.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TapestryComponent {
  store = inject(TapestryStore);
  dialog = inject(MatDialog);

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
  }
}
