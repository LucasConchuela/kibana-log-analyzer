import { Injectable, signal, computed } from '@angular/core';

/**
 * Log Parser Service
 * Handles parsing of Kibana/Elastic log files, JSON/XML detection,
 * string unescaping, and content formatting.
 */

export interface LogEntry {
  _id: string;
  _index?: string;
  '@timestamp': string;
  level?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ParsedContent {
  type: 'json' | 'xml' | 'text';
  formatted: string;
  raw: string;
}

export type ContentType = 'json' | 'xml' | 'text' | 'unknown';

@Injectable({
  providedIn: 'root'
})
export class LogParserService {
  // Reactive state using signals
  private readonly _logs = signal<LogEntry[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Public computed signals
  readonly logs = this._logs.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly logCount = computed(() => this._logs().length);
  readonly hasLogs = computed(() => this._logs().length > 0);

  /**
   * Parse a log file content (JSON, NDJSON, or plain text)
   */
  parseLogFile(content: string, filename: string): void {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const trimmed = content.trim();
      let entries: LogEntry[] = [];

      // Try parsing as JSON array first
      if (trimmed.startsWith('[')) {
        entries = this.parseJsonArray(trimmed);
      }
      // Try parsing as NDJSON (newline-delimited JSON)
      else if (trimmed.startsWith('{')) {
        entries = this.parseNdjson(trimmed);
      }
      // Plain text logs
      else {
        entries = this.parsePlainText(trimmed, filename);
      }

      this._logs.set(entries);
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Failed to parse log file');
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Parse JSON array of log entries
   */
  private parseJsonArray(content: string): LogEntry[] {
    const parsed = JSON.parse(content);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Expected JSON array');
    }

    return parsed.map((entry, index) => this.normalizeEntry(entry, index));
  }

  /**
   * Parse newline-delimited JSON (NDJSON)
   */
  private parseNdjson(content: string): LogEntry[] {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map((line, index) => {
      try {
        const parsed = JSON.parse(line);
        return this.normalizeEntry(parsed, index);
      } catch {
        return this.createTextEntry(line, index);
      }
    });
  }

  /**
   * Parse plain text log file
   */
  private parsePlainText(content: string, filename: string): LogEntry[] {
    const lines = content.split('\n');
    return lines.map((line, index) => this.createTextEntry(line, index));
  }

  /**
   * Normalize a log entry to ensure required fields
   */
  private normalizeEntry(entry: Record<string, unknown>, index: number): LogEntry {
    const flattened = this.flattenObject(entry);
    
    return {
      _id: (entry['_id'] as string) || `entry-${index}`,
      _index: entry['_index'] as string | undefined,
      '@timestamp': this.detectTimestamp(flattened) || new Date().toISOString(),
      level: this.detectLevel(flattened),
      message: this.detectMessage(flattened),
      ...flattened
    };
  }

  /**
   * Create a text-only log entry
   */
  private createTextEntry(line: string, index: number): LogEntry {
    const timestamp = this.extractTimestampFromLine(line);
    const level = this.extractLevelFromLine(line);

    return {
      _id: `line-${index}`,
      '@timestamp': timestamp || new Date().toISOString(),
      level,
      message: line,
      _raw: line
    };
  }

  /**
   * Flatten a nested object into dot-notation keys
   */
  flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, newKey));
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }

  /**
   * Detect timestamp field from common patterns
   */
  private detectTimestamp(entry: Record<string, unknown>): string | null {
    const timestampFields = ['@timestamp', 'timestamp', 'time', 'datetime', 'date', 'created_at'];
    
    for (const field of timestampFields) {
      if (entry[field] && typeof entry[field] === 'string') {
        return entry[field] as string;
      }
    }

    return null;
  }

  /**
   * Detect log level from common patterns
   */
  private detectLevel(entry: Record<string, unknown>): string | undefined {
    const levelFields = ['level', 'log.level', 'severity', 'loglevel'];
    
    for (const field of levelFields) {
      if (entry[field]) {
        return String(entry[field]).toUpperCase();
      }
    }

    return undefined;
  }

  /**
   * Detect message field from common patterns
   */
  private detectMessage(entry: Record<string, unknown>): string | undefined {
    const messageFields = ['message', 'msg', 'text', 'log', 'log.message'];
    
    for (const field of messageFields) {
      if (entry[field] && typeof entry[field] === 'string') {
        return entry[field] as string;
      }
    }

    return undefined;
  }

  /**
   * Extract timestamp from a text line
   */
  private extractTimestampFromLine(line: string): string | null {
    // ISO 8601 pattern
    const isoMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:?\d{2})?/);
    if (isoMatch) return isoMatch[0];

    // Common log format pattern
    const commonMatch = line.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/);
    if (commonMatch) return commonMatch[0];

    return null;
  }

  /**
   * Extract log level from a text line
   */
  private extractLevelFromLine(line: string): string | undefined {
    const levelMatch = line.match(/\b(DEBUG|INFO|WARN|WARNING|ERROR|FATAL|TRACE|CRITICAL)\b/i);
    return levelMatch ? levelMatch[1].toUpperCase() : undefined;
  }

  /**
   * Detect content type (JSON, XML, or plain text)
   */
  detectContentType(content: string): ContentType {
    if (!content || typeof content !== 'string') return 'unknown';

    const trimmed = content.trim();

    // Check for escaped JSON first
    if (trimmed.startsWith('\\"') || trimmed.startsWith('\\{')) {
      const unescaped = this.unescapeString(trimmed);
      return this.detectContentType(unescaped);
    }

    // JSON detection
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {
        // Not valid JSON, continue checking
      }
    }

    // XML detection
    if (trimmed.startsWith('<?xml') || 
        trimmed.startsWith('<') && trimmed.endsWith('>') && this.looksLikeXml(trimmed)) {
      return 'xml';
    }

    // Check for SOAP envelope
    if (trimmed.includes('<soap:Envelope') || trimmed.includes('<SOAP-ENV:')) {
      return 'xml';
    }

    return 'text';
  }

  /**
   * Basic XML structure check
   */
  private looksLikeXml(content: string): boolean {
    // Check for matching tags
    const tagMatch = content.match(/<(\w+)[^>]*>/);
    if (!tagMatch) return false;

    const tagName = tagMatch[1];
    return content.includes(`</${tagName}>`);
  }

  /**
   * Safely unescape a string (handles escaped JSON)
   */
  unescapeString(str: string): string {
    if (!str) return str;

    try {
      // Handle double-escaped strings
      let result = str;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        // Check if it's a JSON string that needs unescaping
        if (result.startsWith('"') && result.endsWith('"')) {
          const parsed = JSON.parse(result);
          if (typeof parsed === 'string') {
            result = parsed;
            attempts++;
            continue;
          }
        }
        
        // Check for escaped characters
        if (result.includes('\\"') || result.includes('\\n') || result.includes('\\t')) {
          const unescaped = result
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r')
            .replace(/\\\\/g, '\\');
          
          if (unescaped !== result) {
            result = unescaped;
            attempts++;
            continue;
          }
        }

        break;
      }

      return result;
    } catch {
      return str;
    }
  }

  /**
   * Parse and format content based on its type
   */
  parseContent(content: string): ParsedContent {
    const unescaped = this.unescapeString(content);
    const type = this.detectContentType(unescaped);

    switch (type) {
      case 'json':
        return {
          type: 'json',
          formatted: this.formatJson(unescaped),
          raw: unescaped
        };
      case 'xml':
        return {
          type: 'xml',
          formatted: this.formatXml(unescaped),
          raw: unescaped
        };
      default:
        return {
          type: 'text',
          formatted: unescaped,
          raw: unescaped
        };
    }
  }

  /**
   * Pretty-print JSON with indentation
   */
  formatJson(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  /**
   * Pretty-print XML with indentation
   */
  formatXml(xml: string): string {
    try {
      let formatted = '';
      let indent = 0;
      const tab = '  ';

      // Remove existing whitespace between tags
      xml = xml.replace(/>\s*</g, '><').trim();

      // Split by tags
      const parts = xml.split(/(<[^>]+>)/g).filter(Boolean);

      for (const part of parts) {
        if (part.startsWith('</')) {
          // Closing tag - decrease indent first
          indent = Math.max(0, indent - 1);
          formatted += tab.repeat(indent) + part + '\n';
        } else if (part.startsWith('<?')) {
          // XML declaration
          formatted += part + '\n';
        } else if (part.startsWith('<') && part.endsWith('/>')) {
          // Self-closing tag
          formatted += tab.repeat(indent) + part + '\n';
        } else if (part.startsWith('<')) {
          // Opening tag
          formatted += tab.repeat(indent) + part + '\n';
          indent++;
        } else if (part.trim()) {
          // Text content
          formatted += tab.repeat(indent) + part.trim() + '\n';
        }
      }

      return formatted.trim();
    } catch {
      return xml;
    }
  }

  /**
   * Clear all loaded logs
   */
  clearLogs(): void {
    this._logs.set([]);
    this._error.set(null);
  }

  /**
   * Get all unique keys from loaded logs
   */
  getAvailableColumns(): string[] {
    const logs = this._logs();
    if (logs.length === 0) return [];

    const keys = new Set<string>();
    
    for (const log of logs) {
      for (const key of Object.keys(log)) {
        keys.add(key);
      }
    }

    // Sort with common fields first
    const priorityFields = ['@timestamp', 'level', 'message', '_id', '_index'];
    const allKeys = Array.from(keys);
    
    return [
      ...priorityFields.filter(f => allKeys.includes(f)),
      ...allKeys.filter(k => !priorityFields.includes(k)).sort()
    ];
  }
}
