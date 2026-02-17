import { Component, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { ProjectComponent } from './components/project/project.component';
import { TapestryStatsComponent } from './components/tapestry-stats/tapestry-stats.component';
import { environment } from '../environments/environment';
import { UserMenuComponent } from './components/user-menu.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UserMenuComponent, ProjectComponent, TapestryStatsComponent],
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
