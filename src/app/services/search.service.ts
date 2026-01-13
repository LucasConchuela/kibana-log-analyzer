import { Injectable, signal, computed } from '@angular/core';
import { LogEntry } from './log-parser.service';

/**
 * Search Service
 * Handles full-text search, regex, quick filters, and time range filtering.
 */

export interface SearchFilter {
  field: string;
  value: string;
  operator: 'equals' | 'contains' | 'not_equals';
}

export interface TimeRange {
  start: Date | null;
  end: Date | null;
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  // Search state
  private readonly _searchQuery = signal('');
  private readonly _isRegex = signal(false);
  private readonly _quickFilters = signal<SearchFilter[]>([]);
  private readonly _timeRange = signal<TimeRange>({ start: null, end: null });
  private readonly _caseSensitive = signal(false);

  // Public readonly signals
  readonly searchQuery = this._searchQuery.asReadonly();
  readonly isRegex = this._isRegex.asReadonly();
  readonly quickFilters = this._quickFilters.asReadonly();
  readonly timeRange = this._timeRange.asReadonly();
  readonly caseSensitive = this._caseSensitive.asReadonly();

  // Check if any filters are active
  readonly hasActiveFilters = computed(() => {
    return this._searchQuery().length > 0 ||
           this._quickFilters().length > 0 ||
           this._timeRange().start !== null ||
           this._timeRange().end !== null;
  });

  /**
   * Set search query
   */
  setSearchQuery(query: string): void {
    this._searchQuery.set(query);
  }

  /**
   * Toggle regex mode
   */
  toggleRegex(): void {
    this._isRegex.update(v => !v);
  }

  /**
   * Toggle case sensitivity
   */
  toggleCaseSensitive(): void {
    this._caseSensitive.update(v => !v);
  }

  /**
   * Set regex mode
   */
  setRegex(enabled: boolean): void {
    this._isRegex.set(enabled);
  }

  /**
   * Add a quick filter
   */
  addQuickFilter(field: string, value: string, operator: 'equals' | 'contains' | 'not_equals' = 'equals'): void {
    this._quickFilters.update(filters => {
      // Don't add duplicate filters
      const exists = filters.some(f => f.field === field && f.value === value && f.operator === operator);
      if (exists) return filters;
      return [...filters, { field, value, operator }];
    });
  }

  /**
   * Remove a quick filter
   */
  removeQuickFilter(index: number): void {
    this._quickFilters.update(filters => filters.filter((_, i) => i !== index));
  }

  /**
   * Clear all quick filters
   */
  clearQuickFilters(): void {
    this._quickFilters.set([]);
  }

  /**
   * Set time range
   */
  setTimeRange(start: Date | null, end: Date | null): void {
    this._timeRange.set({ start, end });
  }

  /**
   * Clear time range
   */
  clearTimeRange(): void {
    this._timeRange.set({ start: null, end: null });
  }

  /**
   * Clear all filters
   */
  clearAll(): void {
    this._searchQuery.set('');
    this._quickFilters.set([]);
    this._timeRange.set({ start: null, end: null });
  }

  /**
   * Filter logs based on current search state
   */
  filterLogs(logs: LogEntry[]): LogEntry[] {
    let filtered = logs;

    // Apply time range filter
    const timeRange = this._timeRange();
    if (timeRange.start || timeRange.end) {
      filtered = filtered.filter(entry => {
        const timestamp = new Date(entry['@timestamp']);
        if (timeRange.start && timestamp < timeRange.start) return false;
        if (timeRange.end && timestamp > timeRange.end) return false;
        return true;
      });
    }

    // Apply quick filters
    const quickFilters = this._quickFilters();
    if (quickFilters.length > 0) {
      filtered = filtered.filter(entry => {
        return quickFilters.every(filter => {
          const entryValue = String(entry[filter.field] ?? '');
          switch (filter.operator) {
            case 'equals':
              return entryValue === filter.value;
            case 'contains':
              return entryValue.toLowerCase().includes(filter.value.toLowerCase());
            case 'not_equals':
              return entryValue !== filter.value;
            default:
              return true;
          }
        });
      });
    }

    // Apply search query
    const query = this._searchQuery().trim();
    if (query.length > 0) {
      const isRegex = this._isRegex();
      const caseSensitive = this._caseSensitive();

      if (isRegex) {
        try {
          const regex = new RegExp(query, caseSensitive ? '' : 'i');
          filtered = filtered.filter(entry => this.matchesRegex(entry, regex));
        } catch {
          // Invalid regex, skip filtering
        }
      } else {
        const searchLower = caseSensitive ? query : query.toLowerCase();
        filtered = filtered.filter(entry => this.matchesSearch(entry, searchLower, caseSensitive));
      }
    }

    return filtered;
  }

  /**
   * Check if entry matches regex
   */
  private matchesRegex(entry: LogEntry, regex: RegExp): boolean {
    for (const value of Object.values(entry)) {
      if (value === null || value === undefined) continue;
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (regex.test(stringValue)) return true;
    }
    return false;
  }

  /**
   * Check if entry matches search query
   */
  private matchesSearch(entry: LogEntry, query: string, caseSensitive: boolean): boolean {
    for (const value of Object.values(entry)) {
      if (value === null || value === undefined) continue;
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const compareValue = caseSensitive ? stringValue : stringValue.toLowerCase();
      if (compareValue.includes(query)) return true;
    }
    return false;
  }

  /**
   * Highlight search matches in text
   */
  highlightMatches(text: string): string {
    const query = this._searchQuery().trim();
    if (!query) return this.escapeHtml(text);

    const isRegex = this._isRegex();
    const caseSensitive = this._caseSensitive();
    const escaped = this.escapeHtml(text);

    try {
      if (isRegex) {
        const regex = new RegExp(`(${query})`, caseSensitive ? 'g' : 'gi');
        return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
      } else {
        const flags = caseSensitive ? 'g' : 'gi';
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, flags);
        return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
      }
    } catch {
      return escaped;
    }
  }

  /**
   * Escape HTML for safe rendering
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
