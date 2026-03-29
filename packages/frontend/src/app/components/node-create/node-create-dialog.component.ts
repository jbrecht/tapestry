import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-node-create-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Add Node</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Label</mat-label>
        <input matInput [(ngModel)]="label" placeholder="e.g. Julius Caesar" (keydown.enter)="submit()" autofocus />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Type</mat-label>
        <mat-select [(ngModel)]="type">
          <mat-option value="Person">Person</mat-option>
          <mat-option value="Place">Place</mat-option>
          <mat-option value="Event">Event</mat-option>
          <mat-option value="Thing">Thing</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Description (optional)</mat-label>
        <textarea matInput [(ngModel)]="description" rows="3" placeholder="Brief description…"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!label.trim()" (click)="submit()">Add</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; min-width: 340px; }
    .full-width { width: 100%; }
  `]
})
export class NodeCreateDialogComponent {
  label = '';
  type: 'Person' | 'Place' | 'Event' | 'Thing' = 'Thing';
  description = '';

  private dialogRef = inject(MatDialogRef<NodeCreateDialogComponent>);

  submit() {
    if (!this.label.trim()) return;
    this.dialogRef.close({
      label: this.label.trim(),
      type: this.type,
      description: this.description.trim() || null,
      attributes: {},
    });
  }
}
