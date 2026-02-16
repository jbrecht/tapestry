import { Routes } from '@angular/router';
import { TapestryComponent } from './tapestry/tapestry.component';
import { LoginPageComponent } from './pages/login-page.component';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: '', component: TapestryComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
