import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-help-modal',
  standalone: true,
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="help-header">
      <h2 class="help-title">Tapestry Help</h2>
      <button class="help-close" (click)="close()" aria-label="Close">✕</button>
    </div>
    <div class="help-body">

      <section>
        <h3>Getting started</h3>
        <dl>
          <dt>How do I add information?</dt>
          <dd>Type anything into the Chat — names, places, events, relationships. The Loom extracts entities and adds them to your graph automatically.</dd>
          <dt>How do I add a large document?</dt>
          <dd>Use the <strong>Extract</strong> tab in the left panel. Paste any text (article, notes, Wikipedia) and click "Extract into graph". It won't pollute your chat history.</dd>
          <dt>How do I start a new project?</dt>
          <dd>Click the project name in the top-left and choose <strong>New Project</strong>.</dd>
        </dl>
      </section>

      <section>
        <h3>Nodes</h3>
        <dl>
          <dt>How do I create a node manually?</dt>
          <dd>Click the <strong>+</strong> button in the top bar. A draft node opens in the detail panel — give it a label and click Save.</dd>
          <dt>How do I edit a node?</dt>
          <dd>Click any node to open the detail panel. Edit its label, type, description, or attributes directly.</dd>
          <dt>How do I delete a node?</dt>
          <dd>Open the detail panel and click <strong>Delete node</strong> at the bottom. Confirm the prompt.</dd>
          <dt>How do I filter nodes?</dt>
          <dd>Use the search bar in the top centre. All views (graph, table, timeline) filter to matching nodes.</dd>
        </dl>
      </section>

      <section>
        <h3>Connections</h3>
        <dl>
          <dt>How do I add a connection between nodes?</dt>
          <dd>Open a node's detail panel, scroll to Connections, and click <strong>+</strong>. Choose a direction, target node, and relationship label.</dd>
          <dt>How do I rename a connection?</dt>
          <dd>In the Connections list, click the relationship label (shown in small grey text) to edit it inline.</dd>
          <dt>How do I delete a connection?</dt>
          <dd>Hover a connection row and click the <strong>✕</strong> that appears on the right.</dd>
        </dl>
      </section>

      <section>
        <h3>Map</h3>
        <dl>
          <dt>How do I place a node on the map?</dt>
          <dd>Open the node's detail panel and use <strong>Find on map</strong> to geocode by name, or click the pin icon to place it manually on the map.</dd>
          <dt>How do I fit all markers on screen?</dt>
          <dd>Switch to the Map view — a <strong>Fit all</strong> button appears in the top-right when markers exist.</dd>
        </dl>
      </section>

      <section>
        <h3>Keyboard shortcuts</h3>
        <table class="shortcuts-table">
          <tbody>
            <tr><td><kbd>⌘Z</kbd> / <kbd>Ctrl Z</kbd></td><td>Undo</td></tr>
            <tr><td><kbd>⌘⇧Z</kbd> / <kbd>Ctrl Shift Z</kbd></td><td>Redo</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Close detail panel / cancel pin mode</td></tr>
            <tr><td><kbd>?</kbd></td><td>Open this help screen</td></tr>
            <tr><td><kbd>Enter</kbd> in chat</td><td>Send message</td></tr>
            <tr><td><kbd>Shift Enter</kbd> in chat</td><td>New line</td></tr>
            <tr><td><kbd>Enter</kbd> on a label/attribute</td><td>Confirm and blur</td></tr>
          </tbody>
        </table>
      </section>

    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; max-height: 80vh; width: 560px; }

    .help-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px 12px;
      border-bottom: 1px solid #eee;
      flex-shrink: 0;
    }

    .help-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #111;
    }

    .help-close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      color: #999;
      padding: 4px;
      border-radius: 4px;
      line-height: 1;
      &:hover { color: #333; background: #f5f5f5; }
    }

    .help-body {
      overflow-y: auto;
      padding: 16px 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    section h3 {
      margin: 0 0 10px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #f5a623;
    }

    dl {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    dt {
      font-size: 13px;
      font-weight: 600;
      color: #222;
      margin: 0;
    }

    dd {
      font-size: 13px;
      color: #555;
      margin: 0 0 0 12px;
      line-height: 1.5;
    }

    .shortcuts-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      td { padding: 5px 8px; vertical-align: middle; }
      td:first-child { white-space: nowrap; width: 1%; }
      tr:not(:last-child) td { border-bottom: 1px solid #f5f5f5; }
      td:last-child { color: #555; }
    }

    kbd {
      display: inline-block;
      padding: 2px 6px;
      font-size: 11px;
      font-family: inherit;
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      color: #333;
    }
  `]
})
export class HelpModalComponent {
  private dialogRef = inject(MatDialogRef<HelpModalComponent>);
  close() { this.dialogRef.close(); }
}
