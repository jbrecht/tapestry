import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './services/auth.service';
import { catchError, switchMap } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Don't attempt refresh for auth endpoints (avoids infinite loops)
      const isAuthEndpoint = req.url.includes('/auth/');
      const isTokenError = error.status === 401 || error.status === 403;

      if (isTokenError && !isAuthEndpoint) {
        return authService.refresh().pipe(
          switchMap(newToken => next(requestWithToken(req, newToken))),
          catchError(() => throwError(() => error))
        );
      }

      return throwError(() => error);
    })
  );
};

function requestWithToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}
