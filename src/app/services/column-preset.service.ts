import { Injectable, signal } from '@angular/core';

/**
 * Column Preset Service
 * Manages saved column configurations for quick switching.
 */

export interface ColumnPreset {
  id: string;
  name: string;
  columns: string[];
  createdAt: Date;
}

const DEFAULT_PRESETS: ColumnPreset[] = [
  {
    id: 'preset-http',
    name: 'HTTP Focus',
    columns: ['@timestamp', 'http.method', 'http.url', 'http.status_code', 'http.duration_ms'],
    createdAt: new Date()
  },
  {
    id: 'preset-errors',
    name: 'Error Analysis',
    columns: ['@timestamp', 'level', 'message', 'http.status_code'],
    createdAt: new Date()
  },
  {
    id: 'preset-minimal',
    name: 'Minimal',
    columns: ['@timestamp', 'message'],
    createdAt: new Date()
  }
];

@Injectable({
  providedIn: 'root'
})
export class ColumnPresetService {
  private readonly _presets = signal<ColumnPreset[]>(this.loadFromStorage());
  private readonly _activePresetId = signal<string | null>(null);

  readonly presets = this._presets.asReadonly();
  readonly activePresetId = this._activePresetId.asReadonly();

  private readonly _columnWidths = signal<Record<string, number>>(this.loadWidthsFromStorage());
  readonly columnWidths = this._columnWidths.asReadonly();

  /**
   * Get all presets (built-in + custom)
   */
  getAllPresets(): ColumnPreset[] {
    return [...DEFAULT_PRESETS, ...this._presets()];
  }

  /**
   * Update width for a specific column
   */
  updateColumnWidth(column: string, width: number): void {
    this._columnWidths.update(widths => ({
      ...widths,
      [column]: Math.max(50, width) // Min width 50px
    }));
    this.saveWidthsToStorage();
  }

  /**
   * Get width for a column (or default)
   */
  getColumnWidth(column: string): number | null {
    return this._columnWidths()[column] || null;
  }

  /**
   * Save a new preset
   */
  savePreset(name: string, columns: string[]): void {
    const preset: ColumnPreset = {
      id: `preset-${Date.now()}`,
      name,
      columns: [...columns],
      createdAt: new Date()
    };

    this._presets.update(list => [...list, preset]);
    this.saveToStorage();
  }

  /**
   * Delete a custom preset
   */
  deletePreset(presetId: string): void {
    // Don't allow deleting default presets
    if (presetId.startsWith('preset-http') || 
        presetId.startsWith('preset-errors') || 
        presetId.startsWith('preset-minimal')) {
      return;
    }

    this._presets.update(list => list.filter(p => p.id !== presetId));
    this.saveToStorage();
  }

  /**
   * Get preset by ID
   */
  getPreset(presetId: string): ColumnPreset | undefined {
    return this.getAllPresets().find(p => p.id === presetId);
  }

  /**
   * Set active preset
   */
  setActivePreset(presetId: string | null): void {
    this._activePresetId.set(presetId);
  }

  /**
   * Load presets from localStorage
   */
  private loadFromStorage(): ColumnPreset[] {
    try {
      const stored = localStorage.getItem('logsynth-column-presets');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return parsed.map((p: ColumnPreset) => ({
        ...p,
        createdAt: new Date(p.createdAt)
      }));
    } catch {
      return [];
    }
  }

  /**
   * Load widths from localStorage
   */
  private loadWidthsFromStorage(): Record<string, number> {
    try {
      const stored = localStorage.getItem('logsynth-column-widths');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Save presets to localStorage
   */
  private saveToStorage(): void {
    localStorage.setItem('logsynth-column-presets', JSON.stringify(this._presets()));
  }

  /**
   * Save widths to localStorage
   */
  private saveWidthsToStorage(): void {
    localStorage.setItem('logsynth-column-widths', JSON.stringify(this._columnWidths()));
  }
}
