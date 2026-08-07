// ---------------------------------------------------------------
// Harvest Log — reads live picking data from the season's
// Picking_Data sheet via ?action=harvest, same fetch/cache pattern
// as vineyard-samples.js.
// ---------------------------------------------------------------

let ENTRIES = [];
const CACHE_KEY = "harvest_log_cache_2026"; // bump the year alongside PICKING_DATA_SHEET_ID in Code.gs each season

document.addEventListener("DOMContentLoaded", () => {
  loadHarvest();
});
window.addEventListener("online", () => loadHarvest({ silent: true }));

async function loadHarvest(opts) {
  opts = opts || {};

  const cached = getCache();
  if (cached && cached.length) {
    applyEntries(cached);
  }

  if (!CONFIG.API_URL || CONFIG.API_URL.startsWith("PASTE_")) {
    if (!cached) $("loadingNote").textContent = "Backend not configured yet.";
    return;
  }
  if (!navigator.onLine) {
    if (!cached) $("loadingNote").textContent = "Offline, and no saved harvest data on this device yet.";
    return;
  }

  try {
    const res = await fetch(`${CONFIG.API_URL}?action=harvest`);
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "server error");
    applyEntries(data.entries || []);
    saveCache(data.entries || []);
    if (opts.silent && data.entries && data.entries.length) showToast("Harvest data refreshed");
  } catch (err) {
    if (!cached) {
      $("loadingNote").textContent = "Couldn't reach the server, and no saved harvest data on this device yet.";
    } else if (!opts.silent) {
      showToast("Couldn't refresh, showing last saved harvest data");
    }
  }
}

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function saveCache(entries) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(entries)); } catch (e) { /* ignore */ }
}

function applyEntries(entries) {
  ENTRIES = entries;
  const loadingNote = $("loadingNote");
  if (!ENTRIES.length) {
    loadingNote.textContent = "No picks logged for this season yet.";
    loadingNote.style.display = "";
    $("harvestBody").style.display = "none";
    return;
  }
  loadingNote.style.display = "none";
  $("harvestBody").style.display = "";
  buildStats();
  buildVarietyBreakdown();
  buildTimeline();
}

// ---------------------------------------------------------------
// Canonical variety table
//
// The picking sheet is hand-typed at harvest time, so the same grape shows
// up under different spellings season to season (2025 sheet: "Sauv Blanc",
// 2026 sheet: "Sauvignon Blanc") and gets clone/selection suffixes tacked on
// ("Cabernet Sauvignon New", "Chardonnay 15", "Zinfandel Select"). This
// table resolves all of that down to one canonical full name + grape color
// family, so the season rollups don't silently split one grape into two
// rows and the timeline chips can be colored consistently.
//
// To add a new grape or alias: add it to VARIETY_INFO (canonical name +
// type) and, if it might show up spelled differently, add the lowercase
// variant(s) to VARIETY_ALIASES pointing at the canonical name. Anything
// that still doesn't match falls back to "unknown" (shown as-typed, gray
// chip) instead of guessing red or white.
// ---------------------------------------------------------------
const VARIETY_INFO = {
  "Cabernet Sauvignon": { type: "red", color: "#6e2740" },
  "Cabernet Franc":     { type: "red", color: "#b0507a" },
  "Merlot":             { type: "red", color: "#a93b54" },
  "Pinot Noir":         { type: "red", color: "#7a1f35" },
  "Syrah":              { type: "red", color: "#591c2e" },
  "Zinfandel":          { type: "red", color: "#8c2f45" },
  "Petite Sirah":       { type: "red", color: "#9c3d52" },
  "Graciano":           { type: "red", color: "#7a2f42" },
  "Mourvèdre":          { type: "red", color: "#4d1b2a" },
  "Red Cuvee":          { type: "red", color: "#8a3f52" },
  "Corrales Red":       { type: "red", color: "#b56b7e" },

  "Chardonnay":         { type: "white", color: "#c9a464" },
  "Riesling":           { type: "white", color: "#d9c08a" },
  "Sauvignon Blanc":    { type: "white", color: "#e0c078" },
  "Semillon":           { type: "white", color: "#e6d9b8" },
  "Roussanne":          { type: "white", color: "#cbb26a" },
  "Gruner Veltliner":   { type: "white", color: "#a98f52" },
  "Gewürztraminer":     { type: "white", color: "#ded0a0" },
  "Viognier":           { type: "white", color: "#f0d9a0" },
  "Corrales White":     { type: "white", color: "#efe3bd" },

  "Rosé":               { type: "rose", color: "#c17a94" },
};

const VARIETY_ALIASES = {
  "cab sauv": "Cabernet Sauvignon",
  "cabernet sauvignon": "Cabernet Sauvignon",
  "cab franc": "Cabernet Franc",
  "cabernet franc": "Cabernet Franc",
  "sauv blanc": "Sauvignon Blanc",
  "sauvignon blanc": "Sauvignon Blanc",
  "petit sirah": "Petite Sirah",        // 2025 sheet spelling
  "petite sirah": "Petite Sirah",
  "gewurtztraminer": "Gewürztraminer",  // sheets consistently drop the umlaut / add an extra "t"
  "gewurztraminer": "Gewürztraminer",
  "gewürztraminer": "Gewürztraminer",
  "gruner": "Gruner Veltliner",
  "gruner veltliner": "Gruner Veltliner",
  "zin": "Zinfandel",
  "zinfandel": "Zinfandel",
  "zin sel": "Zinfandel",
  "zinfandel select": "Zinfandel",
};

const TYPE_CHIP_COLOR = { red: "#a93b54", white: "#c9a464", rose: "#c17a94", unknown: "#7a7480" };

