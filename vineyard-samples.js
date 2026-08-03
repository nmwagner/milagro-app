// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------
let SAMPLES = [];
let combos = [];
let selected = null; // null = landing on the all-samples date list
const CACHE_KEY = "vineyard_samples_cache_2026";

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  wireSheet();
  wireForm();
  loadSamples();
});

window.addEventListener("online", () => loadSamples({ silent: true }));

async function loadSamples(opts) {
  opts = opts || {};

  // Show cached data immediately if we have it, so there's something on
  // screen while the network request is in flight.
  const cached = getCache();
  if (cached && cached.length) {
    applySamples(cached);
  }

  if (!CONFIG.API_URL || CONFIG.API_URL.startsWith("PASTE_")) {
    if (!cached) $("loadingNote").textContent = "Backend not configured yet.";
    return;
  }
  if (!navigator.onLine) {
    if (!cached) $("loadingNote").textContent = "Offline, and no saved samples on this device yet.";
    return;
  }

  try {
    const res = await fetch(`${CONFIG.API_URL}?action=samples`);
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "server error");
    applySamples(data.samples || []);
    saveCache(data.samples || []);
    if (opts.silent && data.samples && data.samples.length) showToast("Samples refreshed");
  } catch (err) {
    if (!cached) {
      $("loadingNote").textContent = "Couldn't reach the server, and no saved samples on this device yet.";
    } else if (!opts.silent) {
      showToast("Couldn't refresh, showing last saved samples");
    }
  }
}

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function saveCache(samples) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(samples)); } catch (e) { /* ignore */ }
}

function applySamples(samples) {
  SAMPLES = samples;
  $("loadingNote").style.display = "none";
  buildCombos();
  renderSheetList();
  render();
}

// ---------------------------------------------------------------
// Combos: grouped by vineyard, variety nested underneath
// ---------------------------------------------------------------
function parseDate(s) {
  const [m, d, yRaw] = s.split("/").map(Number);
  const y = yRaw < 100 ? 2000 + yRaw : yRaw;
  return new Date(y, m - 1, d);
}

function buildCombos() {
  const comboMap = new Map();
  SAMPLES.forEach(s => {
    const key = s.vineyard + " | " + s.variety;
    if (!comboMap.has(key)) comboMap.set(key, []);
    comboMap.get(key).push(s);
  });

  combos = Array.from(comboMap.entries()).map(([key, rows]) => {
    const [vineyard, variety] = key.split(" | ");
    rows.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    return { vineyard, variety, rows };
  });

  combos.sort((a, b) => {
    const vi = a.vineyard.localeCompare(b.vineyard);
    if (vi !== 0) return vi;
    return a.variety.localeCompare(b.variety);
  });
}

// ---------------------------------------------------------------
// Picker sheet
// ---------------------------------------------------------------
function wireSheet() {
  const backdrop = $("sheetBackdrop");
  const sheet = $("comboSheet");
  $("comboField").addEventListener("click", () => {
    backdrop.classList.add("open"); sheet.classList.add("open");
  });
  backdrop.addEventListener("click", () => {
    backdrop.classList.remove("open"); sheet.classList.remove("open");
  });
}

function closeSheet() {
  $("sheetBackdrop").classList.remove("open");
  $("comboSheet").classList.remove("open");
}

function renderSheetList() {
  const listWrap = $("comboList");
  listWrap.innerHTML = "";
  let lastVineyard = null;
  combos.forEach(c => {
    if (c.vineyard !== lastVineyard) {
      const label = document.createElement("div");
      label.className = "variety-group-label";
      label.textContent = c.vineyard;
      listWrap.appendChild(label);
      lastVineyard = c.vineyard;
    }
    const row = document.createElement("div");
    row.className = "combo-row" + (c === selected ? " selected" : "");
    row.innerHTML = `<span class="name">${c.variety}</span><span class="n">${c.rows.length} sample${c.rows.length===1?"":"s"}</span>`;
    row.addEventListener("click", () => {
      selected = c;
      closeSheet();
      render();
    });
    listWrap.appendChild(row);
  });
}

function wireForm() {
  $("backToAll").addEventListener("click", (e) => {
    e.preventDefault();
    selected = null;
    render();
  });
}

