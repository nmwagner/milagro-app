// CONFIG now lives in common.js, shared across all pages.

// Alphabetized by variety name, not by code.
const VARIETIES = [
  { name: "Cabernet Franc", code: "CF" },
  { name: "Cabernet Sauvignon", code: "CS" },
  { name: "Chardonnay", code: "CH" },
  { name: "Corrales Red", code: "CR" },
  { name: "Corrales White", code: "CW" },
  { name: "Gewürztraminer", code: "GW" },
  { name: "Gruner Veltliner", code: "GV" },
  { name: "Merlot", code: "ML" },
  { name: "Pinot Noir", code: "PN" },
  { name: "Red Cuvee", code: "RC" },
  { name: "Riesling", code: "RL" },
  { name: "Rosé", code: "RZ" },
  { name: "Roussanne", code: "RS" },
  { name: "Semillon", code: "SM" },
  { name: "Syrah", code: "SY" },
  { name: "Viognier", code: "VG" },
  { name: "Zinfandel", code: "ZN" },
];

const VINTAGE_SUFFIX = "26";
const DEFAULT_NAMES = ["Max", "Laura", "Amy"];

// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------
let selectedVariety = null; // { name, code }
let selectedLot = null;     // "01".."10"
let recent = [];            // { lot, date, time, temp, brix, notes, name, status }

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  renderVarietyList();
  renderLotGrid();
  renderNameChips();
  prefillDateTime();
  wireSheets();
  wireForm();
  loadPendingIntoRecent();
  updatePendingBadge();
  attemptFlush();
});

window.addEventListener("online", attemptFlush);
setInterval(attemptFlush, 30000);

// ---------------------------------------------------------------
// Variety + lot number bottom sheets
// ---------------------------------------------------------------
function wireSheets() {
  const backdrop = $("sheetBackdrop");
  const varietySheet = $("varietySheet");
  const lotSheet = $("lotSheet");

  function openSheet(sheet) {
    backdrop.classList.add("open");
    sheet.classList.add("open");
  }
  function closeSheets() {
    backdrop.classList.remove("open");
    varietySheet.classList.remove("open");
    lotSheet.classList.remove("open");
  }
  backdrop.addEventListener("click", closeSheets);
  $("varietyField").addEventListener("click", () => openSheet(varietySheet));
  $("lotField").addEventListener("click", () => openSheet(lotSheet));

  window._closeSheets = closeSheets; // used by row handlers below
}

function renderVarietyList() {
  const wrap = $("varietyList");
  wrap.innerHTML = "";
  VARIETIES.forEach((v) => {
    const row = document.createElement("div");
    row.className = "variety-row";
    row.innerHTML = `<span class="name">${v.name}</span><span class="code">${v.code}</span>`;
    row.addEventListener("click", () => {
      selectedVariety = v;
      $("varietyVal").textContent = v.name;
      $("varietyField").classList.add("filled");
      document.querySelectorAll(".variety-row").forEach((r) => r.classList.remove("selected"));
      row.classList.add("selected");
      updateCode();
      window._closeSheets();
    });
    wrap.appendChild(row);
  });
}

function renderLotGrid() {
  const wrap = $("lotGrid");
  wrap.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const label = String(i).padStart(2, "0");
    const el = document.createElement("div");
    el.className = "lot-num";
    el.textContent = label;
    el.addEventListener("click", () => {
      selectedLot = label;
      $("lotVal").textContent = `Lot ${label}`;
      $("lotField").classList.add("filled");
      document.querySelectorAll(".lot-num").forEach((p) => p.classList.remove("selected"));
      el.classList.add("selected");
      updateCode();
      window._closeSheets();
    });
    wrap.appendChild(el);
  }
}

function updateCode() {
  const readout = $("codeReadout");
  if (selectedVariety && selectedLot) {
    readout.textContent = `${selectedVariety.code}${VINTAGE_SUFFIX}-${selectedLot}`;
    readout.classList.add("filled");
  } else {
    readout.textContent = "select variety + lot";
    readout.classList.remove("filled");
  }
  validateForm();
}

function lotCode() {
  return selectedVariety && selectedLot ? `${selectedVariety.code}${VINTAGE_SUFFIX}-${selectedLot}` : null;
}

// ---------------------------------------------------------------
// Date / time — prefilled to now, editable
// ---------------------------------------------------------------
function pad(n) { return String(n).padStart(2, "0"); }

function prefillDateTime() {
  const now = new Date();
  $("dateInput").value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  $("timeInput").value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// ---------------------------------------------------------------
// Name chips
// ---------------------------------------------------------------
function renderNameChips() {
  const wrap = $("nameChips");
  wrap.innerHTML = "";
  DEFAULT_NAMES.forEach((name) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = name;
    chip.addEventListener("click", () => {
      $("nameInput").value = name;
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      validateForm();
    });
    wrap.appendChild(chip);
  });
}

// ---------------------------------------------------------------
// Gauges + numeric restriction
// ---------------------------------------------------------------
function updateGauges() {
  const temp = parseFloat($("tempInput").value);
  const brix = parseFloat($("brixInput").value);
  const tempPct = isNaN(temp) ? 0 : Math.min(100, Math.max(0, ((temp - 50) / (95 - 50)) * 100));
  $("tempFill").style.width = tempPct + "%";
  const brixPct = isNaN(brix) ? 0 : Math.min(100, Math.max(0, (brix / 26) * 100));
  $("brixFill").style.width = brixPct + "%";
}

