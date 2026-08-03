// Shared across every page: status dot, toast, service worker registration,
// and the one Apps Script backend URL every page talks to.

const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbxwc6LzEq-nZ6hg3Sv5-Kn71zN_QkvaRBZ3swY8CV9fNO7fjuvbCRYNcO5XB01vlvnNIg/exec",
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
