import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatCardModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatButtonModule,
    MatTabsModule
  ],
  template: `
    <div class="login-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Tapestry Login</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-tab-group>
            <mat-tab label="Login">
              <form (ngSubmit)="onLogin()">
                <mat-form-field appearance="fill" class="full-width">
                  <mat-label>Username</mat-label>
                  <input matInput [(ngModel)]="loginData.username" name="username" required>
                </mat-form-field>
                <mat-form-field appearance="fill" class="full-width">
                  <mat-label>Password</mat-label>
                  <input matInput type="password" [(ngModel)]="loginData.password" name="password" required>
                </mat-form-field>
                <div class="error-message" *ngIf="errorMessage()">{{ errorMessage() }}</div>
                <button mat-raised-button color="primary" type="submit" [disabled]="loading()">
                  {{ loading() ? 'Logging in...' : 'Login' }}
                </button>
              </form>
            </mat-tab>
            <mat-tab label="Register">
              <form (ngSubmit)="onRegister()">
                <mat-form-field appearance="fill" class="full-width">
                  <mat-label>Username</mat-label>
                  <input matInput [(ngModel)]="registerData.username" name="username" required>
                </mat-form-field>
                <mat-form-field appearance="fill" class="full-width">
                  <mat-label>Password</mat-label>
                  <input matInput type="password" [(ngModel)]="registerData.password" name="password" required>
                </mat-form-field>
                <div class="error-message" *ngIf="errorMessage()">{{ errorMessage() }}</div>
                <button mat-raised-button color="accent" type="submit" [disabled]="loading()">
                  {{ loading() ? 'Registering...' : 'Register' }}
                </button>
              </form>
            </mat-tab>
          </mat-tab-group>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background-color: #f5f5f5;
    }
    mat-card {
      width: 400px;
      padding: 20px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 10px;
    }
    form {
      display: flex;
      flex-direction: column;
      padding-top: 20px;
    }
    .error-message {
      color: red;
      margin-bottom: 10px;
    }
  `]
})
export class LoginPageComponent {
  loginData = { username: '', password: '' };
  registerData = { username: '', password: '' };
  loading = signal(false);
  errorMessage = signal('');

  constructor(private authService: AuthService, private router: Router) {}

  onLogin() {
    this.loading.set(true);
    this.errorMessage.set('');
    this.authService.login(this.loginData).subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.error || 'Login failed');
      }
    });
  }

  onRegister() {
    this.loading.set(true);
    this.errorMessage.set('');
    this.authService.register(this.registerData).subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.error || 'Registration failed');
      }
    });
  }
}
