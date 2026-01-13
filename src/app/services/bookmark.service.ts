import { Injectable, signal, computed } from '@angular/core';
import { LogEntry } from './log-parser.service';

/**
 * Bookmark Service
 * Manages bookmarked log entries for quick reference.
 */

export interface Bookmark {
  id: string;
  entryId: string;
  entry: LogEntry;
  note: string;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class BookmarkService {
  private readonly _bookmarks = signal<Bookmark[]>(this.loadFromStorage());

  readonly bookmarks = this._bookmarks.asReadonly();
  readonly bookmarkCount = computed(() => this._bookmarks().length);
  readonly bookmarkedIds = computed(() => new Set(this._bookmarks().map(b => b.entryId)));

  /**
   * Check if an entry is bookmarked
   */
  isBookmarked(entryId: string): boolean {
    return this.bookmarkedIds().has(entryId);
  }

  /**
   * Toggle bookmark for an entry
   */
  toggleBookmark(entry: LogEntry, note: string = ''): void {
    if (this.isBookmarked(entry._id)) {
      this.removeBookmark(entry._id);
    } else {
      this.addBookmark(entry, note);
    }
  }

  /**
   * Add a bookmark
   */
  addBookmark(entry: LogEntry, note: string = ''): void {
    if (this.isBookmarked(entry._id)) return;

    const bookmark: Bookmark = {
      id: `bm-${Date.now()}`,
      entryId: entry._id,
      entry: { ...entry },
      note,
      createdAt: new Date()
    };

    this._bookmarks.update(list => [...list, bookmark]);
    this.saveToStorage();
  }

  /**
   * Remove a bookmark
   */
  removeBookmark(entryId: string): void {
    this._bookmarks.update(list => list.filter(b => b.entryId !== entryId));
    this.saveToStorage();
  }

  /**
   * Update bookmark note
   */
  updateNote(entryId: string, note: string): void {
    this._bookmarks.update(list => 
      list.map(b => b.entryId === entryId ? { ...b, note } : b)
    );
    this.saveToStorage();
  }

  /**
   * Clear all bookmarks
   */
  clearAll(): void {
    this._bookmarks.set([]);
    this.saveToStorage();
  }

  /**
   * Get bookmarked entries
   */
  getBookmarkedEntries(): LogEntry[] {
    return this._bookmarks().map(b => b.entry);
  }

  /**
   * Load bookmarks from localStorage
   */
  private loadFromStorage(): Bookmark[] {
    try {
      const stored = localStorage.getItem('logsynth-bookmarks');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return parsed.map((b: Bookmark) => ({
        ...b,
        createdAt: new Date(b.createdAt)
      }));
    } catch {
      return [];
    }
  }

  /**
   * Save bookmarks to localStorage
   */
  private saveToStorage(): void {
    localStorage.setItem('logsynth-bookmarks', JSON.stringify(this._bookmarks()));
  }
}
