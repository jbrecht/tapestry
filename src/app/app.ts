import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserMenuComponent } from './components/user-menu.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UserMenuComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('tapestry');
}
