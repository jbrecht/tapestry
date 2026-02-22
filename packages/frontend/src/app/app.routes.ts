import { Routes } from '@angular/router';


import { authGuard } from './auth.guard';
import { adminGuard } from './guards/admin.guard';


export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login-page.component').then(m => m.LoginPageComponent) },
  { path: 'admin', loadComponent: () => import('./components/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent), canActivate: [authGuard, adminGuard] },
  { path: '', loadComponent: () => import('./tapestry/tapestry.component').then(m => m.TapestryComponent), canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
