import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { IUser } from '@tapestry/shared';

export interface UserUsage {
  projectCount: number;
  totalNodes: number;
  totalEdges: number;
  totalMessages: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatIconModule, MatButtonModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
  animations: [
    trigger('detailExpand', [
      state('collapsed,void', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class AdminDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/users`;
  
  users = signal<IUser[]>([]);
  displayedColumns: string[] = ['id', 'username', 'role', 'created'];
  expandedElement = signal<IUser | null>(null);
  userStats = signal<Record<string, UserUsage>>({});
  loadingStats = signal<Record<string, boolean>>({});

  ngOnInit() {
    const headers = new HttpHeaders().set('Authorization', `Bearer ${this.authService.getToken()}`);
    this.http.get<IUser[]>(this.apiUrl, { headers }).subscribe(data => {
      this.users.set(data);
      console.log('users: ', this.users());
    });
  }

  toggleRow(user: IUser) {
    this.expandedElement.update(prev => prev === user ? null : user);
    
    if (this.expandedElement() && !this.userStats()[user.id]) {
      this.fetchUserUsage(user.id);
    }
  }

  fetchUserUsage(userId: string) {
    this.loadingStats.update(state => ({ ...state, [userId]: true }));
    const headers = new HttpHeaders().set('Authorization', `Bearer ${this.authService.getToken()}`);
    this.http.get<UserUsage>(`${this.apiUrl}/${userId}/usage`, { headers }).subscribe({
      next: (usage) => {
        this.userStats.update(state => ({ ...state, [userId]: usage }));
        this.loadingStats.update(state => ({ ...state, [userId]: false }));
      },
      error: (err) => {
        console.error('Failed to fetch usage stats', err);
        this.loadingStats.update(state => ({ ...state, [userId]: false }));
      }
    });
  }
}
