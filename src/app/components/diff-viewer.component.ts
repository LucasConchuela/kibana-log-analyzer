import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogEntry } from '../services/log-parser.service';

/**
 * Diff Viewer Component
 * Displays two log entries side by side for comparison.
 */
@Component({
  selector: 'app-diff-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen()) {
      <div class="diff-viewer-overlay" (click)="close()">
        <div class="diff-viewer-modal" (click)="$event.stopPropagation()">
          <div class="diff-header">
            <span class="diff-title">COMPARE ENTRIES</span>
            <button class="close-btn" (click)="close()">✕</button>
          </div>

          <div class="diff-content">
            <!-- Left Entry -->
            <div class="diff-entry">
              <div class="entry-header">
                <span class="entry-label">ENTRY A</span>
                <span class="entry-id">{{ leftEntry()?._id || 'Not selected' }}</span>
              </div>
              @if (leftEntry()) {
                <div class="entry-fields">
                  @for (field of allFields(); track field) {
                    <div class="field-row" [class.different]="isDifferent(field)">
                      <span class="field-name">{{ field }}</span>
                      <span class="field-value">{{ formatValue(leftEntry()![field]) }}</span>
                    </div>
                  }
                </div>
              } @else {
                <div class="empty-slot">
                  <span>Select an entry from the table</span>
                  <span class="hint">Shift+Click to add</span>
                </div>
              }
            </div>

            <!-- Right Entry -->
            <div class="diff-entry">
              <div class="entry-header">
                <span class="entry-label">ENTRY B</span>
                <span class="entry-id">{{ rightEntry()?._id || 'Not selected' }}</span>
              </div>
              @if (rightEntry()) {
                <div class="entry-fields">
                  @for (field of allFields(); track field) {
                    <div class="field-row" [class.different]="isDifferent(field)">
                      <span class="field-name">{{ field }}</span>
                      <span class="field-value">{{ formatValue(rightEntry()![field]) }}</span>
                    </div>
                  }
                </div>
              } @else {
                <div class="empty-slot">
                  <span>Select an entry from the table</span>
                  <span class="hint">Shift+Click to add</span>
                </div>
              }
            </div>
          </div>

          <div class="diff-footer">
            <button class="te-button" (click)="swapEntries()">SWAP</button>
            <button class="te-button" (click)="clearEntries()">CLEAR</button>
            <span class="diff-stats">
              @if (leftEntry() && rightEntry()) {
                {{ differentFieldCount() }} / {{ allFields().length }} fields differ
              }
            </span>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .diff-viewer-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .diff-viewer-modal {
      width: 90%;
      max-width: 1200px;
      max-height: 80vh;
      background-color: var(--te-bg);
      border: 2px solid var(--axa-blue);
      display: flex;
      flex-direction: column;
    }

    .diff-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background-color: var(--te-bg-dark);
      border-bottom: 1px solid var(--te-border);
    }

    .diff-title {
      font-family: var(--font-sans);
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--te-text);
    }

    .close-btn {
      padding: 4px 8px;
      background: transparent;
      border: 1px solid var(--te-border-light);
      color: var(--te-text-muted);
      cursor: pointer;
      font-size: 0.8rem;
    }

    .close-btn:hover {
      background-color: var(--axa-red);
      border-color: var(--axa-red);
      color: white;
    }

    .diff-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      background-color: var(--te-border);
      flex: 1;
      overflow: hidden;
    }

    .diff-entry {
      background-color: var(--te-bg);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .entry-header {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      background-color: var(--te-bg-dark);
      border-bottom: 1px solid var(--te-border-light);
    }

    .entry-label {
      font-family: var(--font-sans);
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--axa-blue);
    }

    .entry-id {
      font-family: var(--font-mono);
      font-size: 0.6rem;
      color: var(--te-text-muted);
    }

    .entry-fields {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }

    .field-row {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 8px;
      padding: 4px 12px;
      font-family: var(--font-mono);
      font-size: 0.65rem;
    }

    .field-row.different {
      background-color: rgba(255, 193, 7, 0.1);
    }

    .field-row.different .field-value {
      color: #FFC107;
    }

    .field-name {
      color: var(--te-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .field-value {
      color: var(--te-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .empty-slot {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: var(--te-text-muted);
      font-family: var(--font-mono);
      font-size: 0.75rem;
    }

    .hint {
      font-size: 0.6rem;
      opacity: 0.7;
    }

    .diff-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background-color: var(--te-bg-dark);
      border-top: 1px solid var(--te-border);
    }

    .diff-stats {
      margin-left: auto;
      font-family: var(--font-mono);
      font-size: 0.65rem;
      color: var(--te-text-muted);
    }

    .te-button {
      padding: 6px 12px;
      background-color: var(--te-bg);
      border: 1px solid var(--te-border);
      font-family: var(--font-mono);
      font-size: 0.65rem;
      font-weight: 600;
      color: var(--te-text);
      cursor: pointer;
    }

    .te-button:hover {
      background-color: var(--axa-blue);
      border-color: var(--axa-blue);
      color: white;
    }
  `]
})
export class DiffViewerComponent {
  readonly leftEntry = signal<LogEntry | null>(null);
  readonly rightEntry = signal<LogEntry | null>(null);
  readonly isOpen = signal(false);

  readonly allFields = computed(() => {
    const fields = new Set<string>();
    const left = this.leftEntry();
    const right = this.rightEntry();
    
    if (left) Object.keys(left).forEach(k => fields.add(k));
    if (right) Object.keys(right).forEach(k => fields.add(k));
    
    return Array.from(fields).sort();
  });

  readonly differentFieldCount = computed(() => {
    const left = this.leftEntry();
    const right = this.rightEntry();
    if (!left || !right) return 0;
    
    return this.allFields().filter(field => this.isDifferent(field)).length;
  });

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  addEntry(entry: LogEntry): void {
    if (!this.leftEntry()) {
      this.leftEntry.set(entry);
    } else if (!this.rightEntry()) {
      this.rightEntry.set(entry);
    } else {
      // Replace right entry
      this.rightEntry.set(entry);
    }
  }

  swapEntries(): void {
    const left = this.leftEntry();
    const right = this.rightEntry();
    this.leftEntry.set(right);
    this.rightEntry.set(left);
  }

  clearEntries(): void {
    this.leftEntry.set(null);
    this.rightEntry.set(null);
  }

  isDifferent(field: string): boolean {
    const left = this.leftEntry();
    const right = this.rightEntry();
    if (!left || !right) return false;
    
    const leftVal = JSON.stringify(left[field]);
    const rightVal = JSON.stringify(right[field]);
    return leftVal !== rightVal;
  }

  formatValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}
