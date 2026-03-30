import { Component, inject, signal, effect, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TextFieldModule } from '@angular/cdk/text-field';
import { TapestryStore } from '../store/tapestry.store';
import { environment } from '../../environments/environment';
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
  private sanitizer = inject(DomSanitizer);

  protected activeTab = signal<'chat' | 'extract'>('chat');

  // ── Extract tab ────────────────────────────────────────────────────────────
  protected extractMode = signal<'text' | 'url' | 'file'>('text');
  protected extractText = signal('');
  protected extractUrl = signal('');
  protected extractFile = signal<File | null>(null);
  protected extractStatus = signal<'idle' | 'loading' | 'done' | 'error'>('idle');
  protected extractSummary = signal('');
  protected extractProgress = signal('');

  protected onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.extractFile.set(file);
  }

  protected async onExtract() {
    if (this.extractStatus() === 'loading') return;
    const mode = this.extractMode();
    const text = mode === 'text' ? this.extractText().trim() : '';
    const url = mode === 'url' ? this.extractUrl().trim() : '';
    const file = mode === 'file' ? this.extractFile() : null;
    if (!text && !url && !file) return;

    this.extractStatus.set('loading');
    this.extractSummary.set('');
    this.extractProgress.set(url ? `Fetching ${url}…` : file ? `Reading ${file.name}…` : 'Starting…');

    try {
      let response: Response;

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('nodes', JSON.stringify(this.store.nodes()));
        formData.append('edges', JSON.stringify(this.store.edges()));
        response = await fetch(`${environment.apiUrl}/extract-file`, { method: 'POST', body: formData });
      } else {
        response = await fetch(`${environment.apiUrl}/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text || undefined, url: url || undefined, nodes: this.store.nodes(), edges: this.store.edges() }),
        });
      }

      if (!response.ok || !response.body) throw new Error('Bad response');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === 'fetching') {
            this.extractProgress.set(event.message);
          } else if (event.type === 'start') {
            this.extractProgress.set(`Processing ${event.total} chunk${event.total !== 1 ? 's' : ''}…`);
          } else if (event.type === 'progress') {
            this.extractProgress.set(`Chunk ${event.chunk} of ${event.total}…`);
          } else if (event.type === 'linking') {
            this.extractProgress.set(event.message);
          } else if (event.type === 'result') {
            this.store.updateGraph(event.nodes, event.edges);
            this.extractSummary.set(event.summary);
            this.extractStatus.set('done');
            this.extractText.set('');
            this.extractUrl.set('');
            this.extractFile.set(null);
            this.extractProgress.set('');
          } else if (event.type === 'error') {
            this.extractSummary.set(event.message);
            this.extractStatus.set('error');
            this.extractProgress.set('');
          }
        }
      }
    } catch {
      this.extractSummary.set('Extraction failed — check server logs.');
      this.extractStatus.set('error');
      this.extractProgress.set('');
    }
  }

  protected inspectingIdx = signal<number | null>(null);

  readonly messageList = viewChild.required<ElementRef<HTMLDivElement>>('messageList');

  // Local UI State
  userInput = signal('');
  isLoading = signal(false);
  streamingReply = signal('');

  isListening = signal(false);
  private recognition: SpeechRecognition | null = null;

  constructor() {

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

  async onSend() {
    const val = this.userInput().trim();
    if (!val || this.isLoading()) return;

    this.store.addChatMessage('user', val);
    this.userInput.set('');
    this.isLoading.set(true);
    this.streamingReply.set('');

    try {
      const response = await fetch(`${environment.apiUrl}/weave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: val,
          nodes: this.store.nodes(),
          edges: this.store.edges(),
          history: this.store.messages().map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok || !response.body) throw new Error('Bad response');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === 'token') {
            this.streamingReply.update(r => r + event.text);
          } else if (event.type === 'result') {
            this.store.updateGraph(event.nodes, event.edges);
            this.store.addChatMessage('assistant', event.reply || this.streamingReply());
            this.streamingReply.set('');
          } else if (event.type === 'error') {
            this.store.addChatMessage('assistant', event.message);
            this.streamingReply.set('');
          }
        }
      }
    } catch {
      this.store.addChatMessage('assistant', 'Something went wrong — check server logs.');
      this.streamingReply.set('');
    } finally {
      this.isLoading.set(false);
    }
  }
}