import { Routes } from '@angular/router';
import { TapestryComponent } from './tapestry/tapestry.component';
import { LoginPageComponent } from './pages/login-page.component';
import { authGuard } from './auth.guard';
import { adminGuard } from './guards/admin.guard';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';

export const routes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [authGuard, adminGuard] },
  { path: '', component: TapestryComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
