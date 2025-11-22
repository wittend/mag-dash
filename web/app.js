const LS_KEY = "magdash.config.v1";
const LS_PANES_KEY = "magdash.panes.v1"; // persist per-tab state (id, title, splitter width)
// Recent history keys (last 10)
const LS_HIST_WS = "magdash.history.ws.v1";
const LS_HIST_FILES = "magdash.history.files.v1";
const LS_HIST_DEV = "magdash.history.dev.v1";

function loadConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { theme: prefersDark() ? "dark" : "light" };
    const cfg = JSON.parse(raw);
    return { theme: cfg.theme || (prefersDark() ? "dark" : "light") };
  } catch {
    return { theme: prefersDark() ? "dark" : "light" };
  }
}

function saveConfig(cfg) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}

function prefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
}

// --- Recent history helpers ---
function getHistory(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(v => typeof v === 'string' && v.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function saveHistory(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr.slice(0, 10))); } catch {}
}

function pushHistory(key, value) {
  const v = (value || "").trim();
  if (!v) return;
  const arr = getHistory(key);
  const filtered = [v, ...arr.filter(x => x !== v)];
  saveHistory(key, filtered);
}

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    el.append(c.nodeType ? c : document.createTextNode(c));
  }
  return el;
}

function parseSample(line) {
  // Accept either a JSON object string or an already parsed object
  const obj = typeof line === 'string' ? JSON.parse(line) : line;
  const { ts, x, y, z } = obj;
  if (typeof ts !== 'string') throw new Error('ts must be string');
  if (![x, y, z].every((n) => typeof n === 'number')) throw new Error('x,y,z must be numbers');
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) throw new Error('invalid ts');
  const temp = typeof obj.t === 'number' ? obj.t : (typeof obj.temp === 'number' ? obj.temp : undefined);
  return { ts, date, x, y, z, temp };
}

function formatNum(n) {
  return n.toFixed(3);
}

class SourcePane {
  constructor(id, title, activateCb, removeCb, firstUseCb) {
    this.id = id;
    this.title = title;
    this.activateCb = activateCb;
    this.removeCb = removeCb;
    this.firstUseCb = firstUseCb;
    this.samples = [];
    this.ws = null;
    this.connected = false;
    this.mode = 'ws'; // 'ws' or 'file'
    this._used = false;
    this.collapsed = false; // whether the left config pane is hidden
  }

  tabEl() {
    const btn = h('button', { class: 'tab', role: 'tab', id: `tab-${this.id}`, title: this.title },
      h('span', { class: 'ti ti-radio' }), ' ',
      h('span', { class: 'tab-title' }, this.title)
    );
    btn.addEventListener('click', () => this.activateCb(this));
    return btn;
  }

