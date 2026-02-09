import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { TapestryStore } from '../store/tapestry.store';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatComponent {
  readonly store = inject(TapestryStore);
  readonly messageControl = new FormControl('', { nonNullable: true });

  sendMessage() {
    const message = this.messageControl.value.trim();
    if (message) {
      this.store.addMessage(message);
      this.messageControl.reset();
    }
  }
}
