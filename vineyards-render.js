document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.getElementById("vineyardList");
  document.getElementById("countHint").textContent = `${VINEYARDS.length} on file`;

  VINEYARDS.forEach((v) => {
    const card = document.createElement("div");
    card.className = "vineyard-card";

    const stats = [];
    if (v.vines) stats.push(`<span class="stat"><span class="stat-label">Vines</span>${v.vines.toLocaleString()}</span>`);
    if (v.rootstock) stats.push(`<span class="stat"><span class="stat-label">Rootstock</span>${v.rootstock}</span>`);
    if (v.spacing) stats.push(`<span class="stat"><span class="stat-label">Spacing</span>${v.spacing}</span>`);

    card.innerHTML = `
      <div class="vineyard-card-head">
        <div class="vineyard-name">${v.name}</div>
      </div>
      <div class="vineyard-varieties">${v.varieties}</div>
      ${stats.length ? `<div class="vineyard-stats">${stats.join("")}</div>` : ""}
      ${v.note ? `<div class="vineyard-note">${v.note}</div>` : ""}
      <div class="vineyard-links">
        <a class="vineyard-link" href="${v.url}" target="_blank" rel="noopener">Open full record &rarr;</a>
        ${
          v.lat != null && v.lng != null
            ? `<a class="vineyard-link" href="https://www.google.com/maps?q=${v.lat},${v.lng}" target="_blank" rel="noopener">View on map &rarr;</a>`
            : ""
        }
      </div>
    `;
    wrap.appendChild(card);
  });
});
