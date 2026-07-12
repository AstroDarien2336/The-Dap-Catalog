/* ═══════════════════════════════════════════════════════════════════
 * DAP Catalog · Feature Patch v2.19
 * ═══════════════════════════════════════════════════════════════════
 *
 * Adds these features without modifying index.html directly:
 *   1. 28-night moon strip at the top of the catalog page
 *   2. Enhanced 14-night per-target moon forecast
 *   3. Aladin Lite interactive FOV viewer
 *   4. Session comparison section (manual PNG upload, gated on TOSM)
 *   5. Constellation context view with real DSS imagery + overlay
 *   6. Surface brightness overlay on optical image
 *   7. WorldWide Telescope interactive sky embed
 *      + external tools row (Stellarium Web, Aladin, SIMBAD, NED)
 *   8. Finder chart in exoplanet transit detail panel
 *   9. Exoplanet transit row enhancements (NEW in v2.7):
 *      - baseline timing recommendation
 *      - NEA disposition badge (PC/APC/CP/KP)
 *      - pulsing IN PROGRESS badge during live transits
 *      - live real-time clock indicator on each glyph (updates every 60s)
 *
 * USAGE in your index.html, near the bottom before </body>:
 *
 *   <link rel="stylesheet"
 *         href="https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.css">
 *   <script src="https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js"
 *           charset="utf-8"></script>
 *   <script src="dap_features_patch.js"></script>
 *
 * The patch runs automatically once the DOM is ready.
 * Session comparison gates on a configurable backend URL — set to
 * the myweb sessions/ folder once TOSM permissions are sorted.
 *
 * ═══════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────
  // CONFIG — adjust these to your environment
  // ─────────────────────────────────────────────────────────────────
  const CONFIG = {
    // Where session preview PNGs live. Once TOSM fixes myweb permissions,
    // change this to: 'https://myweb.ttu.edu/dperla/DAP_Catalog/sessions/'
    sessionsBaseUrl: 'https://myweb.ttu.edu/dperla/DAP_Catalog/sessions/',
    sessionsEnabled: false,  // flip to true once myweb supports writes

    // Your rig spec — Lacerta 250/1000 + QHY 268M APS-C
    // Verified: 1.34° × 0.90° = 80.4′ × 54.0′
    rigFovWidthArcmin: 80.4,
    rigFovHeightArcmin: 54.0,
    rigLabel: 'Lacerta 250/1000 + QHY 268M',

    // Observer location (matches your existing OBSERVER_* constants)
    observerLat: 33.5779,
    observerLon: -101.8552,
    observerLabel: 'Lubbock, TX'
  };

  // ─────────────────────────────────────────────────────────────────
  // STYLES — injected once
  // ─────────────────────────────────────────────────────────────────
  const STYLES = `
  /* Top-of-page moon calendar */
  .dap-moon-strip {
    background: var(--bg-panel, #0c0c10);
    border: 0.5px solid var(--border-gold, rgba(212,170,80,0.12));
    border-radius: 4px; padding: 12px 16px; margin: 12px 0 20px 0;
    font-family: var(--mono, 'Space Mono', monospace);
  }
  .dap-ms-head {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 10px; padding-bottom: 8px;
    border-bottom: 0.5px dashed var(--border-gold, rgba(212,170,80,0.12));
    flex-wrap: wrap; gap: 8px;
  }
  .dap-ms-title {
    font-size: 10px; color: #a89060;
    text-transform: uppercase; letter-spacing: 0.18em;
  }
  .dap-ms-now { font-size: 10px; color: #a89060; }
  .dap-ms-now .acc { color: #d4aa50; }
  .dap-ms-now .new { color: #7ec87a; }

  /* View toggle: 28-night strip vs month calendar */
  .dap-ms-viewtabs {
    display: flex; gap: 4px; margin-bottom: 10px;
    background: #111116; border-radius: 3px; padding: 2px;
    width: fit-content;
  }
  .dap-ms-viewtab {
    font-size: 9px; padding: 4px 12px; border-radius: 2px;
    text-transform: uppercase; letter-spacing: 0.1em;
    border: 0.5px solid transparent; background: transparent;
    color: #5a4a28; cursor: pointer;
  }
  .dap-ms-viewtab:hover { color: #f5ecd4; }
  .dap-ms-viewtab.active {
    background: rgba(212,170,80,0.1); color: #d4aa50;
    border-color: rgba(212,170,80,0.25);
  }

  /* Strip view (28-night flat row) */
  .dap-ms-grid-strip { display: grid; grid-template-columns: repeat(28, 1fr); gap: 3px; }

  /* Month view (calendar grid) */
  .dap-ms-month-nav {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 10px; padding: 6px 10px;
    background: #111116; border-radius: 3px;
  }
  .dap-ms-nav-btn {
    font-size: 12px; padding: 2px 10px; border-radius: 2px;
    background: transparent; border: 0.5px solid rgba(212,170,80,0.25);
    color: #d4aa50; cursor: pointer;
    font-family: var(--mono, 'Space Mono', monospace);
  }
  .dap-ms-nav-btn:hover { background: rgba(212,170,80,0.06); }
  .dap-ms-month-title {
    font-size: 13px; color: #d4aa50; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
  }
  .dap-ms-dow-row {
    display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;
    margin-bottom: 4px;
  }
  .dap-ms-dow-label {
    text-align: center; font-size: 8px;
    color: #5a4a28; text-transform: uppercase; letter-spacing: 0.12em;
    padding: 4px 0;
  }
  .dap-ms-grid-month {
    display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;
  }
  .dap-ms-grid-month .dap-ms-day {
    aspect-ratio: 1; padding: 6px 4px;
  }
  .dap-ms-grid-month .dap-ms-day.empty {
    background: transparent; cursor: default;
  }
  .dap-ms-grid-month .dap-ms-day-num { font-size: 11px; }
  .dap-ms-grid-month .dap-ms-day-dow { display: none; }
  .dap-ms-grid-month .dap-ms-moon { width: 18px; height: 18px; margin-top: 6px; }

  /* Common day cell styling */
  .dap-ms-day {
    display: flex; flex-direction: column; align-items: center;
    padding: 4px 2px; border-radius: 2px; cursor: pointer; position: relative;
    transition: background 150ms;
  }
  .dap-ms-day:hover:not(.empty) { background: rgba(212,170,80,0.05); }
  .dap-ms-day.today {
    background: rgba(212,170,80,0.06);
    border: 0.5px solid rgba(212,170,80,0.25);
  }
  .dap-ms-day.today::after {
    content: ""; position: absolute; bottom: -2px; left: 50%;
    transform: translateX(-50%);
    width: 3px; height: 3px; background: #7ec87a; border-radius: 50%;
  }
  .dap-ms-day.new-window { border-left: 1px solid #d4aa50; }
  .dap-ms-day.full { background: rgba(168,144,96,0.06); }
  .dap-ms-day-num { font-size: 9px; color: #f5ecd4; }
  .dap-ms-day.today .dap-ms-day-num { color: #d4aa50; }
  .dap-ms-day-dow {
    font-size: 7px; color: #5a4a28; text-transform: uppercase;
    letter-spacing: 0.06em; margin-top: 1px;
  }
  .dap-ms-moon {
    width: 14px; height: 14px; border-radius: 50%;
    background: #111116; border: 0.5px solid #5a4a28;
    margin-top: 4px; overflow: hidden; position: relative;
  }
  .dap-ms-moon svg { width: 100%; height: 100%; display: block; }
  .dap-ms-legend {
    display: flex; gap: 14px; margin-top: 8px;
    font-size: 8px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.08em;
    padding-top: 8px;
    border-top: 0.5px dashed var(--border-gold, rgba(212,170,80,0.12));
    flex-wrap: wrap;
  }

  /* Per-target moon forecast (14 nights, in detail panel) */
  .dap-pt-moon {
    background: rgba(12,12,16,0.5);
    border: 0.5px solid rgba(212,170,80,0.12);
    border-radius: 4px; padding: 12px 14px;
  }
  .dap-pt-rec {
    background: rgba(212,170,80,0.08);
    border: 0.5px solid rgba(212,170,80,0.25);
    border-radius: 3px; padding: 8px 12px; margin-bottom: 12px;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 11px; color: #d4aa50;
    display: flex; align-items: center; gap: 10px;
  }
  .dap-pt-rec .icon {
    width: 16px; height: 16px; display: flex; align-items: center;
    justify-content: center; background: #d4aa50; color: #07070a;
    border-radius: 50%; font-weight: 700; font-size: 11px; flex-shrink: 0;
  }
  .dap-pt-rec strong { color: #f0cc78; }
  .dap-pt-grid { display: grid; grid-template-columns: repeat(14, 1fr); gap: 4px; }
  .dap-pt-day {
    display: flex; flex-direction: column; align-items: center;
    padding: 6px 2px; background: #111116; border-radius: 3px;
    border: 0.5px solid transparent; position: relative;
    font-family: var(--mono, 'Space Mono', monospace);
  }
  .dap-pt-day.best {
    border-color: #d4aa50; background: rgba(212,170,80,0.08);
  }
  .dap-pt-day.target-down { opacity: 0.45; }
  .dap-pt-day.today::before {
    content: ""; position: absolute; top: -3px; left: 50%;
    transform: translateX(-50%);
    width: 4px; height: 4px; background: #7ec87a; border-radius: 50%;
  }
  .dap-pt-day-num { font-size: 10px; color: #f5ecd4; }
  .dap-pt-day.best .dap-pt-day-num { color: #d4aa50; }
  .dap-pt-day-dow {
    font-size: 7px; color: #5a4a28; text-transform: uppercase;
    letter-spacing: 0.1em; margin-top: 1px; margin-bottom: 6px;
  }
  .dap-pt-moon-ic {
    width: 18px; height: 18px; border-radius: 50%;
    background: #0c0c10; border: 0.5px solid #5a4a28;
    margin-bottom: 6px; overflow: hidden;
  }
  .dap-pt-moon-ic svg { width: 100%; height: 100%; display: block; }
  .dap-pt-alt {
    width: 14px; height: 24px; background: #0c0c10;
    border: 0.5px solid rgba(212,170,80,0.12);
    position: relative; border-radius: 1px;
  }
  .dap-pt-alt .fill { position: absolute; bottom: 0; left: 0; right: 0; }
  .dap-pt-alt .fill.high { background: #7ec87a; }
  .dap-pt-alt .fill.mid  { background: #d4aa50; }
  .dap-pt-alt .fill.low  { background: #c86060; }

  /* Aladin FOV viewer */
  .dap-fov-card {
    background: rgba(12,12,16,0.5);
    border: 0.5px solid rgba(212,170,80,0.12);
    border-radius: 4px; padding: 14px 16px;
  }
  .dap-fov-head {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 12px; flex-wrap: wrap; gap: 10px;
  }
  .dap-fov-title {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 11px; color: #d4aa50;
  }
  .dap-fov-rig {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .dap-fov-rig .acc { color: #a89060; }
  .dap-fov-ctrls {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 12px; gap: 12px; flex-wrap: wrap;
  }
  .dap-fov-grp {
    display: flex; gap: 4px; background: #111116;
    border-radius: 3px; padding: 2px;
  }
  .dap-fov-btn {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; padding: 4px 10px; border-radius: 2px;
    text-transform: uppercase; letter-spacing: 0.08em;
    border: 0.5px solid transparent; background: transparent;
    color: #5a4a28; cursor: pointer;
  }
  .dap-fov-btn:hover { color: #f5ecd4; }
  .dap-fov-btn.active {
    background: rgba(212,170,80,0.1); color: #d4aa50;
    border-color: rgba(212,170,80,0.25);
  }
  .dap-fov-slider {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .dap-fov-slider input {
    appearance: none; -webkit-appearance: none;
    width: 100px; height: 3px; background: #111116;
    border-radius: 2px; outline: none;
  }
  .dap-fov-slider input::-webkit-slider-thumb {
    appearance: none; -webkit-appearance: none;
    width: 12px; height: 12px; border-radius: 50%;
    background: #d4aa50; cursor: pointer; border: 0.5px solid #f0cc78;
  }
  .dap-fov-slider input::-moz-range-thumb {
    width: 12px; height: 12px; border-radius: 50%;
    background: #d4aa50; cursor: pointer; border: 0.5px solid #f0cc78;
  }
  .dap-fov-viewer {
    position: relative; border-radius: 3px;
    border: 0.5px solid rgba(212,170,80,0.12); overflow: hidden;
  }
  .dap-fov-aladin {
    width: 100%; aspect-ratio: 16/11; background: #000;
  }
  .dap-fov-overlay {
    position: absolute; top: 50%; left: 50%;
    pointer-events: none; transform-origin: center;
  }
  .dap-fov-overlay-box {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    border: 1.5px solid #d4aa50;
    background: rgba(212,170,80,0.04);
  }
  .dap-fov-overlay-box .c {
    position: absolute; width: 10px; height: 10px;
    border: 1.5px solid #d4aa50;
  }
  .dap-fov-overlay-box .c.tl { top: -1px; left: -1px; border-right: none; border-bottom: none; }
  .dap-fov-overlay-box .c.tr { top: -1px; right: -1px; border-left: none; border-bottom: none; }
  .dap-fov-overlay-box .c.bl { bottom: -1px; left: -1px; border-right: none; border-top: none; }
  .dap-fov-overlay-box .c.br { bottom: -1px; right: -1px; border-left: none; border-top: none; }
  .dap-fov-label {
    position: absolute; top: 8px; left: 10px;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; color: #d4aa50;
    background: rgba(0,0,0,0.7); padding: 3px 8px; border-radius: 2px;
    text-transform: uppercase; letter-spacing: 0.1em;
    z-index: 100; pointer-events: none;
  }

  /* Session comparison */
  .dap-sc-card {
    background: rgba(12,12,16,0.5);
    border: 0.5px solid rgba(212,170,80,0.12);
    border-radius: 4px; padding: 16px;
  }
  .dap-sc-modes {
    display: flex; gap: 4px; margin-bottom: 14px;
    background: #111116; border-radius: 3px; padding: 2px;
    width: fit-content;
  }
  .dap-sc-mode {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 10px; padding: 6px 14px; border-radius: 2px;
    text-transform: uppercase; letter-spacing: 0.1em;
    border: 0.5px solid transparent; background: transparent;
    color: #5a4a28; cursor: pointer;
  }
  .dap-sc-mode:hover { color: #f5ecd4; }
  .dap-sc-mode.active {
    background: rgba(212,170,80,0.1); color: #d4aa50;
    border-color: rgba(212,170,80,0.25);
  }
  .dap-sc-empty {
    padding: 30px 20px; text-align: center;
    border: 1px dashed rgba(212,170,80,0.25); border-radius: 4px;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 11px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.12em;
  }
  .dap-sc-empty .gold { color: #d4aa50; }
  .dap-sc-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
  .dap-sc-frame {
    background: #000;
    border: 0.5px solid rgba(212,170,80,0.12); border-radius: 3px;
    position: relative; aspect-ratio: 4/3; overflow: hidden;
  }
  .dap-sc-frame img {
    display: block; width: 100%; height: 100%; object-fit: cover;
  }
  .dap-sc-stamp {
    position: absolute; top: 6px; left: 8px;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; color: #d4aa50;
    background: rgba(0,0,0,0.7); padding: 2px 7px; border-radius: 2px;
    text-transform: uppercase; letter-spacing: 0.1em;
    pointer-events: none;
  }
  .dap-sc-pickers {
    display: flex; gap: 12px; align-items: center; margin-bottom: 14px;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.1em;
    flex-wrap: wrap;
  }
  .dap-sc-pickers select {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 10px; padding: 5px 10px; border-radius: 2px;
    background: #111116; border: 0.5px solid rgba(212,170,80,0.25);
    color: #f5ecd4; cursor: pointer;
  }
  .dap-sc-drop {
    margin-top: 14px; padding: 14px;
    border: 1px dashed rgba(212,170,80,0.25); border-radius: 4px;
    text-align: center;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 10px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.1em;
    cursor: pointer; transition: all 150ms;
  }
  .dap-sc-drop:hover {
    border-color: #d4aa50; color: #d4aa50;
    background: rgba(212,170,80,0.03);
  }
  .dap-sc-drop .gold { color: #d4aa50; }

  /* ─── Constellation Context ─── */
  .dap-const-card {
    background: rgba(12,12,16,0.5);
    border: 0.5px solid rgba(212,170,80,0.12);
    border-radius: 4px; padding: 14px 16px;
  }
  .dap-const-head {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 12px; flex-wrap: wrap; gap: 10px;
  }
  .dap-const-name {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 13px; color: #d4aa50;
  }
  .dap-const-name .latin { color: #5a4a28; font-size: 10px; margin-left: 6px; }
  .dap-const-info {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .dap-const-viewer {
    position: relative; background: #000;
    border: 0.5px solid rgba(212,170,80,0.12); border-radius: 3px;
    aspect-ratio: 16/10; overflow: hidden;
  }
  .dap-const-aladin {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
  }
  .dap-const-overlay {
    position: absolute; inset: 0;
    width: 100%; height: 100%; display: block;
    pointer-events: none;
    z-index: 5;
  }
  .dap-const-legend {
    display: flex; gap: 14px; margin-top: 10px;
    padding-top: 10px;
    border-top: 0.5px dashed rgba(212,170,80,0.12);
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.08em;
    flex-wrap: wrap;
  }
  .dap-const-legend .item { display: flex; align-items: center; gap: 5px; }
  .dap-const-legend .sw {
    width: 8px; height: 8px; display: inline-block; border-radius: 50%;
  }
  .dap-const-legend .sw.target { background: #d4aa50; }
  .dap-const-legend .sw.star-bright { background: #fff; }
  .dap-const-legend .sw.star-dim { background: #888; }
  .dap-const-legend .sw.galaxy { background: #6fa6c8; border-radius: 2px; }
  .dap-const-neighbors {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 0.5px dashed rgba(212,170,80,0.12);
  }
  .dap-const-neighbors-title {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.12em;
    margin-bottom: 10px;
  }
  .dap-const-neighbors-list {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
  }
  .dap-const-neighbor {
    display: grid; grid-template-columns: auto 1fr auto;
    gap: 10px; align-items: baseline;
    padding: 6px 10px;
    background: #111116; border-radius: 2px;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 10px;
  }
  .dap-const-neighbor .icon { color: #d4aa50; font-size: 8px; }
  .dap-const-neighbor .name { color: #f5ecd4; font-size: 10px; }
  .dap-const-neighbor .name .common { color: #5a4a28; font-size: 9px; }
  .dap-const-neighbor .dist { color: #d4aa50; font-size: 9px; }
  .dap-const-empty {
    padding: 16px; text-align: center;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 10px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.1em;
  }

  /* ─── Surface Brightness Overlay ─── */
  .dap-sb-card {
    background: rgba(12,12,16,0.5);
    border: 0.5px solid rgba(212,170,80,0.12);
    border-radius: 4px; padding: 14px 16px;
  }
  .dap-sb-controls {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 12px; gap: 12px; flex-wrap: wrap;
  }
  .dap-sb-slider {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--mono, 'Space Mono', monospace); font-size: 9px;
    color: #5a4a28; text-transform: uppercase; letter-spacing: 0.1em;
  }
  .dap-sb-slider input {
    appearance: none; -webkit-appearance: none;
    width: 100px; height: 3px; background: #111116;
    border-radius: 2px; outline: none;
  }
  .dap-sb-slider input::-webkit-slider-thumb {
    appearance: none; -webkit-appearance: none;
    width: 12px; height: 12px; border-radius: 50%;
    background: #d4aa50; cursor: pointer;
  }
  .dap-sb-slider input::-moz-range-thumb {
    width: 12px; height: 12px; border-radius: 50%;
    background: #d4aa50; cursor: pointer; border: none;
  }
  .dap-sb-viewer {
    position: relative; background: #000;
    border: 0.5px solid rgba(212,170,80,0.12); border-radius: 3px;
    aspect-ratio: 16/11; overflow: hidden;
  }
  .dap-sb-viewer svg.contours,
  .dap-sb-viewer img {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    display: block;
  }
  .dap-sb-viewer img { object-fit: cover; }
  .dap-sb-viewer svg.contours { pointer-events: none; }
  .dap-sb-img-label {
    position: absolute; top: 6px; left: 8px;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; color: #d4aa50;
    background: rgba(0,0,0,0.7); padding: 2px 7px; border-radius: 2px;
    text-transform: uppercase; letter-spacing: 0.1em;
    pointer-events: none; z-index: 5;
  }
  .dap-sb-key {
    display: flex; gap: 0; margin-top: 12px;
    padding-top: 10px; border-top: 0.5px dashed rgba(212,170,80,0.12);
    align-items: stretch;
  }
  .dap-sb-key-cell {
    flex: 1; padding: 8px 10px;
    border-left: 2px solid transparent;
    font-family: var(--mono, 'Space Mono', monospace); font-size: 9px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .dap-sb-key-cell .lab {
    color: #5a4a28; font-size: 8px;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .dap-sb-key-cell .val { color: #f5ecd4; }
  .dap-sb-key-cell .time { color: #d4aa50; font-size: 9px; margin-top: 2px; }
  .dap-sb-key-cell.lev1 { border-left-color: #fff8e0; }
  .dap-sb-key-cell.lev2 { border-left-color: #ffcb70; }
  .dap-sb-key-cell.lev3 { border-left-color: #ff8a40; }
  .dap-sb-key-cell.lev4 { border-left-color: #c86060; }
  .dap-sb-key-cell.lev5 { border-left-color: #9070c8; }
  .dap-sb-key-cell.lev6 { border-left-color: #3050a0; }
  .dap-sb-callout {
    background: rgba(212,170,80,0.06);
    border-left: 2px solid #d4aa50;
    border-radius: 3px;
    padding: 10px 12px;
    margin-top: 14px;
    font-family: var(--mono, 'Space Mono', monospace); font-size: 10px;
    color: #f5ecd4; line-height: 1.55;
  }
  .dap-sb-callout .gold { color: #d4aa50; }
  .dap-sb-callout strong { color: #f0cc78; }

  /* ─── μ explainer tooltip ─── */
  .dap-mu-info {
    display: inline-block; margin-left: 6px;
    width: 14px; height: 14px;
    border-radius: 50%; border: 0.5px solid rgba(212,170,80,0.4);
    color: #d4aa50; font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; line-height: 13px; text-align: center;
    cursor: help; vertical-align: middle;
    position: relative;
    font-style: italic;
  }
  .dap-mu-info:hover .dap-mu-tooltip {
    opacity: 1; visibility: visible;
  }
  .dap-mu-tooltip {
    position: absolute;
    bottom: calc(100% + 8px); left: 50%;
    transform: translateX(-50%);
    background: #17171e; color: #f5ecd4;
    border: 0.5px solid rgba(212,170,80,0.4);
    border-radius: 3px; padding: 10px 12px;
    width: 320px; max-width: 320px;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 10px; font-style: normal;
    line-height: 1.5; text-align: left;
    opacity: 0; visibility: hidden;
    transition: opacity 150ms;
    pointer-events: none;
    z-index: 100;
    box-shadow: 0 2px 12px rgba(0,0,0,0.5);
    text-transform: none; letter-spacing: 0;
  }
  .dap-mu-tooltip strong { color: #d4aa50; }
  .dap-mu-tooltip::after {
    content: ""; position: absolute;
    top: 100%; left: 50%; transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: #17171e;
  }

  /* ─── WorldWide Telescope embed + External tools ─── */
  .dap-wwt-card {
    background: rgba(12,12,16,0.5);
    border: 0.5px solid rgba(212,170,80,0.12);
    border-radius: 4px; padding: 14px 16px;
  }
  .dap-wwt-head {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 12px; gap: 12px; flex-wrap: wrap;
  }
  .dap-wwt-title {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 11px; color: #a89060;
    flex: 1; min-width: 200px;
  }
  .dap-wwt-newtab {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; color: #d4aa50;
    text-transform: uppercase; letter-spacing: 0.08em;
    padding: 4px 10px; border-radius: 2px;
    border: 0.5px solid rgba(212,170,80,0.25);
    text-decoration: none;
  }
  .dap-wwt-newtab:hover {
    background: rgba(212,170,80,0.06);
    color: #f0cc78;
  }
  .dap-wwt-viewer {
    position: relative;
    background: #000;
    border: 0.5px solid rgba(212,170,80,0.12);
    border-radius: 3px;
    aspect-ratio: 16/10;
    overflow: hidden;
  }
  .dap-wwt-iframe {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    border: none;
    z-index: 1;
  }
  .dap-wwt-loading {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 12px;
    background: #0c0c10;
    z-index: 2;
  }
  .dap-wwt-spinner {
    width: 24px; height: 24px;
    border: 2px solid rgba(212,170,80,0.2);
    border-top-color: #d4aa50;
    border-radius: 50%;
    animation: dap-wwt-spin 1s linear infinite;
  }
  @keyframes dap-wwt-spin {
    to { transform: rotate(360deg); }
  }
  .dap-wwt-loading-text {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 10px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .dap-wwt-note {
    margin-top: 10px;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; color: #5a4a28;
    line-height: 1.6;
  }
  .dap-wwt-note .gold { color: #d4aa50; }

  .dap-ext-divider {
    margin-top: 16px; padding-top: 12px;
    border-top: 0.5px dashed rgba(212,170,80,0.18);
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.14em;
    margin-bottom: 10px;
  }

  /* ─── External sky tools ─── */
  .dap-ext-card {
    background: rgba(12,12,16,0.5);
    border: 0.5px solid rgba(212,170,80,0.12);
    border-radius: 4px; padding: 14px 16px;
  }
  .dap-ext-intro {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 10px; color: #5a4a28;
    margin-bottom: 12px; padding-bottom: 10px;
    border-bottom: 0.5px dashed rgba(212,170,80,0.12);
  }
  .dap-ext-intro .gold { color: #d4aa50; }
  .dap-ext-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .dap-ext-tool {
    display: block; padding: 12px 14px;
    background: #111116; border-radius: 3px;
    border: 0.5px solid rgba(212,170,80,0.12);
    border-left: 2px solid rgba(212,170,80,0.4);
    text-decoration: none;
    transition: all 120ms;
  }
  .dap-ext-tool:hover {
    background: #17171e;
    border-color: rgba(212,170,80,0.25);
    border-left-color: #d4aa50;
    transform: translateY(-1px);
  }
  .dap-ext-name {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 12px; color: #d4aa50;
    margin-bottom: 6px;
    letter-spacing: 0.04em;
  }
  .dap-ext-tool:hover .dap-ext-name { color: #f0cc78; }
  .dap-ext-desc {
    font-family: var(--display, 'Times New Roman', serif);
    font-size: 12px; color: #a89060;
    line-height: 1.45;
    margin-bottom: 8px;
  }
  .dap-ext-host {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 8px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  @media (max-width: 600px) {
    .dap-ext-grid { grid-template-columns: 1fr; }
  }

  /* ─── Exoplanet detail · finder chart ─── */
  .dap-exo-finder-card {
    background: rgba(12,12,16,0.5);
    border: 0.5px solid rgba(212,170,80,0.12);
    border-radius: 4px; padding: 14px 16px;
  }
  .dap-exo-finder-meta {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 10px; color: #5a4a28;
    margin-bottom: 12px; padding-bottom: 10px;
    border-bottom: 0.5px dashed rgba(212,170,80,0.12);
    line-height: 1.55;
  }
  .dap-exo-finder-host { color: #d4aa50; }
  .dap-exo-finder-viewer {
    position: relative;
    background: #000;
    border: 0.5px solid rgba(212,170,80,0.18);
    border-radius: 3px;
    aspect-ratio: 4/3;
    overflow: hidden;
    min-height: 360px;
  }
  .dap-exo-finder-aladin {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
  }
  .dap-exo-finder-fov-overlay {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    border: 1.5px solid #d4aa50;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.5);
    pointer-events: none;
    z-index: 5;
    background: rgba(212,170,80,0.04);
  }
  .dap-exo-finder-loading {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 12px;
    background: #0c0c10;
    z-index: 10;
  }
  .dap-exo-finder-spinner {
    width: 24px; height: 24px;
    border: 2px solid rgba(212,170,80,0.2);
    border-top-color: #d4aa50;
    border-radius: 50%;
    animation: dap-exo-finder-spin 1s linear infinite;
  }
  @keyframes dap-exo-finder-spin { to { transform: rotate(360deg); } }
  .dap-exo-finder-loading-text {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 10px; color: #5a4a28;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .dap-exo-finder-hint {
    margin-top: 10px;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px; color: #5a4a28;
    line-height: 1.5;
  }
  .dap-exo-finder-hint .gold { color: #d4aa50; }

  /* ─── Exo transit row · #8 baseline timing ─── */
  .dap-exo-baseline {
    background: rgba(126,200,122,0.04);
    border-left: 2px solid #7ec87a;
    padding: 5px 9px;
    margin-top: 5px;
    font-family: var(--mono, 'Space Mono', monospace);
    border-radius: 0 2px 2px 0;
  }
  .dap-exo-baseline-label {
    color: #7ec87a; font-size: 8px;
    text-transform: uppercase; letter-spacing: 0.08em;
    font-weight: 700;
  }
  .dap-exo-baseline-times {
    color: #f5ecd4; font-size: 10px;
    margin-top: 2px; letter-spacing: 0.02em;
  }
  .dap-exo-baseline-dur {
    color: #5a4a28; font-size: 9px; margin-top: 1px;
  }

  /* ─── Exo transit row · #10 disposition badge ─── */
  .dap-exo-disp-badge {
    font-size: 8px;
    padding: 1px 5px;
    border-radius: 2px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-left: 4px;
    font-family: var(--mono, 'Space Mono', monospace);
    white-space: nowrap;
  }
  .dap-exo-disp-pc {
    background: rgba(160,100,255,0.12);
    color: #a064ff;
    border: 0.5px solid rgba(160,100,255,0.3);
  }
  .dap-exo-disp-apc {
    background: rgba(200,170,80,0.12);
    color: #c8aa50;
    border: 0.5px solid rgba(200,170,80,0.3);
  }
  .dap-exo-disp-cp {
    background: rgba(126,200,122,0.12);
    color: #7ec87a;
    border: 0.5px solid rgba(126,200,122,0.3);
  }
  .dap-exo-disp-kp {
    background: rgba(111,166,200,0.12);
    color: #6fa6c8;
    border: 0.5px solid rgba(111,166,200,0.3);
  }
  .dap-exo-disp-fa {
    background: rgba(200,96,96,0.12);
    color: #c86060;
    border: 0.5px solid rgba(200,96,96,0.3);
  }

  /* ─── Exo transit row · #3 phase-aware in-progress badge ─── */
  .dap-exo-inprogress {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 2px 7px;
    border-radius: 2px;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    border: 0.5px solid;
  }
  /* Ingressing: green — transit just started, planet entering disk */
  .dap-exo-inprogress-ingressing {
    background: rgba(126,200,122,0.12);
    border-color: #7ec87a;
    color: #7ec87a;
  }
  .dap-exo-inprogress-ingressing .dap-exo-inprogress-dot { background: #7ec87a; }
  /* Mid-transit: gold — peak phase, planet fully on disk */
  .dap-exo-inprogress-midtransit {
    background: rgba(212,170,80,0.14);
    border-color: #d4aa50;
    color: #d4aa50;
  }
  .dap-exo-inprogress-midtransit .dap-exo-inprogress-dot { background: #d4aa50; }
  /* Egressing: soft orange — winding down, planet exiting disk */
  .dap-exo-inprogress-egressing {
    background: rgba(200,138,80,0.14);
    border-color: #c88a50;
    color: #c88a50;
  }
  .dap-exo-inprogress-egressing .dap-exo-inprogress-dot { background: #c88a50; }
  .dap-exo-inprogress-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    position: relative;
  }
  /* Radar ping: an expanding ring radiates outward from the dot. Color
     inherits from the badge phase via currentColor, so ingressing pings
     green, mid-transit pings gold, egressing pings orange. */
  .dap-exo-inprogress-dot::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    border-radius: 50%;
    border: 1px solid currentColor;
    animation: dap-exo-radar-ping 1.8s ease-out infinite;
    pointer-events: none;
  }
  @keyframes dap-exo-radar-ping {
    0%   { transform: scale(1);   opacity: 0.8; }
    100% { transform: scale(3.5); opacity: 0; }
  }

  /* ─── Exo transit row · #1 live clock indicator ─── */
  .dap-exo-now-line {
    position: absolute;
    top: 0; bottom: 0;
    width: 2px;
    background: #d4aa50;
    box-shadow: 0 0 6px #d4aa50;
    pointer-events: none;
    z-index: 5;
    animation: dap-exo-clock-pulse 2.4s ease-in-out infinite;
  }
  @keyframes dap-exo-clock-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* ─── Exo Sky Chart ─── */
  .dap-exo-skychart {
    background: rgba(12,12,16,0.6);
    border: 0.5px solid rgba(212,170,80,0.18);
    border-radius: 4px;
    margin: 12px 0;
    overflow: hidden;
  }
  .dap-exo-skychart-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 10px 14px;
    cursor: pointer;
    user-select: none;
    background: rgba(212,170,80,0.04);
    border-bottom: 0.5px solid rgba(212,170,80,0.12);
    transition: background 0.15s;
  }
  .dap-exo-skychart-header:hover { background: rgba(212,170,80,0.08); }
  .dap-exo-skychart[data-collapsed="1"] .dap-exo-skychart-header { border-bottom: none; }
  .dap-exo-skychart-caret {
    font-family: var(--mono, 'Space Mono', monospace);
    color: #d4aa50; font-size: 11px;
    width: 10px;
  }
  .dap-exo-skychart-title {
    font-family: var(--mono, 'Space Mono', monospace);
    color: #d4aa50;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 700;
  }
  .dap-exo-skychart-meta {
    font-family: var(--mono, 'Space Mono', monospace);
    color: #5a4a28;
    font-size: 10px;
    margin-left: auto;
  }
  .dap-exo-skychart-meta .gold { color: #d4aa50; }
  .dap-exo-skychart-body {
    padding: 18px 20px 16px 20px;
    display: grid;
    grid-template-columns: 1fr 220px;
    gap: 20px;
    align-items: start;
  }
  @media (max-width: 800px) {
    .dap-exo-skychart-body {
      grid-template-columns: 1fr;
    }
  }
  .dap-exo-skychart-chart {
    background: #000;
    border: 0.5px solid rgba(212,170,80,0.12);
    border-radius: 4px;
    overflow: hidden;
    aspect-ratio: 1;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
  }
  .dap-exo-skychart-svg {
    width: 100%; height: 100%; display: block;
  }
  .dap-exo-skychart-legend {
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 10px;
    color: #a89060;
  }
  .dap-exo-skychart-legend-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    line-height: 1.6;
  }
  .dap-exo-skychart-swatch {
    display: inline-block;
    width: 16px; height: 3px;
    margin-right: 4px;
    border-radius: 1px;
  }
  .dap-exo-skychart-swatch.dashed {
    background: transparent !important;
    height: 0; border-top: 2px dashed #a89060;
  }
  .dap-exo-skychart-dot {
    display: inline-block;
    width: 8px; height: 8px;
    border-radius: 50%;
    vertical-align: middle;
    margin-right: 4px;
  }
  .dap-exo-skychart-hint {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 0.5px dashed rgba(212,170,80,0.12);
    color: #5a4a28;
    font-size: 9px;
    line-height: 1.5;
  }
  .dap-exo-skychart-arc {
    cursor: pointer;
    transition: filter 0.15s;
  }
  .dap-exo-skychart-arc:hover {
    filter: brightness(1.4) drop-shadow(0 0 6px currentColor);
  }
  .dap-exo-skychart-arc:hover .dap-exo-skychart-path {
    stroke-width: 3.5;
  }
  /* Now-markers: live position dots updated every minute. Cyan to stand out
     against the gold/purple arcs. Outer ring fades in/out subtly to draw
     the eye. Animating opacity (not the SVG r attribute) for iOS Safari
     compatibility — Safari's support for animating SVG attributes via CSS
     keyframes is patchy across iOS versions. */
  .dap-exo-skychart-now-marker circle:first-child {
    animation: dap-exo-skychart-now-pulse 2.6s ease-in-out infinite;
  }
  @keyframes dap-exo-skychart-now-pulse {
    0%, 100% { opacity: 0.8; }
    50%      { opacity: 0.25; }
  }
  /* Legend swatch styling for the now-marker */
  .dap-exo-skychart-now-swatch {
    display: inline-block;
    width: 12px; height: 12px;
    border: 1.5px solid #6fc8e0;
    border-radius: 50%;
    position: relative;
    vertical-align: middle;
    margin-right: 4px;
  }
  .dap-exo-skychart-now-swatch::after {
    content: '';
    position: absolute;
    inset: 3px;
    background: #6fc8e0;
    border-radius: 50%;
  }

  /* Chart wrapper holds the chart + the controls bar */
  .dap-exo-skychart-chart-wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dap-exo-skychart-chart {
    user-select: none;
    touch-action: none;
  }
  .dap-exo-skychart-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    background: rgba(212,170,80,0.04);
    border: 0.5px solid rgba(212,170,80,0.12);
    border-radius: 3px;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 10px;
  }
  .dap-exo-skychart-zoom-label {
    color: #a89060;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 9px;
    white-space: nowrap;
  }
  .dap-exo-skychart-zoom-label span {
    color: #d4aa50;
    font-weight: 700;
    display: inline-block;
    min-width: 32px;
    text-align: right;
  }
  .dap-exo-skychart-zoom-slider {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: rgba(212,170,80,0.15);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }
  .dap-exo-skychart-zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: #d4aa50;
    cursor: grab;
    border: 2px solid #07070a;
    box-shadow: 0 0 0 1px rgba(212,170,80,0.4);
  }
  .dap-exo-skychart-zoom-slider::-webkit-slider-thumb:active {
    cursor: grabbing;
    background: #f0cc78;
  }
  .dap-exo-skychart-zoom-slider::-moz-range-thumb {
    width: 14px; height: 14px;
    border-radius: 50%;
    background: #d4aa50;
    cursor: grab;
    border: 2px solid #07070a;
    box-shadow: 0 0 0 1px rgba(212,170,80,0.4);
  }
  .dap-exo-skychart-reset {
    background: transparent;
    border: 0.5px solid rgba(212,170,80,0.3);
    color: #a89060;
    font-family: var(--mono, 'Space Mono', monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 4px 10px;
    border-radius: 2px;
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s, background 0.12s;
    white-space: nowrap;
  }
  .dap-exo-skychart-reset:hover {
    color: #d4aa50;
    border-color: #d4aa50;
    background: rgba(212,170,80,0.06);
  }
  `;

  // ─────────────────────────────────────────────────────────────────
  // MOON MATH (Meeus simplified, ±0.5 day accuracy)
  // ─────────────────────────────────────────────────────────────────
  function julianDate(d) {
    return d.getTime() / 86400000 + 2440587.5;
  }
  function moonPhase(date) {
    const jd = julianDate(date);
    const daysSinceNew = jd - 2451549.5;  // known new moon ref
    const newMoons = daysSinceNew / 29.53058867;
    const phase = newMoons - Math.floor(newMoons);
    const illum = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    const waxing = phase < 0.5;
    return { phase, illum, waxing };
  }
  function phaseName(p) {
    if (p.illum < 0.03) return 'New';
    if (p.illum > 0.97) return 'Full';
    if (p.waxing && p.illum < 0.5) return 'Waxing crescent';
    if (p.waxing && p.illum >= 0.5) return 'Waxing gibbous';
    if (!p.waxing && p.illum >= 0.5) return 'Waning gibbous';
    return 'Waning crescent';
  }
  function daysUntilNew(fromDate) {
    let d = new Date(fromDate);
    for (let i = 0; i < 60; i++) {
      d.setDate(d.getDate() + 1);
      if (moonPhase(d).illum < 0.03) return { days: i + 1, date: new Date(d) };
    }
    return { days: null, date: null };
  }
  function moonSvg(illum, waxing) {
    const r = 7;
    if (illum < 0.03) {
      return `<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="${r-0.5}" fill="#111116" stroke="#5a4a28" stroke-width="0.5"/></svg>`;
    }
    if (illum > 0.97) {
      return `<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="${r-0.5}" fill="#a89060" stroke="#5a4a28" stroke-width="0.5"/></svg>`;
    }
    const litW = illum * 2 * r;
    const litX = waxing ? (2 * r - litW) : 0;
    const id = `mc${Math.round(illum * 1000)}-${waxing ? 1 : 0}`;
    return `<svg viewBox="0 0 14 14">
      <defs><clipPath id="${id}"><circle cx="7" cy="7" r="${r - 0.5}"/></clipPath></defs>
      <circle cx="7" cy="7" r="${r - 0.5}" fill="#111116" stroke="#5a4a28" stroke-width="0.5"/>
      <rect x="${litX}" y="0" width="${litW}" height="14" fill="#a89060" clip-path="url(#${id})"/>
    </svg>`;
  }

  // Target altitude at midnight
  function lstAtMidnight(date, lonDeg) {
    const jd = julianDate(date) + 0.5;
    const t = (jd - 2451545.0) / 36525;
    let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t;
    gmst = ((gmst % 360) + 360) % 360;
    return ((gmst + lonDeg) % 360 + 360) % 360;
  }
  function targetAltitude(raHr, decDeg, latDeg, lstDeg) {
    const ha = ((lstDeg - raHr * 15) % 360 + 540) % 360 - 180;
    const haR = ha * Math.PI / 180;
    const decR = decDeg * Math.PI / 180;
    const latR = latDeg * Math.PI / 180;
    const sinAlt = Math.sin(decR) * Math.sin(latR) + Math.cos(decR) * Math.cos(latR) * Math.cos(haR);
    return Math.asin(sinAlt) * 180 / Math.PI;
  }

  // ─────────────────────────────────────────────────────────────────
  // RA/Dec PARSING — use host page's parser when available
  // ─────────────────────────────────────────────────────────────────
  // The host index.html has a parseRaDec(ra, dec) → {raDeg, decDeg}.
  // We use it directly when available. Otherwise we fall back to our own.
  // Returns { raHr, raDeg, decDeg } or null if parsing fails.

  function parseCoords(o) {
    if (!o || o.ra == null || o.dec == null) return null;
    const raStr = String(o.ra).trim();
    const decStr = String(o.dec).trim();
    if (raStr === '' || decStr === '') return null;

    // Try host parser first
    if (typeof window.parseRaDec === 'function') {
      try {
        const r = window.parseRaDec(raStr, decStr);
        if (r && r.raDeg != null && r.decDeg != null
            && !isNaN(r.raDeg) && !isNaN(r.decDeg)) {
          return { raHr: r.raDeg / 15, raDeg: r.raDeg, decDeg: r.decDeg };
        }
      } catch (e) {
        console.debug('[DAP patch] host parseRaDec threw on', { ra: raStr, dec: decStr }, e);
      }
    }

    // Fallback: our own parsers
    const raHr = parseRAFallback(raStr);
    const decDeg = parseDecFallback(decStr);
    if (raHr == null || decDeg == null || isNaN(raHr) || isNaN(decDeg)) return null;
    return { raHr, raDeg: raHr * 15, decDeg };
  }

  // Fallback RA parser — accepts:
  //   "13h 15m 49.3s"   h/m/s notation
  //   "13:15:49.3"      colon-separated sexagesimal hours
  //   "13 15 49.3"      space-separated
  //   "198.7263"        decimal (degrees if >24, else hours)
  function parseRAFallback(s) {
    s = String(s).trim();
    if (s === '') return null;
    const hms = s.match(/(\d+(?:\.\d+)?)\s*h\s*(\d+(?:\.\d+)?)\s*m\s*([\d.]+)?\s*s?/i);
    if (hms) {
      return parseFloat(hms[1]) + parseFloat(hms[2]) / 60 + (parseFloat(hms[3]) || 0) / 3600;
    }
    const parts = s.split(/[:\s]+/).map(parseFloat).filter(n => !isNaN(n));
    if (parts.length >= 2) {
      return parts[0] + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
    }
    const n = parseFloat(s);
    if (!isNaN(n)) return n > 24 ? n / 15 : n;
    return null;
  }

  // Fallback Dec parser — accepts:
  //   "+42° 01′ 45″"    degree symbols
  //   "+42:01:45"       colon-separated
  //   "+42 01 45"       space-separated
  //   "+42.0292"        decimal degrees
  // Handles both ASCII '-' and unicode '−' (U+2212) signs.
  function parseDecFallback(s) {
    s = String(s).trim().replace(/\u2212/g, '-');  // normalize unicode minus
    if (s === '') return null;
    const sign = s.startsWith('-') ? -1 : 1;
    const body = s.replace(/^[+-]/, '');
    const dms = body.match(/(\d+(?:\.\d+)?)\s*[°d]\s*(\d+(?:\.\d+)?)\s*[\'′m]\s*([\d.]+)?\s*[\"″s]?/i);
    if (dms) {
      return sign * (parseFloat(dms[1]) + parseFloat(dms[2]) / 60 + (parseFloat(dms[3]) || 0) / 3600);
    }
    const parts = body.split(/[:\s]+/).map(parseFloat).filter(n => !isNaN(n));
    if (parts.length >= 2) {
      return sign * (parts[0] + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600);
    }
    const n = parseFloat(body);
    if (!isNaN(n)) return sign * n;
    return null;
  }

  // Compatibility wrappers for places that still call parseRA/parseDec
  function parseRA(raStr) {
    const c = parseCoords({ ra: raStr, dec: '+00:00:00' });
    return c ? c.raHr : null;
  }
  function parseDec(decStr) {
    const c = parseCoords({ ra: '00:00:00', dec: decStr });
    return c ? c.decDeg : null;
  }

  // ─────────────────────────────────────────────────────────────────
  // TOP-OF-PAGE MOON CALENDAR — supports strip view + month view
  // ─────────────────────────────────────────────────────────────────

  // Build a single day cell (used by both strip and month views)
  function buildDayCell(d, opts) {
    opts = opts || {};
    const phase = moonPhase(d);
    const today = new Date();
    const isToday = d.getFullYear() === today.getFullYear()
                 && d.getMonth() === today.getMonth()
                 && d.getDate() === today.getDate();
    const isNew = phase.illum < 0.10;
    const isFull = phase.illum > 0.95;
    const cls = ['dap-ms-day'];
    if (isToday) cls.push('today');
    if (isNew) cls.push('new-window');
    if (isFull) cls.push('full');
    if (opts.faded) cls.push('faded');

    const dow = ['S','M','T','W','T','F','S'][d.getDay()];
    return `<div class="${cls.join(' ')}" title="${d.toDateString()} · ${phaseName(phase)} ${Math.round(phase.illum*100)}%">
      <div class="dap-ms-day-num">${d.getDate()}</div>
      <div class="dap-ms-day-dow">${dow}</div>
      <div class="dap-ms-moon">${moonSvg(phase.illum, phase.waxing)}</div>
    </div>`;
  }

  // Strip view: 28 days from today
  function buildStripGrid() {
    const today = new Date();
    let cells = '';
    for (let i = 0; i < 28; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      cells += buildDayCell(d);
    }
    return `<div class="dap-ms-grid-strip">${cells}</div>`;
  }

  // Month view: full calendar grid for a given year/month
  function buildMonthGrid(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDow = firstDay.getDay();  // 0 = Sun
    const daysInMonth = lastDay.getDate();

    const dowLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let header = '<div class="dap-ms-dow-row">';
    for (const lbl of dowLabels) header += `<div class="dap-ms-dow-label">${lbl}</div>`;
    header += '</div>';

    let cells = '';
    // Leading empty cells for days before the 1st
    for (let i = 0; i < firstDow; i++) {
      cells += '<div class="dap-ms-day empty"></div>';
    }
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells += buildDayCell(d);
    }
    // Trailing empty cells to complete the last week
    const totalCells = firstDow + daysInMonth;
    const remainder = totalCells % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        cells += '<div class="dap-ms-day empty"></div>';
      }
    }

    const monthName = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return `
      <div class="dap-ms-month-nav">
        <button class="dap-ms-nav-btn" data-month-nav="prev">‹ Prev</button>
        <div class="dap-ms-month-title">${monthName}</div>
        <button class="dap-ms-nav-btn" data-month-nav="next">Next ›</button>
      </div>
      ${header}
      <div class="dap-ms-grid-month" data-month-year="${year}" data-month-num="${month}">${cells}</div>
    `;
  }

  function buildMoonStripHTML() {
    const today = new Date();
    const newMoonDays = [];

    // Collect new moon days in the next 28 nights for the summary
    for (let i = 0; i < 28; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (moonPhase(d).illum < 0.10) newMoonDays.push(d);
    }

    const tonight = moonPhase(today);
    const next = daysUntilNew(today);
    const nowText = `Tonight: <span class="acc">${phaseName(tonight)} · ${Math.round(tonight.illum * 100)}%</span> · Next new: <span class="new">★ ${next.date ? next.date.toDateString().slice(4, 10) : '?'} (${next.days} ${next.days === 1 ? 'night' : 'nights'})</span>`;

    let windowsText = '';
    if (newMoonDays.length > 0) {
      const w1 = newMoonDays[0];
      const w1end = new Date(w1); w1end.setDate(w1.getDate() + 3);
      windowsText = `★ Recommended dark window: ${w1.toDateString().slice(4, 10)}–${w1end.toDateString().slice(4, 10)}`;
    }

    return `<div class="dap-moon-strip" id="dap-moon-strip">
      <div class="dap-ms-head">
        <div class="dap-ms-title">Moon Calendar · ${CONFIG.observerLabel}</div>
        <div class="dap-ms-now">${nowText}</div>
      </div>
      <div class="dap-ms-viewtabs">
        <span class="dap-ms-viewtab active" data-view="strip">Next 28 nights</span>
        <span class="dap-ms-viewtab" data-view="month">Month view</span>
      </div>
      <div data-ms-content>${buildStripGrid()}</div>
      <div class="dap-ms-legend">
        <span>○ new (best)</span>
        <span>◐ quarter</span>
        <span>● full</span>
        <span style="margin-left: auto; color: #d4aa50;">${windowsText}</span>
      </div>
    </div>`;
  }

  function wireMoonStrip() {
    const root = document.getElementById('dap-moon-strip');
    if (!root) return;
    const content = root.querySelector('[data-ms-content]');
    const tabs = root.querySelectorAll('.dap-ms-viewtab');
    const today = new Date();
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth();

    function showStrip() {
      content.innerHTML = buildStripGrid();
    }
    function showMonth() {
      content.innerHTML = buildMonthGrid(viewYear, viewMonth);
      wireMonthNav();
    }
    function wireMonthNav() {
      const navBtns = content.querySelectorAll('[data-month-nav]');
      navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.monthNav === 'prev') {
            viewMonth--;
            if (viewMonth < 0) { viewMonth = 11; viewYear--; }
          } else {
            viewMonth++;
            if (viewMonth > 11) { viewMonth = 0; viewYear++; }
          }
          showMonth();
        });
      });
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (tab.dataset.view === 'strip') showStrip();
        else showMonth();
      });
    });
  }

  function injectMoonStrip() {
    // Find a good insertion point in the catalog page
    // Try a few common anchors in your index.html
    if (document.getElementById('dap-moon-strip')) return;

    const candidates = [
      document.querySelector('.catalog-controls'),
      document.querySelector('.catalog-header'),
      document.querySelector('main .gallery'),
      document.querySelector('#catalogGallery'),
      document.querySelector('.gallery'),
      document.querySelector('main')
    ];
    const anchor = candidates.find(el => el);
    if (!anchor) {
      console.warn('[DAP patch] could not find a place to inject the moon strip');
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildMoonStripHTML();
    anchor.parentNode.insertBefore(wrapper.firstElementChild, anchor);

    wireMoonStrip();
  }

  // ─────────────────────────────────────────────────────────────────
  // PER-TARGET MOON FORECAST (14 nights with altitude)
  // ─────────────────────────────────────────────────────────────────
  function buildPerTargetForecastHTML(o) {
    const c = parseCoords(o);
    // If unparseable, silently skip — the FOV viewer's warning above already
    // logged the issue with the same object, no need to log twice
    if (!c) return '';
    const raHr = c.raHr;
    const decDeg = c.decDeg;

    const today = new Date();
    const days = [];
    let bestStart = null, bestRun = 0, curRun = 0, curStart = null;

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const phase = moonPhase(d);
      const lst = lstAtMidnight(d, CONFIG.observerLon);
      const alt = targetAltitude(raHr, decDeg, CONFIG.observerLat, lst);
      days.push({ d, phase, alt });

      const isBest = phase.illum < 0.25 && alt > 50;
      if (isBest) {
        if (curRun === 0) curStart = d;
        curRun++;
        if (curRun > bestRun) { bestRun = curRun; bestStart = curStart; }
      } else {
        curRun = 0;
      }
    }

    let cells = '';
    for (let i = 0; i < days.length; i++) {
      const { d, phase, alt } = days[i];
      const isToday = i === 0;
      const isBest = phase.illum < 0.25 && alt > 50;
      const targetDown = alt < 30;
      const cls = ['dap-pt-day'];
      if (isToday) cls.push('today');
      if (isBest) cls.push('best');
      if (targetDown) cls.push('target-down');
      const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
      const altPct = Math.max(0, Math.min(100, (alt / 90) * 100));
      const altCls = alt > 60 ? 'high' : alt > 30 ? 'mid' : 'low';
      cells += `<div class="${cls.join(' ')}" title="${d.toDateString()} · ${phaseName(phase)} ${Math.round(phase.illum * 100)}% · alt ${alt.toFixed(0)}°">
        <div class="dap-pt-day-num">${d.getDate()}</div>
        <div class="dap-pt-day-dow">${dow}</div>
        <div class="dap-pt-moon-ic">${moonSvg(phase.illum, phase.waxing)}</div>
        <div class="dap-pt-alt"><div class="fill ${altCls}" style="height: ${altPct}%"></div></div>
      </div>`;
    }

    let recHTML = '';
    if (bestStart && bestRun >= 2) {
      const endD = new Date(bestStart);
      endD.setDate(bestStart.getDate() + bestRun - 1);
      recHTML = `<div class="dap-pt-rec"><div class="icon">★</div><div><strong>Best: ${bestStart.toDateString().slice(4, 10)}–${endD.toDateString().slice(4, 10)}</strong> · ${bestRun} dark nights · ${o.name} above 50°</div></div>`;
    } else {
      recHTML = `<div class="dap-pt-rec"><div class="icon">!</div><div>No clear dark window for ${o.name} in the next 14 nights.</div></div>`;
    }

    return `<div class="dp-section">
      <div class="dp-section-title">Best windows · ${(o.name || '').replace(/</g, '&lt;')}</div>
      <div class="dap-pt-moon">
        ${recHTML}
        <div class="dap-pt-grid">${cells}</div>
      </div>
    </div>`;
  }

  // ─────────────────────────────────────────────────────────────────
  // ALADIN LITE FOV VIEWER
  // ─────────────────────────────────────────────────────────────────
  let aladinCounter = 0;
  const aladinInstances = {};  // id → instance

  function buildAladinFOVHTML(o) {
    const c = parseCoords(o);
    if (!c) {
      console.warn(`[DAP patch] FOV viewer skipped for "${o.name}" — couldn't parse RA/Dec.`,
        { ra: o.ra, dec: o.dec });
      return `<div class="dp-section">
        <div class="dp-section-title">Interactive FOV · ${(o.name || '').replace(/</g, '&lt;')}</div>
        <div class="dap-fov-card">
          <div class="dap-sc-empty">
            <span class="gold">FOV viewer unavailable</span><br>
            Couldn't parse coordinates: <code>RA: ${(o.ra || '(missing)').replace(/</g,'&lt;')}</code> · <code>Dec: ${(o.dec || '(missing)').replace(/</g,'&lt;')}</code><br>
            <span style="font-size: 9px;">(see browser console for details)</span>
          </div>
        </div>
      </div>`;
    }
    const raHr = c.raHr;
    const decDeg = c.decDeg;

    const id = 'dap-aladin-' + (++aladinCounter);
    const name = (o.name || '').replace(/</g, '&lt;');

    return `<div class="dp-section">
      <div class="dp-section-title">Interactive FOV · ${name}</div>
      <div class="dap-fov-card">
        <div class="dap-fov-head">
          <div class="dap-fov-title">${name} · ${o.ra} ${o.dec}</div>
          <div class="dap-fov-rig">
            <span class="acc">Rig:</span> ${CONFIG.rigLabel} ·
            <span class="acc">FOV:</span> ${CONFIG.rigFovWidthArcmin}′ × ${CONFIG.rigFovHeightArcmin}′
          </div>
        </div>
        <div class="dap-fov-ctrls">
          <div class="dap-fov-grp" data-role="surveys">
            <span class="dap-fov-btn active" data-survey="P/DSS2/color">DSS2</span>
            <span class="dap-fov-btn" data-survey="P/PanSTARRS/DR1/color-z-zg-g">PanSTARRS</span>
            <span class="dap-fov-btn" data-survey="P/SDSS9/color">SDSS</span>
            <span class="dap-fov-btn" data-survey="P/2MASS/color">2MASS</span>
          </div>
          <div class="dap-fov-slider">
            <span>Rotation</span>
            <input type="range" min="0" max="360" value="0" data-role="rotation">
            <span data-role="rot-val" style="color: #d4aa50; min-width: 30px;">0°</span>
          </div>
          <div class="dap-fov-grp" data-role="zooms">
            <span class="dap-fov-btn" data-fov="0.5">0.5×</span>
            <span class="dap-fov-btn active" data-fov="1">1×</span>
            <span class="dap-fov-btn" data-fov="2">2×</span>
            <span class="dap-fov-btn" data-fov="reset">Reset</span>
          </div>
        </div>
        <div class="dap-fov-viewer" data-aladin-id="${id}">
          <div class="dap-fov-aladin" id="${id}"></div>
          <div class="dap-fov-overlay" data-role="overlay" style="transform: translate(-50%,-50%) rotate(0deg);">
            <div class="dap-fov-overlay-box" data-role="overlay-box">
              <div class="c tl"></div><div class="c tr"></div>
              <div class="c bl"></div><div class="c br"></div>
            </div>
          </div>
          <div class="dap-fov-label">${CONFIG.rigLabel} · ${CONFIG.rigFovWidthArcmin}′ × ${CONFIG.rigFovHeightArcmin}′</div>
        </div>
      </div>
    </div>`;
  }

  function initAladinForElement(viewerEl, o) {
    if (typeof A === 'undefined') {
      console.debug(`[DAP patch] Aladin lib not loaded yet for "${o.name}", retrying...`);
      setTimeout(() => initAladinForElement(viewerEl, o), 200);
      return;
    }
    const id = viewerEl.dataset.aladinId;
    if (!id) {
      console.warn('[DAP patch] viewer element has no data-aladin-id');
      return;
    }
    if (aladinInstances[id]) {
      console.debug(`[DAP patch] Aladin instance ${id} already exists, skipping`);
      return;
    }

    const c = parseCoords(o);
    if (!c) {
      console.warn(`[DAP patch] Aladin init: couldn't parse coords for "${o.name}"`,
        { ra: o.ra, dec: o.dec });
      return;
    }
    const raDeg = c.raDeg;
    const decDeg = c.decDeg;

    // Verify the element is actually in the DOM and has a size
    const rect = viewerEl.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) {
      console.warn(`[DAP patch] Aladin viewer for "${o.name}" has zero size (${rect.width}×${rect.height}), retrying once`,
        viewerEl);
      setTimeout(() => initAladinForElement(viewerEl, o), 300);
      return;
    }

    const targetDiv = viewerEl.querySelector('#' + id);
    if (!targetDiv) {
      console.warn(`[DAP patch] Aladin init: couldn't find inner #${id} element`, viewerEl);
      return;
    }

    console.debug(`[DAP patch] Initializing Aladin for "${o.name}" at ${raDeg.toFixed(4)}, ${decDeg.toFixed(4)} → ${id}`);

    A.init.then(() => {
      try {
        const aladin = A.aladin('#' + id, {
          survey: 'P/DSS2/color',
          fov: 1.0,
          target: `${raDeg} ${decDeg}`,
          showReticle: false,
          showZoomControl: false,
          showLayersControl: false,
          showGotoControl: false,
          showFullscreenControl: false,
          showSimbadPointerControl: false,
          showFrame: false,
          cooFrame: 'J2000'
        });
        aladinInstances[id] = aladin;
        console.debug(`[DAP patch] Aladin initialized successfully for "${o.name}"`);

        const overlay = viewerEl.querySelector('[data-role="overlay"]');

        function updateOverlay() {
          const fov = aladin.getFov()[0];
          const rigW = CONFIG.rigFovWidthArcmin / 60;
          const rigH = CONFIG.rigFovHeightArcmin / 60;
          const w = (rigW / fov) * 100;
          const h = (rigH / fov) * 100;
          overlay.style.width = w + '%';
          overlay.style.height = h + '%';
        }

        aladin.on('zoomChanged', updateOverlay);
        aladin.on('positionChanged', updateOverlay);
        updateOverlay();

        const card = viewerEl.closest('.dap-fov-card');

        card.querySelectorAll('[data-role="surveys"] .dap-fov-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            card.querySelectorAll('[data-role="surveys"] .dap-fov-btn')
              .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            aladin.setImageSurvey(btn.dataset.survey);
          });
        });

        const slider = card.querySelector('[data-role="rotation"]');
        const rotVal = card.querySelector('[data-role="rot-val"]');
        slider.addEventListener('input', e => {
          const deg = e.target.value;
          rotVal.textContent = deg + '°';
          overlay.style.transform = `translate(-50%,-50%) rotate(${deg}deg)`;
        });

        card.querySelectorAll('[data-role="zooms"] .dap-fov-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const v = btn.dataset.fov;
            if (v === 'reset') {
              aladin.gotoRaDec(raDeg, decDeg);
              aladin.setFoV(1.0);
            } else {
              aladin.setFoV(parseFloat(v));
            }
            card.querySelectorAll('[data-role="zooms"] .dap-fov-btn')
              .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          });
        });
      } catch (err) {
        console.error(`[DAP patch] Aladin initialization threw for "${o.name}":`, err);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // SESSION COMPARISON
  // ─────────────────────────────────────────────────────────────────
  function buildSessionComparisonHTML(o) {
    const sessions = (o.sessions || []).slice().reverse();

    if (sessions.length === 0) {
      return `<div class="dp-section">
        <div class="dp-section-title">Session Comparison · ${(o.name || '').replace(/</g, '&lt;')}</div>
        <div class="dap-sc-card">
          <div class="dap-sc-empty">
            <span class="gold">No sessions logged yet.</span><br>
            ${CONFIG.sessionsEnabled
              ? 'Drop a PNG or JPG below to start tracking imaging sessions.'
              : 'Session uploads will be enabled once myweb permissions are configured.'}
          </div>
          ${CONFIG.sessionsEnabled
            ? `<div class="dap-sc-drop" data-role="drop"><span class="gold">+ Drop a PNG or JPG here</span> · or click to upload</div>`
            : ''}
        </div>
      </div>`;
    }

    if (sessions.length === 1) {
      const s = sessions[0];
      return `<div class="dp-section">
        <div class="dp-section-title">Session Comparison · ${(o.name || '').replace(/</g, '&lt;')}</div>
        <div class="dap-sc-card">
          <div class="dap-sc-frame" style="aspect-ratio: 16/10;">
            <img src="${escAttr(s.imageUrl)}" alt="${escAttr(s.date)}">
            <div class="dap-sc-stamp">${escAttr(s.date)}</div>
          </div>
          <div class="dap-sc-empty" style="margin-top: 12px;">
            Only one session logged. Add more to enable comparison.
          </div>
          ${CONFIG.sessionsEnabled
            ? `<div class="dap-sc-drop" data-role="drop"><span class="gold">+ Add another session</span></div>`
            : ''}
        </div>
      </div>`;
    }

    const opts = sessions.map((s, i) =>
      `<option value="${i}">${escAttr(s.date)}${s.note ? ' — ' + escAttr(s.note) : ''}</option>`).join('');

    const leftIdx = 0, rightIdx = Math.min(1, sessions.length - 1);

    return `<div class="dp-section">
      <div class="dp-section-title">Session Comparison · ${(o.name || '').replace(/</g, '&lt;')}</div>
      <div class="dap-sc-card" data-sc-card>
        <div class="dap-sc-modes">
          <span class="dap-sc-mode active" data-mode="side">Side-by-side</span>
          <span class="dap-sc-mode" data-mode="blink">Blink</span>
          <span class="dap-sc-mode" data-mode="slider">Slider</span>
        </div>
        <div class="dap-sc-pickers">
          <span>Left</span>
          <select data-role="left">${opts.replace(`value="${leftIdx}"`, `value="${leftIdx}" selected`)}</select>
          <span style="color: #d4aa50;">⇄</span>
          <span>Right</span>
          <select data-role="right">${opts.replace(`value="${rightIdx}"`, `value="${rightIdx}" selected`)}</select>
        </div>
        <div class="dap-sc-pair" data-role="stage">
          <!-- populated by initSessionComparison -->
        </div>
        ${CONFIG.sessionsEnabled
          ? `<div class="dap-sc-drop" data-role="drop"><span class="gold">+ Add another session</span></div>`
          : `<div class="dap-sc-empty" style="margin-top: 12px;">Uploads pending myweb permission fix.</div>`}
      </div>
    </div>`;
  }

  function initSessionComparison(cardEl, o) {
    if (!cardEl) return;
    const sessions = (o.sessions || []).slice().reverse();
    if (sessions.length < 2) return;

    const stage = cardEl.querySelector('[data-role="stage"]');
    const leftSel = cardEl.querySelector('[data-role="left"]');
    const rightSel = cardEl.querySelector('[data-role="right"]');
    let currentMode = 'side';

    function render() {
      const L = sessions[parseInt(leftSel.value)];
      const R = sessions[parseInt(rightSel.value)];

      if (currentMode === 'side') {
        stage.style.gridTemplateColumns = '1fr 1fr';
        stage.innerHTML = `
          <div class="dap-sc-frame">
            <img src="${escAttr(L.imageUrl)}" alt="${escAttr(L.date)}">
            <div class="dap-sc-stamp">${escAttr(L.date)}</div>
          </div>
          <div class="dap-sc-frame">
            <img src="${escAttr(R.imageUrl)}" alt="${escAttr(R.date)}">
            <div class="dap-sc-stamp">${escAttr(R.date)}</div>
          </div>`;
      } else if (currentMode === 'blink') {
        stage.style.gridTemplateColumns = '1fr';
        stage.innerHTML = `
          <div class="dap-sc-frame" data-blink style="aspect-ratio: 16/10; cursor: cell;">
            <img data-blink-l src="${escAttr(L.imageUrl)}" alt="${escAttr(L.date)}" style="position: absolute; inset: 0; opacity: 1; transition: opacity 80ms;">
            <img data-blink-r src="${escAttr(R.imageUrl)}" alt="${escAttr(R.date)}" style="position: absolute; inset: 0; opacity: 0; transition: opacity 80ms;">
            <div class="dap-sc-stamp" data-blink-stamp>${escAttr(L.date)}</div>
          </div>`;
        const frame = stage.querySelector('[data-blink]');
        const imgL = stage.querySelector('[data-blink-l]');
        const imgR = stage.querySelector('[data-blink-r]');
        const stamp = stage.querySelector('[data-blink-stamp]');
        let interval = null, showingR = false;
        frame.addEventListener('mouseenter', () => {
          interval = setInterval(() => {
            showingR = !showingR;
            imgL.style.opacity = showingR ? 0 : 1;
            imgR.style.opacity = showingR ? 1 : 0;
            stamp.textContent = showingR ? R.date : L.date;
          }, 380);
        });
        frame.addEventListener('mouseleave', () => {
          if (interval) clearInterval(interval);
          showingR = false;
          imgL.style.opacity = 1;
          imgR.style.opacity = 0;
          stamp.textContent = L.date;
        });
      } else if (currentMode === 'slider') {
        stage.style.gridTemplateColumns = '1fr';
        stage.innerHTML = `
          <div class="dap-sc-frame" data-slider style="aspect-ratio: 16/10; cursor: ew-resize; user-select: none;">
            <img src="${escAttr(L.imageUrl)}" alt="${escAttr(L.date)}" style="position: absolute; inset: 0;">
            <img data-slider-right src="${escAttr(R.imageUrl)}" alt="${escAttr(R.date)}" style="position: absolute; inset: 0; clip-path: inset(0 0 0 50%);">
            <div data-slider-handle style="position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; background: #d4aa50; box-shadow: 0 0 8px rgba(212,170,80,0.6); pointer-events: none;"></div>
            <div class="dap-sc-stamp" style="left: 8px;">${escAttr(L.date)}</div>
            <div class="dap-sc-stamp" style="right: 8px; left: auto; color: #f0cc78;">${escAttr(R.date)}</div>
          </div>`;
        const wrap = stage.querySelector('[data-slider]');
        const rightImg = stage.querySelector('[data-slider-right]');
        const handle = stage.querySelector('[data-slider-handle]');
        let dragging = false;
        function update(e) {
          const rect = wrap.getBoundingClientRect();
          const x = (e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || rect.left + rect.width / 2);
          const pct = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
          handle.style.left = pct + '%';
          rightImg.style.clipPath = `inset(0 0 0 ${pct}%)`;
        }
        wrap.addEventListener('mousedown', e => { dragging = true; update(e); });
        document.addEventListener('mousemove', e => { if (dragging) update(e); });
        document.addEventListener('mouseup', () => { dragging = false; });
        wrap.addEventListener('touchstart', e => { dragging = true; update(e); });
        document.addEventListener('touchmove', e => { if (dragging) update(e); });
        document.addEventListener('touchend', () => { dragging = false; });
      }
    }

    cardEl.querySelectorAll('.dap-sc-mode').forEach(m => {
      m.addEventListener('click', () => {
        cardEl.querySelectorAll('.dap-sc-mode').forEach(b => b.classList.remove('active'));
        m.classList.add('active');
        currentMode = m.dataset.mode;
        render();
      });
    });
    leftSel.addEventListener('change', render);
    rightSel.addEventListener('change', render);

    render();
  }

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // ─────────────────────────────────────────────────────────────────
  // CONSTELLATION CONTEXT
  // ─────────────────────────────────────────────────────────────────
  // Star catalog: brightest stars used as anchors for constellation
  // patterns. Fields: [RA hours, Dec deg, mag, name, constellation_abbr]
  // ~150 stars covering most major constellation lines. Compact data.
  const BRIGHT_STARS = [
    // [ra, dec, mag, name, const]
    [0.140,29.092,2.07,'Caph','Cas'],[0.153,59.150,2.27,'α Cas','Cas'],
    [0.726,-17.987,2.04,'β Cet','Cet'],[0.946,60.717,2.15,'γ Cas','Cas'],
    [1.430,60.235,2.66,'δ Cas','Cas'],[1.892,63.670,3.35,'ε Cas','Cas'],
    [1.162,35.621,2.06,'α And','And'],[2.097,42.330,2.06,'β And','And'],
    [3.405,49.861,1.79,'α Per','Per'],[3.136,40.956,2.84,'γ Per','Per'],
    [3.792,24.105,2.85,'η Tau','Tau'],[4.598,16.509,0.87,'Aldebaran','Tau'],
    [5.242,28.608,1.65,'β Tau','Tau'],[5.586,-1.202,1.69,'δ Ori','Ori'],
    [5.679,-1.943,1.74,'ε Ori','Ori'],[5.797,-1.942,2.05,'ζ Ori','Ori'],
    [5.679,7.407,0.45,'Betelgeuse','Ori'],[5.242,-8.202,0.18,'Rigel','Ori'],
    [5.992,44.948,0.08,'Capella','Aur'],[5.992,37.213,1.90,'β Aur','Aur'],
    [6.398,-1.943,2.77,'γ Ori','Ori'],[6.752,-16.713,-1.46,'Sirius','CMa'],
    [7.401,31.888,1.16,'Castor','Gem'],[7.755,28.026,1.14,'Pollux','Gem'],
    [7.655,-26.396,-0.62,'Adhara','CMa'],[8.158,-47.337,1.83,'δ Vel','Vel'],
    [8.745,28.760,3.53,'γ Cnc','Cnc'],[9.460,11.967,1.36,'Regulus','Leo'],
    [9.876,-55.011,2.21,'δ Vel','Vel'],[10.139,11.967,2.61,'γ Leo','Leo'],
    [10.333,19.842,2.97,'δ Leo','Leo'],[11.062,61.751,1.81,'Dubhe','UMa'],
    [11.030,56.382,2.34,'Merak','UMa'],[11.817,53.695,2.41,'Phecda','UMa'],
    [11.897,53.687,3.31,'Megrez','UMa'],[12.257,57.033,1.77,'Alioth','UMa'],
    [12.900,55.960,2.27,'Mizar','UMa'],[12.262,-69.144,1.25,'Acrux','Cru'],
    [12.519,-57.113,1.59,'Mimosa','Cru'],[12.519,-60.401,2.78,'Gacrux','Cru'],
    [13.420,54.926,1.85,'Alkaid','UMa'],[13.398,-11.161,1.04,'Spica','Vir'],
    [14.261,19.182,-0.05,'Arcturus','Boo'],[14.276,38.308,2.68,'γ Boo','Boo'],
    [14.535,30.371,2.35,'ε Boo','Boo'],[14.730,27.074,3.04,'δ Boo','Boo'],
    [14.846,74.155,2.07,'β UMi','UMi'],[15.737,26.715,2.23,'α CrB','CrB'],
    [16.490,-26.432,1.06,'Antares','Sco'],[16.836,-69.028,1.92,'α TrA','TrA'],
    [17.582,12.560,2.08,'α Oph','Oph'],[17.943,51.489,3.07,'ε Dra','Dra'],
    [17.583,29.246,3.85,'β Her','Her'],[18.619,38.784,0.03,'Vega','Lyr'],
    [18.984,32.690,3.25,'γ Lyr','Lyr'],[19.770,8.868,0.77,'Altair','Aql'],
    [20.690,45.280,2.20,'Deneb','Cyg'],[19.770,45.131,2.23,'Sadr','Cyg'],
    [19.512,27.960,3.21,'α Vul','Vul'],[20.770,33.965,2.46,'ε Cyg','Cyg'],
    [21.310,62.586,2.45,'α Cep','Cep'],[21.736,9.875,2.94,'ε Peg','Peg'],
    [22.097,15.205,3.62,'ζ Peg','Peg'],[22.711,30.221,2.43,'α Peg','Peg'],
    [23.063,28.083,2.49,'β Peg','Peg'],[0.220,28.997,2.50,'γ Peg','Peg'],
    // Galactic plane / southern additions
    [15.580,26.715,3.46,'β CrB','CrB'],[16.005,-19.806,2.56,'Dschubba','Sco'],
    [16.354,-25.593,1.86,'Shaula','Sco'],[17.561,-37.103,1.62,'Sargas','Sco'],
    // Canes Venatici (your example uses M63)
    [12.560,38.318,2.89,'Cor Caroli','CVn'],[12.945,41.357,4.26,'Chara','CVn'],
    [12.745,45.440,5.00,'Y CVn','CVn'],
    // Coma Berenices
    [13.166,17.529,4.32,'β Com','Com'],[13.197,28.268,4.94,'γ Com','Com'],
    // More mid-sky filler
    [11.062,15.429,2.14,'Algieba','Leo'],[10.715,49.319,2.20,'ν UMa','UMa'],
    [9.218,67.624,3.06,'α Dra','Dra'],[14.073,64.376,2.74,'β Dra','Dra'],
    [17.943,72.733,2.79,'γ Dra','Dra'],[15.580,77.794,2.74,'ξ Dra','Dra'],
    // Cepheus
    [22.485,58.415,3.23,'γ Cep','Cep'],[21.477,70.561,3.39,'ζ Cep','Cep']
  ];

  // Constellation abbreviation → full name (subset)
  const CONST_NAMES = {
    'And':'Andromeda','Aql':'Aquila','Ari':'Aries','Aur':'Auriga','Boo':'Bootes',
    'Cap':'Capricornus','Cas':'Cassiopeia','Cep':'Cepheus','Cet':'Cetus',
    'CMa':'Canis Major','CMi':'Canis Minor','Cnc':'Cancer','Com':'Coma Berenices',
    'CrB':'Corona Borealis','Cru':'Crux','CVn':'Canes Venatici','Cyg':'Cygnus',
    'Dra':'Draco','Gem':'Gemini','Her':'Hercules','Leo':'Leo','LMi':'Leo Minor',
    'Lyr':'Lyra','Oph':'Ophiuchus','Ori':'Orion','Peg':'Pegasus','Per':'Perseus',
    'Sco':'Scorpius','Sgr':'Sagittarius','Tau':'Taurus','TrA':'Triangulum Australe',
    'UMa':'Ursa Major','UMi':'Ursa Minor','Vir':'Virgo','Vul':'Vulpecula','Vel':'Vela'
  };

  // Constellation stick-figure patterns: pairs of star names that should
  // be connected with lines. Names must match BRIGHT_STARS exactly.
  // Each constellation key maps to an array of [starA, starB] pairs.
  const CONST_LINES = {
    'UMa': [  // Big Dipper
      ['Dubhe','Merak'],['Merak','Phecda'],['Phecda','Megrez'],
      ['Megrez','Alioth'],['Alioth','Mizar'],['Mizar','Alkaid'],
      ['Dubhe','Megrez']  // pointer to bowl edge
    ],
    'Ori': [  // Orion (belt + body)
      ['Betelgeuse','γ Ori'],['γ Ori','Rigel'],['Rigel','δ Ori'],
      ['δ Ori','ε Ori'],['ε Ori','ζ Ori'],['ζ Ori','Betelgeuse']
    ],
    'Cas': [  // Cassiopeia W
      ['Caph','α Cas'],['α Cas','γ Cas'],['γ Cas','δ Cas'],['δ Cas','ε Cas']
    ],
    'Cyg': [  // Northern Cross
      ['Deneb','Sadr'],['Sadr','ε Cyg'],['Sadr','α Vul']
    ],
    'Lyr': [  // Lyra harp (simplified)
      ['Vega','γ Lyr']
    ],
    'Boo': [  // Bootes kite
      ['Arcturus','ε Boo'],['ε Boo','δ Boo'],['δ Boo','γ Boo'],['γ Boo','Arcturus']
    ],
    'Leo': [  // Leo
      ['Regulus','γ Leo'],['γ Leo','δ Leo'],['δ Leo','Algieba'],['Algieba','Regulus']
    ],
    'CMa': [  // Canis Major
      ['Sirius','Adhara']
    ],
    'Gem': [  // Gemini
      ['Castor','Pollux']
    ],
    'Tau': [  // Taurus simple
      ['Aldebaran','β Tau'],['Aldebaran','η Tau']
    ],
    'Per': [  // Perseus
      ['α Per','γ Per']
    ],
    'And': [  // Andromeda chain
      ['α And','β And']
    ],
    'Peg': [  // Pegasus great square
      ['α Peg','β Peg'],['β Peg','γ Peg'],['γ Peg','α And'],['α And','α Peg']
    ],
    'Cep': [  // Cepheus pentagon
      ['α Cep','γ Cep'],['γ Cep','ζ Cep']
    ],
    'Dra': [  // Draco serpent
      ['α Dra','β Dra'],['β Dra','γ Dra'],['γ Dra','ξ Dra']
    ],
    'Cas2': [],  // placeholder
    'UMi': [  // Little Dipper (partial — only β UMi in catalog)
    ],
    'CVn': [  // Canes Venatici
      ['Cor Caroli','Chara']
    ],
    'Sco': [  // Scorpius hook (partial)
      ['Antares','Dschubba'],['Antares','Shaula']
    ],
    'CrB': [  // Corona Borealis arc
      ['α CrB','β CrB']
    ]
  };

  // Angular separation in degrees between two points on the sky
  function angSep(ra1Hr, dec1, ra2Hr, dec2) {
    const r1 = ra1Hr * 15 * Math.PI / 180, d1 = dec1 * Math.PI / 180;
    const r2 = ra2Hr * 15 * Math.PI / 180, d2 = dec2 * Math.PI / 180;
    const cosD = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(r1 - r2);
    return Math.acos(Math.max(-1, Math.min(1, cosD))) * 180 / Math.PI;
  }

  // Find the constellation a coordinate sits in.
  // Approximate: pick the constellation of the nearest cataloged bright star.
  // Not IAU-exact but close enough for context labeling.
  function findConstellation(raHr, decDeg) {
    let best = null, bestDist = Infinity;
    for (const s of BRIGHT_STARS) {
      const d = angSep(raHr, decDeg, s[0], s[1]);
      if (d < bestDist) { bestDist = d; best = s[4]; }
    }
    return { abbr: best, name: CONST_NAMES[best] || best };
  }

  // Tangent plane projection: project sky coords to plane centered on target
  function projectTangent(raHr, decDeg, ra0Hr, dec0Deg) {
    const ra = raHr * 15 * Math.PI / 180;
    const dec = decDeg * Math.PI / 180;
    const ra0 = ra0Hr * 15 * Math.PI / 180;
    const dec0 = dec0Deg * Math.PI / 180;
    const cosC = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(ra - ra0);
    if (cosC <= 0.0001) return null;  // behind us
    const x = Math.cos(dec) * Math.sin(ra - ra0) / cosC;  // east = positive
    const y = (Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(ra - ra0)) / cosC;
    return { x: -x, y: -y };  // East is left in sky convention
  }

  // Get list of all DAP catalog objects (uses host's `objects` array if available)
  function getCatalogObjects() {
    // Try several ways to find the catalog, since the host's `let objects`
    // doesn't attach to window automatically:
    if (typeof window.objects !== 'undefined' && Array.isArray(window.objects)) {
      return window.objects;
    }
    try {
      if (typeof globalThis.objects !== 'undefined' && Array.isArray(globalThis.objects)) {
        return globalThis.objects;
      }
    } catch (e) { /* fall through */ }
    // Last resort: use Function constructor to read the global `objects`
    // from the same realm. Works because both scripts share the global
    // execution context.
    try {
      const obj = (new Function('return typeof objects !== "undefined" ? objects : null'))();
      if (Array.isArray(obj)) return obj;
    } catch (e) { /* fall through */ }
    return [];
  }

  let constAladinCounter = 0;
  const constAladinInstances = {};  // id → instance

  function buildConstellationContextHTML(o) {
    const c = parseCoords(o);
    if (!c) return '';
    const raHr = c.raHr, decDeg = c.decDeg;

    // Prefer explicit constellation field from the catalog (e.g. "UMa"),
    // fall back to nearest-bright-star approximation
    let constAbbr = (o.constellation || o.const || '').trim();
    let constName;
    if (constAbbr && CONST_NAMES[constAbbr]) {
      constName = CONST_NAMES[constAbbr];
    } else {
      const guess = findConstellation(raHr, decDeg);
      constAbbr = guess.abbr;
      constName = guess.name;
    }

    // Render angular size (wider for a richer view)
    const FOV_DEG = 30;
    const SVG_W = 800, SVG_H = 500;
    const CX = SVG_W / 2, CY = SVG_H / 2;
    // Aspect of the SVG is wider than tall; horizontal arc subtended by FOV_DEG
    // Vertical scale: 1° = SVG_W/FOV_DEG pixels (using narrower dimension for consistency)
    const SCALE_PX_PER_DEG = SVG_W / FOV_DEG;

    // ----- Project bright stars and constellation lines for the overlay -----
    const screenPos = {};
    const visibleConsts = new Set();
    let starsByLabel = [];
    let starsHTML = '';
    for (const s of BRIGHT_STARS) {
      const [sra, sdec, smag, sname, sconst] = s;
      const sep = angSep(raHr, decDeg, sra, sdec);
      if (sep > FOV_DEG) continue;
      const p = projectTangent(sra, sdec, raHr, decDeg);
      if (!p) continue;
      const px = CX + p.x * SCALE_PX_PER_DEG * 180 / Math.PI;
      const py = CY + p.y * SCALE_PX_PER_DEG * 180 / Math.PI;
      if (px < -20 || px > SVG_W + 20 || py < -20 || py > SVG_H + 20) continue;
      if (sname) screenPos[sname] = { px, py };
      if (sconst) visibleConsts.add(sconst);

      // Faint glow for very bright stars to enhance the photo
      if (smag < 1.5) {
        starsHTML += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="9" fill="rgba(255,255,255,0.25)"/>`;
      }
      // Label only the brightest stars
      if (smag < 2.5 && sname) {
        starsByLabel.push({ px, py, name: sname, mag: smag });
      }
    }

    // Constellation stick-figure lines
    let linesHTML = '';
    for (const constAbbr2 of visibleConsts) {
      const pattern = CONST_LINES[constAbbr2];
      if (!pattern) continue;
      const lineColor = constAbbr2 === constAbbr
        ? 'rgba(212,170,80,0.7)'      // highlight current constellation
        : 'rgba(212,170,80,0.3)';     // others dimmer
      const lineWidth = constAbbr2 === constAbbr ? 1.8 : 1.2;
      for (const [a, b] of pattern) {
        const pa = screenPos[a], pb = screenPos[b];
        if (!pa || !pb) continue;
        linesHTML += `<line x1="${pa.px.toFixed(1)}" y1="${pa.py.toFixed(1)}" x2="${pb.px.toFixed(1)}" y2="${pb.py.toFixed(1)}" stroke="${lineColor}" stroke-width="${lineWidth}" stroke-linecap="round"/>`;
      }
    }

    // Star labels
    let labelsHTML = '';
    for (const lbl of starsByLabel) {
      labelsHTML += `<text x="${(lbl.px + 10).toFixed(1)}" y="${(lbl.py - 6).toFixed(1)}" font-family="Space Mono, monospace" font-size="11" fill="#f5ecd4" style="text-shadow: 0 0 3px #000;">${lbl.name}</text>`;
    }

    // ----- Find catalog neighbors -----
    const catalog = getCatalogObjects();
    const neighbors = [];
    for (const ob of catalog) {
      if (ob === o) continue;
      // Compare by name as a backup to identity since renderings can re-create objects
      if (ob.name && o.name && ob.name === o.name) continue;
      const oc = parseCoords(ob);
      if (!oc) continue;
      const sep = angSep(raHr, decDeg, oc.raHr, oc.decDeg);
      if (sep > FOV_DEG) continue;
      neighbors.push({ obj: ob, sep, raHr: oc.raHr, decDeg: oc.decDeg });
    }
    neighbors.sort((a, b) => a.sep - b.sep);

    // Draw DSO neighbor markers on the chart
    let dsoHTML = '';
    for (const n of neighbors.slice(0, 15)) {
      const p = projectTangent(n.raHr, n.decDeg, raHr, decDeg);
      if (!p) continue;
      const px = CX + p.x * SCALE_PX_PER_DEG * 180 / Math.PI;
      const py = CY + p.y * SCALE_PX_PER_DEG * 180 / Math.PI;
      if (px < 0 || px > SVG_W || py < 0 || py > SVG_H) continue;

      const type = (n.obj.type || '').toLowerCase();
      const isGalaxy = /galaxy|spiral|sa|sb|sc|elliptical/.test(type);
      const isCluster = /cluster|globular/.test(type);
      const isNebula = /nebula/.test(type);

      if (isGalaxy) {
        dsoHTML += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="8" ry="5" fill="rgba(111,166,200,0.25)" stroke="#6fa6c8" stroke-width="1.4"/>`;
      } else if (isCluster) {
        dsoHTML += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="rgba(144,112,200,0.25)" stroke="#9070c8" stroke-width="1.4"/>`;
      } else if (isNebula) {
        dsoHTML += `<rect x="${(px-6).toFixed(1)}" y="${(py-6).toFixed(1)}" width="12" height="12" fill="rgba(126,200,122,0.2)" stroke="#7ec87a" stroke-width="1.4"/>`;
      } else {
        dsoHTML += `<rect x="${(px-5).toFixed(1)}" y="${(py-5).toFixed(1)}" width="10" height="10" fill="none" stroke="#a89060" stroke-width="1.2"/>`;
      }
      const nName = (n.obj.name || '').replace(/</g, '&lt;');
      dsoHTML += `<text x="${(px + 12).toFixed(1)}" y="${(py + 4).toFixed(1)}" font-family="Space Mono, monospace" font-size="10" fill="#6fa6c8" style="text-shadow: 0 0 3px #000;">${nName}</text>`;
    }

    // Target marker (gold crosshair, prominent)
    const targetHTML = `
      <g>
        <ellipse cx="${CX}" cy="${CY}" rx="16" ry="10" fill="rgba(212,170,80,0.15)" stroke="#d4aa50" stroke-width="2.5"/>
        <line x1="${CX-12}" y1="${CY}" x2="${CX-24}" y2="${CY}" stroke="#d4aa50" stroke-width="2"/>
        <line x1="${CX+12}" y1="${CY}" x2="${CX+24}" y2="${CY}" stroke="#d4aa50" stroke-width="2"/>
        <line x1="${CX}" y1="${CY-10}" x2="${CX}" y2="${CY-22}" stroke="#d4aa50" stroke-width="2"/>
        <line x1="${CX}" y1="${CY+10}" x2="${CX}" y2="${CY+22}" stroke="#d4aa50" stroke-width="2"/>
        <text x="${CX+20}" y="${CY-14}" font-family="Space Mono, monospace" font-size="13" font-weight="bold" fill="#d4aa50" style="text-shadow: 0 0 4px #000;">${(o.name || '').replace(/</g, '&lt;')}</text>
      </g>`;

    // Aladin div id (separate from FOV aladin)
    const aladinId = 'dap-const-aladin-' + (++constAladinCounter);

    // Build neighbor list HTML
    let neighborListHTML = '';
    for (const n of neighbors.slice(0, 8)) {
      const t = (n.obj.type || '').toLowerCase();
      let icon = '◇';
      if (/galaxy|spiral|sa|sb|sc|elliptical/.test(t)) icon = '⬭';
      else if (/cluster|globular/.test(t)) icon = '○';
      else if (/nebula/.test(t)) icon = '▢';
      else if (/star|double/.test(t)) icon = '●';
      const name = (n.obj.name || '').replace(/</g, '&lt;');
      const typeShort = (n.obj.type || '').toLowerCase().split(/[\s,]+/)[0];
      neighborListHTML += `
        <div class="dap-const-neighbor">
          <span class="icon">${icon}</span>
          <span class="name">${name} <span class="common">· ${typeShort}</span></span>
          <span class="dist">${n.sep.toFixed(1)}°</span>
        </div>`;
    }

    const catalogSize = catalog.length;
    const neighborsBlock = neighbors.length === 0
      ? (catalogSize === 0
          ? `<div class="dap-const-empty">Catalog not accessible from this section.</div>`
          : `<div class="dap-const-empty">No other catalog targets within ${FOV_DEG}° of this one.<br>(${catalogSize} objects searched)</div>`)
      : `<div class="dap-const-neighbors-title">Notable nearby catalog objects · sorted by angular distance</div>
         <div class="dap-const-neighbors-list">${neighborListHTML}</div>`;

    const inCatalogCount = neighbors.length;
    const summaryNote = inCatalogCount > 0
      ? `★ in your catalog: ${inCatalogCount} object${inCatalogCount === 1 ? '' : 's'} within ${FOV_DEG}°`
      : '';

    return `<div class="dp-section">
      <div class="dp-section-title">Constellation Context</div>
      <div class="dap-const-card">
        <div class="dap-const-head">
          <div class="dap-const-name">${constName}<span class="latin">${constAbbr}</span></div>
          <div class="dap-const-info">${FOV_DEG}° wide-field view · DSS sky image with constellation overlay</div>
        </div>
        <div class="dap-const-viewer" data-const-aladin-id="${aladinId}">
          <div class="dap-const-aladin" id="${aladinId}"></div>
          <svg class="dap-const-overlay" viewBox="0 0 ${SVG_W} ${SVG_H}" preserveAspectRatio="xMidYMid slice">
            ${linesHTML}
            ${starsHTML}
            ${dsoHTML}
            ${labelsHTML}
            ${targetHTML}
          </svg>
        </div>
        <div class="dap-const-legend">
          <span class="item"><span class="sw target"></span>Your target</span>
          <span class="item"><span class="sw" style="background: rgba(212,170,80,0.7);"></span>Current constellation</span>
          <span class="item"><span class="sw galaxy"></span>Catalog galaxy</span>
          <span class="item"><span class="sw" style="background: #9070c8;"></span>Catalog cluster</span>
          <span class="item" style="margin-left: auto; color: #d4aa50;">${summaryNote}</span>
        </div>
        <div class="dap-const-neighbors">
          ${neighborsBlock}
        </div>
      </div>
    </div>`;
  }

  function initConstellationAladin(viewerEl, o) {
    if (typeof A === 'undefined') {
      setTimeout(() => initConstellationAladin(viewerEl, o), 200);
      return;
    }
    const id = viewerEl.dataset.constAladinId;
    if (!id || constAladinInstances[id]) return;
    const c = parseCoords(o);
    if (!c) return;
    const raDeg = c.raDeg, decDeg = c.decDeg;
    A.init.then(() => {
      try {
        const aladin = A.aladin('#' + id, {
          survey: 'P/DSS2/color',
          fov: 30.0,
          target: `${raDeg} ${decDeg}`,
          showReticle: false,
          showZoomControl: false,
          showLayersControl: false,
          showGotoControl: false,
          showFullscreenControl: false,
          showSimbadPointerControl: false,
          showFrame: false,
          cooFrame: 'J2000'
        });
        constAladinInstances[id] = aladin;
      } catch (err) {
        console.error('[DAP patch] constellation Aladin init failed:', err);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // WORLDWIDE TELESCOPE EMBED + EXTERNAL SKY TOOLS
  // ─────────────────────────────────────────────────────────────────
  // Embeds the WWT Research App (web.wwtassets.org/research/latest/) as an
  // iframe, positioned on the current target via postMessage. WWT is
  // purpose-built for iframe embedding by the AAS/NumFOCUS team — see
  // https://docs.worldwidetelescope.org/research-app/latest/embedding/
  //
  // Below the iframe, four cards link out to other sky tools (Stellarium Web,
  // Aladin, SIMBAD, NED) for deeper exploration.

  let wwtCounter = 0;

  // Strip spaces from object name for URLs that don't tolerate them
  function stripSpaces(s) {
    return String(s || '').replace(/\s+/g, '');
  }

  // Try to get the cleanest catalog identifier for the object
  function externalToolName(o) {
    if (!o) return '';
    const candidates = [
      o.name, o.aka, ...(o.aliases || [])
    ].filter(Boolean);
    // Prefer Messier or NGC/IC formats
    for (const c of candidates) {
      const stripped = stripSpaces(c);
      if (/^M\d+$/i.test(stripped) || /^NGC\d+$/i.test(stripped) || /^IC\d+$/i.test(stripped)) {
        return stripped;
      }
    }
    return stripSpaces(o.name);
  }

  function buildWWTHTML(o) {
    const c = parseCoords(o);
    if (!c) return '';
    const name = (o.name || '').replace(/</g, '&lt;');
    const cleanName = externalToolName(o);
    const raDeg = c.raDeg;
    const decDeg = c.decDeg;
    const wwtId = 'dap-wwt-' + (++wwtCounter);

    // External tool URLs (links below the WWT embed)
    const stellariumUrl = cleanName
      ? `https://stellarium-web.org/skysource/${encodeURIComponent(cleanName)}?fov=2`
      : `https://stellarium-web.org/`;
    const aladinUrl = `https://aladin.cds.unistra.fr/AladinLite/?target=${raDeg.toFixed(5)}%20${decDeg.toFixed(5)}&fov=1&survey=P%2FDSS2%2Fcolor`;
    const simbadUrl = cleanName
      ? `https://simbad.u-strasbg.fr/simbad/sim-id?Ident=${encodeURIComponent(cleanName)}`
      : `https://simbad.u-strasbg.fr/simbad/sim-coo?Coord=${raDeg.toFixed(5)}+${decDeg.toFixed(5)}&Radius=2&Radius.unit=arcmin`;
    const nedUrl = cleanName
      ? `https://ned.ipac.caltech.edu/byname?objname=${encodeURIComponent(cleanName)}`
      : `https://ned.ipac.caltech.edu/conesearch?coordinates=${raDeg.toFixed(5)}%20${decDeg.toFixed(5)}&radius=2&in_csys=Equatorial&in_equinox=J2000.0`;

    // Also build a goto URL for opening WWT in a new tab pre-positioned.
    // Zoom is 6×FOV in degrees; 2° FOV → zoom = 12
    const wwtGotoUrl = `https://worldwidetelescope.org/wwtweb/goto.aspx?object=${encodeURIComponent(cleanName || 'target')}&ra=${(raDeg / 15).toFixed(6)}&dec=${decDeg.toFixed(6)}&zoom=12`;

    return `<div class="dp-section">
      <div class="dp-section-title">Interactive Sky View · WorldWide Telescope</div>
      <div class="dap-wwt-card">
        <div class="dap-wwt-head">
          <div class="dap-wwt-title">${name} in WWT · interactive sky atlas with deep imagery from major surveys</div>
          <a href="${wwtGotoUrl}" target="_blank" rel="noopener" class="dap-wwt-newtab">Open in new tab ↗</a>
        </div>
        <div class="dap-wwt-viewer"
             data-wwt-id="${wwtId}"
             data-wwt-ra="${raDeg.toFixed(6)}"
             data-wwt-dec="${decDeg.toFixed(6)}"
             data-wwt-name="${name}">
          <div class="dap-wwt-loading">
            <div class="dap-wwt-spinner"></div>
            <div class="dap-wwt-loading-text">Loading WorldWide Telescope</div>
          </div>
          <iframe
            class="dap-wwt-iframe"
            data-wwt-base-src="https://web.wwtassets.org/research/latest/"
            allow="accelerometer; clipboard-write; gyroscope"
            allowfullscreen
            frameborder="0"
            title="WorldWide Telescope showing ${name}"></iframe>
        </div>
        <div class="dap-wwt-note">
          <span class="gold">Pan + drag</span> to look around · <span class="gold">scroll</span> to zoom ·
          constellation figures and labels are on by default · use WWT's layer controls to toggle more.
        </div>

        <div class="dap-ext-divider">Or open in another tool</div>
        <div class="dap-ext-grid">
          <a href="${stellariumUrl}" target="_blank" rel="noopener" class="dap-ext-tool">
            <div class="dap-ext-name">Stellarium Web ↗</div>
            <div class="dap-ext-desc">Naked-eye simulated sky with atmosphere &amp; constellation art</div>
            <div class="dap-ext-host">stellarium-web.org</div>
          </a>
          <a href="${aladinUrl}" target="_blank" rel="noopener" class="dap-ext-tool">
            <div class="dap-ext-name">Aladin Sky Atlas ↗</div>
            <div class="dap-ext-desc">VizieR catalog overlays, region tools, HiPS surveys</div>
            <div class="dap-ext-host">aladin.cds.unistra.fr</div>
          </a>
          <a href="${simbadUrl}" target="_blank" rel="noopener" class="dap-ext-tool">
            <div class="dap-ext-name">SIMBAD ↗</div>
            <div class="dap-ext-desc">Object database — measurements, references, IDs</div>
            <div class="dap-ext-host">simbad.u-strasbg.fr</div>
          </a>
          <a href="${nedUrl}" target="_blank" rel="noopener" class="dap-ext-tool">
            <div class="dap-ext-name">NED ↗</div>
            <div class="dap-ext-desc">Extragalactic — redshifts, distances, multi-wavelength</div>
            <div class="dap-ext-host">ned.ipac.caltech.edu</div>
          </a>
        </div>
      </div>
    </div>`;
  }

  // Send a postMessage to the WWT iframe asking it to center on coordinates.
  // Per WWT docs at docs.worldwidetelescope.org/research-app/latest/controlling/
  // and message spec at .../webgl-reference/latest/apiref/research-app-messages/
  function sendWWTGoto(iframe, raDeg, decDeg) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage({
        event: 'center_on_coordinates',
        ra: raDeg,
        dec: decDeg,
        fov: 2.0,
        roll: 0,
        instant: false  // smooth pan — better UX while WWT streams tiles
      }, 'https://web.wwtassets.org');
    } catch (err) {
      console.warn('[DAP patch] WWT postMessage failed:', err);
    }
  }

  // Send a setting change command to WWT. Setting names follow the pywwt
  // convention (constellation_figures, constellation_labels, etc).
  // See pywwt.readthedocs.io/en/stable/api/pywwt.BaseWWTWidget.html
  function sendWWTSetting(iframe, setting, value) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage({
        event: 'setting_set',
        setting: setting,
        value: value
      }, 'https://web.wwtassets.org');
      console.debug('[DAP patch] WWT setting sent:', setting, '=', value);
    } catch (err) {
      console.warn('[DAP patch] WWT setting failed:', setting, err);
    }
  }

  // Apply our default visual settings to a WWT iframe.
  //
  // WWT setting names are tricky: the engine uses camelCase (showConstellationFigures),
  // pywwt uses snake_case (constellation_figures), and the docs are ambiguous about
  // which one the research-app's setting_set message handler accepts. To maximize
  // the chance of success, we send BOTH naming conventions. WWT will accept whichever
  // it understands and ignore the others.
  //
  // Note "Boundries" is intentionally misspelled — that's the actual name in the
  // WWT engine API (a long-standing typo preserved for backward compatibility).
  function applyWWTDefaults(iframe) {
    // Constellation figures (stick-figure lines)
    sendWWTSetting(iframe, 'constellation_figures', true);
    sendWWTSetting(iframe, 'showConstellationFigures', true);

    // Constellation labels (names)
    sendWWTSetting(iframe, 'constellation_labels', true);
    sendWWTSetting(iframe, 'showConstellationLabels', true);

    // Master constellations switch (some WWT versions need this)
    sendWWTSetting(iframe, 'showConstellations', true);
    sendWWTSetting(iframe, 'constellations_enabled', true);
  }

  // Track which WWT iframes have heard back from WWT (proving WWT is alive)
  const wwtAlive = new WeakSet();
  const wwtPositioned = new WeakSet();
  let wwtListenerInstalled = false;

  // Install a single window-level listener for WWT messages. WWT periodically
  // broadcasts ViewStateMessage; receiving one tells us WWT is alive and
  // listening. Until that point, our goto commands fall on deaf ears.
  function installWWTListener() {
    if (wwtListenerInstalled) return;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    wwtListenerInstalled = true;
    window.addEventListener('message', (ev) => {
      // Only listen to messages from the WWT origin
      if (ev.origin !== 'https://web.wwtassets.org') return;
      // Find which iframe this came from
      const iframes = document.querySelectorAll('iframe.dap-wwt-iframe');
      for (const iframe of iframes) {
        if (iframe.contentWindow === ev.source) {
          // This iframe is alive! Send the goto if we haven't already
          if (!wwtAlive.has(iframe)) {
            wwtAlive.add(iframe);
            const viewer = iframe.closest('[data-wwt-id]');
            if (viewer && !wwtPositioned.has(iframe)) {
              const raDeg = parseFloat(viewer.dataset.wwtRa);
              const decDeg = parseFloat(viewer.dataset.wwtDec);
              // Small delay to be safe — WWT may have just become message-capable
              // but not yet view-control-capable
              setTimeout(() => {
                sendWWTGoto(iframe, raDeg, decDeg);
                applyWWTDefaults(iframe);
                wwtPositioned.add(iframe);
              }, 200);
            }
          }
          break;
        }
      }
    });
  }

  // Wire up each WWT iframe.
  // The right way to know WWT is ready: it periodically broadcasts
  // ViewStateMessage. We listen for any message from the WWT origin and use
  // that as our "alive" signal, then send the goto.
  function initWWT() {
    installWWTListener();
    document.querySelectorAll('[data-wwt-id]').forEach(viewer => {
      if (viewer.dataset.wired) return;
      viewer.dataset.wired = '1';
      const iframe = viewer.querySelector('iframe');
      const loading = viewer.querySelector('.dap-wwt-loading');
      const raDeg = parseFloat(viewer.dataset.wwtRa);
      const decDeg = parseFloat(viewer.dataset.wwtDec);
      if (!iframe) return;

      // CRITICAL: WWT requires an ?origin= parameter in its iframe URL,
      // otherwise it refuses to listen to postMessage commands as a security
      // precaution. Without this, the goto command is silently dropped and
      // you see "WWT embed: no '?origin=' given" in the console.
      const baseSrc = iframe.dataset.wwtBaseSrc || 'https://web.wwtassets.org/research/latest/';
      const parentOrigin = (typeof window !== 'undefined' && window.location)
        ? window.location.origin
        : '';
      if (!iframe.src && parentOrigin) {
        const sep = baseSrc.indexOf('?') === -1 ? '?' : '&';
        iframe.src = `${baseSrc}${sep}origin=${encodeURIComponent(parentOrigin)}`;
      } else if (!iframe.src) {
        iframe.src = baseSrc;
      }

      iframe.addEventListener('load', () => {
        if (loading) loading.style.display = 'none';
        // Belt-and-suspenders: send the goto at intervals too, in case the
        // message listener doesn't fire (e.g. ad-blockers, browser extensions
        // interfering). If the listener does fire first, wwtPositioned will be
        // set and these become no-ops.
        const intervals = [2000, 4000, 7000, 12000];
        intervals.forEach(delay => {
          setTimeout(() => {
            if (!wwtPositioned.has(iframe)) {
              sendWWTGoto(iframe, raDeg, decDeg);
              applyWWTDefaults(iframe);
            }
          }, delay);
        });
      });

      // If iframe doesn't load within 20 seconds, show fallback link
      setTimeout(() => {
        if (loading && loading.style.display !== 'none') {
          loading.innerHTML = `
            <div style="font-family: var(--mono, 'Space Mono', monospace); font-size: 11px; color: #c86060; text-align: center; padding: 0 20px;">
              <div style="margin-bottom: 6px;">WorldWide Telescope took longer than expected to load.</div>
              <a href="https://web.wwtassets.org/research/latest/" target="_blank" rel="noopener" style="color: #d4aa50; text-decoration: underline;">Open WWT in a new tab ↗</a>
            </div>`;
        }
      }, 20000);
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // SURFACE BRIGHTNESS OVERLAY
  // ─────────────────────────────────────────────────────────────────
  // For galaxies and nebulae: overlay computed isophote contours on
  // the existing DSS image. Contours computed from object size + type.
  // Integration times are heuristic for the Lacerta 250 + QHY 268M
  // at a Bortle 1.5 site.

  function isExtendedObject(o) {
    const t = (o.type || '').toLowerCase();
    return /galaxy|sa|sb|sc|elliptical|spiral|nebula/.test(t);
  }

  // Parse "12.6 x 7.2" or "12.6'" → returns { w, h } in arcmin
  function parseObjectSize(sizeStr) {
    if (!sizeStr) return null;
    const s = String(sizeStr);
    const m = s.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/);
    if (m) return { w: parseFloat(m[1]), h: parseFloat(m[2]) };
    const single = s.match(/(\d+(?:\.\d+)?)/);
    if (single) return { w: parseFloat(single[1]), h: parseFloat(single[1]) };
    return null;
  }

  // Compute approximate isophote semi-major axes (in fraction of D25)
  // based on galaxy type. Returns array of {muLevel, axisFrac, color}.
  function computeIsophotes(o) {
    const t = (o.type || '').toLowerCase();
    // Profile: how surface brightness drops off with radius.
    // Sb spirals like M63 have intermediate concentration; E/S0 are steep;
    // Sd/Im are diffuse. Numbers are heuristic.
    let profile = 'spiral';
    if (/elliptical|e0|e1|e2|e3|e4|e5|e6|e7|s0/.test(t)) profile = 'elliptical';
    else if (/sd|sm|im|irr/.test(t)) profile = 'diffuse';

    // axisFrac = radius at which surface brightness reaches mu level,
    // expressed as fraction of D25 (which is ~ μ=25 isophote).
    // Different profiles fall off differently.
    let contours;
    if (profile === 'elliptical') {
      contours = [
        { mu: 20, frac: 0.10, color: '#fff8e0' },
        { mu: 22, frac: 0.30, color: '#ffcb70' },
        { mu: 24, frac: 0.65, color: '#ff8a40' },
        { mu: 25, frac: 1.00, color: '#c86060' },
        { mu: 26, frac: 1.40, color: '#9070c8' },
        { mu: 27, frac: 1.85, color: '#3050a0' }
      ];
    } else if (profile === 'diffuse') {
      contours = [
        { mu: 21, frac: 0.25, color: '#fff8e0' },
        { mu: 22, frac: 0.50, color: '#ffcb70' },
        { mu: 23, frac: 0.75, color: '#ff8a40' },
        { mu: 25, frac: 1.00, color: '#c86060' },
        { mu: 26, frac: 1.30, color: '#9070c8' },
        { mu: 27, frac: 1.70, color: '#3050a0' }
      ];
    } else {  // spiral
      contours = [
        { mu: 20, frac: 0.12, color: '#fff8e0' },
        { mu: 22, frac: 0.35, color: '#ffcb70' },
        { mu: 23, frac: 0.55, color: '#ff8a40' },
        { mu: 25, frac: 1.00, color: '#c86060' },
        { mu: 26, frac: 1.35, color: '#9070c8' },
        { mu: 27, frac: 1.80, color: '#3050a0' }
      ];
    }
    return contours;
  }

  // Heuristic integration time required to reach a given μ depth
  // for the Lacerta 250 (f/4) + QHY 268M at Bortle 1.5
  function integrationTimeForMu(mu) {
    // Sky background at Bortle 1.5 is roughly μ_sky ≈ 21.8 (V band)
    // For each magnitude fainter than sky, integration grows ~3x.
    if (mu <= 19) return 'a few min';
    if (mu <= 20) return '~ 15 min L';
    if (mu <= 21) return '~ 30 min L';
    if (mu <= 22) return '~ 1 hr L';
    if (mu <= 23) return '~ 2 hr L';
    if (mu <= 24) return '~ 4 hr LRGB';
    if (mu <= 25) return '~ 8 hr LRGB';
    if (mu <= 26) return '~ 15 hr LRGB';
    return '~ 25+ hr dark site';
  }

  function buildSurfaceBrightnessHTML(o) {
    if (!isExtendedObject(o)) return '';
    const size = parseObjectSize(o.size);
    if (!size) return '';

    const c = parseCoords(o);
    if (!c) return '';

    const contours = computeIsophotes(o);
    const name = (o.name || '').replace(/</g, '&lt;');

    // DSS image URL — reuse host's dssUrl function if available
    let dssSrc = '';
    if (typeof window.dssUrl === 'function') {
      try {
        dssSrc = window.dssUrl(o.ra, o.dec, parseFloat(o.size) || 15, 800);
      } catch (e) { /* fall through */ }
    }

    // SVG dimensions: matches the .dap-sb-viewer aspect 16:11
    const SVG_W = 800, SVG_H = 550;
    const CX = SVG_W / 2, CY = SVG_H / 2;

    // Galaxy D25 occupies ~60% of viewer width by design
    const d25PixelsW = SVG_W * 0.55;
    const aspect = size.h / size.w;

    // Get rotation from object data if present; default 38° for visual variety
    const rotation = parseFloat(o.pa) || 38;

    // Build contour ellipses
    let contoursHTML = '';
    let keyHTML = '';
    let i = 0;
    for (const ct of contours) {
      const rx = (d25PixelsW / 2) * ct.frac;
      const ry = rx * aspect;
      contoursHTML += `<ellipse cx="${CX}" cy="${CY}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="${ct.color}" stroke-width="1.4" opacity="${(0.85 - i * 0.05).toFixed(2)}" transform="rotate(${rotation} ${CX} ${CY})"/>`;

      // Label at the right edge of the ellipse, also rotated
      const labelAngle = rotation * Math.PI / 180;
      const lx = CX + rx * Math.cos(labelAngle);
      const ly = CY + rx * Math.sin(labelAngle);
      contoursHTML += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-family="Space Mono, monospace" font-size="10" fill="${ct.color}" opacity="0.9">μ=${ct.mu}</text>`;

      const lev = `lev${Math.min(i + 1, 6)}`;
      const desc = ct.mu <= 20 ? 'Bright nucleus' :
                   ct.mu <= 22 ? 'Inner disk' :
                   ct.mu <= 23 ? 'Mid disk' :
                   ct.mu <= 25 ? 'Outer arms' :
                   ct.mu <= 26 ? 'Faint halo' :
                   'Deep tidal';
      keyHTML += `<div class="dap-sb-key-cell ${lev}">
        <span class="lab">μ ${ct.mu === 20 ? '≤ 20' : '= ' + ct.mu}</span>
        <span class="val">${desc}</span>
        <span class="time">${integrationTimeForMu(ct.mu)}</span>
      </div>`;
      i++;
    }

    // Callout — synthesize a recommendation
    const tShort = (o.type || 'extended object').split(/[\s,]+/)[0];
    const calloutHTML = `<div class="dap-sb-callout">
      <strong>★ For ${name} with your rig:</strong>
      The inner disk (μ ≤ 23) is reachable in <span class="gold">~ 2 hr of L</span>.
      For the outer structure (μ ≈ 25), plan <span class="gold">~ 8 hr LRGB</span>
      from your Bortle 1.5 site. Anything fainter (μ ≥ 26) needs
      <span class="gold">15+ hr</span> on truly dark nights.
    </div>`;

    const imgSrc = dssSrc
      ? `<img src="${escAttr(dssSrc)}" alt="${name} optical" onerror="this.style.display='none'">`
      : '';

    return `<div class="dp-section">
      <div class="dp-section-title">Surface Brightness · Optical Overlay<span class="dap-mu-info">μ?<span class="dap-mu-tooltip"><strong>μ (mu)</strong> is surface brightness — magnitudes per square arcsecond. It measures how bright the object appears <em>per unit area</em> of sky.<br><br>A galaxy with total mag 9 spreads that light over many arcsec², so its <em>per-area</em> brightness is much fainter — typically μ = 22–25. As your integration time grows, you reach progressively fainter μ.<br><br><strong>Reference:</strong> Bortle 1 sky ≈ μ 21.8. Detecting features fainter than this is the whole game of deep imaging.</span></span></div>
      <div class="dap-sb-card">
        <div class="dap-sb-controls">
          <div class="dap-sb-slider">
            <span>Contour opacity</span>
            <input type="range" min="0" max="100" value="75" data-role="sb-opacity">
            <span data-role="sb-opacity-val" style="color: #d4aa50; min-width: 30px;">75%</span>
          </div>
          <div style="font-family: var(--mono, 'Space Mono', monospace); font-size: 9px; color: #5a4a28; text-transform: uppercase; letter-spacing: 0.1em;">
            ${tShort} · D25 ≈ ${size.w.toFixed(1)}′ × ${size.h.toFixed(1)}′
          </div>
        </div>
        <div class="dap-sb-viewer">
          ${imgSrc}
          <svg class="contours" viewBox="0 0 ${SVG_W} ${SVG_H}" preserveAspectRatio="xMidYMid slice" data-role="sb-contours" style="opacity: 0.75;">
            ${contoursHTML}
            <line x1="15" y1="${SVG_H - 25}" x2="${15 + (d25PixelsW / size.w * 2).toFixed(0)}" y2="${SVG_H - 25}" stroke="#d4aa50" stroke-width="1.5"/>
            <text x="${15 + (d25PixelsW / size.w * 2 / 2).toFixed(0)}" y="${SVG_H - 30}" text-anchor="middle" font-family="Space Mono, monospace" font-size="10" fill="#d4aa50">2′</text>
            <g transform="translate(${SVG_W - 40}, 35)">
              <line x1="0" y1="0" x2="0" y2="-18" stroke="#d4aa50" stroke-width="1"/>
              <text x="0" y="-22" text-anchor="middle" font-family="Space Mono, monospace" font-size="9" fill="#d4aa50">N</text>
              <line x1="0" y1="0" x2="-18" y2="0" stroke="#d4aa50" stroke-width="1"/>
              <text x="-26" y="3" text-anchor="middle" font-family="Space Mono, monospace" font-size="9" fill="#d4aa50">E</text>
            </g>
          </svg>
          <div class="dap-sb-img-label">${name} · isophotes on DSS2</div>
        </div>
        <div class="dap-sb-key">${keyHTML}</div>
        ${calloutHTML}
      </div>
    </div>`;
  }

  // Wire up the opacity slider after render
  function initSurfaceBrightness() {
    document.querySelectorAll('[data-role="sb-opacity"]').forEach(slider => {
      if (slider.dataset.wired) return;
      slider.dataset.wired = '1';
      const card = slider.closest('.dap-sb-card');
      const contours = card.querySelector('[data-role="sb-contours"]');
      const valLabel = card.querySelector('[data-role="sb-opacity-val"]');
      slider.addEventListener('input', e => {
        const v = parseInt(e.target.value);
        contours.style.opacity = (v / 100).toString();
        valLabel.textContent = v + '%';
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // EXOPLANET DETAIL PANEL · FINDER CHART
  // ─────────────────────────────────────────────────────────────────
  // Adds a finder chart section to the exoplanet detail panel (the one
  // that opens when you click a transit row's planet name).
  //
  // Same pattern as the catalog FOV viewer: an Aladin Lite instance
  // showing DSS2 color centered on the host star, with a FOV box overlay
  // matching the Lacerta 10″ + QHY 268M rig (80.4′ × 54′).
  //
  // Hooks into window.exoBuildDetailPanel() which is the function in the
  // host index.html that renders the detail panel HTML.

  let exoFinderCounter = 0;
  const exoFinderInstances = {};  // id → Aladin instance

  function buildExoFinderChartHTML(p, t) {
    // p has p.ra and p.dec as decimal degrees (already parsed via parseFloat)
    if (!p || isNaN(p.ra) || isNaN(p.dec)) {
      return '';  // can't build a finder without coordinates
    }
    const raDeg = p.ra;
    const decDeg = p.dec;
    const id = 'dap-exo-finder-' + (++exoFinderCounter);
    const hostName = (p.host || p.name || '').replace(/</g, '&lt;');
    const planetName = (p.name || '').replace(/</g, '&lt;');

    // Honest design: the section uses .exo-detail-section to match the host's
    // existing styling. The inner viewer uses our own classes so it doesn't
    // collide with the catalog FOV viewer's styles.
    return `
      <div class="exo-detail-section">
        <h4>Finder chart</h4>
        <div class="dap-exo-finder-card">
          <div class="dap-exo-finder-meta">
            Centered on <span class="dap-exo-finder-host">${hostName}</span>
            · RA ${raDeg.toFixed(5)}° · Dec ${decDeg.toFixed(5)}°
            · Gold box = Lacerta 10″ + QHY 268M FOV (${CONFIG.rigFovWidthArcmin.toFixed(1)}′ × ${CONFIG.rigFovHeightArcmin.toFixed(1)}′)
          </div>
          <div class="dap-exo-finder-viewer"
               data-exo-finder-id="${id}"
               data-exo-ra="${raDeg.toFixed(6)}"
               data-exo-dec="${decDeg.toFixed(6)}"
               data-exo-name="${planetName}">
            <div class="dap-exo-finder-aladin" id="${id}"></div>
            <div class="dap-exo-finder-fov-overlay" data-role="exo-fov-overlay"></div>
            <div class="dap-exo-finder-loading">
              <div class="dap-exo-finder-spinner"></div>
              <div class="dap-exo-finder-loading-text">Loading sky imagery</div>
            </div>
          </div>
          <div class="dap-exo-finder-hint">
            <span class="gold">Drag</span> to pan · <span class="gold">scroll</span> to zoom ·
            FOV box scales automatically with zoom level.
          </div>
        </div>
      </div>`;
  }

  function initExoFinderChart(viewerEl) {
    // Bounded retry counter so we never loop forever
    viewerEl._dapInitAttempts = (viewerEl._dapInitAttempts || 0) + 1;
    const MAX_ATTEMPTS = 40;  // 40 × 250ms = 10 seconds of retry budget

    function showError(msg, sub) {
      const loading = viewerEl.querySelector('.dap-exo-finder-loading');
      if (!loading) return;
      loading.innerHTML = `
        <div style="color: #c86060; font-family: var(--mono, 'Space Mono', monospace); font-size: 11px; text-align: center; padding: 0 20px;">
          <div style="margin-bottom: 6px;">${msg}</div>
          ${sub ? `<div style="color: #5a4a28; font-size: 10px;">${sub}</div>` : ''}
        </div>`;
    }

    if (viewerEl._dapInitAttempts > MAX_ATTEMPTS) {
      console.warn('[DAP patch] exo finder: gave up after', MAX_ATTEMPTS, 'attempts');
      showError('Could not load finder chart', 'Init timeout. Check browser console.');
      return;
    }

    if (typeof A === 'undefined') {
      console.debug('[DAP patch] Aladin lib not loaded yet for exo finder, attempt', viewerEl._dapInitAttempts);
      setTimeout(() => initExoFinderChart(viewerEl), 250);
      return;
    }

    const id = viewerEl.dataset.exoFinderId;
    if (!id) {
      console.warn('[DAP patch] exo finder: no data-exo-finder-id on viewer');
      showError('Internal error: missing viewer id');
      return;
    }
    if (exoFinderInstances[id]) {
      console.debug('[DAP patch] exo finder already initialized for', id);
      return;
    }

    const raDeg = parseFloat(viewerEl.dataset.exoRa);
    const decDeg = parseFloat(viewerEl.dataset.exoDec);
    if (isNaN(raDeg) || isNaN(decDeg)) {
      console.warn('[DAP patch] exo finder: invalid coords on viewer', viewerEl.dataset);
      showError('No coordinates available for this target');
      return;
    }

    // Verify the element is actually visible. Detail panel uses overlay flex
    // layout that may not be settled the moment we run.
    const rect = viewerEl.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) {
      console.debug('[DAP patch] exo finder viewer sized', rect.width, 'x', rect.height, '— retrying, attempt', viewerEl._dapInitAttempts);
      setTimeout(() => initExoFinderChart(viewerEl), 250);
      return;
    }

    const targetDiv = viewerEl.querySelector('#' + id);
    if (!targetDiv) {
      console.warn('[DAP patch] exo finder: inner div #' + id + ' not found in viewer', viewerEl);
      showError('Internal error: viewer container missing');
      return;
    }

    const loading = viewerEl.querySelector('.dap-exo-finder-loading');
    const fovOverlay = viewerEl.querySelector('[data-role="exo-fov-overlay"]');

    // Default FOV: 3× the rig FOV width, so target field plus useful context
    const defaultFovDeg = (CONFIG.rigFovWidthArcmin / 60) * 3;

    console.debug(`[DAP patch] exo finder: initializing Aladin at ${raDeg.toFixed(4)}, ${decDeg.toFixed(4)} (id=${id}, fov=${defaultFovDeg.toFixed(3)}°)`);

    // Sanity-check that A.init is a Promise (Aladin v3 API)
    if (!A.init || typeof A.init.then !== 'function') {
      console.error('[DAP patch] exo finder: A.init is not a Promise. Aladin API mismatch?', A.init);
      showError('Aladin Lite API mismatch', 'A.init is not a Promise. Check Aladin version.');
      return;
    }

    // Belt-and-suspenders: if A.init.then never resolves, show error after 15s
    let resolved = false;
    setTimeout(() => {
      if (!resolved && !exoFinderInstances[id]) {
        console.warn('[DAP patch] exo finder: A.init.then never resolved after 15s for', id);
        showError('Aladin took too long to initialize', 'A.init promise did not resolve in 15s.');
      }
    }, 15000);

    A.init.then(() => {
      resolved = true;
      try {
        const aladin = A.aladin('#' + id, {
          survey: 'P/DSS2/color',
          fov: defaultFovDeg,
          target: `${raDeg} ${decDeg}`,
          showReticle: false,
          showZoomControl: true,
          showLayersControl: false,
          showGotoControl: false,
          showFullscreenControl: true,
          showSimbadPointerControl: true,
          showFrame: false,
          cooFrame: 'J2000'
        });
        exoFinderInstances[id] = aladin;
        if (loading) loading.style.display = 'none';
        console.debug('[DAP patch] exo finder: initialized successfully for', id);

        // FOV box scaling: keep gold rectangle matching the rig's physical FOV
        // as the user zooms.
        function updateFovOverlay() {
          if (!fovOverlay) return;
          const fov = aladin.getFov()[0];  // current FOV in degrees
          const rigW = CONFIG.rigFovWidthArcmin / 60;
          const rigH = CONFIG.rigFovHeightArcmin / 60;
          const wPct = (rigW / fov) * 100;
          const hPct = (rigH / fov) * 100;
          fovOverlay.style.width = wPct + '%';
          fovOverlay.style.height = hPct + '%';
          if (wPct > 90 || hPct > 90 || wPct < 1) {
            fovOverlay.style.display = 'none';
          } else {
            fovOverlay.style.display = 'block';
          }
        }
        updateFovOverlay();
        aladin.on('zoomChanged', updateFovOverlay);
        aladin.on('positionChanged', updateFovOverlay);
      } catch (err) {
        console.error('[DAP patch] exo finder: A.aladin() threw', err);
        showError('Aladin viewer failed to construct', (err && err.message) || 'unknown error');
      }
    }).catch(err => {
      console.error('[DAP patch] exo finder: A.init rejected', err);
      showError('Aladin failed to initialize', (err && err.message) || 'WebGL2 may be unavailable');
    });
  }

  // Hook exoBuildDetailPanel to append our finder section.
  // The host's exoBuildDetailPanel(p, t) returns the full detail panel HTML.
  // We wrap it: call the original, then insert our section before the
  // "External resources" section so it sits naturally in the flow.
  function installExoDetailHook() {
    if (typeof window.exoBuildDetailPanel !== 'function') {
      // The exo module loads lazily — keep retrying for up to 30 seconds.
      // After that, the user might just not be on the exo page; give up quietly.
      const attempts = (installExoDetailHook._attempts = (installExoDetailHook._attempts || 0) + 1);
      if (attempts < 60) {  // 60 × 500ms = 30s
        setTimeout(installExoDetailHook, 500);
      } else {
        console.debug('[DAP patch] exoBuildDetailPanel never appeared; exo finder hook skipped');
      }
      return;
    }
    if (installExoDetailHook._installed) return;
    installExoDetailHook._installed = true;

    const original = window.exoBuildDetailPanel;
    window.exoBuildDetailPanel = function patchedExoBuildDetailPanel(p, t) {
      let html = original(p, t);
      const finderHtml = buildExoFinderChartHTML(p, t);
      if (!finderHtml) return html;  // no coords, skip silently

      // Insert the finder chart immediately AFTER the System view section,
      // so the user can compare the system geometry (above) with the sky
      // position (below). System view is always present in the detail panel
      // (every planet has system geometry), so this anchor is reliable
      // regardless of which conditional sections come after it.
      //
      // Strategy: find the System view header, then find where the NEXT
      // exo-detail-section starts after it — that's the boundary where
      // our new section should land.
      const systemViewMarker = '<h4>System view</h4>';
      const systemViewIdx = html.indexOf(systemViewMarker);
      if (systemViewIdx !== -1) {
        // Find the start of the next section after System view
        const nextSectionMarker = '<div class="exo-detail-section';
        const nextSectionIdx = html.indexOf(nextSectionMarker, systemViewIdx + systemViewMarker.length);
        if (nextSectionIdx !== -1) {
          html = html.slice(0, nextSectionIdx) + finderHtml + html.slice(nextSectionIdx);
        } else {
          // System view is the last section — append after it.
          // Walk back from the panel end to find a sensible insertion point.
          html = html + finderHtml;
        }
      } else {
        // System view marker not found (unlikely but possible if the host
        // panel structure changes). Fall back to appending at the end.
        html = html + finderHtml;
      }

      // Init Aladin after the panel renders. The host's exoOpenPlanetDetail
      // assigns this HTML to overlay.innerHTML, so the DOM is ready a tick later.
      setTimeout(() => {
        document.querySelectorAll('[data-exo-finder-id]').forEach(viewer => {
          if (!exoFinderInstances[viewer.dataset.exoFinderId]) {
            initExoFinderChart(viewer);
          }
        });
      }, 150);
      return html;
    };
    console.log('[DAP patch] exo detail hook installed · finder chart will appear in transit detail panels');
  }

  // ─────────────────────────────────────────────────────────────────
  // EXOPLANET TRANSIT ROW ENHANCEMENTS
  // ─────────────────────────────────────────────────────────────────
  // Adds four decorations to each transit row in the table:
  //   #8  Baseline timing recommendation (ingress-1h → egress+1h)
  //   #10 NEA disposition badge from tfopwg_disp
  //   #3  Pulsing IN PROGRESS badge if right now is between ingress/egress
  //   #1  Live real-time clock indicator (pulsing line) on each glyph
  //
  // The host renders rows via renderExoTransits() which sets innerHTML
  // directly. We hook by wrapping renderExoTransits to walk the resulting
  // DOM and inject decorations using the cached transit data in
  // window._exoLastTransits and window._exoEphemerides.

  // Track the live-clock interval so we don't stack multiple
  let exoClockInterval = null;

  // Convert a Julian Date to a JS Date for comparison with current time
  function jdToDate(jd) {
    return new Date((jd - 2440587.5) * 86400000);
  }

  // Format a JD as local HH:MM time (matches host's jdToLocalTime style)
  function jdToHHMM(jd) {
    const d = jdToDate(jd);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // #8: Build baseline timing recommendation HTML
  function buildBaselineHTML(t) {
    if (!t || !t.ingressJD || !t.egressJD) return '';
    const baselineHr = 1.0;  // 1 hr baseline each side — standard for photometry detrending
    const startJD = t.ingressJD - baselineHr / 24;
    const endJD = t.egressJD + baselineHr / 24;
    const startTime = jdToHHMM(startJD);
    const endTime = jdToHHMM(endJD);
    const durHr = (endJD - startJD) * 24;
    const durH = Math.floor(durHr);
    const durM = Math.round((durHr - durH) * 60);
    return `
      <div class="dap-exo-baseline">
        <div class="dap-exo-baseline-label">Recommended capture</div>
        <div class="dap-exo-baseline-times">${startTime} → ${endTime}</div>
        <div class="dap-exo-baseline-dur">${durH}h ${durM}m · includes 1hr baseline ea. side</div>
      </div>`;
  }

  // #10: Build NEA disposition badge HTML from tfopwg_disp.
  // Dispositions: PC=planet candidate, APC=ambiguous, CP=confirmed,
  // KP=known planet. FP/FA already filtered out by the host fetch.
  function buildDispositionBadge(p) {
    if (!p || !p.disp) return '';
    const d = String(p.disp).trim().toUpperCase();
    const config = {
      'PC':  { label: 'Planet Candidate',  cls: 'pc' },
      'APC': { label: 'Ambiguous PC',      cls: 'apc' },
      'CP':  { label: 'Confirmed',         cls: 'cp' },
      'KP':  { label: 'Known Planet',      cls: 'kp' },
      'FA':  { label: 'False Alarm',       cls: 'fa' },
      'FP':  { label: 'False Positive',    cls: 'fa' }
    };
    const cfg = config[d];
    if (!cfg) return '';
    return `<span class="dap-exo-disp-badge dap-exo-disp-${cfg.cls}" title="TFOPWG disposition: ${d}">${cfg.label}</span>`;
  }

  // #3: Build phase-aware transit-in-progress badge if current time is between ingress and egress.
  // Three phases based on simple fractional position within the transit:
  //   first 25% of duration → "Ingressing"  (~45 min for a 3hr transit)
  //   middle 50%            → "Mid-transit" (~90 min for a 3hr transit)
  //   last 25%              → "Egressing"   (~45 min for a 3hr transit)
  //
  // Original v2.9 thresholds (10/90) were too narrow — Ingressing and
  // Egressing windows were only ~18 minutes each, often missed entirely
  // between 60-second clock ticks. The wider thresholds give meaningful
  // badge states throughout the transit and reflect informal operational
  // phases ("just started", "stable middle", "winding down") rather than
  // strict 2nd/3rd contact contact-time boundaries.
  function buildInProgressBadge(t) {
    if (!t || !t.ingressJD || !t.egressJD) {
      // Skip silent — these are predicted-only entries, expected to lack JDs
      return '';
    }
    const now = new Date();
    const nowJD = (now.getTime() / 86400000) + 2440587.5;
    if (nowJD < t.ingressJD) return '';  // before transit (silent — most rows hit this)
    if (nowJD > t.egressJD) return '';   // after transit (silent — most rows hit this)

    // Transit IS active. Compute phase and log it (this is the interesting case).
    const totalMin = Math.round((t.egressJD - t.ingressJD) * 24 * 60);
    const elapsedMin = Math.round((nowJD - t.ingressJD) * 24 * 60);
    const fraction = (nowJD - t.ingressJD) / (t.egressJD - t.ingressJD);
    const planetName = (t.planet && t.planet.name) || '?';

    let phase, phaseClass;
    if (fraction < 0.25) {
      phase = 'Ingressing';
      phaseClass = 'ingressing';
    } else if (fraction > 0.75) {
      phase = 'Egressing';
      phaseClass = 'egressing';
    } else {
      phase = 'Mid-transit';
      phaseClass = 'midtransit';
    }
    console.log(`[DAP patch] ACTIVE transit: ${planetName} · ${phase} · ${elapsedMin}/${totalMin} min (${(fraction*100).toFixed(0)}%)`);

    return `
      <span class="dap-exo-inprogress dap-exo-inprogress-${phaseClass}" title="Transit phase: ${phase} (${(fraction*100).toFixed(0)}% through)">
        <span class="dap-exo-inprogress-dot"></span>
        ${phase} · ${elapsedMin}/${totalMin} min
      </span>`;
  }

  // #1: Position the live-clock indicator on a glyph cell.
  //
  // Critical correction from v2.7: each glyph has its OWN time axis (the
  // transit's observable window), not a shared night-wide axis. Looking at
  // the host's exoBuildGlyph: x-axis spans observableSegments[0].jd to
  // observableSegments[last].jd, drawn within SVG viewBox 0..130 with data
  // padding from x=6 to x=124.
  //
  // So for each transit:
  //   - If now < obs window start: no line (transit hasn't started observable)
  //   - If now > obs window end:   no line (transit is over)
  //   - Otherwise: position line at percentage of cell width matching the
  //     transit's observable axis, accounting for SVG viewBox padding.
  function placeClockIndicatorOnCell(cellEl, t) {
    if (!cellEl || !t || !t.observableSegments || t.observableSegments.length === 0) {
      return;
    }
    const segStart = t.observableSegments[0].jd;
    const segEnd = t.observableSegments[t.observableSegments.length - 1].jd;
    if (!segStart || !segEnd || segEnd <= segStart) return;

    const now = new Date();
    const nowJD = (now.getTime() / 86400000) + 2440587.5;

    // Find or create the line element
    let line = cellEl.querySelector('.dap-exo-now-line');

    // Outside this transit's observable window? Hide and bail.
    if (nowJD < segStart || nowJD > segEnd) {
      if (line) line.style.display = 'none';
      return;
    }

    // The SVG has viewBox 0 0 130 30 with data spanning x=6 to x=124
    // (see exoBuildGlyph: X0=6, X1=124). Convert "fraction of data range"
    // into "fraction of total SVG width."
    const dataFrac = (nowJD - segStart) / (segEnd - segStart);
    const SVG_X0 = 6, SVG_X1 = 124, SVG_W = 130;
    const svgFrac = (SVG_X0 + dataFrac * (SVG_X1 - SVG_X0)) / SVG_W;
    const pct = svgFrac * 100;

    if (!line) {
      line = document.createElement('div');
      line.className = 'dap-exo-now-line';
      // Cell needs position: relative for absolute child positioning
      const cs = window.getComputedStyle(cellEl);
      if (cs.position === 'static') cellEl.style.position = 'relative';
      cellEl.appendChild(line);
    }
    line.style.display = 'block';
    line.style.left = pct.toFixed(2) + '%';
  }

  // (getActiveNightTwilight removed in v2.9 — each glyph now uses its own
  // observable-window time axis from t.observableSegments rather than a
  // shared night-wide twilight axis.)

  // Get the host's _exoLastTransits array.
  //
  // Original v2.8 fix used `new Function('return _exoLastTransits')()` to
  // access the host's let-scoped global. This works in Chrome/Firefox/Edge
  // and desktop Safari but is unreliable on iOS Safari due to strict-mode
  // quirks — sometimes returns undefined even when the variable exists.
  //
  // v2.18 fix: install a wrapper on the host's `exoComputeNightTransits`
  // function (function-declared, so reliably on window) that captures the
  // computed transits into `window._dapTransitCache`. This sidesteps the
  // let-scope problem entirely. See installDataCaptureHook below.
  function getExoTransits() {
    // Primary: the captured cache from our wrapper hook (works on iOS Safari)
    if (window._dapTransitCache && Array.isArray(window._dapTransitCache.transits)) {
      return window._dapTransitCache.transits;
    }
    // Fallback 1: directly on window
    if (typeof window._exoLastTransits !== 'undefined' && Array.isArray(window._exoLastTransits)) {
      return window._exoLastTransits;
    }
    // Fallback 2: Function constructor (unreliable on iOS Safari)
    try {
      const v = (new Function('return typeof _exoLastTransits !== "undefined" ? _exoLastTransits : null'))();
      if (Array.isArray(v)) return v;
    } catch (e) { /* fall through */ }
    return [];
  }

  // Get the host's _exoEphemerides array. Same three-tier strategy.
  function getExoEphemerides() {
    if (window._dapTransitCache && Array.isArray(window._dapTransitCache.ephemerides)) {
      return window._dapTransitCache.ephemerides;
    }
    if (typeof window._exoEphemerides !== 'undefined' && Array.isArray(window._exoEphemerides)) {
      return window._exoEphemerides;
    }
    try {
      const v = (new Function('return typeof _exoEphemerides !== "undefined" ? _exoEphemerides : null'))();
      if (Array.isArray(v)) return v;
    } catch (e) { /* fall through */ }
    return [];
  }

  // Install a wrapper on exoComputeNightTransits to capture its output into
  // window._dapTransitCache. This is the most reliable path to access the
  // transit data on iOS Safari where Function-constructor access to
  // let-scoped vars is unreliable. exoComputeNightTransits IS function-
  // declared in the host, so it attaches to window properly on all browsers.
  function installDataCaptureHook() {
    if (typeof window.exoComputeNightTransits !== 'function') {
      const attempts = (installDataCaptureHook._attempts = (installDataCaptureHook._attempts || 0) + 1);
      if (attempts < 60) {
        setTimeout(installDataCaptureHook, 500);
      } else {
        console.debug('[DAP patch] exoComputeNightTransits never appeared; data capture hook skipped');
      }
      return;
    }
    if (installDataCaptureHook._installed) return;
    installDataCaptureHook._installed = true;

    const original = window.exoComputeNightTransits;
    window.exoComputeNightTransits = function patchedExoComputeNightTransits(planets, dayOffset) {
      const result = original.apply(this, arguments);
      // Capture into a window-attached cache that getExoTransits/getExoEphemerides read
      window._dapTransitCache = window._dapTransitCache || {};
      if (result && Array.isArray(result.transits)) {
        window._dapTransitCache.transits = result.transits;
      }
      if (Array.isArray(planets)) {
        window._dapTransitCache.ephemerides = planets;
      }
      return result;
    };
    console.log('[DAP patch] data capture hook installed · exoComputeNightTransits results cached on window._dapTransitCache (fixes iOS Safari let-scope issue)');
  }

  // Walk all transit rows in the DOM and decorate them with our four features.
  // Idempotent: re-running won't duplicate decorations (each helper checks).
  // Show a persistent diagnostic line inside the exo transit section.
  // ALWAYS visible (not just on errors) so we can see clock + data state at
  // a glance across machines. The line shows:
  //   Local clock: HH:MM · Tonight's transits: HH:MM — HH:MM · Loaded: N transits, M planets
  // If anything looks off (clock way out of range, no data, etc) the line
  // itself is the signal — no DevTools needed.
  function updateExoSectionDiagnostic(state) {
    const section = document.getElementById('exoTransitsSection');
    if (!section) return;
    let banner = section.querySelector('.dap-exo-diagnostic-banner');

    // Build always-on info line
    const now = new Date();
    const nowJD = (now.getTime() / 86400000) + 2440587.5;
    const clockStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const transits = getExoTransits();
    const ephem = getExoEphemerides();

    let transitWindow = '—';
    let activeNow = 0;
    if (transits.length > 0) {
      let minJD = Infinity, maxJD = -Infinity;
      for (const t of transits) {
        if (t.ingressJD && t.ingressJD < minJD) minJD = t.ingressJD;
        if (t.egressJD && t.egressJD > maxJD) maxJD = t.egressJD;
        if (t.ingressJD && t.egressJD && nowJD >= t.ingressJD && nowJD <= t.egressJD) {
          activeNow++;
        }
      }
      if (isFinite(minJD) && isFinite(maxJD)) {
        const d1 = new Date((minJD - 2440587.5) * 86400000);
        const d2 = new Date((maxJD - 2440587.5) * 86400000);
        const t1 = `${String(d1.getHours()).padStart(2, '0')}:${String(d1.getMinutes()).padStart(2, '0')}`;
        const t2 = `${String(d2.getHours()).padStart(2, '0')}:${String(d2.getMinutes()).padStart(2, '0')}`;
        // Show date info too: which day is the transit data on relative to "now"?
        const monthDay = (d) => `${d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`;
        const sameDay = d1.toDateString() === now.toDateString();
        const dateNote = sameDay
          ? ''
          : ` [${monthDay(d1)}${d1.toDateString() !== d2.toDateString() ? '→'+monthDay(d2) : ''}]`;
        transitWindow = `${t1} — ${t2}${dateNote}`;
      }

      // One-time diagnostic dump so we can debug "0 active now" reports.
      // Logs the first 3 transits' JD windows compared to nowJD, so we can
      // tell if the JD math is wrong or the data is in an unexpected shape.
      if (!window._dapTransitDumpDone) {
        window._dapTransitDumpDone = true;
        console.log('[DAP patch] === transit JD diagnostic dump ===');
        console.log(`  nowJD = ${nowJD.toFixed(5)} (= ${now.toISOString()})`);
        console.log(`  total transits in cache: ${transits.length}`);
        const sample = transits.slice(0, 3);
        for (const t of sample) {
          const name = (t.planet && t.planet.name) || '?';
          console.log(`  ${name}: ingressJD=${t.ingressJD} egressJD=${t.egressJD} midJD=${t.midJD}`);
          if (t.ingressJD) {
            const dIng = new Date((t.ingressJD - 2440587.5) * 86400000);
            const dEg = new Date((t.egressJD - 2440587.5) * 86400000);
            console.log(`    ingress = ${dIng.toISOString()} (${dIng.toLocaleString()})`);
            console.log(`    egress  = ${dEg.toISOString()} (${dEg.toLocaleString()})`);
            const diffMin = ((t.ingressJD - nowJD) * 24 * 60).toFixed(1);
            console.log(`    ingress - now = ${diffMin} minutes (negative = transit already started)`);
          }
        }
        // Also dump count of transits with null JDs (predicted-only entries)
        const nullJD = transits.filter(t => !t.ingressJD || !t.egressJD).length;
        console.log(`  transits with null JD fields (skipped from badge check): ${nullJD}`);
      }
    }

    // Detect clock-out-of-range condition: now is way outside the transit
    // window. Could indicate timezone or system clock issue on this machine.
    let kind = 'info';
    let warning = '';
    if (transits.length > 0 && activeNow === 0) {
      // Check if now is wildly far from any transit (e.g. middle of the day)
      const d1 = new Date((transits.map(t => t.ingressJD).filter(j => j)[0] - 2440587.5) * 86400000);
      const transitDate = d1.toDateString();
      const nowDate = now.toDateString();
      if (transitDate !== nowDate) {
        // Different date → clock is on a different day than the transit data
        kind = 'warn';
        warning = ` ⚠ Local date (${nowDate}) differs from transit date (${transitDate}) — check system clock/timezone.`;
      }
    }
    if (transits.length === 0 && ephem.length === 0) {
      kind = 'warn';
      warning = ' Waiting for NEA fetch — if this persists >60s, check DevTools → Network for failing exoplanetarchive.ipac.caltech.edu requests.';
    }

    const kindColor = {
      info: '#5a4a28',
      warn: '#c89858',
      err: '#c86060'
    }[kind] || '#5a4a28';

    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'dap-exo-diagnostic-banner';
      // Insert right after the header (or as first child if no header found)
      const header = section.querySelector('.exo-section-header');
      if (header && header.nextSibling) {
        section.insertBefore(banner, header.nextSibling);
      } else {
        section.insertBefore(banner, section.firstChild);
      }
    }
    banner.style.cssText = `
      background: rgba(0,0,0,0.3);
      border-left: 2px solid ${kindColor};
      padding: 5px 10px;
      margin: 4px 0 8px 0;
      font-family: var(--mono, 'Space Mono', monospace);
      font-size: 9px;
      color: #5a4a28;
      line-height: 1.5;
    `;
    banner.innerHTML = `
      <span style="color:#a89060;">Local clock: <span style="color:${kind === 'warn' ? '#c89858' : '#d4aa50'};">${clockStr}</span></span>
      · Tonight: <span style="color:#a89060;">${transitWindow}</span>
      · ${transits.length} transit${transits.length === 1 ? '' : 's'},
      ${activeNow > 0 ? `<span style="color:#7ec87a;">${activeNow} active now</span>` : '<span>0 active now</span>'}
      <span style="color:${kindColor};">${warning}</span>
    `;
  }

  function decorateExoTransitRows() {
    const rows = document.querySelectorAll('.exo-row[data-planet-name]');
    if (rows.length === 0) return;

    const ephemerides = getExoEphemerides();
    const transits = getExoTransits();

    // Always update diagnostic line so it stays fresh on each tick
    updateExoSectionDiagnostic();

    if (ephemerides.length === 0 && transits.length === 0) {
      console.debug('[DAP patch] decorateExoTransitRows: no ephemerides/transits found yet, skipping');
      return;
    }

    rows.forEach(row => {
      const planetName = row.dataset.planetName;
      if (!planetName) return;
      const p = ephemerides.find(x => x.name === planetName);
      const t = transits.find(x => x.planet && x.planet.name === planetName);
      if (!p || !t) return;

      // Find the name cell (second column) where we'll inject baseline + in-progress
      const nameCell = row.querySelector('.exo-cell.name');
      if (nameCell) {
        // #10 disposition badge — insert into the existing name row
        if (!nameCell.dataset.dapEnhanced10) {
          const nameRow = nameCell.querySelector('div'); // first child = name flex row
          const dispBadge = buildDispositionBadge(p);
          if (nameRow && dispBadge) {
            const wrapper = document.createElement('span');
            wrapper.innerHTML = dispBadge;
            nameRow.appendChild(wrapper.firstElementChild);
          }
          nameCell.dataset.dapEnhanced10 = '1';
        }

        // #3 phase-aware in-progress badge — only present while transit is happening.
        // Remove any old in-progress badge first (phase may have changed since last refresh).
        const oldBadge = nameCell.querySelector('.dap-exo-inprogress-wrap');
        if (oldBadge) oldBadge.remove();
        const ipHtml = buildInProgressBadge(t);
        if (ipHtml) {
          const ipDiv = document.createElement('div');
          ipDiv.className = 'dap-exo-inprogress-wrap';
          ipDiv.style.marginTop = '5px';
          ipDiv.innerHTML = ipHtml;
          nameCell.appendChild(ipDiv);
        }

        // #8 baseline timing — append once
        if (!nameCell.dataset.dapEnhanced8) {
          const baselineHtml = buildBaselineHTML(t);
          if (baselineHtml) {
            const baselineDiv = document.createElement('div');
            baselineDiv.innerHTML = baselineHtml;
            const baselineEl = baselineDiv.firstElementChild;
            if (baselineEl) nameCell.appendChild(baselineEl);
          }
          nameCell.dataset.dapEnhanced8 = '1';
        }
      }

      // #1 live clock — position indicator on the glyph cell using this
      // transit's own observable-window time axis. Target the cell itself
      // (not the SVG inside, since SVG can't contain HTML children).
      const glyphCell = row.querySelector('.exo-cell.glyph, .exo-cell.exo-glyph-cell');
      if (glyphCell) {
        placeClockIndicatorOnCell(glyphCell, t);
      }
    });
  }

  // Live-clock tick. Updates every N seconds. Cleared and restarted on each
  // render so we don't stack intervals. Rate adapts to chart zoom level:
  // at higher zoom we update faster so motion is visible per-tick.
  let exoCurrentTickRate = 60000;  // ms between ticks
  function startExoClockTick(rateMs) {
    const newRate = rateMs || 60000;
    if (exoCurrentTickRate === newRate && exoClockInterval) return;
    exoCurrentTickRate = newRate;
    if (exoClockInterval) clearInterval(exoClockInterval);
    exoClockInterval = setInterval(() => {
      try {
        // Only update if any rows are visible (cheap query)
        if (document.querySelectorAll('.exo-row[data-planet-name]').length === 0) return;
        try { decorateExoTransitRows(); }
        catch (e) { console.warn('[DAP patch] tick: decorateExoTransitRows threw', e); }
        try { updateExoSkyChartNowMarkers(); }
        catch (e) { console.warn('[DAP patch] tick: updateExoSkyChartNowMarkers threw', e); }
      } catch (e) {
        console.warn('[DAP patch] clock tick threw', e);
      }
    }, newRate);
  }

  // Update the sky chart legend's "updates every X" label
  function updateTickRateLabel(rateMs) {
    const label = document.querySelector('[data-role="update-rate-label"]');
    if (!label) return;
    const sec = Math.round(rateMs / 1000);
    label.textContent = `· updates every ${sec}s`;
  }

  // Hook renderExoTransits — wrap the original so we can decorate after it paints.
  // Like exoBuildDetailPanel, the host's renderExoTransits is async; we just
  // schedule our decoration to run shortly after the render completes.
  // ─────────────────────────────────────────────────────────────────
  // EXOPLANET SKY CHART · arc paths for tonight's transits
  // ─────────────────────────────────────────────────────────────────
  // A zenith-centered all-sky chart showing each transit as an arc from
  // ingress alt-az to egress alt-az. Drops into the transit section above
  // the data table, collapsible.
  //
  // Projection: azimuthal equidistant from zenith.
  //   - Zenith at center of chart
  //   - Horizon as outer ring
  //   - alt 90° → r=0, alt 0° → r=R
  //   - az 0° (N) → up, az 90° (E) → right (standard astronomy convention)

  const SKYCHART_W = 800;
  const SKYCHART_H = 800;
  const SKYCHART_CX = SKYCHART_W / 2;
  const SKYCHART_CY = SKYCHART_H / 2;
  const SKYCHART_R = 360;  // chart radius (horizon)

  // Project (alt, az) in degrees to SVG (x, y).
  // Standard astronomy convention for an all-sky chart viewed from below
  // (looking up at the sky): N up, S down, E on the LEFT, W on the RIGHT.
  // This mirrors the normal map convention since we're looking up, not down.
  // It's the convention used by planispheres, Stellarium's fisheye view, etc.
  //
  // alt 90° → center (radius 0), alt 0° → horizon ring (radius R).
  // az 0° (N) → up, az 90° (E) → left, az 180° (S) → down, az 270° (W) → right.
  function projectAltAz(altDeg, azDeg) {
    const altClamped = Math.max(-5, Math.min(90, altDeg));  // tolerate slight negative
    const r = SKYCHART_R * (90 - altClamped) / 90;
    const azRad = azDeg * Math.PI / 180;
    // x_offset = -r*sin(az) puts east (az=90°) on the LEFT
    // y_offset = -r*cos(az) puts north (az=0°) UP
    const x = SKYCHART_CX - r * Math.sin(azRad);
    const y = SKYCHART_CY - r * Math.cos(azRad);
    return { x, y, r };
  }

  // Build an SVG path string for a transit's arc: from (altIn,azIn) through
  // (altMid,azMid) to (altEg,azEg). Use a quadratic Bezier with mid as control,
  // adjusted so the visible curve passes through the mid point.
  function buildTransitArcPath(t) {
    const p1 = projectAltAz(t.altIn, t.azIn);
    const pM = projectAltAz(t.altMid, t.azMid);
    const p2 = projectAltAz(t.altEg, t.azEg);
    // For a Bezier curve passing THROUGH the mid point, the control point
    // should be at: 2*Pmid - (P1 + P2)/2
    const ctrlX = 2 * pM.x - (p1.x + p2.x) / 2;
    const ctrlY = 2 * pM.y - (p1.y + p2.y) / 2;
    return `M ${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q ${ctrlX.toFixed(1)},${ctrlY.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  // Build the sky chart SVG for a set of transits.
  // Each transit is drawn as an arc with markers at ingress/mid/egress.
  // Transit type colors: PRIME gold, partial muted, regular purple.
  function buildExoSkyChartSVG(transits) {
    const horizon = `<circle cx="${SKYCHART_CX}" cy="${SKYCHART_CY}" r="${SKYCHART_R}" fill="none" stroke="rgba(212,170,80,0.35)" stroke-width="1.2"/>`;
    // Alt rings at 30° and 60°
    const r30 = SKYCHART_R * (90 - 30) / 90;
    const r60 = SKYCHART_R * (90 - 60) / 90;
    const altRings = `
      <circle cx="${SKYCHART_CX}" cy="${SKYCHART_CY}" r="${r30}" fill="none" stroke="rgba(212,170,80,0.12)" stroke-width="0.5" stroke-dasharray="2 3"/>
      <circle cx="${SKYCHART_CX}" cy="${SKYCHART_CY}" r="${r60}" fill="none" stroke="rgba(212,170,80,0.12)" stroke-width="0.5" stroke-dasharray="2 3"/>
      <text x="${SKYCHART_CX + 4}" y="${SKYCHART_CY - r30 + 4}" font-family="Space Mono, monospace" font-size="10" fill="rgba(212,170,80,0.4)">30°</text>
      <text x="${SKYCHART_CX + 4}" y="${SKYCHART_CY - r60 + 4}" font-family="Space Mono, monospace" font-size="10" fill="rgba(212,170,80,0.4)">60°</text>`;
    // Cardinal direction labels (N up, E left, S down, W right per our convention)
    const cardinals = `
      <text x="${SKYCHART_CX}" y="${SKYCHART_CY - SKYCHART_R - 12}" text-anchor="middle" font-family="Space Mono, monospace" font-size="14" fill="#d4aa50" font-weight="700">N</text>
      <text x="${SKYCHART_CX - SKYCHART_R - 14}" y="${SKYCHART_CY + 5}" text-anchor="middle" font-family="Space Mono, monospace" font-size="14" fill="#d4aa50" font-weight="700">E</text>
      <text x="${SKYCHART_CX}" y="${SKYCHART_CY + SKYCHART_R + 20}" text-anchor="middle" font-family="Space Mono, monospace" font-size="14" fill="#d4aa50" font-weight="700">S</text>
      <text x="${SKYCHART_CX + SKYCHART_R + 14}" y="${SKYCHART_CY + 5}" text-anchor="middle" font-family="Space Mono, monospace" font-size="14" fill="#d4aa50" font-weight="700">W</text>`;
    // Faint cross at meridian + horizon great circles
    const meridian = `<line x1="${SKYCHART_CX}" y1="${SKYCHART_CY - SKYCHART_R}" x2="${SKYCHART_CX}" y2="${SKYCHART_CY + SKYCHART_R}" stroke="rgba(212,170,80,0.08)" stroke-width="0.5" stroke-dasharray="1 4"/>`;
    const equator = `<line x1="${SKYCHART_CX - SKYCHART_R}" y1="${SKYCHART_CY}" x2="${SKYCHART_CX + SKYCHART_R}" y2="${SKYCHART_CY}" stroke="rgba(212,170,80,0.08)" stroke-width="0.5" stroke-dasharray="1 4"/>`;
    // Zenith marker
    const zenith = `
      <circle cx="${SKYCHART_CX}" cy="${SKYCHART_CY}" r="3" fill="rgba(212,170,80,0.5)"/>
      <text x="${SKYCHART_CX + 8}" y="${SKYCHART_CY + 3}" font-family="Space Mono, monospace" font-size="9" fill="rgba(212,170,80,0.4)">zenith</text>`;

    // Now the actual transit arcs. Each gets a unique color/style based on:
    //  - PRIME (any rig)            → gold (full weight)
    //  - Partial (off-window edges) → gold-mute, dashed
    //  - Regular                    → purple (DAP exo color)
    //  - LowAlt (low altitude all)  → faded
    const arcs = transits.map((t, idx) => {
      const isPrime = !!(t.lacertaPrime || t.meadePrime || t.takPrime || t.rcosPrime);
      let stroke, sw, dash, opacity;
      if (isPrime) {
        stroke = '#d4aa50';
        sw = 2.5;
        dash = '';
        opacity = '0.9';
      } else if (t.partial) {
        stroke = '#a89060';
        sw = 1.5;
        dash = ' stroke-dasharray="4 3"';
        opacity = '0.75';
      } else if (t.lowAlt) {
        stroke = '#5a4a28';
        sw = 1.2;
        dash = ' stroke-dasharray="2 4"';
        opacity = '0.5';
      } else {
        stroke = '#8b7ad1';
        sw = 1.8;
        dash = '';
        opacity = '0.8';
      }

      const pathD = buildTransitArcPath(t);
      const pIn = projectAltAz(t.altIn, t.azIn);
      const pMid = projectAltAz(t.altMid, t.azMid);
      const pEg = projectAltAz(t.altEg, t.azEg);
      const planetName = (t.planet && t.planet.name) || 'unknown';
      const planetNameEsc = planetName.replace(/[<>&"']/g, c =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));

      // Tooltip group for hover; data attr for click handling
      return `
        <g class="dap-exo-skychart-arc" data-planet-name="${planetNameEsc}" data-idx="${idx}">
          <path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${sw}"${dash} opacity="${opacity}"
                stroke-linecap="round" class="dap-exo-skychart-path"/>
          <circle cx="${pIn.x.toFixed(1)}" cy="${pIn.y.toFixed(1)}" r="3" fill="#7ec87a" opacity="${opacity}"/>
          <circle cx="${pMid.x.toFixed(1)}" cy="${pMid.y.toFixed(1)}" r="4" fill="${stroke}" opacity="${opacity}"/>
          <circle cx="${pEg.x.toFixed(1)}" cy="${pEg.y.toFixed(1)}" r="3" fill="#c86060" opacity="${opacity}"/>
          <text x="${pMid.x.toFixed(1)}" y="${(pMid.y - 8).toFixed(1)}" text-anchor="middle"
                font-family="Space Mono, monospace" font-size="10" fill="${stroke}"
                opacity="${opacity}" style="pointer-events:none;">${planetNameEsc}</text>
        </g>`;
    }).join('');

    return `
      <svg viewBox="0 0 ${SKYCHART_W} ${SKYCHART_H}" xmlns="http://www.w3.org/2000/svg"
           class="dap-exo-skychart-svg" preserveAspectRatio="xMidYMid meet">
        ${equator}
        ${meridian}
        ${horizon}
        ${altRings}
        ${cardinals}
        ${zenith}
        ${arcs}
      </svg>`;
  }

  // Build the full sky chart panel HTML (collapsible wrapper).
  function buildExoSkyChartHTML(transits) {
    if (!transits || transits.length === 0) return '';
    const transitCount = transits.length;
    const primeCount = transits.filter(t => !!(t.lacertaPrime || t.meadePrime || t.takPrime || t.rcosPrime)).length;
    const partialCount = transits.filter(t => t.partial).length;
    const collapsed = localStorage.getItem('DAP_exo_skychart_collapsed') === '1';

    return `
      <div class="dap-exo-skychart" data-collapsed="${collapsed ? '1' : '0'}">
        <div class="dap-exo-skychart-header" data-role="skychart-toggle">
          <span class="dap-exo-skychart-caret">${collapsed ? '▸' : '▾'}</span>
          <span class="dap-exo-skychart-title">Sky Map · Transit Paths</span>
          <span class="dap-exo-skychart-meta">
            ${transitCount} transit${transitCount === 1 ? '' : 's'}
            ${primeCount > 0 ? ` · <span class="gold">${primeCount} PRIME</span>` : ''}
            ${partialCount > 0 ? ` · ${partialCount} partial` : ''}
          </span>
        </div>
        <div class="dap-exo-skychart-body" ${collapsed ? 'style="display:none;"' : ''}>
          <div class="dap-exo-skychart-chart-wrap">
            <div class="dap-exo-skychart-chart" data-role="skychart-chart">
              ${buildExoSkyChartSVG(transits)}
            </div>
            <div class="dap-exo-skychart-controls">
              <label class="dap-exo-skychart-zoom-label">
                Zoom: <span data-role="zoom-value">1.0×</span>
              </label>
              <input type="range" min="100" max="500" step="5" value="100"
                     class="dap-exo-skychart-zoom-slider"
                     data-role="zoom-slider"
                     aria-label="Sky chart zoom">
              <button class="dap-exo-skychart-reset" data-role="reset-view"
                      title="Reset to 1× and center">Reset view</button>
            </div>
          </div>
          <div class="dap-exo-skychart-legend">
            <div class="dap-exo-skychart-legend-row">
              <span class="dap-exo-skychart-swatch" style="background:#d4aa50;"></span>
              <span>PRIME (any rig)</span>
              <span class="dap-exo-skychart-swatch" style="background:#8b7ad1; margin-left: 18px;"></span>
              <span>Regular transit</span>
              <span class="dap-exo-skychart-swatch dashed" style="border: 1px dashed #a89060; margin-left: 18px;"></span>
              <span>Partial / unobservable edge</span>
            </div>
            <div class="dap-exo-skychart-legend-row" style="margin-top: 6px; color: var(--text3, #5a4a28);">
              <span style="margin-right: 18px;">
                <span class="dap-exo-skychart-dot" style="background:#7ec87a;"></span> ingress
              </span>
              <span style="margin-right: 18px;">
                <span class="dap-exo-skychart-dot" style="background:#d4aa50;"></span> mid-transit
              </span>
              <span>
                <span class="dap-exo-skychart-dot" style="background:#c86060;"></span> egress
              </span>
            </div>
            <div class="dap-exo-skychart-legend-row" style="margin-top: 6px;">
              <span class="dap-exo-skychart-now-swatch"></span>
              <span style="color: #6fc8e0;">live position right now</span>
              <span style="color: var(--text3, #5a4a28); margin-left: 6px;" data-role="update-rate-label">· updates every 60s</span>
            </div>
            <div class="dap-exo-skychart-hint">
              Drag the slider to zoom. Drag the chart to pan when zoomed in.
              Click an arc for that transit's detail panel.
            </div>
          </div>
        </div>
      </div>`;
  }

  // Inject the sky chart into the transit section after each render.
  // Idempotent: replaces any previous chart so day-tab changes refresh it.
  function injectExoSkyChart() {
    const transits = getExoTransits();
    if (transits.length === 0) return;

    const section = document.getElementById('exoTransitsSection');
    if (!section) return;

    const table = section.querySelector('.exo-table');
    if (!table) return;

    // Remove old chart if present (so it refreshes on every render)
    const oldChart = section.querySelector('.dap-exo-skychart');
    if (oldChart) oldChart.remove();

    // Build and insert the new chart before the table
    const chartHTML = buildExoSkyChartHTML(transits);
    if (!chartHTML) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = chartHTML;
    const chartEl = wrap.firstElementChild;
    if (!chartEl) return;
    section.insertBefore(chartEl, table);

    // Wire the collapse toggle
    const toggle = chartEl.querySelector('[data-role="skychart-toggle"]');
    const body = chartEl.querySelector('.dap-exo-skychart-body');
    const caret = chartEl.querySelector('.dap-exo-skychart-caret');
    if (toggle && body && caret) {
      toggle.addEventListener('click', () => {
        const isCollapsed = chartEl.dataset.collapsed === '1';
        const newState = !isCollapsed;
        chartEl.dataset.collapsed = newState ? '1' : '0';
        body.style.display = newState ? 'none' : '';
        caret.textContent = newState ? '▸' : '▾';
        try { localStorage.setItem('DAP_exo_skychart_collapsed', newState ? '1' : '0'); } catch (e) {}
      });
    }

    // Wire arc click → open detail panel for that planet
    // ── Zoom + pan state ──────────────────────────────────────
    // The chart's data uses a fixed 800x800 coordinate system. Zooming and
    // panning are implemented by changing the SVG viewBox: smaller viewBox =
    // zoomed in (less area visible). Pan shifts the viewBox origin.
    //
    // State is local to this chart instance (re-created on each render).
    let zoomLevel = 1.0;          // 1.0 → full view, 5.0 → 1/25 area visible
    let panCenterX = 400;          // viewBox center in SVG coords
    let panCenterY = 400;
    const VB_FULL = 800;           // full viewBox width = chart coord space

    const svgEl = chartEl.querySelector('.dap-exo-skychart-svg');
    const slider = chartEl.querySelector('[data-role="zoom-slider"]');
    const zoomValue = chartEl.querySelector('[data-role="zoom-value"]');
    const resetBtn = chartEl.querySelector('[data-role="reset-view"]');
    const chartContainer = chartEl.querySelector('[data-role="skychart-chart"]');

    // ── Arc click handler — opens detail panel for the planet.
    // If a drag happens, onPointerUp installs a one-shot capture-phase
    // click swallow on the chart container, which intercepts before this
    // handler runs. So we don't need drag-detection logic here.
    chartEl.querySelectorAll('.dap-exo-skychart-arc').forEach(arc => {
      arc.addEventListener('click', () => {
        const name = arc.dataset.planetName;
        if (name && typeof window.exoOpenPlanetDetail === 'function') {
          window.exoOpenPlanetDetail(name);
        }
      });
    });

    function applyViewBox() {
      if (!svgEl) return;
      const vbW = VB_FULL / zoomLevel;
      const vbH = VB_FULL / zoomLevel;
      // Clamp pan so the visible area stays within ±VB_FULL/2 of center.
      // We allow center to range freely within the data area; visible area
      // can extend beyond the horizon ring (that's just dark space and ok).
      const halfW = vbW / 2;
      const halfH = vbH / 2;
      // Soft clamp: don't allow center to wander more than VB_FULL/2 from
      // the data center (400, 400). That keeps the chart roughly on-screen
      // even when zoomed in and panned hard.
      panCenterX = Math.max(halfW, Math.min(VB_FULL - halfW, panCenterX));
      panCenterY = Math.max(halfH, Math.min(VB_FULL - halfH, panCenterY));
      const vbX = panCenterX - halfW;
      const vbY = panCenterY - halfH;
      svgEl.setAttribute('viewBox', `${vbX.toFixed(1)} ${vbY.toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}`);
    }

    function adaptTickRate() {
      // Faster updates when zoomed in so motion is visible.
      // Honest reasoning: per-minute az motion is ~0.25°, which is ~5%
      // of a 5°-wide visible area but only 0.7% of the full 60° hemisphere.
      // Faster ticks make zoomed-in motion meaningful.
      const newRate = zoomLevel >= 1.5 ? 15000 : 60000;
      if (exoCurrentTickRate !== newRate) {
        startExoClockTick(newRate);
        updateTickRateLabel(newRate);
      }
    }

    // ── Slider zoom ───────────────────────────────────────────
    if (slider && zoomValue) {
      slider.addEventListener('input', () => {
        const v = parseInt(slider.value, 10) / 100;  // 100..500 → 1.0..5.0
        zoomLevel = v;
        zoomValue.textContent = v.toFixed(1) + '×';
        applyViewBox();
        adaptTickRate();
      });
    }

    // ── Reset button ──────────────────────────────────────────
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        zoomLevel = 1.0;
        panCenterX = 400;
        panCenterY = 400;
        if (slider) slider.value = '100';
        if (zoomValue) zoomValue.textContent = '1.0×';
        applyViewBox();
        adaptTickRate();
      });
    }

    // ── Drag pan ──────────────────────────────────────────────
    // Tracks: drag start, drag delta, and whether we actually dragged
    // (any movement > 5px). If we dragged, the upcoming click is swallowed
    // by a one-shot capture-phase listener so the arc click handler doesn't fire.
    let dragState = null;  // { startX, startY, startPanX, startPanY, didMove }

    function onPointerDown(ev) {
      if (zoomLevel <= 1.0) return;  // no pan when fully zoomed out
      // Only left mouse / primary touch
      if (ev.button !== undefined && ev.button !== 0) return;
      dragState = {
        startX: ev.clientX,
        startY: ev.clientY,
        startPanX: panCenterX,
        startPanY: panCenterY,
        didMove: false
      };
      chartContainer.style.cursor = 'grabbing';
      ev.preventDefault();
    }

    function onPointerMove(ev) {
      if (!dragState) return;
      const dx = ev.clientX - dragState.startX;
      const dy = ev.clientY - dragState.startY;
      // Detect "moved enough to be a drag" (threshold 5px)
      if (!dragState.didMove && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        dragState.didMove = true;
      }
      if (!dragState.didMove) return;
      // Convert screen px → SVG units. Chart container width = visible SVG width.
      const rect = chartContainer.getBoundingClientRect();
      if (rect.width === 0) return;
      const svgPerPx = (VB_FULL / zoomLevel) / rect.width;
      // Drag right → pan left (so content moves with cursor)
      panCenterX = dragState.startPanX - dx * svgPerPx;
      panCenterY = dragState.startPanY - dy * svgPerPx;
      applyViewBox();
    }

    function onPointerUp(ev) {
      if (!dragState) return;
      const didMove = dragState.didMove;
      dragState = null;
      chartContainer.style.cursor = zoomLevel > 1.0 ? 'grab' : '';
      // If we moved, swallow the next click to avoid opening detail panel
      if (didMove) {
        const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
        chartContainer.addEventListener('click', swallow, { capture: true, once: true });
      }
    }

    chartContainer.addEventListener('mousedown', onPointerDown);
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);

    // Cursor hint: grab when zoomed in, normal otherwise
    function updateCursor() {
      chartContainer.style.cursor = zoomLevel > 1.0 ? 'grab' : '';
    }
    if (slider) slider.addEventListener('input', updateCursor);
    if (resetBtn) resetBtn.addEventListener('click', updateCursor);

    // Populate the "now" markers immediately (clock tick will refresh them on the active rate)
    updateExoSkyChartNowMarkers();
  }

  // Compute current alt-az for a planet using the host's exoAltAz function.
  // exoAltAz is a function declaration so it attaches to window.
  function computeNowAltAz(planet, nowJD) {
    if (typeof window.exoAltAz !== 'function') return null;
    if (!planet || isNaN(planet.ra) || isNaN(planet.dec)) return null;
    try {
      const result = window.exoAltAz(planet.ra, planet.dec, nowJD);
      if (!result || isNaN(result.alt) || isNaN(result.az)) return null;
      return result;
    } catch (e) {
      return null;
    }
  }

  // Build the SVG fragment for the "now" markers — one dot per target
  // currently above the horizon, showing its live alt-az position.
  // This is regenerated on each tick (every 60s) so we can replace the
  // <g class="dap-exo-skychart-now-group"> element cleanly.
  function buildNowMarkers() {
    const ephem = getExoEphemerides();
    if (ephem.length === 0) return '';

    const nowJD = (Date.now() / 86400000) + 2440587.5;
    const transits = getExoTransits();
    // Only show markers for planets that have transits computed (i.e. are
    // visible in the section right now). Otherwise we'd draw dots for
    // all ~1000+ known exoplanets, which is meaningless.
    const planetNames = new Set(transits.map(t => t.planet && t.planet.name).filter(Boolean));

    const markers = [];
    for (const p of ephem) {
      if (!planetNames.has(p.name)) continue;
      const altAz = computeNowAltAz(p, nowJD);
      if (!altAz || altAz.alt < 0) continue;  // skip below-horizon targets

      const pos = projectAltAz(altAz.alt, altAz.az);
      const planetNameEsc = String(p.name).replace(/[<>&"']/g, c =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));

      // Cyan-ish now-marker, visually distinct from gold/purple arc endpoints
      markers.push(`
        <g class="dap-exo-skychart-now-marker" data-planet-name="${planetNameEsc}">
          <circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="6"
                  fill="none" stroke="#6fc8e0" stroke-width="1.5" opacity="0.7"/>
          <circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="3"
                  fill="#6fc8e0">
            <title>${planetNameEsc} · alt ${altAz.alt.toFixed(1)}° · az ${altAz.az.toFixed(1)}°</title>
          </circle>
        </g>`);
    }

    return `<g class="dap-exo-skychart-now-group">${markers.join('')}</g>`;
  }

  // Update the now-markers in the current sky chart. Called every minute
  // by the clock-tick interval, and once when the chart is first injected.
  function updateExoSkyChartNowMarkers() {
    const chart = document.querySelector('.dap-exo-skychart-svg');
    if (!chart) return;
    // Remove old group if present
    const oldGroup = chart.querySelector('.dap-exo-skychart-now-group');
    if (oldGroup) oldGroup.remove();
    // Build and insert new group
    const newSvgFragment = buildNowMarkers();
    if (!newSvgFragment) return;
    // Inject as the last child of the SVG so markers render on top of arcs
    // (innerHTML mutation on SVG is supported)
    chart.insertAdjacentHTML('beforeend', newSvgFragment);
  }

  function installExoTransitRowHook() {
    if (typeof window.renderExoTransits !== 'function') {
      const attempts = (installExoTransitRowHook._attempts = (installExoTransitRowHook._attempts || 0) + 1);
      if (attempts < 60) {
        setTimeout(installExoTransitRowHook, 500);
      } else {
        console.debug('[DAP patch] renderExoTransits never appeared; row enhancements skipped');
      }
      return;
    }
    if (installExoTransitRowHook._installed) return;
    installExoTransitRowHook._installed = true;

    const original = window.renderExoTransits;
    window.renderExoTransits = async function patchedRenderExoTransits() {
      const result = await original.apply(this, arguments);
      // Wait briefly for the DOM to settle before decorating
      setTimeout(() => {
        try {
          decorateExoTransitRows();
          startExoClockTick();
          injectExoSkyChart();
        } catch (e) {
          console.warn('[DAP patch] exo row decoration failed:', e);
        }
      }, 100);
      return result;
    };
    console.log('[DAP patch] exo transit row hook installed · baseline/disp/in-progress/clock + sky chart active');

    // If the section is already rendered (page loaded before hook installed),
    // decorate immediately. But retry a few times if the data caches aren't
    // populated yet — exoFetchEphemerides is async and can take ~30 sec on
    // first load.
    let initialDecorateAttempts = 0;
    function tryInitialDecorate() {
      initialDecorateAttempts++;
      const rows = document.querySelectorAll('.exo-row[data-planet-name]');
      const ephem = getExoEphemerides();
      const trans = getExoTransits();
      if (rows.length > 0 && ephem.length > 0 && trans.length > 0) {
        decorateExoTransitRows();
        startExoClockTick();
        injectExoSkyChart();
        return;
      }
      if (initialDecorateAttempts < 60) {  // ~30 sec budget at 500ms
        setTimeout(tryInitialDecorate, 500);
      }
    }
    setTimeout(tryInitialDecorate, 100);
  }

  // ─────────────────────────────────────────────────────────────────
  // OVERRIDE buildPanelBody to add our sections
  // ─────────────────────────────────────────────────────────────────
  function installPanelHook() {
    if (typeof window.buildPanelBody !== 'function') {
      console.warn('[DAP patch] buildPanelBody not found — will retry');
      setTimeout(installPanelHook, 500);
      return;
    }
    const original = window.buildPanelBody;
    window.buildPanelBody = function patchedBuildPanelBody(o) {
      let html = original(o);
      // Append our new sections at the end of the panel body
      html += buildPerTargetForecastHTML(o);
      html += buildAladinFOVHTML(o);
      html += buildConstellationContextHTML(o);
      html += buildSurfaceBrightnessHTML(o);
      html += buildWWTHTML(o);
      html += buildSessionComparisonHTML(o);
      // After the panel renders, hook up interactive bits
      setTimeout(() => {
        document.querySelectorAll('[data-aladin-id]').forEach(viewer => {
          if (!aladinInstances[viewer.dataset.aladinId]) initAladinForElement(viewer, o);
        });
        const scCard = document.querySelector('[data-sc-card]');
        if (scCard) initSessionComparison(scCard, o);
        initSurfaceBrightness();
        initWWT();
        // Init the constellation Aladin viewer
        document.querySelectorAll('[data-const-aladin-id]').forEach(viewer => {
          if (!constAladinInstances[viewer.dataset.constAladinId]) {
            initConstellationAladin(viewer, o);
          }
        });
      }, 100);
      return html;
    };
    console.log('[DAP patch] panel hook installed');
  }

  // ─────────────────────────────────────────────────────────────────
  // CATALOG "NEEDS EXPORT" INDICATOR
  // ─────────────────────────────────────────────────────────────────
  // The host has Export/Import buttons but no signal that you've made
  // changes since the last export. This wraps the host's persistSave +
  // exportCatalogJson functions to track an "unsynced" flag, and shows a
  // small badge near the export button when changes are pending. Prevents
  // the "I added 5 objects last week and forgot to upload to MyWeb" bug.

  const NEEDS_EXPORT_KEY = 'DAP_catalog_needs_export';

  function setCatalogNeedsExport(value) {
    try {
      if (value) localStorage.setItem(NEEDS_EXPORT_KEY, '1');
      else localStorage.removeItem(NEEDS_EXPORT_KEY);
    } catch (e) {}
    updateCatalogNeedsExportBadge();
  }

  function catalogNeedsExport() {
    try { return localStorage.getItem(NEEDS_EXPORT_KEY) === '1'; } catch (e) { return false; }
  }

  function updateCatalogNeedsExportBadge() {
    // Find the export button in the catalog header
    const exportBtn = document.querySelector('button[onclick="exportCatalogJson()"]');
    if (!exportBtn) return;
    let badge = document.querySelector('.dap-catalog-needs-export');
    if (catalogNeedsExport()) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'dap-catalog-needs-export';
        badge.style.cssText = `
          display: inline-block;
          margin-left: 6px;
          padding: 2px 6px;
          background: rgba(200,138,80,0.18);
          border: 1px solid #c88a50;
          color: #c88a50;
          font-family: var(--mono, 'Space Mono', monospace);
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-radius: 2px;
          vertical-align: middle;
        `;
        badge.textContent = '● unsynced changes';
        badge.title = 'Local catalog has changes that haven\'t been exported. Click "↓ Export", then SFTP the file to MyWeb to share with other machines.';
        exportBtn.parentNode.insertBefore(badge, exportBtn.nextSibling);
      }
    } else {
      if (badge) badge.remove();
    }
  }

  function installCatalogExportTracking() {
    // Wrap persistSave to set the flag on every save
    if (typeof window.persistSave === 'function' && !window.persistSave._dapWrapped) {
      const originalSave = window.persistSave;
      window.persistSave = async function patchedPersistSave() {
        const result = await originalSave.apply(this, arguments);
        setCatalogNeedsExport(true);
        return result;
      };
      window.persistSave._dapWrapped = true;
    }
    // Wrap exportCatalogJson to clear the flag on every export
    if (typeof window.exportCatalogJson === 'function' && !window.exportCatalogJson._dapWrapped) {
      const originalExport = window.exportCatalogJson;
      window.exportCatalogJson = function patchedExportCatalogJson() {
        const result = originalExport.apply(this, arguments);
        setCatalogNeedsExport(false);
        return result;
      };
      window.exportCatalogJson._dapWrapped = true;
    }
    // Initial badge render based on current flag state
    updateCatalogNeedsExportBadge();
  }

  // Probe whether localStorage actually works. Some environments (corporate
  // policy, Safari private mode, restricted iframes) expose the localStorage
  // API but silently fail on writes — which makes catalog saves vanish.
  // Test by setting and immediately reading a sentinel key.
  function checkLocalStorageHealth() {
    try {
      const key = '__dap_ls_probe__';
      const val = 'probe_' + Date.now();
      localStorage.setItem(key, val);
      const got = localStorage.getItem(key);
      localStorage.removeItem(key);
      if (got !== val) {
        console.warn('[DAP patch] localStorage write/read mismatch — catalog saves may not persist on this machine');
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[DAP patch] localStorage unavailable:', e && e.message);
      return false;
    }
  }

  // Show a persistent warning at the top of the catalog if localStorage is
  // broken. Without this, catalog edits silently vanish and the user has no
  // way to tell.
  function showLocalStorageWarning() {
    if (document.querySelector('.dap-ls-warning-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'dap-ls-warning-banner';
    banner.style.cssText = `
      background: rgba(200,96,96,0.12);
      border: 1px solid #c86060;
      color: #c86060;
      padding: 10px 14px;
      margin: 10px;
      font-family: var(--mono, 'Space Mono', monospace);
      font-size: 11px;
      line-height: 1.5;
      border-radius: 3px;
    `;
    banner.innerHTML = `
      <div style="font-weight:700; text-transform:uppercase; letter-spacing:0.08em; font-size:10px; margin-bottom:4px;">⚠ Catalog won't save on this machine</div>
      <div style="color:#a89060;">
        localStorage is unavailable or restricted (private browsing? corporate policy?).
        Any objects you add here will vanish on refresh.
        Use the "↓ Export" button to save catalog state to a file, and "↑ Import" to load it back.
      </div>
    `;
    // Insert into the top of the body if possible
    if (document.body) document.body.insertBefore(banner, document.body.firstChild);
  }

  // ─────────────────────────────────────────────────────────────────
  // BOOTSTRAP
  // ─────────────────────────────────────────────────────────────────
  function init() {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.appendChild(style);

    // Inject moon strip at top of catalog
    injectMoonStrip();

    // Install the data capture hook FIRST so that subsequent renders by the
    // host populate window._dapTransitCache. Critical for iOS Safari support.
    installDataCaptureHook();

    // Hook into the panel body builder
    installPanelHook();

    // Hook into the exoplanet detail panel builder (for transit finder chart)
    installExoDetailHook();

    // Hook into the exoplanet transit row renderer (for row decorations)
    installExoTransitRowHook();

    // Check localStorage health and warn the user if it's broken
    if (!checkLocalStorageHealth()) {
      showLocalStorageWarning();
    }

    // Install catalog export tracking (badge appears when local changes
    // haven't been exported to a JSON file yet)
    installCatalogExportTracking();
    // Re-check periodically in case the host's catalog loads after init
    setTimeout(installCatalogExportTracking, 1000);
    setTimeout(installCatalogExportTracking, 3000);

    console.log('[DAP patch v2.19] initialized · status badges now use radar ping animation');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
