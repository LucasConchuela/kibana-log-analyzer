import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService } from '../services/analytics.service';

/**
 * Analytics Panel Component
 * Full-view analytics with log levels, HTTP status, duration evolution, and error rate evolution.
 */
@Component({
  selector: 'app-analytics-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="analytics-panel">
      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card">
          <span class="card-value">{{ analytics.summary().totalLogs }}</span>
          <span class="card-label">TOTAL LOGS</span>
        </div>
        <div class="summary-card error">
          <span class="card-value">{{ analytics.summary().errorCount }}</span>
          <span class="card-label">ERRORS</span>
        </div>
        <div class="summary-card" [class.warning]="analytics.summary().errorRate > 5">
          <span class="card-value">{{ analytics.throughput() | number:'1.1-1' }}</span>
          <span class="card-label">REQ / MIN</span>
        </div>
        <div class="summary-card success">
          <span class="card-value">{{ analytics.summary().successRate | number:'1.1-1' }}%</span>
          <span class="card-label">SUCCESS RATE</span>
        </div>
        <div class="summary-card">
          <span class="card-value">{{ analytics.summary().avgDuration | number:'1.0-0' }}ms</span>
          <span class="card-label">AVG DURATION</span>
        </div>
      </div>

      <!-- Main Grid -->
      <div class="analytics-grid">
        
        <!-- ROW 1: Distribution Charts -->
        <div class="grid-row three-col">
          <!-- Log Level -->
          <div class="chart-container">
            <div class="chart-header">
              <span class="chart-title">LOG LEVELS</span>
            </div>
            <div class="bar-chart">
              @for (item of analytics.levelDistribution(); track item.level) {
                <div class="bar-row">
                  <span class="bar-label">{{ item.level }}</span>
                  <div class="bar-track">
                    <div class="bar-fill" [style.width.%]="item.percentage" [style.background-color]="item.color"></div>
                  </div>
                  <span class="bar-value">{{ item.count }}</span>
                </div>
              }
            </div>
          </div>

          <!-- HTTP Status -->
          <div class="chart-container">
            <div class="chart-header">
              <span class="chart-title">HTTP STATUS</span>
            </div>
            <div class="donut-chart-container">
              <svg class="donut-chart" viewBox="0 0 100 100">
                @for (segment of getDonutSegments(); track segment.category) {
                  <circle class="donut-segment" cx="50" cy="50" r="35" [style.stroke]="segment.color" [style.stroke-dasharray]="segment.dashArray" [style.stroke-dashoffset]="segment.dashOffset" />
                }
              </svg>
              <div class="donut-legend">
                @for (item of analytics.statusDistribution(); track item.category) {
                  <div class="legend-item">
                    <span class="legend-color" [style.background-color]="item.color"></span>
                    <span class="legend-label">{{ item.category }}</span>
                    <span class="legend-value">{{ item.percentage | number:'1.0-0' }}%</span>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Methods -->
          <div class="chart-container">
            <div class="chart-header">
              <span class="chart-title">HTTP METHODS</span>
            </div>
             <div class="bar-chart">
              @for (item of analytics.methodDistribution(); track item.method) {
                <div class="bar-row">
                  <span class="bar-label">{{ item.method }}</span>
                  <div class="bar-track">
                    <div class="bar-fill" [style.width.%]="item.percentage" [style.background-color]="item.color"></div>
                  </div>
                  <span class="bar-value">{{ item.count }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- ROW 2: Evolution Charts -->
        <div class="grid-row two-col">
           <!-- Duration Evolution -->
            <div class="chart-container">
              <div class="chart-header">
                <span class="chart-title">LATENCY EVOLUTION (AVG/MAX)</span>
              </div>
              <div class="line-chart">
                <div class="chart-area" style="position: relative; height: 100px; width: 100%;">
                   <svg class="line-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline class="line-max" [attr.points]="getDurationMaxPolyline()" />
                    <polyline class="line-avg" [attr.points]="getDurationAvgPolyline()" />
                  </svg>
                </div>
              </div>
            </div>

            <!-- Error Rate Evolution -->
             <div class="chart-container">
              <div class="chart-header">
                <span class="chart-title">ERROR RATE EVOLUTION</span>
              </div>
               <div class="error-rate-chart" style="height: 100px; display: flex; align-items: flex-end; gap: 2px;">
                  @for (bucket of analytics.errorRateEvolution(); track bucket.label) {
                    <div class="error-bar" [style.height.%]="bucket.errorRate" [title]="bucket.label + ': ' + bucket.errorRate + '%'" [class.has-errors]="bucket.errorRate > 0" style="flex: 1; min-width: 4px; background: var(--te-border-light);"></div>
                  }
               </div>
            </div>
        </div>

        <!-- ROW 3: Latency Histogram -->
        <div class="chart-container full-width">
          <div class="chart-header">
            <span class="chart-title">LATENCY DISTRIBUTION</span>
            <div class="button-group">
              @for (size of [25, 50, 100, 250, 500]; track size) {
                <button 
                  class="te-button-small" 
                  [class.active]="analytics.histogramBucketSize() === size"
                  (click)="analytics.histogramBucketSize.set(size)"
                >
                  {{ size }}ms
                </button>
              }
            </div>
          </div>
          <div class="histogram-chart">
            @if (analytics.latencyHistogram().length > 0) {
              <div class="histogram-bars">
                @for (bucket of analytics.latencyHistogram(); track bucket.start) {
                  <div 
                    class="histogram-bar-container"
                    [title]="bucket.label + ': ' + bucket.count + ' requests'"
                  >
                    <div 
                      class="histogram-bar" 
                      [style.height.%]="(bucket.count / getMaxHistogramCount()) * 100"
                    ></div>
                    <span class="histogram-label" *ngIf="$index % getHistogramLabelStep() === 0">
                      {{ bucket.start }}
                    </span>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state">No duration data available</div>
            }
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .analytics-panel {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      background-color: var(--te-bg);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Summary Cards */
    .summary-cards {
      display: flex;
      gap: 12px;
      flex-wrap: wrap; /* Safety for small screens */
    }

    .summary-card {
      flex: 1;
      min-width: 120px;
      padding: 12px 16px;
      background-color: var(--te-bg-dark);
      border: 1px solid var(--te-border-light);
      text-align: center;
    }

    .summary-card.error .card-value { color: #C62828; }
    .summary-card.success .card-value { color: #2E7D32; }
    .summary-card.warning .card-value { color: #E65100; }

    .card-value {
      display: block;
      font-family: var(--font-mono);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--te-text);
      line-height: 1.2;
    }

    .card-label {
      display: block;
      margin-top: 4px;
      font-family: var(--font-sans);
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--te-text-muted);
    }

    /* Grid Layout */
    .analytics-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .grid-row {
      display: grid;
      gap: 16px;
    }

    .grid-row.three-col { grid-template-columns: repeat(3, 1fr); }
    .grid-row.two-col { grid-template-columns: repeat(2, 1fr); }

    .chart-container {
      background-color: var(--te-bg-dark);
      border: 1px solid var(--te-border-light);
      padding: 16px;
      display: flex;
      flex-direction: column;
      min-width: 0; /* Important for flex/grid overflow */
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--te-border-light);
      padding-bottom: 8px;
    }

    .chart-title {
      font-family: var(--font-sans);
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--te-text-muted);
    }

    /* Visualization Styles */
    .bar-chart { display: flex; flex-direction: column; gap: 8px; }
    .bar-row { display: grid; grid-template-columns: 80px 1fr 50px; align-items: center; gap: 12px; }
    .bar-label { font-family: var(--font-mono); font-size: 0.65rem; color: var(--te-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-track { height: 12px; background: var(--te-bg); flex: 1; border-radius: 2px; overflow: hidden; }
    .bar-fill { height: 100%; }
    .bar-value { font-family: var(--font-mono); font-size: 0.65rem; text-align: right; color: var(--te-text-muted); }

    .donut-chart-container { display: flex; align-items: center; gap: 24px; justify-content: center; height: 100%; }
    .donut-chart { width: 100px; height: 100px; transform: rotate(-90deg); flex-shrink: 0; }
    .donut-segment { fill: none; stroke-width: 14; }
    .donut-legend { display: flex; flex-direction: column; gap: 6px; }
    .legend-item { display: flex; align-items: center; gap: 8px; }
    .legend-color { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 0 1px var(--te-border-light); }
    .legend-label { font-family: var(--font-mono); font-size: 0.65rem; color: var(--te-text); }
    .legend-value { font-family: var(--font-mono); font-size: 0.6rem; color: var(--te-text-muted); margin-left: auto; }

    .line-chart-svg { width: 100%; height: 100%; overflow: visible; }
    .line-max { fill: none; stroke: var(--axa-red); stroke-width: 1; stroke-dasharray: 4,4; opacity: 0.6; }
    .line-avg { fill: none; stroke: var(--axa-blue); stroke-width: 2; vector-effect: non-scaling-stroke; }
    .error-bar.has-errors { background-color: var(--axa-red) !important; }

    /* Evolution Charts */
    .line-chart {
      display: flex;
      height: 140px;
    }
    
    .chart-area {
      flex: 1;
      height: 100%;
      border-left: 1px solid var(--te-border-light);
      border-bottom: 1px solid var(--te-border-light);
      position: relative;
    }

    .error-rate-chart {
      height: 140px;
    }

    /* Buttons */
    .button-group {
      display: flex;
      gap: 4px;
    }

    .te-button-small {
      padding: 4px 8px;
      font-family: var(--font-mono);
      font-size: 0.6rem;
      font-weight: 600;
      color: var(--te-text-muted);
      background-color: transparent;
      border: 1px solid var(--te-border-light);
      cursor: pointer;
      border-radius: 2px;
      transition: all 0.15s ease;
    }

    .te-button-small:hover {
      background-color: var(--te-bg);
      color: var(--te-text);
      border-color: var(--te-border);
    }

    .te-button-small.active {
      background-color: var(--axa-blue);
      color: white;
      border-color: var(--axa-blue);
    }

    /* Histogram */
    .histogram-chart {
      height: 200px;
      margin-top: 16px;
    }

    .histogram-bars {
      display: flex;
      align-items: flex-end;
      height: 100%;
      gap: 1px;
      padding-bottom: 24px; /* Space for labels */
      border-bottom: 1px solid var(--te-border-light);
    }

    .histogram-bar-container {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      position: relative;
    }

    .histogram-bar {
      width: 100%;
      background-color: var(--axa-blue);
      border-top-left-radius: 2px;
      border-top-right-radius: 2px;
      opacity: 0.7;
      transition: height 0.3s ease, background-color 0.2s;
    }

    .histogram-bar:hover {
      opacity: 1;
      background-color: var(--axa-blue-light);
    }

    .histogram-label {
      position: absolute;
      bottom: -20px;
      left: 50%;
      transform: translateX(-50%);
      font-family: var(--font-mono);
      font-size: 0.55rem;
      color: var(--te-text-muted);
      white-space: nowrap;
    }

    .empty-state {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-mono);
      font-size: 0.7rem;
      color: var(--te-text-muted);
      background-color: rgba(0,0,0,0.02);
    }

    /* Data Table Styles (Unchanged) */
    .data-table { width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.65rem; }
    .data-table th { text-align: left; color: var(--te-text-muted); padding: 4px 8px; border-bottom: 1px solid var(--te-border-light); font-weight: 600; }
    .data-table td { padding: 4px 8px; color: var(--te-text); border-bottom: 1px solid var(--te-border-light); }
    .data-table tr:last-child td { border-bottom: none; }
    .col-url { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .col-msg { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mono { font-family: var(--font-mono); }
    .mono-dim { font-family: var(--font-mono); color: var(--te-text-muted); }
  `]
})
export class AnalyticsPanelComponent {
  protected readonly analytics = inject(AnalyticsService);

  getTotalHttpRequests(): number {
    return this.analytics.statusDistribution().reduce((sum, s) => sum + s.count, 0);
  }

  getDonutSegments(): { category: string; color: string; dashArray: string; dashOffset: number }[] {
    const data = this.analytics.statusDistribution();
    const total = this.getTotalHttpRequests();
    if (total === 0) return [];

    const circumference = 2 * Math.PI * 35;
    let offset = 0;
    
    return data.map(item => {
      const segmentLength = (item.percentage / 100) * circumference;
      const dashArray = `${segmentLength} ${circumference - segmentLength}`;
      const dashOffset = -offset;
      offset += segmentLength;
      
      return {
        category: item.category,
        color: item.color,
        dashArray,
        dashOffset
      };
    });
  }

  getMaxDuration(): number {
    const data = this.analytics.durationEvolution();
    if (data.length === 0) return 100;
    return Math.max(...data.map(d => d.maxDuration)) * 1.1; // Add 10% padding
  }

  getXPosition(index: number, total: number): number {
    if (total <= 1) return 50;
    return (index / (total - 1)) * 100;
  }

  getYPosition(value: number, max: number): number {
    if (max === 0) return 60;
    return 60 - (value / max) * 55; // Leave 5px padding at top
  }

  getDurationAvgPolyline(): string {
    const data = this.analytics.durationEvolution();
    const max = this.getMaxDuration();
    return data.map((point, i) => 
      `${this.getXPosition(i, data.length)},${this.getYPosition(point.avgDuration, max)}`
    ).join(' ');
  }

  getDurationMaxPolyline(): string {
    const data = this.analytics.durationEvolution();
    const max = this.getMaxDuration();
    return data.map((point, i) => 
      `${this.getXPosition(i, data.length)},${this.getYPosition(point.maxDuration, max)}`
    ).join(' ');
  }

  getEvolutionLabels(data: { label: string }[]): string[] {
    if (data.length <= 5) return data.map(d => d.label);
    
    // Show first, middle, and last
    const step = Math.floor(data.length / 4);
    const indices = [0, step, step * 2, step * 3, data.length - 1];
    return [...new Set(indices)].map(i => data[i]?.label || '').filter(Boolean);
  }

  getMaxHistogramCount(): number {
    const data = this.analytics.latencyHistogram();
    if (data.length === 0) return 1;
    return Math.max(...data.map(d => d.count));
  }

  getHistogramLabelStep(): number {
    const len = this.analytics.latencyHistogram().length;
    if (len <= 10) return 1;
    if (len <= 20) return 2;
    if (len <= 50) return 5;
    return 10;
  }
}
