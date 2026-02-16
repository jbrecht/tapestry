import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProjectComponent } from './components/project/project.component';
import { TapestryStatsComponent } from './components/tapestry-stats/tapestry-stats.component';
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
}
