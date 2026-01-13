import { Injectable, computed, inject } from '@angular/core';
import { LogParserService, LogEntry } from './log-parser.service';
import { SearchService } from './search.service';

/**
 * Analytics Service
 * Computes statistics from log data for visualization.
 */

export interface LevelCount {
  level: string;
  count: number;
  percentage: number;
  color: string;
}

export interface StatusCount {
  category: string;
  count: number;
  percentage: number;
  color: string;
}

export interface TimelineBucket {
  time: Date;
  label: string;
  count: number;
  maxCount: number;
}

export interface DurationPoint {
  time: Date;
  label: string;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  p95Duration: number;
}

export interface ErrorRateBucket {
  time: Date;
  label: string;
  errorRate: number;
  errorCount: number;
  totalCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly logParser = inject(LogParserService);
  private readonly searchService = inject(SearchService);

  // Use filtered logs for analytics
  private readonly filteredLogs = computed(() => {
    return this.searchService.filterLogs(this.logParser.logs());
  });

  /**
   * Log level distribution
   */
  readonly levelDistribution = computed<LevelCount[]>(() => {
    const logs = this.filteredLogs();
    const counts = new Map<string, number>();
    
    for (const log of logs) {
      const level = (log.level || 'UNKNOWN').toUpperCase();
      counts.set(level, (counts.get(level) || 0) + 1);
    }

    const total = logs.length;
    const levelColors: Record<string, string> = {
      'ERROR': '#C62828',
      'FATAL': '#AD1457',
      'CRITICAL': '#AD1457',
      'WARN': '#E65100',
      'WARNING': '#E65100',
      'INFO': '#1565C0',
      'DEBUG': '#2E7D32',
      'TRACE': '#455A64',
      'UNKNOWN': '#888888'
    };

    // Sort by priority: ERROR/FATAL first, then by count
    const priority = ['ERROR', 'FATAL', 'CRITICAL', 'WARN', 'WARNING', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN'];
    
    return Array.from(counts.entries())
      .sort((a, b) => {
        const aPriority = priority.indexOf(a[0]);
        const bPriority = priority.indexOf(b[0]);
        if (aPriority !== bPriority) return aPriority - bPriority;
        return b[1] - a[1];
      })
      .map(([level, count]) => ({
        level,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        color: levelColors[level] || '#888888'
      }));
  });

  /**
   * HTTP status code distribution
   */
  readonly statusDistribution = computed<StatusCount[]>(() => {
    const logs = this.filteredLogs();
    const counts = {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0
    };

    for (const log of logs) {
      const status = log['http.status_code'];
      if (typeof status === 'number') {
        if (status >= 200 && status < 300) counts['2xx']++;
        else if (status >= 300 && status < 400) counts['3xx']++;
        else if (status >= 400 && status < 500) counts['4xx']++;
        else if (status >= 500) counts['5xx']++;
      }
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const colors: Record<string, string> = {
      '2xx': '#2E7D32',
      '3xx': '#E65100',
      '4xx': '#C62828',
      '5xx': '#AD1457'
    };

    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([category, count]) => ({
        category,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        color: colors[category]
      }));
  });

  /**
   * Timeline histogram - log frequency over time
   */
  readonly timelineData = computed<TimelineBucket[]>(() => {
    const logs = this.filteredLogs();
    if (logs.length === 0) return [];

    // Parse timestamps and sort
    const timestamps = logs
      .map(log => new Date(log['@timestamp']))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (timestamps.length === 0) return [];

    const minTime = timestamps[0].getTime();
    const maxTime = timestamps[timestamps.length - 1].getTime();
    const range = maxTime - minTime;

    // Determine bucket size based on range
    let bucketMs: number;
    let formatLabel: (d: Date) => string;

    if (range < 60 * 60 * 1000) {
      // Less than 1 hour: 1-minute buckets
      bucketMs = 60 * 1000;
      formatLabel = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (range < 24 * 60 * 60 * 1000) {
      // Less than 1 day: 15-minute buckets
      bucketMs = 15 * 60 * 1000;
      formatLabel = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (range < 7 * 24 * 60 * 60 * 1000) {
      // Less than 1 week: 1-hour buckets
      bucketMs = 60 * 60 * 1000;
      formatLabel = (d) => d.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
    } else {
      // More than 1 week: 1-day buckets
      bucketMs = 24 * 60 * 60 * 1000;
      formatLabel = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    // Create buckets
    const buckets = new Map<number, number>();
    for (const ts of timestamps) {
      const bucketKey = Math.floor(ts.getTime() / bucketMs) * bucketMs;
      buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + 1);
    }

    const maxCount = Math.max(...buckets.values());

    // Fill in empty buckets for continuity
    const result: TimelineBucket[] = [];
    const startBucket = Math.floor(minTime / bucketMs) * bucketMs;
    const endBucket = Math.floor(maxTime / bucketMs) * bucketMs;

    for (let bucket = startBucket; bucket <= endBucket; bucket += bucketMs) {
      const time = new Date(bucket);
      result.push({
        time,
        label: formatLabel(time),
        count: buckets.get(bucket) || 0,
        maxCount
      });
    }

    // Limit to max 30 buckets for readability
    if (result.length > 30) {
      const step = Math.ceil(result.length / 30);
      return result.filter((_, i) => i % step === 0);
    }

    return result;
  });

  /**
   * Summary statistics
   */
  readonly summary = computed(() => {
    const logs = this.filteredLogs();
    const levels = this.levelDistribution();
    const statuses = this.statusDistribution();

    const errorCount = levels
      .filter(l => ['ERROR', 'FATAL', 'CRITICAL'].includes(l.level))
      .reduce((sum, l) => sum + l.count, 0);

    const successRate = statuses.length > 0
      ? (statuses.find(s => s.category === '2xx')?.percentage || 0)
      : 0;

    // Calculate average duration
    const durations = logs
      .map(log => log['http.duration_ms'])
      .filter((d): d is number => typeof d === 'number');
    const avgDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;

    return {
      totalLogs: logs.length,
      errorCount,
      errorRate: logs.length > 0 ? (errorCount / logs.length) * 100 : 0,
      successRate,
      avgDuration
    };
  });

  /**
   * Duration evolution over time
   */
  readonly durationEvolution = computed<DurationPoint[]>(() => {
    const logs = this.filteredLogs();
    if (logs.length === 0) return [];

    // Get logs with both timestamp and duration
    const dataPoints = logs
      .map(log => ({
        time: new Date(log['@timestamp']),
        duration: log['http.duration_ms'] as number
      }))
      .filter(d => !isNaN(d.time.getTime()) && typeof d.duration === 'number')
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    if (dataPoints.length < 2) return [];

    const minTime = dataPoints[0].time.getTime();
    const maxTime = dataPoints[dataPoints.length - 1].time.getTime();
    const range = maxTime - minTime;

    // Use 5-minute buckets for most cases
    const bucketMs = range < 60 * 60 * 1000 ? 5 * 60 * 1000 : 15 * 60 * 1000;
    const formatLabel = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Group by bucket
    const buckets = new Map<number, number[]>();
    for (const point of dataPoints) {
      const bucketKey = Math.floor(point.time.getTime() / bucketMs) * bucketMs;
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
      buckets.get(bucketKey)!.push(point.duration);
    }

    // Calculate stats for each bucket
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bucketTime, durations]) => {
        durations.sort((a, b) => a - b);
        const p95Index = Math.floor(durations.length * 0.95);
        
        return {
          time: new Date(bucketTime),
          label: formatLabel(new Date(bucketTime)),
          avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
          maxDuration: Math.max(...durations),
          minDuration: Math.min(...durations),
          p95Duration: durations[p95Index] || durations[durations.length - 1]
        };
      });
  });

