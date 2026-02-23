import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './services/auth.service';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Check for Unauthorized or Forbidden statuses
      if (error.status === 401 || error.status === 403) {
        // Clear tokens and redirect to login
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
