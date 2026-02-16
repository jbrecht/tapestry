import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TapestryStore } from '../../store/tapestry.store';

import { MatDialog } from '@angular/material/dialog';
import { ProjectDeleteDialogComponent } from './project-delete-dialog.component';

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatListModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule
  ],
  templateUrl: './project.component.html',
  styleUrl: './project.component.scss'
})
export class ProjectComponent {
  store = inject(TapestryStore);
  dialog = inject(MatDialog);
  newProjectName = signal('');

  startProject() {
    if (this.newProjectName().trim()) {
      this.store.startNewProject(this.newProjectName().trim());
      this.newProjectName.set('');
    }
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
