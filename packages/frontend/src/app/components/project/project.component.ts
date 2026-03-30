import { Component, inject } from '@angular/core';

import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { TapestryStore } from '../../store/tapestry.store';
import { ProjectService } from '../../services/project.service';

import { MatDialog } from '@angular/material/dialog';
import { ProjectDeleteDialogComponent } from './project-delete-dialog.component';
import { ProjectCreateDialogComponent } from './project-create-dialog.component';
import { ProjectEditDialogComponent, ProjectEditDialogData } from './project-edit-dialog.component';

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [
    MatMenuModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    ProjectEditDialogComponent
],
  templateUrl: './project.component.html',
  styleUrl: './project.component.scss'
})
export class ProjectComponent {
  store = inject(TapestryStore);
  dialog = inject(MatDialog);
  private projectService = inject(ProjectService);

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

  openEditDialog() {
    const dialogRef = this.dialog.open(ProjectEditDialogComponent, {
      width: '440px',
      data: {
        name: this.store.projectName(),
        description: this.store.projectDescription(),
        createdAt: this.store.projectCreatedAt(),
        updatedAt: this.store.projectUpdatedAt(),
        nodeCount: this.store.nodes().length,
        edgeCount: this.store.edges().length,
        messageCount: this.store.messages().length,
      } satisfies ProjectEditDialogData,
    });

    dialogRef.afterClosed().subscribe((result: { name: string; description: string } | undefined) => {
      if (result) {
        this.store.updateProjectMeta(result.name, result.description);
      }
    });
  }

  onDuplicateProject() {
    const projectId = this.store.projectId();
    if (!projectId) return;
    this.projectService.duplicateProject(projectId).subscribe({
      next: (project) => {
        this.store.loadProjectList();
        this.store.switchProject(project.id);
      },
      error: (err) => console.error('Duplicate failed', err),
    });
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
