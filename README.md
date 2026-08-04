# Milagro Cellar &amp; Vineyard

A mobile PWA hub for cellar and vineyard data, hosted at `nmwagner.github.io/milagro-app/`. No login required.

## What's live

**Operations**
- **Schedule** — a two-week day strip up top (each day shows how many events and tasks land on it; tap a day to jump the list to it), an All/Events/Tasks filter, then an agenda grouped by day with overdue tasks pinned above everything else. Reads Google Calendar and Google Tasks from `vineyardsmilagro@gmail.com`. Checking a task off marks it complete in Google Tasks too — works offline, queues the change locally and syncs once you're back online, same pattern as the Ferm Log's reading queue.

**Cellar Management**
- **Fermentation Log** — pick a variety, then a lot number, and the app builds the lot code itself (Chardonnay + 3 → `CH26-03`). Date and time prefill to now, still editable for backfilling. Temp and Brix are numeric-only. Entered by defaults to Max, Laura, Amy, or type any other name. Writes to `Ferm_Master_Log_2026`, works offline with a local queue that syncs once you're back online.

**Vineyard Management**
- **Vineyards** — a static reference directory, 19 vineyards, varieties, vine counts, rootstock, spacing, a link to each source sheet, and a "View on map" link for the ones with GPS coordinates on file.
- **Vineyard Samples** — Brix trend charts by vineyard and variety, built for picking decisions. Lands on every 2026 sample logged so far, newest date first. Tap into a specific vineyard and variety to see the chart, with the trend line projected 5 days past the last reading. Reads live from `Vineyard_Samples_2026`.
- **Irrigation Log** — placeholder button, not built yet.

## One backend, one deployment

All data-driven pages (Ferm Log, Vineyard Samples, Schedule, and eventually Irrigation Log) talk to the same Apps Script Web App through one shared URL, set once in `common.js`. You don't need a separate deployment per feature.

## Migrating the backend to vineyardsmilagro@gmail.com

Schedule reads Google Calendar and Google Tasks from whichever account the Apps Script project executes as ("Execute as: Me" in the deployment). Calendar can be shared across accounts, but Google Tasks has no sharing mechanism at all — the only way to read (and write completions back to) `vineyardsmilagro@gmail.com`'s tasks is to have the script actually run as that account. If your existing deployment runs as a different account, this is a one-time move, done once you're back at a computer:

1. Share the **2026 Harvest** Drive folder (containing `Ferm_Master_Log_2026` and `Vineyard_Samples_2026`) with `vineyardsmilagro@gmail.com` as an **Editor** — or transfer the folder's ownership outright if that account should own the data going forward.
2. Transfer ownership of the existing Apps Script project to `vineyardsmilagro@gmail.com` too (it's a Drive file — Share → transfer ownership). This keeps the same script and version history rather than starting a second copy.
3. Log into `vineyardsmilagro@gmail.com`, open the project, and enable the **Tasks API** as an Advanced Service: Services (the **+** icon in the left sidebar) → find "Tasks API" → Add. One-time, per-project.
4. Paste in the updated `Code.gs` from this update (it already has the Schedule endpoints).
5. **Deploy → New deployment → Web app.** Execute as **Me** (now = `vineyardsmilagro@gmail.com`), access **Anyone** → copy the new `/exec` URL.
6. Paste that URL into `CONFIG.API_URL` in `common.js`, then push everything — `CACHE_NAME` in `service-worker.js` is already bumped in this update to pick up the change.
7. Re-test Ferm Log and Vineyard Samples once the identity's changed, just to confirm step 1's sharing actually covers everything.

If you'd rather Schedule pull from a separate dedicated calendar instead of that account's main one, swap `CalendarApp.getDefaultCalendar()` for `CalendarApp.getCalendarById('the-other-calendar-id')` in `getScheduleEvents()` in `Code.gs`.

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
  schedule.html
  styles.css
  common.js               (shared utilities + CONFIG.API_URL)
  hub.js
  ferm.js
  vineyards.js
  vineyards-render.js
  vineyard-samples.js
  schedule.js
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
- **Schedule** — confirm the day strip and agenda show real events and tasks from `vineyardsmilagro@gmail.com`. Check a task off, confirm it shows completed in Google Tasks too. Try airplane mode, confirm the checkbox still marks it done locally and syncs once you're back online.
- **Irrigation Log** — confirm the "coming soon" toast.

If you had the app installed to your home screen already, remove and re-add it (or force-refresh once), the service worker cache name changes with each meaningful update specifically so stale files get replaced instead of lingering.

## Notes

- The Ferm Log's lot picker doesn't depend on `Lot_Registry` at all, variety and lot number are fixed local choices, so it works the same online or off.
- Vineyard Samples is read-only, it doesn't write anything, samples still get logged into `Vineyard_Samples_2026` the way you already do it.
- The Vineyards roster (`vineyards.js`) is static reference data, not pulled live. Edit that file directly and push when something changes.
- Schedule reads Calendar and Tasks live from `vineyardsmilagro@gmail.com`; there's no login, so everyone who opens the app sees the same calendar and task lists. Tasks checked off more than a few days ago drop out of the feed automatically so it doesn't slowly fill up with old completions — see `COMPLETED_TASK_LOOKBACK_DAYS` in `Code.gs` if you want that window longer or shorter.
- Irrigation Log is a placeholder. When you're ready to spec it out, it slots into the same hub pattern as everything else.
