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
          <span class="card-value">{{ analytics.summary().errorRate | number:'1.1-1' }}%</span>
          <span class="card-label">ERROR RATE</span>
        </div>
        @if (analytics.summary().successRate > 0) {
          <div class="summary-card success">
            <span class="card-value">{{ analytics.summary().successRate | number:'1.1-1' }}%</span>
            <span class="card-label">2XX RATE</span>
          </div>
        }
        <div class="summary-card">
          <span class="card-value">{{ analytics.summary().avgDuration | number:'1.0-0' }}ms</span>
          <span class="card-label">AVG DURATION</span>
        </div>
      </div>

      <!-- Charts Grid -->
      <div class="charts-grid">
        <!-- Left Column: Distribution Charts -->
        <div class="chart-column">
          <!-- Log Level Distribution -->
          <div class="chart-container">
            <div class="chart-header">
              <span class="chart-title">LOG LEVEL DISTRIBUTION</span>
            </div>
            <div class="bar-chart">
              @for (item of analytics.levelDistribution(); track item.level) {
                <div class="bar-row">
                  <span class="bar-label">{{ item.level }}</span>
                  <div class="bar-track">
                    <div 
                      class="bar-fill" 
                      [style.width.%]="item.percentage"
                      [style.background-color]="item.color"
                    ></div>
                  </div>
                  <span class="bar-value">{{ item.count }}</span>
                </div>
              }
              @if (analytics.levelDistribution().length === 0) {
                <div class="empty-state">No data</div>
              }
            </div>
          </div>

          <!-- HTTP Status Distribution -->
          <div class="chart-container">
            <div class="chart-header">
              <span class="chart-title">HTTP STATUS CODES</span>
            </div>
            <div class="donut-chart-container">
              @if (analytics.statusDistribution().length > 0) {
                <svg class="donut-chart" viewBox="0 0 100 100">
                  @for (segment of getDonutSegments(); track segment.category) {
                    <circle
                      class="donut-segment"
                      cx="50" cy="50" r="35"
                      [style.stroke]="segment.color"
                      [style.stroke-dasharray]="segment.dashArray"
                      [style.stroke-dashoffset]="segment.dashOffset"
                    />
                  }
                  <text x="50" y="48" class="donut-center-text">
                    {{ getTotalHttpRequests() }}
                  </text>
                  <text x="50" y="58" class="donut-center-label">
                    REQUESTS
                  </text>
                </svg>
                <div class="donut-legend">
                  @for (item of analytics.statusDistribution(); track item.category) {
                    <div class="legend-item">
                      <span class="legend-color" [style.background-color]="item.color"></span>
                      <span class="legend-label">{{ item.category }}</span>
                      <span class="legend-value">{{ item.count }} ({{ item.percentage | number:'1.0-0' }}%)</span>
                    </div>
                  }
                </div>
              } @else {
                <div class="empty-state">No HTTP data</div>
              }
            </div>
          </div>
        </div>

        <!-- Right Column: Evolution Charts -->
        <div class="chart-column">
          <!-- Duration Evolution -->
          @if (analytics.durationEvolution().length > 0) {
            <div class="chart-container">
              <div class="chart-header">
                <span class="chart-title">API DURATION OVER TIME</span>
                <span class="chart-subtitle">Avg / Max per 5-min bucket</span>
              </div>
              <div class="line-chart">
                <div class="chart-y-axis">
                  <span>{{ getMaxDuration() | number:'1.0-0' }}ms</span>
                  <span>{{ getMaxDuration() / 2 | number:'1.0-0' }}ms</span>
                  <span>0ms</span>
                </div>
                <div class="chart-area">
                  <svg class="line-chart-svg" viewBox="0 0 100 60" preserveAspectRatio="none">
                    <!-- Max duration line (faded) -->
                    <polyline
                      class="line-max"
                      [attr.points]="getDurationMaxPolyline()"
                    />
                    <!-- Avg duration line -->
                    <polyline
                      class="line-avg"
                      [attr.points]="getDurationAvgPolyline()"
                    />
                    <!-- Data points -->
                    @for (point of analytics.durationEvolution(); track point.label; let i = $index) {
                      <circle
                        class="data-point"
                        [attr.cx]="getXPosition(i, analytics.durationEvolution().length)"
                        [attr.cy]="getYPosition(point.avgDuration, getMaxDuration())"
                        r="2"
                      >
                        <title>{{ point.label }}: {{ point.avgDuration | number:'1.0-0' }}ms avg, {{ point.maxDuration | number:'1.0-0' }}ms max</title>
                      </circle>
                    }
                  </svg>
                </div>
              </div>
              <div class="chart-x-labels">
                @for (label of getEvolutionLabels(analytics.durationEvolution()); track label) {
                  <span>{{ label }}</span>
                }
              </div>
            </div>
          }

          <!-- Error Rate Evolution -->
          @if (analytics.errorRateEvolution().length > 0) {
            <div class="chart-container">
              <div class="chart-header">
                <span class="chart-title">ERROR RATE OVER TIME</span>
                <span class="chart-subtitle">Per 5-min bucket</span>
              </div>
              <div class="error-rate-chart">
                <div class="chart-bars">
                  @for (bucket of analytics.errorRateEvolution(); track bucket.label) {
                    <div 
                      class="error-bar-container"
                      [title]="bucket.label + ': ' + bucket.errorCount + '/' + bucket.totalCount + ' errors (' + (bucket.errorRate | number:'1.0-0') + '%)'"
                    >
                      <div 
                        class="error-bar"
                        [style.height.%]="bucket.errorRate"
                        [class.has-errors]="bucket.errorRate > 0"
                      ></div>
                      @if (bucket.errorCount > 0) {
                        <span class="error-count">{{ bucket.errorCount }}</span>
                      }
                    </div>
                  }
                </div>
              </div>
              <div class="chart-x-labels">
                @for (label of getEvolutionLabels(analytics.errorRateEvolution()); track label) {
                  <span>{{ label }}</span>
                }
              </div>
            </div>
          }

          @if (analytics.durationEvolution().length === 0 && analytics.errorRateEvolution().length === 0) {
            <div class="chart-container">
              <div class="empty-state">Not enough time-series data for evolution charts</div>
            </div>
          }
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
    }

    /* Summary Cards */
    .summary-cards {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }

    .summary-card {
      flex: 1;
      padding: 12px 16px;
      background-color: var(--te-bg-dark);
      border: 1px solid var(--te-border-light);
      text-align: center;
    }

    .summary-card.error {
      border-color: #C62828;
    }

    .summary-card.error .card-value {
      color: #C62828;
    }

    .summary-card.warning .card-value {
      color: #E65100;
    }

    .summary-card.success .card-value {
      color: #2E7D32;
    }

    .card-value {
      display: block;
      font-family: var(--font-mono);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--te-text);
    }

    .card-label {
      font-family: var(--font-sans);
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--te-text-muted);
    }

    /* Charts Grid */
    .charts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .chart-column {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .chart-container {
      background-color: var(--te-bg-dark);
      border: 1px solid var(--te-border-light);
      padding: 12px;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 12px;
    }

    .chart-title {
      font-family: var(--font-sans);
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--te-text-muted);
    }

    .chart-subtitle {
      font-family: var(--font-mono);
      font-size: 0.55rem;
      color: var(--te-text-muted);
      opacity: 0.7;
    }

    /* Bar Chart */
    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .bar-row {
      display: grid;
      grid-template-columns: 70px 1fr 40px;
      align-items: center;
      gap: 8px;
    }

    .bar-label {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      font-weight: 600;
      color: var(--te-text);
    }

    .bar-track {
      height: 16px;
      background-color: var(--te-bg);
      border: 1px solid var(--te-border-light);
    }

    .bar-fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    .bar-value {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      color: var(--te-text-muted);
      text-align: right;
    }

    /* Donut Chart */
    .donut-chart-container {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .donut-chart {
      width: 100px;
      height: 100px;
      transform: rotate(-90deg);
    }

    .donut-segment {
      fill: none;
      stroke-width: 14;
    }

    .donut-center-text {
      font-family: var(--font-mono);
      font-size: 16px;
      font-weight: 700;
      fill: var(--te-text);
      text-anchor: middle;
      transform: rotate(90deg);
      transform-origin: 50% 50%;
    }

    .donut-center-label {
      font-family: var(--font-sans);
      font-size: 5px;
      fill: var(--te-text-muted);
      text-anchor: middle;
      transform: rotate(90deg);
      transform-origin: 50% 50%;
    }

    .donut-legend {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .legend-color {
      width: 12px;
      height: 12px;
    }

    .legend-label {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--te-text);
    }

    .legend-value {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      color: var(--te-text-muted);
    }

    /* Line Chart */
    .line-chart {
      display: flex;
      height: 120px;
    }

    .chart-y-axis {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding-right: 8px;
      font-family: var(--font-mono);
      font-size: 0.55rem;
      color: var(--te-text-muted);
      text-align: right;
      min-width: 50px;
    }

    .chart-area {
      flex: 1;
      border-left: 1px solid var(--te-border-light);
      border-bottom: 1px solid var(--te-border-light);
    }

    .line-chart-svg {
      width: 100%;
      height: 100%;
    }

    .line-max {
      fill: none;
      stroke: var(--axa-red);
      stroke-width: 0.5;
      stroke-dasharray: 2,2;
      opacity: 0.5;
    }

    .line-avg {
      fill: none;
      stroke: var(--axa-blue);
      stroke-width: 1.5;
    }

    .data-point {
      fill: var(--axa-blue);
    }

    .data-point:hover {
      fill: var(--axa-blue-light);
      r: 3;
    }

    .chart-x-labels {
      display: flex;
      justify-content: space-between;
      padding-left: 58px;
      margin-top: 4px;
      font-family: var(--font-mono);
      font-size: 0.5rem;
      color: var(--te-text-muted);
    }

    /* Error Rate Chart */
    .error-rate-chart {
      height: 80px;
    }

    .chart-bars {
      display: flex;
      align-items: flex-end;
      height: 100%;
      gap: 4px;
      padding-left: 58px;
      border-left: 1px solid var(--te-border-light);
      border-bottom: 1px solid var(--te-border-light);
    }

    .error-bar-container {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      position: relative;
    }

    .error-bar {
      width: 100%;
      max-width: 20px;
      min-height: 2px;
      background-color: var(--te-border-light);
      transition: height 0.3s ease;
    }

    .error-bar.has-errors {
      background-color: #C62828;
    }

    .error-count {
      position: absolute;
      top: -14px;
      font-family: var(--font-mono);
      font-size: 0.55rem;
      color: #C62828;
    }

    .empty-state {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--te-text-muted);
      text-align: center;
      padding: 24px;
    }
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
}
