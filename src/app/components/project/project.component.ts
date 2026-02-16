import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { TapestryStore } from '../../store/tapestry.store';

import { MatDialog } from '@angular/material/dialog';
import { ProjectDeleteDialogComponent } from './project-delete-dialog.component';
import { ProjectCreateDialogComponent } from './project-create-dialog.component';

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [
    CommonModule, 
    MatMenuModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule
  ],
  templateUrl: './project.component.html',
  styleUrl: './project.component.scss'
})
export class ProjectComponent {
  store = inject(TapestryStore);
  dialog = inject(MatDialog);

  openCreateDialog() {
    const dialogRef = this.dialog.open(ProjectCreateDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.store.startNewProject(result);
      }
    });
  }

  onSwitchProject(id: string) {
    if (id && id !== this.store.projectId()) {
      this.store.switchProject(id);
    }
  }

  onDeleteProject() {
    const projectId = this.store.projectId();
    if (projectId) {
      const dialogRef = this.dialog.open(ProjectDeleteDialogComponent);

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.store.deleteProject(projectId);
        }
      });
    }
  }
}
