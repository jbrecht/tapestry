import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  if (user && user.isAdmin) {
    return true;
  }

  router.navigate(['/']); // Redirect to home if not admin
  return false;
};
