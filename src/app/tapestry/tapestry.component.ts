import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ChatComponent } from '../chat/chat.component';
import { TapestryCanvasComponent } from '../canvas/tapestry-canvas.component';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  selector: 'app-tapestry',
  standalone: true,
  imports: [ChatComponent, TapestryCanvasComponent, MatSidenavModule],
  templateUrl: './tapestry.component.html',
  styleUrl: './tapestry.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TapestryComponent {}