  panelEl() {
    const wrap = h('section', { class: 'panel', id: `panel-${this.id}`, role: 'tabpanel', 'aria-hidden': 'true' });

    // Left: connection form
    const modeSel = h('select', {},
      h('option', { value: 'ws' }, 'WebSocket URL'),
      h('option', { value: 'file' }, 'Local file'),
      h('option', { value: 'device' }, 'Local Device'),
    );
    const urlInput = h('input', { type: 'url', placeholder: 'wss://example/ws' });
    // Allow all file extensions by default (no accept attribute)
    const fileInput = h('input', { type: 'file' });
    fileInput.style.display = 'none';
    const skipInput = h('input', { type: 'number', min: '0', value: '0', size: '3', inputmode: 'numeric', class: 'w-ch-3' });
    const deviceInput = h('input', { type: 'text', placeholder: '/dev/ttyUSB0' });

    // Attach datalists for URL and device histories
    const urlListId = `dl-ws-${this.id}`;
    const devListId = `dl-dev-${this.id}`;
    const urlDataList = h('datalist', { id: urlListId });
    const devDataList = h('datalist', { id: devListId });
    urlInput.setAttribute('list', urlListId);
    deviceInput.setAttribute('list', devListId);

    const populateDataList = (dl, items) => {
      dl.innerHTML = '';
      for (const it of items.slice(0, 10)) dl.append(h('option', { value: it }));
    };
    populateDataList(urlDataList, getHistory(LS_HIST_WS));
    populateDataList(devDataList, getHistory(LS_HIST_DEV));

    // Recent files UI (cannot prefill file input): show a small select list of recent file names
    const recentFilesWrap = h('div', { class: 'small' });
    const recentFilesSelect = h('select', { class: 'w-100' }, h('option', { value: '' }, '-- choose recent file name --'));
    const refreshRecentFiles = () => {
      const items = getHistory(LS_HIST_FILES);
      // Reset options
      recentFilesSelect.innerHTML = '';
      recentFilesSelect.append(h('option', { value: '' }, items.length ? '-- choose recent file name --' : 'No recent files'));
      for (const it of items.slice(0, 10)) {
        recentFilesSelect.append(h('option', { value: it }, it));
      }
    };
    refreshRecentFiles();
    // Only show the dropdown; omit any label text like "Recent files"
    recentFilesWrap.append(recentFilesSelect);

    modeSel.addEventListener('change', () => {
      this.mode = modeSel.value;
      const isFile = this.mode === 'file';
      // Keep WebSocket URL and Device path inputs visible at all times
      urlInput.style.display = 'block';
      deviceInput.style.display = 'block';
      // Toggle only the file input by mode
      fileInput.style.display = isFile ? 'block' : 'none';
    });

    const connectBtn = h('button', { class: 'btn primary' }, h('span', { class: 'ti ti-plug-connected' }), ' Connect');
    const abandonBtn = h('button', { class: 'btn' }, h('span', { class: 'ti ti-trash' }), ' Abandon');
    const collapseBtn = h('button', { class: 'btn', title: 'Hide config (toggle)' }, h('span', { class: 'ti ti-chevron-left' }), ' Hide');

    // Inline SVG spinner (hidden by default); shown during local file loading
    const spinner = h('svg', { class: 'spinner', viewBox: '0 0 50 50', 'aria-hidden': 'true' },
      h('circle', { cx: '25', cy: '25', r: '20', stroke: 'currentColor', 'stroke-width': '4', fill: 'none', 'stroke-linecap': 'round' })
    );

    const formId = `form-${this.id}`;
    const form = h('div', { class: 'card left-pane', id: formId },
      h('div', { class: 'field' }, h('label', {}, 'Mode'), modeSel),
      h('div', { class: 'field' }, h('label', {}, 'WebSocket URL'), urlInput, urlDataList),
      h('div', { class: 'field' }, h('label', {}, 'Local file'), fileInput, recentFilesWrap),
      h('div', { class: 'field' }, h('label', {}, 'Device path'), deviceInput, devDataList),
      h('div', { class: 'field' }, h('label', {}, 'Skip header lines'), skipInput),
      h('div', { class: 'row' }, abandonBtn, connectBtn, spinner, collapseBtn),
    );
    // Accessibility: tie the collapse button to the form it controls
    collapseBtn.setAttribute('aria-controls', formId);
    collapseBtn.setAttribute('aria-expanded', 'true');

    // Right: charts
    const charts = h('div', { class: 'charts right-pane' },
      this.chartEl('X (nT)', 'x'),
      this.chartEl('Y (nT)', 'y'),
      this.chartEl('Z (nT)', 'z'),
      this.chartEl('Temp (°C)', 'temp'),
      this.timeAxisEl(),
    );

    // Vertical splitter between left (form) and right (charts)
    const splitter = h('div', { class: 'vsplit', role: 'separator', 'aria-orientation': 'vertical', tabindex: '0', title: 'Drag to resize. Click when hidden to show config.' });

    // History table
    const table = h('table', { class: 'table' },
      h('thead', {}, h('tr', {},
        h('th', {}, '#'),
        h('th', {}, 'Timestamp (UTC)'),
        h('th', {}, 'X (nT)'),
        h('th', {}, 'Y (nT)'),
        h('th', {}, 'Z (nT)'),
        h('th', {}, 'T (°C)')
      )),
      h('tbody'),
    );
    const exportBtn = h('button', { class: 'btn' }, h('span', { class: 'ti ti-download' }), ' Export JSONL');
    const history = h('div', { class: 'history card' },
      h('div', { class: 'muted', style: 'margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;' },
        h('span', {}, 'History (most recent first)'),
        exportBtn,
      ),
      h('div', { class: 'history-body' }, table)
    );

    // Append in grid order: left form (col1), splitter (col2), charts (col3), history (row2 spans)
    wrap.append(form, splitter, charts, history);

    // After first layout, ensure left panel width is at least its content width
    queueMicrotask(() => {
      try {
        const contentEl = document.getElementById('content');
        if (!contentEl) return;
        const minLeft = Math.ceil(form.scrollWidth);
        this.minLeftPx = Math.max(240, minLeft);
        const current = parseInt(getComputedStyle(contentEl).getPropertyValue('--left-width')) || 0;
        const initial = Math.max(minLeft, current || 360);
        contentEl.style.setProperty('--left-width', `${initial}px`);
        this.leftWidthPx = initial;
        this.resizeCharts();
      } catch {}
    });

    // Drag behavior for splitter
    const onPointerMove = (ev) => {
      const contentEl = document.getElementById('content');
      if (!contentEl || !this._dragging || this.collapsed) return;
      ev.preventDefault();
      const rect = contentEl.getBoundingClientRect();
      const styles = getComputedStyle(contentEl);
      const padL = parseFloat(styles.paddingLeft) || 0;
      const padR = parseFloat(styles.paddingRight) || 0;
      const gap = parseFloat(styles.columnGap) || 16; // grid column gap from CSS
      const splitterW = this.elements?.splitter ? (parseFloat(getComputedStyle(this.elements.splitter).width) || 6) : 6; // splitter column width
      const innerWidth = rect.width - padL - padR;
      const relX = Math.max(0, Math.min(innerWidth, ev.clientX - rect.left - padL));
      const minLeft = Math.max(240, this.minLeftPx || Math.ceil(form.scrollWidth)); // can't be smaller than intrinsic content
      const minRight = 320; // keep reasonable space for charts
      const maxLeft = Math.max(0, innerWidth - (minRight + splitterW + gap * 2));
      // Pointer is on the splitter that sits after a gap, so subtract gap (and half splitter width) to align left width
      const proposedRaw = relX - gap - (splitterW / 2);
      const proposed = Math.max(minLeft, Math.min(proposedRaw, maxLeft));
      contentEl.style.setProperty('--left-width', `${proposed}px`);
      this.leftWidthPx = proposed;
      this.resizeCharts();
    };
    const onPointerUp = (ev) => {
      this._dragging = false;
      try { splitter.releasePointerCapture?.(ev.pointerId); } catch {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      this.resizeCharts();
      try {
        // Announce updated splitter width for persistence
        window.dispatchEvent(new CustomEvent('magdash:split', { detail: { id: this.id, left: this.leftWidthPx || 0 } }));
      } catch {}
    };
    splitter.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      if (this.collapsed) {
        // When collapsed, clicking the splitter acts as a show-handle
        this.setCollapsed(false);
        return;
      }
      this._dragging = true;
      splitter.setPointerCapture?.(ev.pointerId);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });

