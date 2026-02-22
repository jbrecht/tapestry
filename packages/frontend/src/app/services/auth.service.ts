import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError } from 'rxjs/operators';
import { of, Observable } from 'rxjs';

export interface User {
  id: string;
  username: string;
  isAdmin?: boolean;
}

interface AuthResponse {
  token: string;
  user: User;
}

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'tapestry_auth_token';
  private readonly USER_KEY = 'tapestry_user';

  // Signals
  currentUser = signal<User | null>(this.getUserFromStorage());
  isLoggedIn = computed(() => !!this.currentUser());

  constructor(private http: HttpClient, private router: Router) {}

  login(credentials: { username: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => this.handleAuthSuccess(response))
    );
  }

  register(credentials: { username: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, credentials).pipe(
      tap(response => this.handleAuthSuccess(response))
    );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private handleAuthSuccess(response: AuthResponse) {
    localStorage.setItem(this.TOKEN_KEY, response.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
    this.currentUser.set(response.user);
    this.router.navigate(['/']);
  }

  private getUserFromStorage(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }
}