// Numbers only: block letters (including "e" scientific notation), +, and a
// second decimal point. inputmode="decimal" already gives a numeric keypad
// on phones, this is the backstop for anyone typing on a real keyboard.
function restrictToNumber(e) {
  const blocked = ["e", "E", "+", "-"];
  if (blocked.includes(e.key)) { e.preventDefault(); return; }
  if (e.key === "." && e.target.value.includes(".")) e.preventDefault();
}

// ---------------------------------------------------------------
// Form wiring + validation
// ---------------------------------------------------------------
function wireForm() {
  $("tempInput").addEventListener("input", () => { updateGauges(); validateForm(); });
  $("brixInput").addEventListener("input", () => { updateGauges(); validateForm(); });
  $("tempInput").addEventListener("keydown", restrictToNumber);
  $("brixInput").addEventListener("keydown", restrictToNumber);
  $("nameInput").addEventListener("input", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
    validateForm();
  });
  $("dateInput").addEventListener("input", validateForm);
  $("timeInput").addEventListener("input", validateForm);
  $("logBtn").addEventListener("click", submitEntry);
}

function validateForm() {
  const temp = $("tempInput").value.trim();
  const brix = $("brixInput").value.trim();
  const name = $("nameInput").value.trim();
  const date = $("dateInput").value;
  const time = $("timeInput").value;
  const ok = !!lotCode() && !!name && !!date && !!time && (temp !== "" || brix !== "");
  $("logBtn").disabled = !ok;
}

// ---------------------------------------------------------------
// Submit + offline queue
// ---------------------------------------------------------------
function submitEntry() {
  const entry = {
    lot: lotCode(),
    date: $("dateInput").value,
    time: $("timeInput").value,
    temp: $("tempInput").value.trim(),
    brix: $("brixInput").value.trim(),
    notes: $("notesInput").value.trim(),
    name: $("nameInput").value.trim(),
    queuedAt: Date.now(),
    status: "queued",
  };

  recent.unshift(entry);
  renderRecent();

  const queue = getQueue();
  queue.push(entry);
  saveQueue(queue);
  updatePendingBadge();

  // Clear the reading, keep lot + name selected for the next reading on the
  // same lot, and bump the clock forward to right now for the next entry.
  $("tempInput").value = "";
  $("brixInput").value = "";
  $("notesInput").value = "";
  updateGauges();
  prefillDateTime();
  validateForm();
  showToast("Entry saved");

  attemptFlush();
}

function getQueue() {
  try { return JSON.parse(localStorage.getItem("fermlog_queue") || "[]"); }
  catch (e) { return []; }
}
function saveQueue(q) { localStorage.setItem("fermlog_queue", JSON.stringify(q)); }

function loadPendingIntoRecent() {
  const q = getQueue();
  recent = q.map((e) => ({ ...e, status: "queued" }));
  renderRecent();
}

let flushing = false;
async function attemptFlush() {
  if (flushing) return;
  if (!navigator.onLine) return;
  if (!CONFIG.API_URL || CONFIG.API_URL.startsWith("PASTE_")) return;
  const queue = getQueue();
  if (!queue.length) return;

  flushing = true;
  const remaining = [];

  for (const entry of queue) {
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "log",
          lot: entry.lot,
          date: entry.date,
          time: entry.time,
          temp: entry.temp,
          brix: entry.brix,
          notes: entry.notes,
          name: entry.name,
        }),
      });
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "server rejected entry");

      const match = recent.find((r) => r.queuedAt === entry.queuedAt && r.status !== "synced");
      if (match) match.status = "synced";
    } catch (e) {
      remaining.push(entry);
    }
  }

  saveQueue(remaining);
  updatePendingBadge();
  renderRecent();
  flushing = false;

  if (remaining.length === 0 && queue.length > 0) {
    showToast("Synced to Ferm Master Log");
  }
}

function updatePendingBadge() {
  const n = getQueue().length;
  $("pendingBadge").textContent = n > 0 ? `${n} entr${n === 1 ? "y" : "ies"} waiting to sync` : "";
}

// ---------------------------------------------------------------
// Recent entries list
// ---------------------------------------------------------------
function renderRecent() {
  const wrap = $("recentList");
  if (!recent.length) {
    wrap.innerHTML = `<div class="empty-note">Logged entries will show up here.</div>`;
    return;
  }
  wrap.innerHTML = "";
  recent.slice(0, 8).forEach((e) => {
    const row = document.createElement("div");
    row.className = "recent-row" + (e.status === "queued" ? " queued" : "");
    row.innerHTML = `
      <div><span class="lot">${e.lot}</span><span class="meta">${e.time}${e.status === "queued" ? " · pending sync" : ""}</span></div>
      <div class="vals">${e.temp !== "" ? e.temp + "&deg;" : ""}${e.temp !== "" && e.brix !== "" ? " / " : ""}${e.brix !== "" ? e.brix + " Bx" : ""}</div>
    `;
    wrap.appendChild(row);
  });
}
