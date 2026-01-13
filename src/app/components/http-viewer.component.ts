import { Component, input, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogParserService } from '../services/log-parser.service';

/**
 * HTTP Viewer Component
 * Beautiful HTTP request/response display with method badges,
 * URL parsing, query parameter display, and body formatting.
 */

export interface HttpData {
  method?: string;
  url?: string;
  statusCode?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  duration?: number;
}

interface ParsedUrl {
  protocol: string;
  host: string;
  pathname: string;
  queryParams: { key: string; value: string }[];
  fullUrl: string;
}

@Component({
  selector: 'app-http-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="http-viewer">
      <!-- Request Section -->
      <section class="http-section">
        <div class="section-header">
          <span class="section-label">REQUEST</span>
        </div>

        <!-- Method + URL Bar -->
        <div class="url-bar">
          <span class="method-badge" [class]="'method-' + methodLower()">
            {{ method() }}
          </span>
          <div class="url-display">
            @if (parsedUrl()) {
              <span class="url-protocol">{{ parsedUrl()!.protocol }}//</span>
              <span class="url-host">{{ parsedUrl()!.host }}</span>
              <span class="url-path">{{ parsedUrl()!.pathname }}</span>
            } @else {
              <span class="url-raw">{{ httpData().url || 'No URL' }}</span>
            }
          </div>
        </div>

        <!-- Query Parameters -->
        @if (parsedUrl()?.queryParams?.length) {
          <div class="params-section">
            <div class="params-header">
              <span class="params-title">QUERY PARAMETERS</span>
              <span class="params-count">{{ parsedUrl()!.queryParams.length }}</span>
            </div>
            <div class="params-grid">
              @for (param of parsedUrl()!.queryParams; track param.key) {
                <div class="param-row">
                  <span class="param-key">{{ param.key }}</span>
                  <span class="param-separator">=</span>
                  <span class="param-value">{{ param.value }}</span>
                </div>
              }
            </div>
          </div>
        }

        <!-- Request Headers -->
        @if (hasRequestHeaders()) {
          <div class="headers-section">
            <button class="toggle-btn" (click)="toggleRequestHeaders()">
              <span class="toggle-icon">{{ showRequestHeaders() ? '▼' : '▶' }}</span>
              <span class="toggle-label">HEADERS</span>
              <span class="toggle-count">{{ requestHeaderCount() }}</span>
            </button>
            @if (showRequestHeaders()) {
              <div class="headers-grid">
                @for (header of requestHeadersList(); track header.key) {
                  <div class="header-row">
                    <span class="header-key">{{ header.key }}</span>
                    <span class="header-value">{{ header.value }}</span>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Request Body -->
        @if (httpData().requestBody) {
          <div class="body-section">
            <div class="body-header">
              <span class="body-title">BODY</span>
              <span class="body-type-badge" [class]="'type-' + requestBodyType()">
                {{ requestBodyType().toUpperCase() }}
              </span>
              <button class="copy-btn" (click)="copyRequestBody()">
                {{ copiedRequest() ? '✓' : 'COPY' }}
              </button>
            </div>
            <div class="body-content">
              <pre><code [innerHTML]="formattedRequestBody()"></code></pre>
            </div>
          </div>
        }
      </section>

      <!-- Divider with Status -->
      <div class="response-divider">
        <div class="axa-stripe divider-stripe"></div>
        @if (httpData().statusCode) {
          <div class="status-badge" [class]="getStatusClass()">
            <span class="status-code">{{ httpData().statusCode }}</span>
            @if (httpData().statusText) {
              <span class="status-text">{{ httpData().statusText }}</span>
            }
          </div>
        }
        @if (httpData().duration) {
          <span class="duration-badge">{{ httpData().duration }}ms</span>
        }
        <div class="axa-stripe divider-stripe"></div>
      </div>

      <!-- Response Section -->
      <section class="http-section">
        <div class="section-header">
          <span class="section-label">RESPONSE</span>
        </div>

        <!-- Response Headers -->
        @if (hasResponseHeaders()) {
          <div class="headers-section">
            <button class="toggle-btn" (click)="toggleResponseHeaders()">
              <span class="toggle-icon">{{ showResponseHeaders() ? '▼' : '▶' }}</span>
              <span class="toggle-label">HEADERS</span>
              <span class="toggle-count">{{ responseHeaderCount() }}</span>
            </button>
            @if (showResponseHeaders()) {
              <div class="headers-grid">
                @for (header of responseHeadersList(); track header.key) {
                  <div class="header-row">
                    <span class="header-key">{{ header.key }}</span>
                    <span class="header-value">{{ header.value }}</span>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Response Body -->
        @if (httpData().responseBody) {
          <div class="body-section">
            <div class="body-header">
              <span class="body-title">BODY</span>
              <span class="body-type-badge" [class]="'type-' + responseBodyType()">
                {{ responseBodyType().toUpperCase() }}
              </span>
              <button class="copy-btn" (click)="copyResponseBody()">
                {{ copiedResponse() ? '✓' : 'COPY' }}
              </button>
            </div>
            <div class="body-content">
              <pre><code [innerHTML]="formattedResponseBody()"></code></pre>
            </div>
          </div>
        }

        @if (!httpData().responseBody) {
          <div class="empty-body">
            <span class="empty-text">No response body</span>
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .http-viewer {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: auto;
      background-color: var(--te-bg);
    }

    /* Section Layout */
    .http-section {
      padding: 12px;
    }

    .section-header {
      margin-bottom: 12px;
    }

    .section-label {
      font-family: var(--font-sans);
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: var(--te-text-muted);
    }

    /* URL Bar */
    .url-bar {
      display: flex;
      align-items: stretch;
      border: 1px solid var(--te-border);
      background-color: var(--te-bg-dark);
      margin-bottom: 12px;
    }

    .method-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 12px;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: white;
      min-width: 60px;
    }

    .method-get { background-color: #2E7D32; }
    .method-post { background-color: #1565C0; }
    .method-put { background-color: #E65100; }
    .method-patch { background-color: #7B1FA2; }
    .method-delete { background-color: #C62828; }
    .method-options { background-color: #455A64; }
    .method-head { background-color: #455A64; }

    .url-display {
      flex: 1;
      display: flex;
      align-items: center;
      padding: 8px 12px;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      overflow: hidden;
      white-space: nowrap;
    }

    .url-protocol { color: var(--te-text-muted); }
    .url-host { color: var(--axa-blue); font-weight: 600; }
    .url-path { color: var(--te-text); }
    .url-raw { color: var(--te-text); }

    /* Query Parameters */
    .params-section {
      margin-bottom: 12px;
      border: 1px solid var(--te-border-light);
    }

    .params-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background-color: var(--te-bg-dark);
      border-bottom: 1px solid var(--te-border-light);
    }

    .params-title {
      font-family: var(--font-sans);
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--te-text-muted);
    }

    .params-count {
      font-family: var(--font-mono);
      font-size: 0.6rem;
      padding: 1px 6px;
      background-color: var(--axa-blue);
      color: white;
    }

    .params-grid {
      padding: 8px 10px;
    }

    .param-row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px 0;
      font-family: var(--font-mono);
      font-size: 0.7rem;
    }

    .param-key {
      color: #6C3483;
      font-weight: 500;
    }

    .param-separator {
      color: var(--te-text-muted);
    }

    .param-value {
      color: #067D17;
    }

    /* Headers Section */
    .headers-section {
      margin-bottom: 12px;
    }

    .toggle-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      padding: 6px 10px;
      background-color: var(--te-bg-dark);
      border: 1px solid var(--te-border-light);
      cursor: pointer;
      font-family: var(--font-sans);
      text-align: left;
    }

    .toggle-btn:hover {
      background-color: var(--te-bg);
    }

    .toggle-icon {
      font-size: 0.6rem;
      color: var(--te-text-muted);
    }

    .toggle-label {
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--te-text-muted);
    }

    .toggle-count {
      font-family: var(--font-mono);
      font-size: 0.55rem;
      padding: 1px 5px;
      background-color: var(--te-border-light);
      color: var(--te-text-muted);
    }

    .headers-grid {
      border: 1px solid var(--te-border-light);
      border-top: none;
      padding: 8px 10px;
    }

    .header-row {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 8px;
      padding: 2px 0;
      font-family: var(--font-mono);
      font-size: 0.65rem;
    }

    .header-key {
      color: #994500;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .header-value {
      color: var(--te-text);
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Body Section */
    .body-section {
      border: 1px solid var(--te-border);
    }

    .body-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background-color: var(--te-bg-dark);
      border-bottom: 1px solid var(--te-border);
    }

    .body-title {
      font-family: var(--font-sans);
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--te-text-muted);
    }

    .body-type-badge {
      font-family: var(--font-mono);
      font-size: 0.55rem;
      font-weight: 600;
      padding: 2px 6px;
      border: 1px solid;
    }

    .type-json {
      background-color: #E8F5E9;
      color: #2E7D32;
      border-color: #2E7D32;
    }

    .type-xml {
      background-color: #E3F2FD;
      color: #1565C0;
      border-color: #1565C0;
    }

    .type-text {
      background-color: var(--te-bg);
      color: var(--te-text-muted);
      border-color: var(--te-border-light);
    }

    .copy-btn {
      margin-left: auto;
      padding: 2px 8px;
      font-family: var(--font-mono);
      font-size: 0.55rem;
      font-weight: 600;
      background-color: transparent;
      border: 1px solid var(--te-border-light);
      color: var(--te-text-muted);
      cursor: pointer;
    }

    .copy-btn:hover {
      background-color: var(--te-border);
      color: var(--te-bg);
    }

    .body-content {
      padding: 10px;
      max-height: 300px;
      overflow: auto;
    }

    .body-content pre {
      margin: 0;
      font-family: var(--font-mono);
      font-size: 0.7rem;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* Response Divider */
    .response-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background-color: var(--te-bg-dark);
      border-top: 1px solid var(--te-border);
      border-bottom: 1px solid var(--te-border);
    }

    .divider-stripe {
      flex: 1;
      height: 3px;
    }

    .status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 600;
      border: 1px solid;
    }

    .status-badge.status-2xx {
      background-color: #E8F5E9;
      color: #2E7D32;
      border-color: #2E7D32;
    }

    .status-badge.status-3xx {
      background-color: #FFF3E0;
      color: #E65100;
      border-color: #E65100;
    }

    .status-badge.status-4xx {
      background-color: #FFEBEE;
      color: #C62828;
      border-color: #C62828;
    }

    .status-badge.status-5xx {
      background-color: #FCE4EC;
      color: #AD1457;
      border-color: #AD1457;
    }

    .status-code {
      font-weight: 700;
    }

    .status-text {
      font-weight: 400;
      opacity: 0.8;
    }

    .duration-badge {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      color: var(--te-text-muted);
    }

    /* Empty State */
    .empty-body {
      padding: 24px;
      text-align: center;
    }

    .empty-text {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      color: var(--te-text-muted);
    }

    /* Syntax Highlighting */
    :host ::ng-deep .syn-key { color: #6C3483; font-weight: 500; }
    :host ::ng-deep .syn-string { color: #067D17; }
    :host ::ng-deep .syn-number { color: #1750EB; }
    :host ::ng-deep .syn-boolean { color: #0033B3; font-weight: 500; }
    :host ::ng-deep .syn-null { color: #808080; font-style: italic; }
    :host ::ng-deep .syn-tag { color: #00008F; font-weight: 500; }
    :host ::ng-deep .syn-attr { color: #994500; }
    :host ::ng-deep .syn-attr-value { color: #067D17; }
  `]
})
export class HttpViewerComponent {
  private readonly logParser = inject(LogParserService);

  // Input
  readonly httpData = input.required<HttpData>();

  // Local state
  readonly showRequestHeaders = signal(false);
  readonly showResponseHeaders = signal(false);
  readonly copiedRequest = signal(false);
  readonly copiedResponse = signal(false);

  // Computed values
  readonly method = computed(() => (this.httpData().method || 'GET').toUpperCase());
  readonly methodLower = computed(() => this.method().toLowerCase());

  readonly parsedUrl = computed<ParsedUrl | null>(() => {
    const url = this.httpData().url;
    if (!url) return null;

    try {
      const parsed = new URL(url);
      const queryParams: { key: string; value: string }[] = [];
      parsed.searchParams.forEach((value, key) => {
        queryParams.push({ key, value });
      });

      return {
        protocol: parsed.protocol,
        host: parsed.host,
        pathname: parsed.pathname,
        queryParams,
        fullUrl: url
      };
    } catch {
      return null;
    }
  });

  // Headers
  readonly hasRequestHeaders = computed(() => {
    const headers = this.httpData().requestHeaders;
    return headers && Object.keys(headers).length > 0;
  });

  readonly requestHeaderCount = computed(() => {
    const headers = this.httpData().requestHeaders;
    return headers ? Object.keys(headers).length : 0;
  });

  readonly requestHeadersList = computed(() => {
    const headers = this.httpData().requestHeaders || {};
    return Object.entries(headers).map(([key, value]) => ({ key, value }));
  });

  readonly hasResponseHeaders = computed(() => {
    const headers = this.httpData().responseHeaders;
    return headers && Object.keys(headers).length > 0;
  });

  readonly responseHeaderCount = computed(() => {
    const headers = this.httpData().responseHeaders;
    return headers ? Object.keys(headers).length : 0;
  });

  readonly responseHeadersList = computed(() => {
    const headers = this.httpData().responseHeaders || {};
    return Object.entries(headers).map(([key, value]) => ({ key, value }));
  });

  // Body formatting
  readonly requestBodyType = computed(() => {
    const body = this.httpData().requestBody;
    if (!body) return 'text';
    return this.logParser.detectContentType(body);
  });

  readonly responseBodyType = computed(() => {
    const body = this.httpData().responseBody;
    if (!body) return 'text';
    return this.logParser.detectContentType(body);
  });

  readonly formattedRequestBody = computed(() => {
    const body = this.httpData().requestBody;
    if (!body) return '';
    return this.formatAndHighlight(body);
  });

  readonly formattedResponseBody = computed(() => {
    const body = this.httpData().responseBody;
    if (!body) return '';
    return this.formatAndHighlight(body);
  });

  private formatAndHighlight(content: string): string {
    const parsed = this.logParser.parseContent(content);
    
    if (parsed.type === 'json') {
      return this.syntaxHighlightJson(parsed.formatted);
    } else if (parsed.type === 'xml') {
      return this.syntaxHighlightXml(parsed.formatted);
    }
    return this.escapeHtml(content);
  }

  private syntaxHighlightJson(json: string): string {
    const escaped = this.escapeHtml(json);
    return escaped
      .replace(/"([^"]+)"(?=\s*:)/g, '<span class="syn-key">"$1"</span>')
      .replace(/:\s*"([^"]*)"(?=[,\n\r\]}])/g, ': <span class="syn-string">"$1"</span>')
      .replace(/:\s*(-?\d+\.?\d*)(?=[,\n\r\]}])/g, ': <span class="syn-number">$1</span>')
      .replace(/:\s*(true|false)(?=[,\n\r\]}])/g, ': <span class="syn-boolean">$1</span>')
      .replace(/:\s*(null)(?=[,\n\r\]}])/g, ': <span class="syn-null">$1</span>');
  }

  private syntaxHighlightXml(xml: string): string {
    const escaped = this.escapeHtml(xml);
    return escaped
      .replace(/&lt;(\/?[\w:-]+)/g, '&lt;<span class="syn-tag">$1</span>')
      .replace(/([\w:-]+)=(&quot;[^&]*&quot;)/g, 
        '<span class="syn-attr">$1</span>=<span class="syn-attr-value">$2</span>');
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  getStatusClass(): string {
    const code = this.httpData().statusCode || 0;
    if (code >= 200 && code < 300) return 'status-2xx';
    if (code >= 300 && code < 400) return 'status-3xx';
    if (code >= 400 && code < 500) return 'status-4xx';
    return 'status-5xx';
  }

  toggleRequestHeaders(): void {
    this.showRequestHeaders.update(v => !v);
  }

  toggleResponseHeaders(): void {
    this.showResponseHeaders.update(v => !v);
  }

  async copyRequestBody(): Promise<void> {
    const body = this.httpData().requestBody;
    if (body) {
      await navigator.clipboard.writeText(body);
      this.copiedRequest.set(true);
      setTimeout(() => this.copiedRequest.set(false), 2000);
    }
  }

  async copyResponseBody(): Promise<void> {
    const body = this.httpData().responseBody;
    if (body) {
      await navigator.clipboard.writeText(body);
      this.copiedResponse.set(true);
      setTimeout(() => this.copiedResponse.set(false), 2000);
    }
  }
}
