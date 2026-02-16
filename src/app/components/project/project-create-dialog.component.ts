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
  template: `
    <h2 mat-dialog-title>New Project</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Project Name</mat-label>
        <input matInput 
               type="text" 
               [ngModel]="projectName()" 
               (ngModelChange)="projectName.set($event)"
               (keyup.enter)="projectName().trim() && dialogRef.close(projectName().trim())"
               autoFocus>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-button color="primary" 
              [mat-dialog-close]="projectName().trim()" 
              [disabled]="!projectName().trim()">
        Create
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
    }
    mat-dialog-content {
      min-width: 300px;
      padding-top: 10px; /* spacing for outline field */
    }
  `]
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