    connectBtn.addEventListener('click', async () => {
      const skip = Math.max(0, parseInt(skipInput.value || '0'));
      if (this.mode === 'ws') {
        const url = urlInput.value.trim();
        if (!url) return alert('Enter a WebSocket URL');
        // Save history and update datalist
        pushHistory(LS_HIST_WS, url);
        populateDataList(urlDataList, getHistory(LS_HIST_WS));
        await this.connectWs(url);
      } else if (this.mode === 'file') {
        const file = fileInput.files?.[0];
        if (!file) return alert('Choose a file');
        // Save file name to history and refresh UI
        pushHistory(LS_HIST_FILES, file.name || 'unnamed');
        refreshRecentFiles();
        await this.loadFile(file, skip);
      } else if (this.mode === 'device') {
        const path = deviceInput.value.trim();
        if (!path) return alert('Enter a device path (e.g., /dev/ttyUSB0)');
        pushHistory(LS_HIST_DEV, path);
        populateDataList(devDataList, getHistory(LS_HIST_DEV));
        alert('Local Device mode UI is enabled. Browsers cannot open device paths directly. We can add Web Serial support or a Deno proxy in the next step. Entered path: ' + path);
      }
    });

    abandonBtn.addEventListener('click', () => this.removeCb(this));

    collapseBtn.addEventListener('click', () => {
      this.setCollapsed(!this.collapsed);
    });

    exportBtn.addEventListener('click', () => this.exportJSONL());

