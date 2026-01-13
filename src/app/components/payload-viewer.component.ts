import { Component, input, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogParserService, ContentType } from '../services/log-parser.service';

/**
 * Payload Viewer Component
 * Displays and formats JSON/XML/text content with syntax highlighting.
 * Part of the "Payload Inspector" feature for LogSynth.
 */
@Component({
  selector: 'app-payload-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="payload-viewer">
      <!-- Header with content type badge -->
      <div class="payload-header">
        <span class="payload-title">{{ title() }}</span>
        <span class="content-type-badge" [class]="'badge-' + contentType()">
          {{ contentType().toUpperCase() }}
        </span>
      </div>

      <!-- Content display -->
      <div class="payload-content">
        @if (contentType() === 'json') {
          <pre class="syntax-highlighted"><code [innerHTML]="highlightedJson()"></code></pre>
        } @else if (contentType() === 'xml') {
          <pre class="syntax-highlighted"><code [innerHTML]="highlightedXml()"></code></pre>
        } @else {
          <pre class="raw-text"><code>{{ formattedContent() }}</code></pre>
        }
      </div>

      <!-- Actions -->
      <div class="payload-actions">
        <button class="te-button" (click)="copyToClipboard()">
          {{ copied() ? '✓ COPIED' : 'COPY' }}
        </button>
        <button class="te-button" (click)="toggleRaw()">
          {{ showRaw() ? 'FORMATTED' : 'RAW' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .payload-viewer {
      display: flex;
      flex-direction: column;
      height: 100%;
      background-color: var(--te-bg);
      border: 1px solid var(--te-border);
    }

    .payload-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-bottom: 1px solid var(--te-border);
      background-color: var(--te-bg-dark);
    }

    .payload-title {
      font-family: var(--font-sans);
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--te-text-muted);
    }

    .content-type-badge {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      font-weight: 600;
      padding: 2px 8px;
      border: 1px solid var(--te-border);
    }

    .badge-json {
      background-color: #E8F5E9;
      color: #2E7D32;
      border-color: #2E7D32;
    }

    .badge-xml {
      background-color: #E3F2FD;
      color: #1565C0;
      border-color: #1565C0;
    }

    .badge-text {
      background-color: var(--te-bg-dark);
      color: var(--te-text-muted);
    }

    .payload-content {
      flex: 1;
      overflow: auto;
      padding: 12px;
    }

    pre {
      margin: 0;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .syntax-highlighted {
      background: transparent;
    }

    .payload-actions {
      display: flex;
      gap: 1px;
      border-top: 1px solid var(--te-border);
      background-color: var(--te-border);
    }

    .payload-actions .te-button {
      flex: 1;
      border: none;
      border-radius: 0;
    }

    /* Syntax highlighting tokens */
    :host ::ng-deep .syn-key { color: #6C3483; font-weight: 500; }
    :host ::ng-deep .syn-string { color: #067D17; }
    :host ::ng-deep .syn-number { color: #1750EB; }
    :host ::ng-deep .syn-boolean { color: #0033B3; font-weight: 500; }
    :host ::ng-deep .syn-null { color: #808080; font-style: italic; }
    :host ::ng-deep .syn-bracket { color: var(--te-text); }
    :host ::ng-deep .syn-tag { color: #00008F; font-weight: 500; }
    :host ::ng-deep .syn-attr { color: #994500; }
    :host ::ng-deep .syn-attr-value { color: #067D17; }
  `]
})
export class PayloadViewerComponent {
  private readonly logParser = inject(LogParserService);

  // Signal-based inputs
  readonly content = input<string>('');
  readonly title = input<string>('PAYLOAD');

  // Local state
  readonly showRaw = signal(false);
  readonly copied = signal(false);

  // Computed values
  readonly contentType = computed<ContentType>(() => {
    const raw = this.content();
    if (!raw) return 'text';
    return this.logParser.detectContentType(raw);
  });

  readonly parsedContent = computed(() => {
    const raw = this.content();
    if (!raw) return { type: 'text' as const, formatted: '', raw: '' };
    return this.logParser.parseContent(raw);
  });

  readonly formattedContent = computed(() => {
    if (this.showRaw()) {
      return this.content();
    }
    return this.parsedContent().formatted;
  });

  readonly highlightedJson = computed(() => {
    const content = this.showRaw() ? this.content() : this.parsedContent().formatted;
    return this.syntaxHighlightJson(content);
  });

  readonly highlightedXml = computed(() => {
    const content = this.showRaw() ? this.content() : this.parsedContent().formatted;
    return this.syntaxHighlightXml(content);
  });

  /**
   * Apply syntax highlighting to JSON
   */
  private syntaxHighlightJson(json: string): string {
    if (!json) return '';

    // Escape HTML first
    const escaped = this.escapeHtml(json);

    return escaped
      // Highlight keys
      .replace(/"([^"]+)"(?=\s*:)/g, '<span class="syn-key">"$1"</span>')
      // Highlight string values (after colon)
      .replace(/:\s*"([^"]*)"(?=[,\n\r\]}])/g, ': <span class="syn-string">"$1"</span>')
      // Highlight numbers
      .replace(/:\s*(-?\d+\.?\d*)(?=[,\n\r\]}])/g, ': <span class="syn-number">$1</span>')
      // Highlight booleans
      .replace(/:\s*(true|false)(?=[,\n\r\]}])/g, ': <span class="syn-boolean">$1</span>')
      // Highlight null
      .replace(/:\s*(null)(?=[,\n\r\]}])/g, ': <span class="syn-null">$1</span>')
      // Highlight brackets
      .replace(/([{}\[\]])/g, '<span class="syn-bracket">$1</span>');
  }

  /**
   * Apply syntax highlighting to XML
   */
  private syntaxHighlightXml(xml: string): string {
    if (!xml) return '';

    // Escape HTML first
    const escaped = this.escapeHtml(xml);

    return escaped
      // Highlight tags
      .replace(/&lt;(\/?[\w:-]+)/g, '&lt;<span class="syn-tag">$1</span>')
      // Highlight attributes
      .replace(/([\w:-]+)=(&quot;[^&]*&quot;)/g, 
        '<span class="syn-attr">$1</span>=<span class="syn-attr-value">$2</span>')
      // Highlight closing bracket
      .replace(/(\/?&gt;)/g, '<span class="syn-bracket">$1</span>');
  }

  /**
   * Escape HTML for safe rendering
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Toggle between raw and formatted view
   */
  toggleRaw(): void {
    this.showRaw.update(v => !v);
  }

  /**
   * Copy content to clipboard
   */
  async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.formattedContent());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
}
