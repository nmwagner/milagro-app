// CONFIG lives in common.js, shared across all pages.

// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------
let EVENTS = [];
let TASKS = [];
let filter = "all"; // all | event | task

const SCHEDULE_CACHE_KEY = "milagro_schedule_cache_2026";
const TASK_QUEUE_KEY = "milagro_task_queue";

function pad(n) { return String(n).padStart(2, "0"); }

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const TODAY = todayStr();

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  loadSchedule();
});

window.addEventListener("online", () => {
  loadSchedule({ silent: true });
  attemptFlushTaskQueue();
});
setInterval(attemptFlushTaskQueue, 30000);

// ---------------------------------------------------------------
// Load + cache
// ---------------------------------------------------------------
async function loadSchedule(opts) {
  opts = opts || {};

  const cached = getCache();
  if (cached) applyData(cached);

  if (!CONFIG.API_URL || CONFIG.API_URL.startsWith("PASTE_")) {
    if (!cached) $("loadingNote").textContent = "Backend not configured yet.";
    return;
  }
  if (!navigator.onLine) {
    if (!cached) $("loadingNote").textContent = "Offline, and no saved calendar on this device yet.";
    return;
  }

  try {
    const res = await fetch(`${CONFIG.API_URL}?action=schedule`);
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "server error");

    const fresh = {
      events: (data.events || []).map((e) => ({ ...e, type: "event" })),
      tasks: (data.tasks || []).map((t) => ({ ...t, type: "task" })),
    };
    applyData(fresh);
    saveCache(fresh);
    if (opts.silent) showToast("Calendar refreshed");
  } catch (err) {
    if (!cached) {
      $("loadingNote").textContent = "Couldn't reach the server, and no saved calendar on this device yet.";
    } else if (!opts.silent) {
      showToast("Couldn't refresh, showing last saved calendar");
    }
  }
}

function getCache() {
  try {
    const raw = localStorage.getItem(SCHEDULE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function saveCache(data) {
  try { localStorage.setItem(SCHEDULE_CACHE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

// Applies fetched/cached data, then re-applies any not-yet-synced task
// completions from the offline queue on top of it, so a checkbox tapped
// just before a refresh doesn't visually flicker back to its old state.
function applyData(data) {
  EVENTS = data.events;
  TASKS = data.tasks;
  reconcileWithQueue();
  $("loadingNote").style.display = "none";
  $("scheduleContent").style.display = "";
  renderWeekStrip();
  renderChips();
  renderList();
}

function reconcileWithQueue() {
  getTaskQueue().forEach((q) => {
    const t = TASKS.find((t) => t.id === q.taskId && t.listId === q.listId);
    if (t) t.done = q.completed;
  });
}

// ---------------------------------------------------------------
// Offline queue for task completions — same shape as the Ferm Log's
// reading queue: write locally first, queue the sync, flush on an
// interval and whenever we come back online.
// ---------------------------------------------------------------
function getTaskQueue() {
  try { return JSON.parse(localStorage.getItem(TASK_QUEUE_KEY) || "[]"); }
  catch (e) { return []; }
}
function saveTaskQueue(q) { localStorage.setItem(TASK_QUEUE_KEY, JSON.stringify(q)); }

let flushingTasks = false;
async function attemptFlushTaskQueue() {
  if (flushingTasks) return;
  if (!navigator.onLine) return;
  if (!CONFIG.API_URL || CONFIG.API_URL.startsWith("PASTE_")) return;
  const queue = getTaskQueue();
  if (!queue.length) return;

  flushingTasks = true;
  const remaining = [];

  for (const item of queue) {
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "set_task_status",
          listId: item.listId,
          taskId: item.taskId,
          completed: item.completed,
        }),
      });
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "server rejected update");
    } catch (e) {
      remaining.push(item);
    }
  }

  saveTaskQueue(remaining);
  flushingTasks = false;

  if (remaining.length === 0 && queue.length > 0) {
    showToast("Synced to Google Tasks");
  }
}

function toggleTask(id) {
  const t = TASKS.find((t) => t.id === id);
  if (!t) return;
  t.done = !t.done;

  const queue = getTaskQueue();
  const existing = queue.find((q) => q.taskId === t.id && q.listId === t.listId);
  if (existing) existing.completed = t.done;
  else queue.push({ taskId: t.id, listId: t.listId, completed: t.done, queuedAt: Date.now() });
  saveTaskQueue(queue);
  saveCache({ events: EVENTS, tasks: TASKS });

  renderList();
  attemptFlushTaskQueue();
}

// ---------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------
function fmtDayHeader(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return dateStr === TODAY ? `Today — ${label}` : label;
}

function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function fmtShortDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}

function pluralize(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------
// Week strip
// ---------------------------------------------------------------
function buildStripDates(days) {
  const arr = [];
  const start = new Date(TODAY + "T00:00:00");
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    arr.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }
  return arr;
}