    this.elements = { wrap, tableBody: table.querySelector('tbody'), form, charts, splitter, connectBtn, spinner, collapseBtn };
    // Ensure initial collapse state is reflected
    this.updateCollapseUI();
    return wrap;
  }

  chartEl(label, key) {
    const container = h('div', { class: 'chart card' });
    const canvas = h('canvas');
    const lbl = h('div', { class: 'label' }, label);
    container.append(lbl, canvas);
    const ctx = canvas.getContext('2d');
    if (!this.charts) this.charts = {};
    this.charts[key] = { canvas, ctx };
    return container;
  }

  resizeCharts() {
    if (!this.charts) return;
    for (const { canvas } of Object.values(this.charts)) {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(100, Math.floor(rect.width * dpr));
      canvas.height = Math.max(80, Math.floor(rect.height * dpr));
    }
    // Resize time axis canvas
    if (this.timeAxis && this.timeAxis.canvas) {
      const rect = this.timeAxis.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.timeAxis.canvas.width = Math.max(100, Math.floor(rect.width * dpr));
      this.timeAxis.canvas.height = Math.max(18, Math.floor(rect.height * dpr));
    }
    this.drawCharts();
  }

  setCollapsed(flag) {
    this.collapsed = !!flag;
    this.updateCollapseUI();
    // Persist state
    try { window.magdash?.savePanesState?.(); } catch {}
    // Resize charts to reflect new layout
    this.resizeCharts();
  }

  updateCollapseUI() {
    const wrap = this.elements?.wrap;
    const form = this.elements?.form;
    const collapseBtn = this.elements?.collapseBtn;
    if (!wrap || !form) return;
    // Toggle class on the panel; grid CSS hides left-pane when collapsed
    wrap.classList.toggle('collapsed', this.collapsed);
    const contentEl = document.getElementById('content');
    if (contentEl) {
      if (this.collapsed) {
        contentEl.style.setProperty('--left-width', '0px');
      } else {
        // restore to previous width or intrinsic minimum
        const minLeft = Math.max(240, this.minLeftPx || Math.ceil(form.scrollWidth));
        const desired = Math.max(minLeft, this.leftWidthPx || 360);
        contentEl.style.setProperty('--left-width', `${desired}px`);
      }
    }
    if (collapseBtn) {
      if (this.collapsed) {
        collapseBtn.title = 'Show config (toggle)';
        collapseBtn.innerHTML = '';
        collapseBtn.append(h('span', { class: 'ti ti-chevron-right' }), ' Show');
        collapseBtn.setAttribute('aria-expanded', 'false');
      } else {
        collapseBtn.title = 'Hide config (toggle)';
        collapseBtn.innerHTML = '';
        collapseBtn.append(h('span', { class: 'ti ti-chevron-left' }), ' Hide');
        collapseBtn.setAttribute('aria-expanded', 'true');
      }
      // Ensure aria-controls points to the current form id
      if (form.id) collapseBtn.setAttribute('aria-controls', form.id);
    }
    // Notify app so global toggle can reflect state
    try {
      window.dispatchEvent(new CustomEvent('magdash:collapsed', { detail: { id: this.id, collapsed: this.collapsed } }));
    } catch {}
  }

  drawCharts() {
    if (!this.charts) return;
    const colors = { x: '#ef4444', y: '#22c55e', z: '#3b82f6', temp: '#f59e0b' };

    // Use a common time window for all charts and a shared X (time) scale
    const WINDOW = 400; // samples to consider (most recent by timestamp)
    const windowSamples = this.samples.slice(0, WINDOW);
    if (!windowSamples.length) {
      for (const chart of Object.values(this.charts)) {
        chart.ctx?.clearRect(0, 0, chart.canvas.width, chart.canvas.height);
      }
      // Clear time axis too
      if (this.timeAxis?.ctx && this.timeAxis?.canvas) {
        this.timeAxis.ctx.clearRect(0, 0, this.timeAxis.canvas.width, this.timeAxis.canvas.height);
      }
      return;
    }
    // Draw in chronological order left->right
    const seq = windowSamples.slice().sort((a, b) => a.date - b.date);
    const times = seq.map(s => s.date.getTime());
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const tSpan = Math.max(1, tMax - tMin);

    for (const key of ['x','y','z','temp']) {
      const chart = this.charts[key];
      if (!chart) continue;
      const { canvas, ctx } = chart;
      if (!ctx) continue;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Per-series Y scale calculated from available values within the time window
      const seriesVals = seq.map(s => s[key]).filter(v => typeof v === 'number' && !Number.isNaN(v));
      if (!seriesVals.length) continue;
      const vMin = Math.min(...seriesVals);
      const vMax = Math.max(...seriesVals);
      const vSpan = (vMax - vMin) || 1;

      ctx.strokeStyle = colors[key] || '#999';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      for (const s of seq) {
        const v = s[key];
        if (typeof v !== 'number' || Number.isNaN(v)) continue; // skip gaps (e.g., missing temp)
        const x = ((s.date.getTime() - tMin) / tSpan) * (canvas.width - 8) + 4;
        const y = canvas.height - ((v - vMin) / vSpan) * (canvas.height - 8) - 4;
        if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();
    }

    // Draw synchronized time axis in seconds
    this.drawTimeAxis(tMin, tMax, tSpan);
  }

  timeAxisEl() {
    const container = h('div', { class: 'time-axis' });
    const canvas = h('canvas');
    container.append(canvas);
    const ctx = canvas.getContext('2d');
    this.timeAxis = { canvas, ctx };
    return container;
  }

  drawTimeAxis(tMin, tMax, tSpan) {
    const axis = this.timeAxis;
    if (!axis || !axis.ctx || !axis.canvas) return;
    const ctx = axis.ctx;
    const canvas = axis.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Determine desired ~6-10 ticks
    const targetTicks = 8;
    const spanSec = tSpan / 1000;
    const niceSteps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
    let step = niceSteps[0];
    for (const s of niceSteps) {
      if (spanSec / s <= targetTicks) { step = s; break; }
      step = s;
    }

    // Padding must match the series mapping (4px each side)
    const leftPad = 4;
    const rightPad = 4;
    const width = canvas.width;
    const height = canvas.height;

    // Axis line
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftPad, height - 0.5);
    ctx.lineTo(width - rightPad, height - 0.5);
    ctx.stroke();

    ctx.fillStyle = '#9ca3af';
    ctx.font = `${Math.max(10, Math.floor(10 * (window.devicePixelRatio || 1)))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Start from nearest multiple of step seconds from tMin
    const startSec = 0; // seconds offset from tMin
    const endSec = spanSec;
    const firstTick = Math.ceil(startSec / step) * step;
    for (let s = firstTick; s <= endSec; s += step) {
      const t = tMin + s * 1000;
      const x = ((t - tMin) / tSpan) * (width - leftPad - rightPad) + leftPad;
      // Tick mark
      ctx.beginPath();
      ctx.moveTo(x + 0.5, height - 12);
      ctx.lineTo(x + 0.5, height - 0.5);
      ctx.stroke();
      // Label (seconds)
      const label = `${Math.round(s)}s`;
      ctx.fillText(label, x, 2);
    }
  }

  addSample(sample) {
    this.samples.push(sample);
    // Sort by date descending for display
    this.samples.sort((a, b) => b.date - a.date);
    this.renderHistoryRows();
    this.drawCharts();
    if (!this._used) {
      this._used = true;
      if (typeof this.firstUseCb === 'function') this.firstUseCb(this);
    }
  }

  renderHistoryRows() {
    const tb = this.elements.tableBody;
    tb.innerHTML = '';
    const rows = this.samples.slice(0, 500);
    for (let i = 0; i < rows.length; i++) {
      const s = rows[i];
      const idx = i + 1; // 1-based index in current (most-recent-first) view
      tb.append(
        h('tr', {},
          h('td', { class: 'col-idx' }, String(idx)),
          h('td', {}, s.ts),
          h('td', {}, formatNum(s.x)),
          h('td', {}, formatNum(s.y)),
          h('td', {}, formatNum(s.z)),
          h('td', {}, typeof s.temp === 'number' ? formatNum(s.temp) : '')
        )
      );
    }
  }

  async connectWs(url) {
    if (this.ws) try { this.ws.close(); } catch {}
    const ws = new WebSocket(url);
    this.ws = ws;
    this.connected = true;
    ws.addEventListener('message', (ev) => {
      const text = typeof ev.data === 'string' ? ev.data : '';
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const sample = parseSample(line);
          this.addSample(sample);
        } catch (e) {
          console.warn('Bad sample:', e);
        }
      }
    });
    ws.addEventListener('close', () => { this.connected = false; });
    ws.addEventListener('error', () => { this.connected = false; });
  }

  async loadFile(file, skipLines) {
    // Stream the file incrementally to avoid blocking the UI
    // Show lightweight progress in the Connect button if available
    const { connectBtn, spinner } = this.elements || {};
    const prevBtnText = connectBtn?.textContent;
    const prevBtnDisabled = connectBtn?.disabled;
    if (connectBtn) { connectBtn.disabled = true; connectBtn.textContent = 'Loading…'; }
    if (spinner) { spinner.style.display = 'inline-block'; }

    const decoder = new TextDecoder();
    const reader = file.stream().getReader();
    let { value, done } = await reader.read();
    let buffer = '';
    let lineCount = 0;
    let skipped = 0;
    const batch = [];

    // Throttled rendering: schedule at most ~10fps
    let rafPending = false;
    const scheduleRender = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        this.renderHistoryRows();
        this.drawCharts();
      });
    };

    const pushBatch = () => {
      if (!batch.length) return;
      // Merge and sort once per batch (date desc)
      this.samples.push(...batch);
      batch.length = 0;
      this.samples.sort((a, b) => b.date - a.date);
      // Optional: cap memory to last N samples
      const MAX_SAMPLES = 50000;
      if (this.samples.length > MAX_SAMPLES) this.samples.length = MAX_SAMPLES;
      scheduleRender();
    };

    try {
      while (!done) {
        buffer += decoder.decode(value, { stream: true });
        // Process complete lines
        let idx;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          line = line.replace(/\r$/, '');
          if (!line.trim()) continue;
          // Handle header skipping
          if (skipped < (skipLines | 0)) { skipped++; continue; }
          try {
            const sample = parseSample(line);
            batch.push(sample);
            lineCount++;
            if (batch.length >= 500) pushBatch();
          } catch (e) {
            console.warn('Bad line in file:', e);
          }
        }
        // Update progress text occasionally
        if (connectBtn && lineCount % 1000 === 0) connectBtn.textContent = `Loading… ${lineCount.toLocaleString()} lines`;
        // Yield to keep UI responsive
        await new Promise(r => setTimeout(r, 0));
        ({ value, done } = await reader.read());
      }
      // Flush the remainder of the buffer
      buffer += decoder.decode();
      for (const rawLine of buffer.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        if (skipped < (skipLines | 0)) { skipped++; continue; }
        try {
          const sample = parseSample(line);
          batch.push(sample);
          lineCount++;
        } catch (e) {
          console.warn('Bad line in file:', e);
        }
      }
      pushBatch();
      // Final render
      this.renderHistoryRows();
      this.drawCharts();
      // Update tab title to the loaded filename
      this.setTitle(file?.name || 'File');
      if (!this._used) {
        this._used = true;
        if (typeof this.firstUseCb === 'function') this.firstUseCb(this);
      }
    } finally {
      try { reader.releaseLock?.(); } catch {}
      if (connectBtn) { connectBtn.disabled = prevBtnDisabled ?? false; connectBtn.textContent = prevBtnText ?? 'Connect'; }
      if (spinner) { spinner.style.display = 'none'; }
    }
  }

  setTitle(title) {
    this.title = title || this.title || 'Source';
    const tab = document.getElementById(`tab-${this.id}`);
    if (tab) {
      const tspan = tab.querySelector('.tab-title');
      if (tspan) tspan.textContent = this.title;
      tab.setAttribute('title', this.title);
    }
    try { window.magdash?.savePanesState?.(); } catch {}
  }

  exportJSONL() {
    if (!this.samples.length) {
      alert('No data to export.');
      return;
    }
    const lines = this.samples
      .slice() // already sorted desc
      .map(s => {
        const base = { ts: s.ts, x: Number(formatNum(s.x)), y: Number(formatNum(s.y)), z: Number(formatNum(s.z)) };
        if (typeof s.temp === 'number') base.temp = Number(formatNum(s.temp));
        return JSON.stringify(base);
      });
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${this.title.replace(/\s+/g,'_') || this.id}.jsonl` });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }
}

