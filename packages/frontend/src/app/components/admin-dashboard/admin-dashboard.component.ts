import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { IUser } from '@tapestry/shared';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatIconModule, MatButtonModule, RouterModule],
  template: `
    <div class="admin-container">
      <header>
        <h2>Admin Dashboard</h2>
        <a mat-button routerLink="/">
          <mat-icon>arrow_back</mat-icon>
          Back to Tapestry
        </a>
      </header>

      <div class="table-container mat-elevation-z8">
        <table mat-table [dataSource]="users" class="mat-elevation-z8">
          
          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef> ID </th>
            <td mat-cell *matCellDef="let user"> <span class="id-truncate">{{user.id}}</span> </td>
          </ng-container>

          <ng-container matColumnDef="username">
            <th mat-header-cell *matHeaderCellDef> Username </th>
            <td mat-cell *matCellDef="let user"> {{user.username}} </td>
          </ng-container>

          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef> Role </th>
            <td mat-cell *matCellDef="let user"> 
              <span class="role-badge" [class.admin]="user.isAdmin">
                {{ user.isAdmin ? 'Admin' : 'User' }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="created">
            <th mat-header-cell *matHeaderCellDef> Joined </th>
            <td mat-cell *matCellDef="let user"> {{user.createdAt | date:'mediumDate'}} </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .admin-container {
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
      font-family: Roboto, "Helvetica Neue", sans-serif;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }
    header h2 { 
      margin: 0; 
      color: #333; 
      font-weight: 500;
    }
    .table-container {
      border-radius: 8px;
      overflow: hidden;
      background: white;
    }
    table {
      width: 100%;
    }
    .id-truncate {
      display: inline-block;
      max-width: 150px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: monospace;
      color: #666;
      vertical-align: middle;
    }
    .role-badge {
      padding: 4px 8px;
      border-radius: 12px;
      background: #e0e0e0;
      color: #555;
      font-size: 0.85em;
      
    }
    .role-badge.admin {
      background: #e3f2fd;
      color: #1565c0;
      font-weight: 500;
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/users`;
  
  users: IUser[] = [];
  displayedColumns: string[] = ['id', 'username', 'role', 'created'];

  ngOnInit() {
    const headers = new HttpHeaders().set('Authorization', `Bearer ${this.authService.getToken()}`);
    this.http.get<IUser[]>(this.apiUrl, { headers }).subscribe(users => {
      this.users = users;
      console.log('users: ', this.users);
    });
  }
}
