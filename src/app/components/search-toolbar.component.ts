import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchService } from '../services/search.service';

/**
 * Search Toolbar Component
 * Provides search input, regex toggle, time range picker, and active filter display.
 */
@Component({
  selector: 'app-search-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-toolbar">
      <!-- Search Input -->
      <div class="search-input-wrapper">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input 
          type="text"
          class="search-input"
          placeholder="Search logs..."
          [ngModel]="searchService.searchQuery()"
          (ngModelChange)="onSearchChange($event)"
          (keydown.escape)="clearSearch()"
        />
        @if (searchService.searchQuery()) {
          <button class="clear-btn" (click)="clearSearch()" title="Clear search">✕</button>
        }
      </div>

      <!-- Search Options -->
      <div class="search-options">
        <button 
          class="option-btn"
          [class.active]="searchService.isRegex()"
          (click)="searchService.toggleRegex()"
          title="Regular Expression"
        >
          .*
        </button>
        <button 
          class="option-btn"
          [class.active]="searchService.caseSensitive()"
          (click)="searchService.toggleCaseSensitive()"
          title="Case Sensitive"
        >
          Aa
        </button>
      </div>

      <!-- Time Range Picker -->
      <div class="time-range">
        <button 
          class="option-btn time-btn"
          [class.active]="showTimeRange"
          (click)="toggleTimeRange()"
          title="Time Range Filter"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          TIME
        </button>
      </div>

      <!-- Active Filters -->
      @if (searchService.hasActiveFilters()) {
        <div class="active-filters">
          @for (filter of searchService.quickFilters(); track $index) {
            <div class="filter-tag">
              <span class="filter-field">{{ filter.field }}</span>
              <span class="filter-op">{{ getOperatorSymbol(filter.operator) }}</span>
              <span class="filter-value">{{ filter.value }}</span>
              <button class="remove-filter" (click)="searchService.removeQuickFilter($index)">✕</button>
            </div>
          }
          <button class="clear-all-btn" (click)="searchService.clearAll()">
            CLEAR ALL
          </button>
        </div>
      }
    </div>

    <!-- Time Range Panel -->
    @if (showTimeRange) {
      <div class="time-range-panel">
        <div class="time-inputs">
          <div class="time-field">
            <label>FROM</label>
            <input 
              type="datetime-local"
              [ngModel]="startTime"
              (ngModelChange)="onStartTimeChange($event)"
            />
          </div>
          <div class="time-field">
            <label>TO</label>
            <input 
              type="datetime-local"
              [ngModel]="endTime"
              (ngModelChange)="onEndTimeChange($event)"
            />
          </div>
        </div>
        <div class="time-presets">
          <button class="preset-btn" (click)="setPreset('15m')">15m</button>
          <button class="preset-btn" (click)="setPreset('1h')">1h</button>
          <button class="preset-btn" (click)="setPreset('24h')">24h</button>
          <button class="preset-btn" (click)="setPreset('7d')">7d</button>
          <button class="preset-btn" (click)="clearTimeRange()">Clear</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .search-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background-color: var(--te-bg-dark);
      border-bottom: 1px solid var(--te-border);
    }

    .search-input-wrapper {
      display: flex;
      align-items: center;
      flex: 1;
      max-width: 400px;
      background-color: var(--te-bg);
      border: 1px solid var(--te-border-light);
      padding: 0 8px;
    }

    .search-icon {
      color: var(--te-text-muted);
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      padding: 6px 8px;
      background: transparent;
      border: none;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--te-text);
      outline: none;
    }

    .search-input::placeholder {
      color: var(--te-text-muted);
    }

    .clear-btn {
      padding: 2px 6px;
      background: transparent;
      border: none;
      color: var(--te-text-muted);
      cursor: pointer;
      font-size: 0.7rem;
    }

    .clear-btn:hover {
      color: var(--te-text);
    }

    .search-options {
      display: flex;
      gap: 2px;
    }

    .option-btn {
      padding: 4px 8px;
      background-color: var(--te-bg);
      border: 1px solid var(--te-border-light);
      font-family: var(--font-mono);
      font-size: 0.65rem;
      font-weight: 600;
      color: var(--te-text-muted);
      cursor: pointer;
      transition: all 0.1s ease;
    }

    .option-btn:hover {
      background-color: var(--te-bg-dark);
      color: var(--te-text);
    }

    .option-btn.active {
      background-color: var(--axa-blue);
      border-color: var(--axa-blue);
      color: white;
    }

    .time-btn {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .active-filters {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 8px;
    }

    .filter-tag {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 3px 6px;
      background-color: var(--axa-blue);
      color: white;
      font-family: var(--font-mono);
      font-size: 0.6rem;
    }

    .filter-field {
      font-weight: 600;
    }

    .filter-op {
      opacity: 0.7;
    }

    .filter-value {
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .remove-filter {
      padding: 0 2px;
      margin-left: 4px;
      background: transparent;
      border: none;
      color: white;
      opacity: 0.7;
      cursor: pointer;
      font-size: 0.6rem;
    }

    .remove-filter:hover {
      opacity: 1;
    }

    .clear-all-btn {
      padding: 3px 8px;
      background: transparent;
      border: 1px solid var(--te-border-light);
      font-family: var(--font-mono);
      font-size: 0.55rem;
      font-weight: 600;
      color: var(--te-text-muted);
      cursor: pointer;
    }

    .clear-all-btn:hover {
      background-color: var(--te-bg);
      color: var(--te-text);
    }

    /* Time Range Panel */
    .time-range-panel {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px 12px;
      background-color: var(--te-bg);
      border-bottom: 1px solid var(--te-border);
    }

    .time-inputs {
      display: flex;
      gap: 12px;
    }

    .time-field {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .time-field label {
      font-family: var(--font-sans);
      font-size: 0.6rem;
      font-weight: 600;
      color: var(--te-text-muted);
      letter-spacing: 0.05em;
    }

    .time-field input {
      padding: 4px 8px;
      background-color: var(--te-bg-dark);
      border: 1px solid var(--te-border-light);
      font-family: var(--font-mono);
      font-size: 0.7rem;
      color: var(--te-text);
    }

    .time-presets {
      display: flex;
      gap: 4px;
    }

    .preset-btn {
      padding: 4px 8px;
      background-color: var(--te-bg-dark);
      border: 1px solid var(--te-border-light);
      font-family: var(--font-mono);
      font-size: 0.6rem;
      font-weight: 600;
      color: var(--te-text-muted);
      cursor: pointer;
    }

    .preset-btn:hover {
      background-color: var(--axa-blue);
      border-color: var(--axa-blue);
      color: white;
    }
  `]
})
export class SearchToolbarComponent {
  protected readonly searchService = inject(SearchService);
  
  protected showTimeRange = false;
  protected startTime = '';
  protected endTime = '';

  onSearchChange(query: string): void {
    this.searchService.setSearchQuery(query);
  }

  clearSearch(): void {
    this.searchService.setSearchQuery('');
  }

  toggleTimeRange(): void {
    this.showTimeRange = !this.showTimeRange;
  }

  onStartTimeChange(value: string): void {
    this.startTime = value;
    this.updateTimeRange();
  }

  onEndTimeChange(value: string): void {
    this.endTime = value;
    this.updateTimeRange();
  }

  private updateTimeRange(): void {
    const start = this.startTime ? new Date(this.startTime) : null;
    const end = this.endTime ? new Date(this.endTime) : null;
    this.searchService.setTimeRange(start, end);
  }

  setPreset(preset: string): void {
    const now = new Date();
    const end = now;
    let start: Date;

    switch (preset) {
      case '15m':
        start = new Date(now.getTime() - 15 * 60 * 1000);
        break;
      case '1h':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        return;
    }

    this.startTime = this.formatDateTimeLocal(start);
    this.endTime = this.formatDateTimeLocal(end);
    this.searchService.setTimeRange(start, end);
  }

  clearTimeRange(): void {
    this.startTime = '';
    this.endTime = '';
    this.searchService.clearTimeRange();
  }

  private formatDateTimeLocal(date: Date): string {
    return date.toISOString().slice(0, 16);
  }

  getOperatorSymbol(operator: string): string {
    switch (operator) {
      case 'equals': return '=';
      case 'contains': return '~';
      case 'not_equals': return '≠';
      default: return '=';
    }
  }
}
