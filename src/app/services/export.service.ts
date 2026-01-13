import { Injectable, inject } from '@angular/core';
import { LogEntry } from './log-parser.service';

/**
 * Export Service
 * Handles exporting log data to JSON and CSV formats.
 */
@Injectable({
  providedIn: 'root'
})
export class ExportService {

  /**
   * Export logs to JSON file
   */
  exportToJson(logs: LogEntry[], filename: string = 'logs-export'): void {
    const data = JSON.stringify(logs, null, 2);
    this.downloadFile(data, `${filename}.json`, 'application/json');
  }

  /**
   * Export logs to CSV file
   */
  exportToCsv(logs: LogEntry[], filename: string = 'logs-export'): void {
    if (logs.length === 0) return;

    // Get all unique columns from all logs
    const allColumns = new Set<string>();
    logs.forEach(log => {
      Object.keys(log).forEach(key => allColumns.add(key));
    });
    const columns = Array.from(allColumns).sort();

    // Create CSV header
    const header = columns.map(col => this.escapeCsvValue(col)).join(',');

    // Create CSV rows
    const rows = logs.map(log => {
      return columns.map(col => {
        const value = log[col];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return this.escapeCsvValue(JSON.stringify(value));
        return this.escapeCsvValue(String(value));
      }).join(',');
    });

    const csv = [header, ...rows].join('\n');
    this.downloadFile(csv, `${filename}.csv`, 'text/csv');
  }

  /**
   * Escape CSV value (handle commas, quotes, newlines)
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Trigger file download
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