function resolveVariety(raw) {
  const trimmed = String(raw || "").trim();
  // Strip a trailing clone/selection marker ("New", "Old", "Select", "Sel",
  // or a trailing clone number like "Chardonnay 15") before matching, so a
  // clone we haven't explicitly aliased still resolves to its base grape.
  const stripped = trimmed.replace(/\s+(New|Old|Select|Sel)$/i, "").replace(/\s+\d+$/, "").trim();

  const tryMatch = (name) => {
    if (VARIETY_INFO[name]) return name;
    const alias = VARIETY_ALIASES[name.toLowerCase()];
    return alias || null;
  };

  const resolved = tryMatch(trimmed) || tryMatch(stripped);
  if (resolved) {
    return { name: resolved, type: VARIETY_INFO[resolved].type, color: VARIETY_INFO[resolved].color };
  }
  return { name: trimmed, type: "unknown", color: TYPE_CHIP_COLOR.unknown };
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmt(n) { return Math.round(n).toLocaleString(); }

// ---------------- Stat tiles ----------------
function buildStats() {
  const total = ENTRIES.reduce((a, e) => a + e.weight, 0);
  const days = new Set(ENTRIES.map((e) => e.date));
  const vineyards = new Set(ENTRIES.map((e) => e.vineyard));
  const dates = Array.from(days).sort((a, b) => new Date(a) - new Date(b));
  const first = dates[0], last = dates[dates.length - 1];
  const shortD = (d) => d.split("/").slice(0, 2).join("/");

  $("statTotal").textContent = fmt(total) + " lb";
  $("statDays").textContent = days.size;
  $("statRange").textContent = `${shortD(first)} – ${shortD(last)}`;
  $("statVineyards").textContent = vineyards.size;
}

// ---------------- Variety composition (clones + aliases combined) ----------------
function buildVarietyBreakdown() {
  const totals = new Map();
  ENTRIES.forEach((e) => {
    const v = resolveVariety(e.variety);
    const existing = totals.get(v.name);
    if (existing) existing.wt += e.weight;
    else totals.set(v.name, { wt: e.weight, color: v.color, type: v.type });
  });

  const rows = Array.from(totals.entries())
    .map(([name, r]) => ({ name, wt: r.wt, color: r.color }))
    .sort((a, b) => b.wt - a.wt);

  const grand = rows.reduce((a, r) => a + r.wt, 0);
  const stackWrap = $("stackBar");
  const listWrap = $("varietyList");
  stackWrap.innerHTML = "";
  listWrap.innerHTML = "";

  rows.forEach((r) => {
    const pct = grand ? (r.wt / grand) * 100 : 0;
    const seg = document.createElement("div");
    seg.className = "stack-seg";
    seg.style.width = pct + "%";
    seg.style.background = r.color;
    stackWrap.appendChild(seg);

    const row = document.createElement("div");
    row.className = "hv-variety-row";
    row.innerHTML = `
      <span class="name"><span class="hv-swatch" style="background:${r.color}"></span>${esc(r.name)}</span>
      <span class="wt">${fmt(r.wt)} lb</span>
    `;
    listWrap.appendChild(row);
  });
}

// ---------------- Timeline, most recent pick first ----------------
function buildTimeline() {
  const byDate = new Map();
  ENTRIES.forEach((e) => {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  });
  // Sort dates chronologically first so the running season total is correct,
  // then reverse just the display order (most recent pick shows up top).
  const dates = Array.from(byDate.keys()).sort((a, b) => new Date(a) - new Date(b));

  let cum = 0;
  const cumByDate = new Map();
  dates.forEach((date) => {
    cum += byDate.get(date).reduce((a, r) => a + r.weight, 0);
    cumByDate.set(date, cum);
  });

  const wrap = $("tlBody");
  wrap.innerHTML = "";
  dates.slice().reverse().forEach((date) => {
    const rows = byDate.get(date);
    const dayTotal = rows.reduce((a, r) => a + r.weight, 0);
    const runningTotal = cumByDate.get(date);
    const group = document.createElement("div");
    group.className = "tl-date-group";
    const shortDate = date.split("/").slice(0, 2).join("/");
    group.innerHTML = `
      <div class="tl-dot"></div>
      <div class="tl-date-header">
        <span class="date">${esc(shortDate)}</span>
        <span class="daytotal">+${fmt(dayTotal)} lb &middot; ${fmt(runningTotal)} total</span>
      </div>
    `;
    rows.forEach((r) => {
      const v = resolveVariety(r.variety);
      const chipColor = TYPE_CHIP_COLOR[v.type];
      const el = document.createElement("div");
      el.className = "tl-entry";
      el.style.borderLeftColor = chipColor;

      let yoyHtml;
      if (r.pct == null) {
        yoyHtml = `<span class="tl-yoy new">new pick</span>`;
      } else if (r.pct === 0) {
        yoyHtml = `<span class="tl-yoy flat">flat vs last yr</span>`;
      } else {
        yoyHtml = `<span class="tl-yoy ${r.pct > 0 ? "up" : "down"}">${r.pct > 0 ? "▲ +" : "▼ "}${r.pct.toFixed(1)}% vs last yr</span>`;
      }

      el.innerHTML = `
        <div class="tl-entry-top">
          <span class="name-line">
            <span class="hv-swatch" style="background:${chipColor}"></span>
            <span class="pick-name"><span class="vy">${esc(r.vineyard)}</span> <span class="vr">— ${esc(r.variety)}</span></span>
          </span>
          <span class="tl-entry-right">
            <span class="wt">${fmt(r.weight)} lb</span>
            ${yoyHtml}
          </span>
        </div>
      `;
      group.appendChild(el);
    });
    wrap.appendChild(group);
  });
}
