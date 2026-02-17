import { Component, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('tapestry');

  constructor(private http: HttpClient) {
    this.checkServerStatus();
  }

  private checkServerStatus() {
    this.http.get(`${environment.apiUrl}/server-test`, { responseType: 'text' })
      .subscribe({
        next: (response) => console.log('Server status:', response),
        error: (error) => console.error('Server status check failed:', error)
      });
  }
}
