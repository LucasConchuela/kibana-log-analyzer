import { Component, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { LogParserService, LogEntry } from './services/log-parser.service';
import { SearchService } from './services/search.service';
import { PayloadViewerComponent } from './components/payload-viewer.component';
import { HttpViewerComponent, HttpData } from './components/http-viewer.component';
import { SearchToolbarComponent } from './components/search-toolbar.component';
import { AnalyticsPanelComponent } from './components/analytics-panel.component';
import { DiffViewerComponent } from './components/diff-viewer.component';
import { ExportService } from './services/export.service';
import { BookmarkService } from './services/bookmark.service';
import { ColumnPresetService, ColumnPreset } from './services/column-preset.service';
import { HostListener, ViewChild } from '@angular/core';

/**
 * App Component - LogSynth
 * Industrial layout shell with Teenage Engineering x AXA aesthetic
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ScrollingModule, PayloadViewerComponent, HttpViewerComponent, SearchToolbarComponent, AnalyticsPanelComponent, DiffViewerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly logParser = inject(LogParserService);
  protected readonly searchService = inject(SearchService);
  protected readonly exportService = inject(ExportService);
  protected readonly bookmarkService = inject(BookmarkService);
  protected readonly columnPresetService = inject(ColumnPresetService);

  @ViewChild(DiffViewerComponent) diffViewer!: DiffViewerComponent;

  // State signals
  protected readonly isDragOver = signal(false);
  protected readonly selectedEntry = signal<LogEntry | null>(null);
  protected readonly visibleColumns = signal<string[]>(['@timestamp', 'level', 'message', 'http.method', 'http.status_code']);
  protected readonly showColumnSettings = signal(false);
  protected readonly inspectorTab = signal<'http' | 'raw'>('http');
  protected readonly isDarkMode = signal(this.loadThemePreference());
  protected readonly mainView = signal<'logs' | 'analytics'>('logs');

  constructor() {
    // Automatically sync theme with DOM and localStorage
    effect(() => {
      const isDark = this.isDarkMode();
      localStorage.setItem('logsynth-theme', isDark ? 'dark' : 'light');
      if (isDark) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    });
  }

  // Computed from service
  protected readonly logs = this.logParser.logs;
  protected readonly isLoading = this.logParser.isLoading;
  protected readonly error = this.logParser.error;
  protected readonly hasLogs = this.logParser.hasLogs;
  protected readonly logCount = this.logParser.logCount;
  protected readonly availableColumns = computed(() => this.logParser.getAvailableColumns());

  // Filtered logs based on search
  protected readonly filteredLogs = computed(() => {
    return this.searchService.filterLogs(this.logs());
  });

  protected readonly filteredLogCount = computed(() => this.filteredLogs().length);

  // Check if entry has HTTP data
  protected readonly hasHttpData = computed(() => {
    const entry = this.selectedEntry();
    if (!entry) return false;
    return !!(entry['http.method'] || entry['http.url'] || entry['http.request.body'] || entry['http.response.body']);
  });

  // Extract HTTP data from log entry
  protected readonly httpData = computed<HttpData>(() => {
    const entry = this.selectedEntry();
    if (!entry) return {};

    // Extract and parse headers from nested objects or stringified JSON
    const parseHeaders = (value: unknown): Record<string, string> => {
      if (!value) return {};
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      }
      if (typeof value === 'object') {
        return value as Record<string, string>;
      }
      return {};
    };

    // Extract body - could be stringified or object
    const extractBody = (value: unknown): string => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      return JSON.stringify(value, null, 2);
    };

    return {
      method: entry['http.method'] as string || undefined,
      url: entry['http.url'] as string || undefined,
      statusCode: entry['http.status_code'] as number || undefined,
      statusText: entry['http.status_text'] as string || undefined,
      duration: entry['http.duration_ms'] as number || undefined,
      requestHeaders: parseHeaders(entry['http.request.headers']),
      responseHeaders: parseHeaders(entry['http.response.headers']),
      requestBody: extractBody(entry['http.request.body']),
      responseBody: extractBody(entry['http.response.body'])
    };
  });

  // Computed for raw payload viewer (fallback)
  protected readonly selectedPayload = computed(() => {
    const entry = this.selectedEntry();
    if (!entry) return null;

    // Look for common payload field names
    const payloadFields = ['request', 'response', 'payload', 'xml', 'body', 'data', 'content'];
    for (const field of payloadFields) {
      if (entry[field] && typeof entry[field] === 'string') {
        return { field, content: entry[field] as string };
      }
    }
    
    // Return the full entry as JSON if no specific payload field
    return { field: 'entry', content: JSON.stringify(entry, null, 2) };
  });

  // Drag and drop handlers
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File): void {
    const validTypes = ['.json', '.log', '.txt', '.ndjson'];
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(extension)) {
      console.error('Invalid file type. Please upload .json, .log, .txt, or .ndjson files.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      this.logParser.parseLogFile(content, file.name);
    };
    reader.readAsText(file);
  }

  // Load sample data
  async loadSampleData(): Promise<void> {
    try {
      const url = new URL('sample-http-logs.json', document.baseURI).href;
      const response = await fetch(url);
      const content = await response.text();
      this.logParser.parseLogFile(content, 'sample-http-logs.json');
    } catch (err) {
      console.error('Failed to load sample data:', err);
    }
  }

  // Row selection
  selectEntry(entry: LogEntry, event?: MouseEvent): void {
    // Diff Viewer: Shift+Click
    if (event?.shiftKey) {
      this.openDiffViewer(entry, event);
      return;
    }

    this.selectedEntry.set(entry);
    // Auto-select HTTP tab if entry has HTTP data
    if (entry['http.method'] || entry['http.url']) {
      this.inspectorTab.set('http');
    }
  }

  closeInspector(): void {
    this.selectedEntry.set(null);
  }

  // Tab switching
  setInspectorTab(tab: 'http' | 'raw'): void {
    this.inspectorTab.set(tab);
  }

  // Column management
  toggleColumnSettings(): void {
    this.showColumnSettings.update(v => !v);
  }

  toggleColumn(column: string): void {
    this.visibleColumns.update(cols => {
      if (cols.includes(column)) {
        return cols.filter(c => c !== column);
      }
      return [...cols, column];
    });
  }

  isColumnVisible(column: string): boolean {
    return this.visibleColumns().includes(column);
  }

  // --- Keyboard Shortcuts ---

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey) return; // Ignore if modifier keys are pressed (except simple navigation)

    // Arrow navigation
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const logs = this.filteredLogs();
      if (logs.length === 0) return;

      const current = this.selectedEntry();
      const index = current ? logs.findIndex(l => l._id === current._id) : -1;
      
      let newIndex = index;
      if (event.key === 'ArrowDown') {
        newIndex = index < logs.length - 1 ? index + 1 : index;
      } else if (event.key === 'ArrowUp') {
        newIndex = index > 0 ? index - 1 : index;
      }

      if (newIndex !== index && newIndex >= 0) {
        event.preventDefault();
        this.selectEntry(logs[newIndex]);
        // TODO: Scroll into view logic if needed
      }
    }

    // Escape to close inspector or diff viewer
    if (event.key === 'Escape') {
      if (this.diffViewer?.isOpen()) {
        this.diffViewer.close();
      } else if (this.selectedEntry()) {
        this.selectedEntry.set(null);
      }
    }
  }

  // --- Column Resizing ---
  protected resizingColumn: string | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;

  @HostListener('document:mousemove', ['$event'])
  onResize(event: MouseEvent) {
    if (!this.resizingColumn) return;
    
    event.preventDefault(); // Prevent text selection
    const deltaX = event.clientX - this.resizeStartX;
    const newWidth = this.resizeStartWidth + deltaX;
    
    this.columnPresetService.updateColumnWidth(this.resizingColumn, newWidth);
  }

  @HostListener('document:mouseup')
  onResizeEnd() {
    if (this.resizingColumn) {
      this.resizingColumn = null;
      document.body.style.cursor = '';
    }
  }

  onResizeStart(event: MouseEvent, column: string) {
    event.preventDefault();
    event.stopPropagation();
    
    const width = this.columnPresetService.getColumnWidth(column);
    // If no explicit width, calculate current computed width
    if (width) {
      this.resizeStartWidth = width;
    } else {
       // Fallback: estimate or get from DOM if possible, but for now default to 150
       // Better approach: get the header element width
       const header = (event.target as HTMLElement).closest('.th');
       this.resizeStartWidth = header ? header.getBoundingClientRect().width : 120;
    }

    this.resizingColumn = column;
    this.resizeStartX = event.clientX;
    document.body.style.cursor = 'col-resize';
  }

  getColumnStyle(column: string): Record<string, string> {
    const width = this.columnPresetService.getColumnWidth(column);
    if (width) {
      return { 
        'width': `${width}px`, 
        'flex': 'none',
        'min-width': `${width}px`,
        'max-width': `${width}px` 
      };
    }
    return {};
  }

  // --- Diff Viewer ---

  openDiffViewer(entry: LogEntry, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault(); // Prevent text selection
    }
    
    if (!this.diffViewer.isOpen()) {
       // If standard click was on first entry, use it as left
       if (this.selectedEntry()) {
         this.diffViewer.addEntry(this.selectedEntry()!);
       }
       this.diffViewer.open();
    }
    
    this.diffViewer.addEntry(entry);
  }



  // --- Export ---
  exportJson(): void {
    this.exportService.exportToJson(this.filteredLogs());
  }

  exportCsv(): void {
    this.exportService.exportToCsv(this.filteredLogs());
  }

  // --- Utility ---
  
  clearLogs(): void {
    this.logParser.clearLogs();
    this.selectedEntry.set(null);
    this.searchService.clearAll();
  }

  formatCellValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  formatCellValueWithHighlight(value: unknown): string {
    const text = this.formatCellValue(value);
    return this.searchService.highlightMatches(text);
  }
  
  onCellClick(event: MouseEvent, column: string, value: unknown): void {
    if (event.ctrlKey || event.metaKey) {
      event.stopPropagation();
      event.preventDefault();
      const stringValue = value === null || value === undefined ? '' : String(value);
      this.searchService.addQuickFilter(column, stringValue, 'equals');
    }
  }

  // --- Helpers related to template usage ---
  
  getPresetClass(preset: ColumnPreset): string {
    return this.columnPresetService.activePresetId() === preset.id ? 'active' : '';
  }

  savePreset(name: string): void {
    if (!name.trim()) return;
    this.columnPresetService.savePreset(name, this.visibleColumns());
    // Select the new preset
    const newPreset = this.columnPresetService.getAllPresets().find(p => p.name === name);
    if (newPreset) {
      this.columnPresetService.setActivePreset(newPreset.id);
    }
  }

  loadPreset(preset: ColumnPreset): void {
    this.visibleColumns.set(preset.columns);
    this.columnPresetService.setActivePreset(preset.id);
  }

  trackByLogId(index: number, entry: LogEntry): string {
    return entry._id;
  }



  getStatusPillClass(status: unknown): string {
    const code = Number(status);
    if (isNaN(code)) return '';
    if (code >= 200 && code < 300) return 'status-2xx';
    if (code >= 300 && code < 400) return 'status-3xx';
    if (code >= 400 && code < 500) return 'status-4xx';
    if (code >= 500) return 'status-5xx';
    return 'status-unknown';
  }

  getRowClass(entry: LogEntry): string {
    const level = entry.level?.toLowerCase();
    if (level === 'error' || level === 'fatal' || level === 'critical') return 'bg-log-error';
    if (level === 'warn' || level === 'warning') return 'bg-log-warn';
    if (level === 'info') return 'bg-log-info';
    return '';
  }

  toggleDarkMode(): void {
    this.isDarkMode.update(v => !v);
  }

  private loadThemePreference(): boolean {
    return localStorage.getItem('logsynth-theme') === 'dark';
  }
}
