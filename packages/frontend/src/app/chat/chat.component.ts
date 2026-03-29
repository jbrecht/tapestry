import { Component, inject, signal, effect, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TextFieldModule } from '@angular/cdk/text-field';
import { TapestryStore } from '../store/tapestry.store';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';
import { patchState } from '@ngrx/signals';
import { of } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const NODE_COLORS: Record<string, string> = {
  Person: '#ff7f0e',
  Event:  '#d62728',
  Place:  '#2ca02c',
  Thing:  '#1f77b4',
};

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    FormsModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatButtonModule, 
    MatIconModule,
    TextFieldModule
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent {
  protected store = inject(TapestryStore);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  protected inspectingIdx = signal<number | null>(null);

  readonly messageList = viewChild.required<ElementRef<HTMLDivElement>>('messageList');

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

  isListening = signal(false);
  private recognition: SpeechRecognition | null = null;

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

    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition() {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => {
        this.isListening.set(true);
      };

      recognition.onend = () => {
        this.isListening.set(false);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          this.userInput.update(current => {
            const trimmed = current.trim();
            return trimmed ? `${trimmed} ${transcript}` : transcript;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        this.isListening.set(false);
      };

      this.recognition = recognition;
    }
  }

  toggleListening() {
    if (!this.recognition) {
      console.warn('Speech recognition not supported or not initialized.');
      return;
    }

    if (this.isListening()) {
      this.recognition.stop();
    } else {
      this.recognition.start();
    }
  }

  private scrollToBottom() {
      const messageList = this.messageList();
      if (messageList) {
          const el = messageList.nativeElement;
          el.scrollTop = el.scrollHeight;
      }
  }

  onEnter(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  protected nodesForMessage(msgIdx: number) {
    return this.store.nodes().filter(n => n.attributes['_msgIdx'] === msgIdx);
  }

  protected highlightedHtml(msgIdx: number): SafeHtml {
    const message = this.store.messages()[msgIdx];
    if (!message) return this.sanitizer.bypassSecurityTrustHtml('');
    const nodes = this.nodesForMessage(msgIdx);
    const text = message.content;
    if (nodes.length === 0) return this.sanitizer.bypassSecurityTrustHtml(this.escapeHtml(text));

    type Match = { start: number; end: number; type: string; nodeId: string };
    const matches: Match[] = [];
    for (const node of nodes) {
      const re = new RegExp(node.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      let m;
      while ((m = re.exec(text)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, type: node.type, nodeId: node.id });
      }
    }
    // Sort by position; prefer longer match on tie
    matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    // Remove overlaps
    const clean: Match[] = [];
    let lastEnd = 0;
    for (const m of matches) {
      if (m.start >= lastEnd) { clean.push(m); lastEnd = m.end; }
    }

    let html = '';
    let cursor = 0;
    for (const m of clean) {
      html += this.escapeHtml(text.slice(cursor, m.start));
      const color = NODE_COLORS[m.type] ?? NODE_COLORS['Thing'];
      html += `<mark data-node-id="${m.nodeId}" style="background:${color}28;color:${color};border-radius:3px;padding:1px 3px;font-weight:600;cursor:pointer">${this.escapeHtml(text.slice(m.start, m.end))}</mark>`;
      cursor = m.end;
    }
    html += this.escapeHtml(text.slice(cursor));
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  protected onInspectBodyClick(event: MouseEvent) {
    const nodeId = (event.target as HTMLElement).dataset['nodeId'];
    if (nodeId) this.store.selectNode(nodeId);
  }

  private escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  onSend() {
    const val = this.userInput().trim();
    if (!val) return;

    // 1. Log the user's thought
    this.store.addChatMessage('user', val);
    this.store.setLoading(true);

    // 2. Trigger the resource via pendingMessage
    this.pendingMessage.set({ text: val, id: Date.now() });
  }
}