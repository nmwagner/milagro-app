// Shared across every page: status dot, toast, service worker registration,
// and the one Apps Script backend URL every page talks to.

const CONFIG = {
  API_URL: "PASTE_APPS_SCRIPT_WEB_APP_URL_HERE",
};

const $ = (id) => document.getElementById(id);

function updateStatus() {
  const dot = $("statusDot");
  const text = $("statusText");
  if (!dot) return;
  if (navigator.onLine) {
    dot.classList.remove("offline");
    text.textContent = "Online";
  } else {
    dot.classList.add("offline");
    text.textContent = "Offline";
  }
}
window.addEventListener("online", updateStatus);
window.addEventListener("offline", updateStatus);
document.addEventListener("DOMContentLoaded", updateStatus);

let toastTimer;
function showToast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