class App {
  constructor() {
    this.cfg = loadConfig();
    setTheme(this.cfg.theme);
    this.tabsEl = document.getElementById('tabs');
    this.contentEl = document.getElementById('content');
    this.panes = [];

    this.themeBtn = document.getElementById('themeToggle');
    this.themeBtn.addEventListener('click', () => this.toggleTheme());

    // Global config toggle button (collapse/expand left config for active pane)
    this.globalCfgBtn = document.getElementById('configToggle');
    if (this.globalCfgBtn) {
      this.globalCfgBtn.addEventListener('click', () => {
        const p = this.activePane();
        if (!p) return;
        p.setCollapsed(!p.collapsed);
        this.updateGlobalConfigToggle();
      });
    }

    window.addEventListener('resize', () => {
      const active = this.activePane();
      if (active) {
        this.clampLeftWidth(active);
        active.resizeCharts();
      }
    });

    // Resize observer to handle layout changes affecting charts size
    if ('ResizeObserver' in window) {
      this._ro = new ResizeObserver(() => {
        const active = this.activePane();
        if (active) active.resizeCharts();
      });
      this._ro.observe(this.contentEl);
    }

    // Persist splitter width updates
    window.addEventListener('magdash:split', (ev) => {
      try {
        const { id, left } = ev.detail || {};
        const p = this.panes.find(x => x.id === id);
        if (p && typeof left === 'number' && left > 0) {
          p.leftWidthPx = left;
          this.savePanesState();
        }
      } catch {}
    });

    // Reflect per-pane collapse state changes in the global toggle button
    window.addEventListener('magdash:collapsed', () => this.updateGlobalConfigToggle());

    // Keyboard shortcut: Ctrl+Shift+C (or Meta+Shift+C) toggles config for active pane
    window.addEventListener('keydown', (e) => {
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      if (!ctrlOrMeta || !e.shiftKey) return;
      // Ignore if focused element is an editable input without modifiers beyond Ctrl/Meta+Shift
      const tag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toLowerCase() : '';
      const isEditable = ['input','textarea','select'].includes(tag) || (document.activeElement && document.activeElement.isContentEditable);
      if (isEditable && !(e.ctrlKey || e.metaKey)) return;
      if (e.code === 'KeyC') {
        const p = this.activePane();
        if (p) {
          e.preventDefault();
          p.setCollapsed(!p.collapsed);
          this.updateGlobalConfigToggle();
        }
      }
    });

    // Initialize config first so it's available before activating any source pane
    this.addConfigPane();
    // Restore panes from localStorage or create one
    const restored = this.restorePanesState();
    if (!restored) {
      this.addSourcePane();
      this.savePanesState();
    }
    // Initial state of the global toggle
    this.updateGlobalConfigToggle();
  }

