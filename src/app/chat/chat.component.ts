import { Component, inject, signal, effect, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TapestryStore } from '../store/tapestry.store';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';
import { patchState } from '@ngrx/signals';
import { of } from 'rxjs';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent {
  protected store = inject(TapestryStore);
  private http = inject(HttpClient);

  @ViewChild('messageList') messageList!: ElementRef<HTMLDivElement>;

  // Local UI State
  userInput = signal('');
  // Pending message to be sent
  // Pending message to be sent
  pendingMessage = signal<{ text: string, id: number } | null>(null);

  /**
   * The Loom Resource
   * This reactively triggers whenever userInput changes (via the send method)
   */
  loomResource = rxResource({
    params: () => {
      const pm = this.pendingMessage();
      if (!pm) return null;

      return {
        message: pm.text,
        nodes: this.store.nodes(),
        edges: this.store.edges(),
        history: this.store.messages().map(m => ({ role: m.role, content: m.content }))
      };
    },
    stream: ({params: req}) => {
      if (!req) return of(null);
      
      return this.http.post<any>(`${environment.apiUrl}/weave`, req);
    }
  });

  constructor() {
    // Effect to synchronize the AI's response with the Global Signal Store
    effect(() => {
      const result = this.loomResource.value();
      if (result) {
        // Update the Shared Graph State
        this.store.updateGraph(result.nodes, result.edges);

        // Update local chat UI - Save to Store!
        this.store.addChatMessage('assistant', result.reply);
        
        // Reset input for next turn
        
        // Reset input for next turn
        this.userInput.set('');
        this.pendingMessage.set(null);
      }
    });

    // Effect to scroll to bottom when messages change
    effect(() => {
        const messages = this.store.messages();
        // Use setTimeout to allow DOM to update
        setTimeout(() => {
            this.scrollToBottom();
        }, 50);
    });
  }

  private scrollToBottom() {
      if (this.messageList) {
          const el = this.messageList.nativeElement;
          el.scrollTop = el.scrollHeight;
      }
  }

  onSend() {
    const val = this.userInput().trim();
    if (!val) return;

    // 1. Log the user's thought
    // 1. Log the user's thought
    this.store.addChatMessage('user', val);
    this.store.setLoading(true);

    // 2. Trigger the resource via pendingMessage
    this.pendingMessage.set({ text: val, id: Date.now() });
  }
}