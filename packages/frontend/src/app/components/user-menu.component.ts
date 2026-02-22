import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatMenuModule, RouterModule],
  template: `
    <div *ngIf="authService.currentUser() as user" class="user-menu">
      <button mat-button [matMenuTriggerFor]="menu">
        <mat-icon>person</mat-icon>
        {{ user.username }}
      </button>
      <mat-menu #menu="matMenu">
        <button mat-menu-item routerLink="/admin" *ngIf="user.isAdmin">
          <mat-icon>admin_panel_settings</mat-icon>
          <span>Admin Dashboard</span>
        </button>
        <button mat-menu-item (click)="logout()">
          <mat-icon>logout</mat-icon>
          <span>Logout</span>
        </button>
      </mat-menu>
    </div>
  `,
  styles: [`
    .user-menu {
      margin-left: auto;
    }
  `]
})
export class UserMenuComponent {
  constructor(public authService: AuthService) {}

  logout() {
    this.authService.logout();
  }
}
