import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-project-create-dialog',
  standalone: true,
  imports: [
    CommonModule,
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
  projectName = signal('');
  // We can inject MatDialogRef if we need to close it programmatically (like in enter key), 
  // but template reference is easier for simple cases. 
  // However, for (keyup.enter) to work with the close method, I'll need to inject it or use the template directive.
  // Let's inject it for cleaner controller logic if needed, or just use the directive in template.
  // Actually, to use `dialogRef.close()` in template, I need it public.
  
  constructor(public dialogRef: MatDialogRef<ProjectCreateDialogComponent>) {}
}