  activePane() { return this.panes.find(p => p.active); }

  toggleTheme() {
    this.cfg.theme = this.cfg.theme === 'dark' ? 'light' : 'dark';
    setTheme(this.cfg.theme);
    saveConfig(this.cfg);
    this.themeBtn.innerHTML = `<span class="ti ${this.cfg.theme === 'dark' ? 'ti-sun' : 'ti-moon'}"></span>`;
  }

  addSourcePane(opts = {}) {
    const id = opts.id || `src-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const title = opts.title || 'New Source';
    const autoActivate = opts.autoActivate !== undefined ? !!opts.autoActivate : true;
    const pane = new SourcePane(id, title, (p) => this.activate(p), (p) => this.remove(p), () => this.onPaneFirstUse());
    if (typeof opts.leftWidthPx === 'number') pane.leftWidthPx = opts.leftWidthPx;
    if (typeof opts.collapsed === 'boolean') pane.collapsed = opts.collapsed;
    this.panes.push(pane);
    const tab = pane.tabEl();
    const panel = pane.panelEl();
    // Insert before the config tab if it exists to keep config at far right
    const configTab = document.getElementById('tab-config');
    if (configTab && configTab.parentElement) {
      configTab.parentElement.insertBefore(tab, configTab);
    } else {
      this.tabsEl.append(tab);
    }
    this.contentEl.append(panel);
    if (autoActivate) this.activate(pane);
    this.savePanesState();
  }

  addConfigPane() {
    const id = 'config';
    const tab = h('button', { class: 'tab', role: 'tab', id: 'tab-config' }, h('span', { class: 'ti ti-settings' }), ' Config');
    tab.addEventListener('click', () => this.showConfig());
    this.tabsEl.append(tab); // always last
    this.configPanel = this.buildConfigPanel();
    this.contentEl.append(this.configPanel);
  }

  buildConfigPanel() {
    const panel = h('section', { class: 'panel panel-config', id: 'panel-config', role: 'tabpanel', 'aria-hidden': 'true' });
    const themeRow = h('div', { class: 'field' }, h('label', {}, 'Theme'), h('select', {},
      h('option', { value: 'light', selected: this.cfg.theme === 'light' ? '' : null }, 'Light'),
      h('option', { value: 'dark', selected: this.cfg.theme === 'dark' ? '' : null }, 'Dark'),
    ));
    const saveBtn = h('button', { class: 'btn primary' }, 'Save');
    const card = h('div', { class: 'card' },
      h('h3', {}, 'Global configuration'),
      themeRow,
      h('div', { class: 'muted' }, 'Settings are stored locally in your browser.'),
      h('div', { class: 'row' }, saveBtn),
    );
    panel.append(card);
    const select = themeRow.querySelector('select');
    saveBtn.addEventListener('click', () => {
      this.cfg.theme = select.value;
      setTheme(this.cfg.theme);
      saveConfig(this.cfg);
      alert('Saved');
    });
    return panel;
  }

  showConfig() {
    for (const p of this.panes) this.setActive(p, false);
    this.configPanel.setAttribute('aria-hidden', 'false');
    this.markActiveTab('config');
    this.updateGlobalConfigToggle();
  }

  markActiveTab(id) {
    for (const el of this.tabsEl.querySelectorAll('.tab')) el.setAttribute('aria-selected', 'false');
    const t = document.getElementById(`tab-${id}`) || (id === 'config' ? document.getElementById('tab-config') : null);
    if (t) t.setAttribute('aria-selected', 'true');
  }

  activate(pane) {
    for (const p of this.panes) {
      this.setActive(p, p === pane);
    }
    if (this.configPanel) this.configPanel.setAttribute('aria-hidden', 'true');
    this.markActiveTab(pane.id);
    // Restore splitter position for this pane, ensuring at least the form's content width
    try {
      const contentEl = document.getElementById('content');
      const form = pane.elements?.form;
      if (contentEl && form) {
        if (pane.collapsed) {
          contentEl.style.setProperty('--left-width', `0px`);
          pane.updateCollapseUI?.();
        } else {
          const minLeft = Math.max(240, pane.minLeftPx || Math.ceil(form.scrollWidth));
          let desired = Math.max(minLeft, pane.leftWidthPx || 360);
          // Also respect maximum based on current viewport
          const styles = getComputedStyle(contentEl);
          const rect = contentEl.getBoundingClientRect();
          const padL = parseFloat(styles.paddingLeft) || 0;
          const padR = parseFloat(styles.paddingRight) || 0;
          const gap = parseFloat(styles.columnGap) || 16;
          const splitterW = pane.elements?.splitter ? (parseFloat(getComputedStyle(pane.elements.splitter).width) || 6) : 6;
          const innerWidth = rect.width - padL - padR;
          const minRight = 320;
          const maxLeft = Math.max(0, innerWidth - (minRight + splitterW + gap * 2));
          desired = Math.min(desired, maxLeft);
          contentEl.style.setProperty('--left-width', `${desired}px`);
          pane.updateCollapseUI?.();
        }
      }
    } catch {}
    pane.resizeCharts();
    this.updateGlobalConfigToggle();
  }

  setActive(pane, active) {
    pane.active = active;
    const el = document.getElementById(`panel-${pane.id}`);
    if (el) el.setAttribute('aria-hidden', active ? 'false' : 'true');
    const tab = document.getElementById(`tab-${pane.id}`);
    if (tab) tab.setAttribute('aria-selected', active ? 'true' : 'false');
  }

  remove(pane) {
    const idx = this.panes.indexOf(pane);
    if (idx >= 0) this.panes.splice(idx, 1);
    document.getElementById(`panel-${pane.id}`)?.remove();
    document.getElementById(`tab-${pane.id}`)?.remove();
    this.savePanesState();
    if (!this.panes.length) this.addSourcePane(); else this.activate(this.panes[0]);
    this.updateGlobalConfigToggle();
  }

  onPaneFirstUse() {
    // When a pane is used for the first time, create a fresh one to the right
    // but keep the current page selected.
    this.addSourcePane({ autoActivate: false });
  }

  clampLeftWidth(pane) {
    try {
      const contentEl = document.getElementById('content');
      const form = pane.elements?.form;
      if (!contentEl || !form) return;
      if (pane.collapsed) {
        // Keep collapsed width at 0 when window resizes
        contentEl.style.setProperty('--left-width', `0px`);
        return;
      }
      const styles = getComputedStyle(contentEl);
      const rect = contentEl.getBoundingClientRect();
      const padL = parseFloat(styles.paddingLeft) || 0;
      const padR = parseFloat(styles.paddingRight) || 0;
      const gap = parseFloat(styles.columnGap) || 16;
      const splitterW = pane.elements?.splitter ? (parseFloat(getComputedStyle(pane.elements.splitter).width) || 6) : 6;
      const innerWidth = rect.width - padL - padR;
      const minRight = 320;
      const maxLeft = Math.max(0, innerWidth - (minRight + splitterW + gap * 2));
      const minLeft = Math.max(240, pane.minLeftPx || Math.ceil(form.scrollWidth));
      const current = parseFloat(styles.getPropertyValue('--left-width')) || pane.leftWidthPx || 360;
      const clamped = Math.max(minLeft, Math.min(current, maxLeft));
      contentEl.style.setProperty('--left-width', `${clamped}px`);
      pane.leftWidthPx = clamped;
    } catch {}
  }

  savePanesState() {
    try {
      const data = this.panes.map(p => ({ id: p.id, title: p.title, leftWidthPx: typeof p.leftWidthPx === 'number' ? p.leftWidthPx : undefined, collapsed: !!p.collapsed }));
      localStorage.setItem(LS_PANES_KEY, JSON.stringify(data));
    } catch {}
  }

  restorePanesState() {
    try {
      const raw = localStorage.getItem(LS_PANES_KEY);
      if (!raw) return false;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return false;
      for (const item of arr) {
        this.addSourcePane({ id: item.id, title: item.title || 'Source', leftWidthPx: item.leftWidthPx, collapsed: !!item.collapsed });
      }
      // ensure config tab stays last (already handled in addSourcePane)
      this.updateGlobalConfigToggle();
      return true;
    } catch {
      return false;
    }
  }

  updateGlobalConfigToggle() {
    const btn = this.globalCfgBtn;
    if (!btn) return;
    const active = this.activePane();
    const isConfigActive = this.configPanel && this.configPanel.getAttribute('aria-hidden') === 'false';
    const enabled = !!active && !isConfigActive;
    btn.disabled = !enabled;
    if (!enabled) {
      btn.setAttribute('aria-pressed', 'false');
      btn.title = 'Toggle config panel (select a source tab)';
      btn.innerHTML = '<span class="ti ti-layout-sidebar-right-collapse"></span>';
      return;
    }
    btn.setAttribute('aria-pressed', active.collapsed ? 'true' : 'false');
    // Update icon and tooltip according to state
    if (active.collapsed) {
      btn.title = 'Show config (Ctrl+Shift+C)';
      btn.innerHTML = '<span class="ti ti-layout-sidebar-right-expand"></span>';
    } else {
      btn.title = 'Hide config (Ctrl+Shift+C)';
      btn.innerHTML = '<span class="ti ti-layout-sidebar-right-collapse"></span>';
    }
  }
}

window.addEventListener('beforeunload', (e) => {
  try {
    const panes = window.magdash?.panes || [];
    const hasUnsaved = panes.some(p => p.samples && p.samples.length);
    if (hasUnsaved) {
      // Show a confirmation prompt in supported browsers
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  } catch {}
});

window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  // Expose for quick debugging in console
  window.magdash = app;
});
