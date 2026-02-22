import { Component, signal, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-project-create-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule
],
  templateUrl: './project-create-dialog.component.html',
  styleUrl: './project-create-dialog.component.scss'
})
export class ProjectCreateDialogComponent {
  dialogRef = inject<MatDialogRef<ProjectCreateDialogComponent>>(MatDialogRef);

  projectName = signal('');
}
