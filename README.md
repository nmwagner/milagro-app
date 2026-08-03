# Milagro Cellar &amp; Vineyard

A mobile PWA hub for cellar and vineyard data, hosted at `nmwagner.github.io/milagro-app/`. No login required.

## What's live

**Cellar Management**
- **Fermentation Log** — pick a variety, then a lot number, and the app builds the lot code itself (Chardonnay + 3 → `CH26-03`). Date and time prefill to now, still editable for backfilling. Temp and Brix are numeric-only. Entered by defaults to Max, Laura, Amy, or type any other name. Writes to `Ferm_Master_Log_2026`, works offline with a local queue that syncs once you're back online.

**Vineyard Management**
- **Vineyards** — a static reference directory, 19 vineyards, varieties, vine counts, rootstock, spacing, a link to each source sheet, and a "View on map" link for the ones with GPS coordinates on file.
- **Vineyard Samples** — Brix trend charts by vineyard and variety, built for picking decisions. Lands on every 2026 sample logged so far, newest date first. Tap into a specific vineyard and variety to see the chart, with the trend line projected 5 days past the last reading. Reads live from `Vineyard_Samples_2026`.
- **Irrigation Log** — placeholder button, not built yet.

## One backend, one deployment

All three data-driven pages (Ferm Log, Vineyard Samples, and eventually Irrigation Log) talk to the same Apps Script Web App through one shared URL, set once in `common.js`. You don't need a separate deployment per feature.

## First-time setup

### 1. Create the 2026 ferm log sheet

Drive write access needs an approval step I don't have from here, so this one's manual, about a minute:

1. Open your **2026 Harvest** folder in Drive.
2. New > Google Sheets. Name it `Ferm_Master_Log_2026`.
3. Row 1, these eight headers exactly: `Date`, `Time`, `Lot ID`, `Temp (°F)`, `Brix`, `Notes`, `Entered By`, `Source`.
4. Copy the sheet's ID out of its URL: `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

(`Vineyard_Samples_2026` already exists and its ID is already filled into `Code.gs`, nothing to do there.)

### 2. Deploy the backend

1. [script.google.com](https://script.google.com) → new project.
2. Delete the placeholder code, paste in `Code.gs`.
3. Paste the sheet ID from step 1 into `FERM_LOG_SHEET_ID` at the top.
4. **Deploy > New deployment > Web app.** Execute as **Me**, access **Anyone**.
5. Copy the `/exec` URL.
6. Open `common.js` and paste that URL into `CONFIG.API_URL` at the top.

If you're updating `Code.gs` on a deployment that already exists (adding a new endpoint, for example), you need **Deploy > Manage deployments > pencil icon > New version > Deploy** for the live URL to actually pick up the change, editing the script alone isn't enough.

Sanity check: paste the `/exec` URL into a browser tab, you should see `{"ok":true,"message":"Milagro Ferm Log backend is running."}`.

### 3. Host the frontend

Push everything below to the root of the `milagro-app` repo via GitHub Desktop:

```
milagro-app/
  index.html              (hub)
  ferm-log.html
  vineyards.html
  vineyard-samples.html
  styles.css
  common.js               (shared utilities + CONFIG.API_URL)
  hub.js
  ferm.js
  vineyards.js
  vineyards-render.js
  vineyard-samples.js
  manifest.json
  service-worker.js
  vineyard-bg.jpg
  icons/
```

`Code.gs` never gets pushed here, it only lives in the Apps Script project from step 2.

### 4. Test it

Visit `nmwagner.github.io/milagro-app/`. From the hub:

- **Fermentation Log** — log a real entry, confirm it lands in `Ferm_Master_Log_2026`. Try airplane mode, confirm it queues and syncs on reconnect.
- **Vineyards** — confirm the roster loads and links open the right sheets.
- **Vineyard Samples** — confirm it loads real 2026 samples. If nothing's been sampled yet this season, you'll see an empty state rather than a chart, that's expected.
- **Irrigation Log** — confirm the "coming soon" toast.

If you had the app installed to your home screen already, remove and re-add it (or force-refresh once), the service worker cache name changes with each meaningful update specifically so stale files get replaced instead of lingering.

## Notes

- The Ferm Log's lot picker doesn't depend on `Lot_Registry` at all, variety and lot number are fixed local choices, so it works the same online or off.
- Vineyard Samples is read-only, it doesn't write anything, samples still get logged into `Vineyard_Samples_2026` the way you already do it.
- The Vineyards roster (`vineyards.js`) is static reference data, not pulled live. Edit that file directly and push when something changes.
- Irrigation Log is a placeholder. When you're ready to spec it out, it slots into the same hub pattern as everything else.
