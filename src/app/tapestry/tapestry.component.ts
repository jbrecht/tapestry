import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ChatComponent } from '../chat/chat.component';
import { TapestryCanvasComponent } from '../canvas/tapestry-canvas.component';

@Component({
  selector: 'app-tapestry',
  standalone: true,
  imports: [ChatComponent, TapestryCanvasComponent],
  templateUrl: './tapestry.component.html',
  styleUrl: './tapestry.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TapestryComponent {}