function renderWeekStrip() {
  const wrap = $("weekStrip");
  const dates = buildStripDates(14);
  wrap.innerHTML = dates.map((date) => {
    const d = new Date(date + "T00:00:00");
    const name = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    const num = d.getDate();
    const evCount = EVENTS.filter((e) => e.date === date).length;
    const tkCount = TASKS.filter((t) => t.due === date).length;
    const counts = [];
    if (evCount) counts.push(`<span class="wd-count event">${pluralize(evCount, "event")}</span>`);
    if (tkCount) counts.push(`<span class="wd-count task">${pluralize(tkCount, "task")}</span>`);
    if (!counts.length) counts.push(`<span class="wd-count none">&mdash;</span>`);
    return `<div class="week-day${date === TODAY ? " today" : ""}" data-date="${date}">
      <div class="wd-top"><span class="wd-name">${name}</span><span class="wd-num">${num}</span></div>
      <div class="wd-counts">${counts.join("")}</div>
    </div>`;
  }).join("");

  wrap.querySelectorAll(".week-day").forEach((el) => {
    el.addEventListener("click", () => {
      wrap.querySelectorAll(".week-day").forEach((x) => x.classList.remove("selected"));
      el.classList.add("selected");
      const target = document.getElementById("day-" + el.dataset.date);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// ---------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------
function renderChips() {
  const wrap = $("filterChips");
  const options = [["all", "All"], ["event", "Events"], ["task", "Tasks"]];
  wrap.innerHTML = options.map(([val, label]) =>
    `<button class="chip${filter === val ? " selected" : ""}" data-filter="${val}">${label}</button>`
  ).join("");
  wrap.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      filter = chip.dataset.filter;
      renderChips();
      renderList();
    });
  });
}

// ---------------------------------------------------------------
// Agenda rows
// ---------------------------------------------------------------
function eventRow(e) {
  return `<div class="sched-row event">
    <span class="sched-time">${e.allDay ? "All day" : fmtTime(e.time)}</span>
    <span class="sched-title">${e.title}</span>
  </div>`;
}

function taskRow(t, overdue) {
  const dueLabel = overdue
    ? `${daysBetween(t.due, TODAY)}d overdue`
    : (t.due ? fmtShortDate(t.due) : "");
  return `<div class="sched-row task${overdue ? " overdue" : ""}">
    <span class="sched-check${t.done ? " done" : ""}" data-id="${t.id}"></span>
    <span class="sched-title${t.done ? " done" : ""}">${t.title}</span>
    ${dueLabel ? `<span class="sched-due">${dueLabel}</span>` : ""}
  </div>`;
}

// ---------------------------------------------------------------
// Agenda list
// ---------------------------------------------------------------
function renderList() {
  const wrap = $("scheduleList");
  const showEvents = filter === "all" || filter === "event";
  const showTasks = filter === "all" || filter === "task";

  const overdueTasks = showTasks ? TASKS.filter((t) => !t.done && t.due && t.due < TODAY) : [];
  const noDateTasks = showTasks ? TASKS.filter((t) => !t.due) : [];

  const byDate = new Map();
  const addTo = (date, item) => {
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(item);
  };
  if (showEvents) EVENTS.forEach((e) => addTo(e.date, e));
  if (showTasks) TASKS.forEach((t) => { if (t.due && t.due >= TODAY) addTo(t.due, t); });

  const dates = Array.from(byDate.keys()).sort();
  let html = "";

  if (overdueTasks.length) {
    html += `<div class="date-group"><div class="date-group-header overdue">Overdue</div>`;
    overdueTasks.forEach((t) => { html += taskRow(t, true); });
    html += `</div>`;
  }

  dates.forEach((date) => {
    const items = byDate.get(date).sort((a, b) => {
      const ta = a.type === "event" ? (a.time || "00:00") : "99:99";
      const tb = b.type === "event" ? (b.time || "00:00") : "99:99";
      return ta.localeCompare(tb);
    });
    html += `<div class="date-group" id="day-${date}"><div class="date-group-header">${fmtDayHeader(date)}</div>`;
    items.forEach((item) => { html += item.type === "event" ? eventRow(item) : taskRow(item, false); });
    html += `</div>`;
  });

  if (noDateTasks.length) {
    html += `<div class="date-group"><div class="date-group-header">No due date</div>`;
    noDateTasks.forEach((t) => { html += taskRow(t, false); });
    html += `</div>`;
  }

  if (!html) html = `<div class="empty-note">Nothing on the calendar.</div>`;

  wrap.innerHTML = html;
  wrap.querySelectorAll(".sched-check").forEach((el) => {
    el.addEventListener("click", () => toggleTask(el.dataset.id));
  });
}
