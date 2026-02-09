import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TapestryComponent } from "./tapestry/tapestry.component";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TapestryComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('tapestry');
}
