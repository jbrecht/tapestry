import { Component, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TapestryStore } from '../store/tapestry.store';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';
import { patchState } from '@ngrx/signals';
import { of } from 'rxjs';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent {
  private store = inject(TapestryStore);
  private http = inject(HttpClient);

  // Local UI State
  userInput = signal('');
  chatHistory = signal<{ role: 'user' | 'assistant', content: string }[]>([]);

  /**
   * The Loom Resource
   * This reactively triggers whenever userInput changes (via the send method)
   */
  loomResource = rxResource({
    params: () => {
      const msg = this.userInput();
      if (!msg) return null;

      return {
        message: msg,
        nodes: this.store.nodes(),
        edges: this.store.edges(),
        history: this.chatHistory()
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

        // Update local chat UI
        this.chatHistory.update(h => [
          ...h, 
          { role: 'assistant', content: result.reply }
        ]);
        
        // Reset input for next turn
        this.userInput.set('');
      }
    });
  }

  onSend() {
    const val = this.userInput().trim();
    if (!val || this.loomResource.isLoading()) return;

    // 1. Add user message to UI immediately
    this.chatHistory.update(h => [...h, { role: 'user', content: val }]);
    
    // 2. The resource handles the HTTP call automatically 
    // because we updated the value that 'request' depends on.
  }
}