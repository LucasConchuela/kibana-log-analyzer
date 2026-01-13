# LogSynth - Copilot Instructions

## 🧠 Project Context
**Name:** LogSynth (Kibana Log Analyzer)
**Type:** Single Page Application (SPA) for log analysis.
**Framework:** Angular 19+ (Standalone Components, Signals).
**Style:** "Industrial x Corporate" (Teenage Engineering inspired + AXA Brand).

## 🛠️ Technology Stack
- **Core:** Angular (Standalone, Signals, Control Flow `@if`, `@for`).
- **Styling:** Vanilla CSS with CSS Variables (Design Tokens). **NO** external UI frameworks (Bootstrap, Material, Tailwind* - *Tailwind is imported but preferred method is custom CSS tokens).*
- **Performance:** `@angular/cdk/scrolling` for Virtual Scroll.
- **State Management:** Local Component State + Service Signals (No NgRx/Stores needed for this scale).

## 🏗️ Architecture & Patterns

### 1. Reactivity (Signals)
- **Use Signals exclusively** for state. Avoid `BehaviorSubject` unless interfacing with legacy streams.
- **Computed Signals:** Use `computed(() => ...)` for derived state (e.g., filtered logs).
- **Effects:** Use `effect(() => ...)` for side effects (DOM manipulation, LocalStorage).
  ```typescript
  // ✅ GOOD
  protected readonly logCount = computed(() => this.logs().length);
  
  // ❌ BAD
  get logCount() { return this.logs.value.length; }
  ```

### 2. Service-Based Data Flow
- **LogParserService:** Handles file ingestion (NDJSON/JSON) and parsing.
- **SearchService:** Centralized filtering logic.
- **ExportService:** CSV/JSON export logic.
- **Components** inject services and consume public signals.

### 3. Styling Guidelines (Strict)
- **Design Tokens:** ALWAYS use variables from `:root` in `styles.css`.
  - Colors: `--axa-blue`, `--te-bg`, `--te-text-muted`.
  - Typography: `--font-mono` (JetBrains Mono) for data, `--font-sans` (Inter) for UI.
- **Dark Mode:** Support `.dark-mode` class on `<body>`.
  - Use `var(--color-name)` which automatically switches in `styles.css` media queries or classes.
- **Aesthetic:** Minimalist, flat, high-contrast, "Lab Instrument" feel. Thin borders, uppercase labels ranges.

### 4. Layout
- **Flexbox/Grid:** Use utility classes or component-scoped CSS.
- **Full Height:** App uses `100vh` with `overflow: hidden`.
- **Scrolling:** Main table usage `cdk-virtual-scroll-viewport`.

## 📁 Key Files
- `src/app/app.ts`: Main shell, manages global state (Theme, View Mode).
- `src/app/services/log-parser.service.ts`: Core logic for reading/parsing logs.
- `src/app/components/`: Specific features (SearchToolbar, AnalyticsPanel, DiffViewer).
- `src/styles.css`: Global design tokens and reset.

## 🚀 Feature Implementation Rules
1. **No External Dependencies** for UI (Buttons, Inputs, Modals must be custom CSS).
2. **Performance First:** Large datasets (>10k rows) must use Virtual Scroll.
3. **Type Safety:** Strict TypeScript interfaces for all Log Entries.
4. **Clean Code:** Extract logic to Services; Keep Components display-focused.

## 📦 Data Schema (LogEntry)
```typescript
interface LogEntry {
  _id: string;
  '@timestamp': string;
  level: string;
  message: string;
  http?: {
    method: string;
    status_code: number;
    url: string;
    // ... nested fields
  };
  // ... other fields
}
```

## 📝 Common Tasks
- **Adding a Column:** Update `visibleColumns` signal in `LogParserService` or `App`.
- **New Visualization:** Add component to `AnalyticsPanelComponent`.
- **Filter Logic:** Extend `SearchService.filterLogs()`.
