const LS_KEY = "magdash.config.v1";
const LS_PANES_KEY = "magdash.panes.v1"; // persist per-tab state (id, title, splitter width)

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
  }

  tabEl() {
    const btn = h('button', { class: 'tab', role: 'tab', id: `tab-${this.id}` },
      h('span', { class: 'ti ti-radio' }), ' ', this.title);
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
    const fileInput = h('input', { type: 'file', accept: '.jsonl,.txt,application/json' });
    fileInput.style.display = 'none';
    const skipInput = h('input', { type: 'number', min: '0', value: '0', size: '3', inputmode: 'numeric', class: 'w-ch-3' });
    const deviceInput = h('input', { type: 'text', placeholder: '/dev/ttyUSB0', style: 'display:none' });

    modeSel.addEventListener('change', () => {
      this.mode = modeSel.value;
      const isFile = this.mode === 'file';
      const isWs = this.mode === 'ws';
      const isDev = this.mode === 'device';
      urlInput.style.display = isWs ? 'block' : 'none';
      fileInput.style.display = isFile ? 'block' : 'none';
      deviceInput.style.display = isDev ? 'block' : 'none';
    });

    const connectBtn = h('button', { class: 'btn primary' }, h('span', { class: 'ti ti-plug-connected' }), ' Connect');
    const abandonBtn = h('button', { class: 'btn' }, h('span', { class: 'ti ti-trash' }), ' Abandon');

    const form = h('div', { class: 'card left-pane' },
      h('div', { class: 'field' }, h('label', {}, 'Mode'), modeSel),
      h('div', { class: 'field' }, h('label', {}, 'WebSocket URL'), urlInput),
      h('div', { class: 'field' }, h('label', {}, 'Local file'), fileInput),
      h('div', { class: 'field' }, h('label', {}, 'Device path'), deviceInput),
      h('div', { class: 'field' }, h('label', {}, 'Skip header lines'), skipInput),
      h('div', { class: 'row' }, abandonBtn, connectBtn),
    );

    // Right: charts
    const charts = h('div', { class: 'charts right-pane' },
      this.chartEl('X (nT)', 'x'),
      this.chartEl('Y (nT)', 'y'),
      this.chartEl('Z (nT)', 'z'),
      this.chartEl('Temp (°C)', 'temp'),
    );

    // Vertical splitter between left (form) and right (charts)
    const splitter = h('div', { class: 'vsplit', role: 'separator', 'aria-orientation': 'vertical', tabindex: '0' });

    // History table
    const table = h('table', { class: 'table' },
      h('thead', {}, h('tr', {},
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
      if (!contentEl || !this._dragging) return;
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
        await this.connectWs(url);
      } else if (this.mode === 'file') {
        const file = fileInput.files?.[0];
        if (!file) return alert('Choose a file');
        await this.loadFile(file, skip);
      } else if (this.mode === 'device') {
        const path = deviceInput.value.trim();
        if (!path) return alert('Enter a device path (e.g., /dev/ttyUSB0)');
        alert('Local Device mode UI is enabled. Browsers cannot open device paths directly. We can add Web Serial support or a Deno proxy in the next step. Entered path: ' + path);
      }
    });

    abandonBtn.addEventListener('click', () => this.removeCb(this));

    exportBtn.addEventListener('click', () => this.exportJSONL());

    this.elements = { wrap, tableBody: table.querySelector('tbody'), form, charts, splitter };
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
    this.drawCharts();
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
    for (const s of this.samples.slice(0, 500)) {
      tb.append(
        h('tr', {},
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
    const text = await file.text();
    const lines = text.split(/\r?\n/).slice(skipLines);
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const sample = parseSample(line);
        this.addSample(sample);
      } catch (e) {
        console.warn('Bad line in file:', e);
      }
    }
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

    // Initialize config first so it's available before activating any source pane
    this.addConfigPane();
    // Restore panes from localStorage or create one
    const restored = this.restorePanesState();
    if (!restored) {
      this.addSourcePane();
      this.savePanesState();
    }
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
    const pane = new SourcePane(id, title, (p) => this.activate(p), (p) => this.remove(p), () => this.onPaneFirstUse());
    if (typeof opts.leftWidthPx === 'number') pane.leftWidthPx = opts.leftWidthPx;
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
    this.activate(pane);
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
      }
    } catch {}
    pane.resizeCharts();
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
  }

  onPaneFirstUse() {
    // When a pane is used for the first time, create a fresh one to the right
    this.addSourcePane();
  }

  clampLeftWidth(pane) {
    try {
      const contentEl = document.getElementById('content');
      const form = pane.elements?.form;
      if (!contentEl || !form) return;
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
      const data = this.panes.map(p => ({ id: p.id, title: p.title, leftWidthPx: typeof p.leftWidthPx === 'number' ? p.leftWidthPx : undefined }));
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
        this.addSourcePane({ id: item.id, title: item.title || 'Source', leftWidthPx: item.leftWidthPx });
      }
      // ensure config tab stays last (already handled in addSourcePane)
      return true;
    } catch {
      return false;
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