  /**
   * Error rate evolution over time
   */
  readonly errorRateEvolution = computed<ErrorRateBucket[]>(() => {
    const logs = this.filteredLogs();
    if (logs.length === 0) return [];

    // Get logs with timestamps
    const dataPoints = logs
      .map(log => ({
        time: new Date(log['@timestamp']),
        isError: ['ERROR', 'FATAL', 'CRITICAL'].includes((log.level || '').toUpperCase())
      }))
      .filter(d => !isNaN(d.time.getTime()))
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    if (dataPoints.length < 2) return [];

    const minTime = dataPoints[0].time.getTime();
    const maxTime = dataPoints[dataPoints.length - 1].time.getTime();
    const range = maxTime - minTime;

    const bucketMs = range < 60 * 60 * 1000 ? 5 * 60 * 1000 : 15 * 60 * 1000;
    const formatLabel = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Group by bucket
    const buckets = new Map<number, { errors: number; total: number }>();
    for (const point of dataPoints) {
      const bucketKey = Math.floor(point.time.getTime() / bucketMs) * bucketMs;
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, { errors: 0, total: 0 });
      const bucket = buckets.get(bucketKey)!;
      bucket.total++;
      if (point.isError) bucket.errors++;
    }

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bucketTime, data]) => ({
        time: new Date(bucketTime),
        label: formatLabel(new Date(bucketTime)),
        errorRate: data.total > 0 ? (data.errors / data.total) * 100 : 0,
        errorCount: data.errors,
        totalCount: data.total
      }));
  });
}