// ---------------------------------------------------------------
// Linear regression
// ---------------------------------------------------------------
function regression(points) {
  const n = points.length;
  if (n < 2) return null;
  const t0 = points[0].t;
  const xs = points.map(p => p.t - t0);
  const ys = points.map(p => p.y);
  const sumX = xs.reduce((a,b)=>a+b,0), sumY = ys.reduce((a,b)=>a+b,0);
  const sumXY = xs.reduce((a,x,i)=>a+x*ys[i],0);
  const sumXX = xs.reduce((a,x)=>a+x*x,0);
  const denom = (n*sumXX - sumX*sumX);
  if (denom === 0) return null;
  const slope = (n*sumXY - sumX*sumY) / denom;
  const intercept = (sumY - slope*sumX) / n;
  return { slope, intercept, t0 };
}

// ---------------------------------------------------------------
// Chart rendering
// ---------------------------------------------------------------
function renderChart(rows) {
  const wrap = $("chartWrap");
  if (rows.length < 1) {
    wrap.innerHTML = `<div class="no-data">No samples yet.</div>`;
    return;
  }
  if (rows.length === 1) {
    wrap.innerHTML = `<div class="no-data">Only one reading so far, ${rows[0].brix} Brix on ${rows[0].date}. Trend needs at least two samples.</div>`;
    return;
  }

  const W = 340, H = 190, padL = 32, padR = 12, padT = 14, padB = 26;
  const DAY = 86400000;
  const points = rows.map(r => ({ t: parseDate(r.date).getTime(), y: r.brix, date: r.date }));
  const tMin = points[0].t, tLast = points[points.length-1].t;
  const reg = regression(points);
  const tProjected = reg ? tLast + 5 * DAY : tLast;
  const projectedBrix = reg ? reg.slope * (tProjected - reg.t0) + reg.intercept : null;
  const tMax = tProjected;
  const yValsForRange = points.map(p=>p.y);
  if (projectedBrix !== null) yValsForRange.push(projectedBrix);
  const yMin = Math.floor(Math.min(...yValsForRange) - 1.5);
  const yMax = Math.ceil(Math.max(...yValsForRange) + 1.5);

  const x = t => padL + (W - padL - padR) * ((t - tMin) / Math.max(1, (tMax - tMin)));
  const y = v => H - padB - (H - padT - padB) * ((v - yMin) / (yMax - yMin));

  let gridlines = "";
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const v = yMin + (yMax - yMin) * i / ySteps;
    const yy = y(v);
    gridlines += `<line x1="${padL}" y1="${yy}" x2="${W-padR}" y2="${yy}" stroke="#3a3542" stroke-width="1" />`;
    gridlines += `<text x="${padL-6}" y="${yy+3}" font-size="9" fill="#a9a0ae" font-family="IBM Plex Mono, monospace" text-anchor="end">${v.toFixed(0)}</text>`;
  }

  const maxLabels = 6;
  const stride = Math.max(1, Math.ceil(points.length / maxLabels));
  let xlabels = "";
  points.forEach((p, i) => {
    if (i % stride === 0 || i === points.length - 1) {
      const d = new Date(p.t);
      const label = `${d.getMonth()+1}/${d.getDate()}`;
      xlabels += `<text x="${x(p.t)}" y="${H-8}" font-size="9" fill="#a9a0ae" font-family="IBM Plex Mono, monospace" text-anchor="middle">${label}</text>`;
    }
  });

  const linePath = points.map((p,i) => `${i===0?"M":"L"}${x(p.t).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const dots = points.map(p => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="3.2" fill="#c9a464" stroke="#14131a" stroke-width="1"/>`).join("");

  let trendPath = "", projectedMarkup = "";
  if (reg) {
    const y1 = reg.intercept;
    const yLast = reg.slope * (tLast - reg.t0) + reg.intercept;
    trendPath = `<line x1="${x(tMin)}" y1="${y(y1)}" x2="${x(tLast)}" y2="${y(yLast)}" stroke="#a9a0ae" stroke-width="1.5" stroke-dasharray="4 3" />`;
    trendPath += `<line x1="${x(tLast)}" y1="${y(yLast)}" x2="${x(tProjected)}" y2="${y(projectedBrix)}" stroke="#c9a464" stroke-width="1.5" stroke-dasharray="2 3" opacity="0.7" />`;
    const pd = new Date(tProjected);
    const pLabel = `${pd.getMonth()+1}/${pd.getDate()}`;
    projectedMarkup = `
      <circle cx="${x(tProjected).toFixed(1)}" cy="${y(projectedBrix).toFixed(1)}" r="2.6" fill="none" stroke="#c9a464" stroke-width="1.3"/>
      <text x="${x(tProjected).toFixed(1)}" y="${(y(projectedBrix)-7).toFixed(1)}" font-size="9" fill="#c9a464" font-family="IBM Plex Mono, monospace" text-anchor="middle">${projectedBrix.toFixed(1)}</text>
      <text x="${x(tProjected).toFixed(1)}" y="${H-8}" font-size="9" fill="#7a7480" font-family="IBM Plex Mono, monospace" text-anchor="middle">${pLabel}</text>
    `;
  }

  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
    ${gridlines}
    ${trendPath}
    <path d="${linePath}" fill="none" stroke="#c9a464" stroke-width="2.2" />
    ${dots}
    ${xlabels}
    ${projectedMarkup}
  </svg>`;
}

// ---------------------------------------------------------------
// Stats
// ---------------------------------------------------------------
function renderStats(rows) {
  const wrap = $("statRow");
  wrap.innerHTML = "";
  const last = rows[rows.length - 1];
  const first = rows[0];
  const days = Math.max(1, (parseDate(last.date) - parseDate(first.date)) / 86400000);
  const rate = rows.length > 1 ? ((last.brix - first.brix) / days) : null;

  const chips = [
    { label: "Latest Brix", value: last.brix, brass: true },
    { label: "Last sampled", value: last.date },
    { label: "Rise / day", value: rate !== null ? (rate >= 0 ? "+" : "") + rate.toFixed(2) : "—" },
  ];
  chips.forEach(c => {
    const el = document.createElement("div");
    el.className = "stat-chip";
    el.innerHTML = `<div class="label">${c.label}</div><div class="value${c.brass?" brass":""}">${c.value}</div>`;
    wrap.appendChild(el);
  });
}

// ---------------------------------------------------------------
// Sample log table
// ---------------------------------------------------------------
function renderTable(rows) {
  const table = $("sampleTable");
  let html = `<tr><th>Date</th><th>Brix</th><th>pH</th><th>TA</th></tr>`;
  rows.slice().reverse().forEach(r => {
    html += `<tr>
      <td>${r.date}</td>
      <td>${r.brix}</td>
      <td class="${r.ph? "":"muted"}">${r.ph ?? "—"}</td>
      <td class="${r.ta? "":"muted"}">${r.ta ?? "—"}</td>
    </tr>`;
  });
  table.innerHTML = html;
}

// ---------------------------------------------------------------
// Date list (landing view)
// ---------------------------------------------------------------
function renderDateList() {
  const wrap = $("dateList");
  const byDate = new Map();
  SAMPLES.forEach(s => {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  });
  const dates = Array.from(byDate.keys()).sort((a, b) => parseDate(b) - parseDate(a));

  wrap.innerHTML = "";
  if (!dates.length) {
    wrap.innerHTML = `<div class="empty-note">No samples logged for 2026 yet.</div>`;
    return;
  }
  dates.forEach(date => {
    const group = document.createElement("div");
    group.className = "date-group";
    const header = document.createElement("div");
    header.className = "date-group-header";
    header.textContent = date;
    group.appendChild(header);

    byDate.get(date).forEach(s => {
      const row = document.createElement("div");
      row.className = "date-row";
      row.innerHTML = `<span class="who">${s.vineyard} <span class="variety">— ${s.variety}</span></span><span class="val">${s.brix}</span>`;
      row.addEventListener("click", () => {
        const combo = combos.find(c => c.vineyard === s.vineyard && c.variety === s.variety);
        if (combo) { selected = combo; render(); }
      });
      group.appendChild(row);
    });
    wrap.appendChild(group);
  });
}

// ---------------------------------------------------------------
// Render
// ---------------------------------------------------------------
function render() {
  const dateView = $("dateListView");
  const comboView = $("comboView");

  if (!selected) {
    $("comboVal").textContent = "Select vineyard & variety";
    dateView.style.display = "";
    comboView.style.display = "none";
    renderDateList();
    return;
  }

  $("comboVal").textContent = `${selected.vineyard} — ${selected.variety}`;
  dateView.style.display = "none";
  comboView.style.display = "";
  renderStats(selected.rows);
  renderChart(selected.rows);
  renderTable(selected.rows);
  renderSheetList();
}
