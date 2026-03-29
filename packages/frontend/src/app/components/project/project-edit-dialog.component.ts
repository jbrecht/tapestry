import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

export interface ProjectEditDialogData {
  name: string;
  description: string;
  createdAt: string | null;
  updatedAt: string | null;
  nodeCount: number;
  edgeCount: number;
  messageCount: number;
}

@Component({
  selector: 'app-project-edit-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Edit Project</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Name</mat-label>
        <input matInput [(ngModel)]="name" required (keydown.enter)="submit()" autofocus />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Description</mat-label>
        <textarea matInput [(ngModel)]="description" rows="3" placeholder="What is this project about?"></textarea>
      </mat-form-field>

      <div class="meta-section">
        <div class="meta-row">
          <span class="meta-label">Nodes</span>
          <span class="meta-value">{{ data.nodeCount }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Edges</span>
          <span class="meta-value">{{ data.edgeCount }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Messages</span>
          <span class="meta-value">{{ data.messageCount }}</span>
        </div>
        @if (data.createdAt) {
          <div class="meta-row">
            <span class="meta-label">Created</span>
            <span class="meta-value">{{ data.createdAt | date:'mediumDate' }}</span>
          </div>
        }
        @if (data.updatedAt) {
          <div class="meta-row">
            <span class="meta-label">Last saved</span>
            <span class="meta-value">{{ data.updatedAt | date:'medium' }}</span>
          </div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!name.trim()" (click)="submit()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-top: 8px;
      min-width: 380px;
    }
    .full-width { width: 100%; }
    .meta-section {
      border-top: 1px solid #eee;
      padding-top: 12px;
      margin-top: 4px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
    }
    .meta-label { color: #888; }
    .meta-value { font-weight: 500; color: #333; }
  `]
})
export class ProjectEditDialogComponent {
  data = inject<ProjectEditDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ProjectEditDialogComponent>);

  name = this.data.name;
  description = this.data.description;

  submit() {
    if (!this.name.trim()) return;
    this.dialogRef.close({ name: this.name.trim(), description: this.description.trim() });
  }
}
