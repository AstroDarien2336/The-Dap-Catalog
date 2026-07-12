/* ============================================================================
   DAP Weather Patch  ·  dap_weather_patch.js
   ----------------------------------------------------------------------------
   Drop-in for the DAP Object Catalog. Adds:
     • Gold weather ticker (Open-Meteo, Paducah TX) below the header
     • Red severe-weather ticker (NWS api.weather.gov) above it, only when active
     • Warning -> center modal (pulse + flash + NWR chirp + spoken voice)
     • Watch   -> corner toast (two-note chime)
     • Mesoscale Discussion -> corner toast (soft beep)
     • Local Storm Report   -> corner toast (quick ping); confirmed tornado -> modal
     • Settings: master mute, per-tier mute, volume, do-not-disturb window
   All data sources are keyless. All sounds synthesized in-browser. No deps.

   Usage:  <script src="dap_weather_patch.js" defer></script>
   Test :  DAPWeather.test('tornado-warning' | 'severe-warning' | 'flood-warning'
                          | 'tornado-watch'   | 'mesoscale' | 'lsr-tornado'
                          | 'lsr-wind' | 'lsr-hail' | 'lsr-flood')
   ============================================================================ */
(function () {
  'use strict';
  if (window.__DAPWX_LOADED__) return;      // guard against double-load
  window.__DAPWX_LOADED__ = true;

  /* ───────────────────────── CONFIG ───────────────────────── */
  const CONFIG = {
    lat: 34.0122,
    lon: -100.3028,
    place: 'Paducah, TX',
    tz: 'America/Chicago',
    bortle: '1.5',
    office: 'NWS Lubbock',            // issuing office (shown only as small source tag)
    countyZone: 'TXC101',             // Cottle County UGC (county-based products)
    forecastZone: 'TXZ032',           // Cottle County NWS public forecast zone

    weatherPollMs: 5 * 60 * 1000,     // refresh weather every 5 min
    alertPollMs:   60 * 1000,         // refresh NWS alerts every 60 s
    auxPollMs:     2 * 60 * 1000,     // refresh LSR / MD every 2 min

    weatherSpeedPxSec: 55,            // gold ticker scroll speed (px/sec)
    severeSpeedPxSec:  38,            // red alert ticker speed (px/sec) — lower = slower

    enableLSR: true,                  // Local Storm Reports (IEM) — verify endpoint
    enableMD:  true,                  // Mesoscale Discussions (IEM) — verify endpoint
    lsrRadiusMi: 60,                  // only show reports within this many miles

    voiceOnWarnings: true,            // TTS speaks warnings (warnings only)
    voiceOnConfirmedTornadoLSR: true, // also speak a "tornado on the ground" report
  };

  const STORAGE_KEY = 'dapwx_settings_v1';

  /* ───────────────────────── STATE ───────────────────────── */
  const S = {
    weather: null,
    pressureHist: [],
    alerts: [],
    seen: new Set(),         // ids we've already announced
    activeModal: null,
    audioCtx: null,
    settings: loadSettings(),
  };

  function loadSettings() {
    const def = {
      muted: false,
      volume: 0.6,
      mute: { warning: false, watch: false, md: false, report: false },
      voice: true,
      dndEnabled: false,
      dndStart: '08:00',
      dndEnd: '18:00',
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign(def, JSON.parse(raw));
    } catch (e) {}
    return def;
  }
  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S.settings)); } catch (e) {}
  }

  /* ───────────────────────── ICONS (thin-line) ───────────────────────── */
  const I = {
    tornado: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 4h18"/><path d="M4.5 8h15"/><path d="M6.5 12h11"/><path d="M9 16h6"/><path d="M11 20h2"/></svg>`,
    tstorm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14a4.5 4.5 0 0 1 1-8.9 5.5 5.5 0 0 1 10.5 1.4A3.5 3.5 0 0 1 17 14H7z"/><path d="M11 14l-1.5 4h2.5L10 22"/></svg>`,
    hail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14a4.5 4.5 0 0 1 1-8.9 5.5 5.5 0 0 1 10.5 1.4A3.5 3.5 0 0 1 17 14H7z"/><circle cx="9" cy="18" r="1.4"/><circle cx="13" cy="17" r="1.6"/><circle cx="11" cy="21" r="1.2"/></svg>`,
    flood: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 11c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 6c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>`,
    fire: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c-4 0-7-2.5-7-6.5 0-3 2-4.5 3-7 .5-1.5-.5-3.5-1.5-4.5 4 .5 6.5 4 6.5 7 0 1 .7 2 1.5 2s1.5-1 1.5-2.5c2.5 1.5 3 5 3 7 0 4-3 6.5-7 6.5z"/></svg>`,
    wind: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h12a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h10a3 3 0 1 0-3 3"/></svg>`,
    dust: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 7c4-2 8 2 12 0s4-2 6 0"/><path d="M3 12c4-2 8 2 12 0s4-2 6 0"/><path d="M3 17c4-2 8 2 12 0s4-2 6 0"/></svg>`,
    winter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 2v20"/><path d="M2 12h20"/><path d="M5 5l14 14"/><path d="M19 5L5 19"/><path d="M9 6l3-2 3 2"/><path d="M9 18l3 2 3-2"/><path d="M6 9l-2 3 2 3"/><path d="M18 9l2 3-2 3"/></svg>`,
    md: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4 L19 4 L22 11 L19 20 L5 20 L2 11 Z" stroke-dasharray="2.5 1.5"/><path d="M12 8 L10 13 L13 13 L11 18"/></svg>`,
    report: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22 C 12 22, 4 14, 4 9 a 8 8 0 0 1 16 0 c 0 5-8 13-8 13 Z"/><path d="M13 6 L10.5 10.5 H13 L11 14"/></svg>`,
    gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    mute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M22 9l-6 6"/><path d="M16 9l6 6"/></svg>`,
    sound: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>`,
  };

  /* ───────────────────────── STYLES ───────────────────────── */
  function injectStyles() {
    const css = `
    #dapwx-root { margin: 8px 0 18px; font-family: var(--mono, monospace); }

    /* shared marquee shell */
    .dapwx-marq { position: relative; overflow: hidden; display: flex; align-items: center;
      background: linear-gradient(90deg, rgba(15,15,20,.95) 0%, rgba(20,18,12,.95) 50%, rgba(15,15,20,.95) 100%);
      border-top: 1px solid var(--border2, rgba(212,170,80,.25));
      border-bottom: 1px solid var(--border2, rgba(212,170,80,.25)); }
    .dapwx-marq::before, .dapwx-marq::after { content:''; position:absolute; top:0; bottom:0; width:50px; z-index:2; pointer-events:none; }
    .dapwx-marq::before { left:0; background: linear-gradient(90deg, var(--bg,#07070a) 0%, transparent 100%); }
    .dapwx-marq::after  { right:0; background: linear-gradient(270deg, var(--bg,#07070a) 0%, transparent 100%); }
    .dapwx-label { position:absolute; left:0; top:0; bottom:0; z-index:3; display:flex; align-items:center;
      padding:0 12px; font-size:10px; font-weight:bold; letter-spacing:.15em; text-transform:uppercase;
      box-shadow:4px 0 12px rgba(0,0,0,.6); white-space:nowrap; }
    .dapwx-track { display:flex; gap:28px; white-space:nowrap; will-change:transform; }
    .dapwx-marq:hover .dapwx-track { animation-play-state: paused; }
    @keyframes dapwx-scroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
    .dapwx-item { display:inline-flex; align-items:center; gap:6px; font-size:10px; letter-spacing:.05em; color:var(--text,#f5ecd4); flex-shrink:0; }
    .dapwx-item .k { color:var(--text2,#a89060); font-size:9px; letter-spacing:.15em; text-transform:uppercase; border-right:1px solid var(--border2,rgba(212,170,80,.25)); padding-right:6px; }
    .dapwx-item .v.good{color:var(--green,#7ec87a)} .dapwx-item .v.gold{color:var(--gold3,#f0cc78)}
    .dapwx-item .v.teal{color:var(--teal,#70b8a8)} .dapwx-item .v.warn{color:var(--coral,#c87850)}
    .dapwx-item .v.bad{color:#ff3a4f}
    .dapwx-div { color:var(--text3,#5a4a28); font-size:10px; flex-shrink:0; }

    /* gold weather ticker */
    .dapwx-weather { height:36px; }
    .dapwx-weather .dapwx-label { background:var(--gold,#d4aa50); color:#1a1408; }
    .dapwx-weather .dapwx-track { padding-left:104px; animation: dapwx-scroll 55s linear infinite; }
    .dapwx-gear { position:absolute; right:8px; top:50%; transform:translateY(-50%); z-index:4;
      width:22px; height:22px; color:var(--text2,#a89060); cursor:pointer; opacity:.6; transition:opacity .2s; }
    .dapwx-gear:hover { opacity:1; color:var(--gold3,#f0cc78); }

    /* red severe ticker */
    .dapwx-severe { height:32px; margin-bottom:4px; display:none;
      background:linear-gradient(90deg, rgba(40,10,10,.95) 0%, rgba(60,15,15,.95) 50%, rgba(40,10,10,.95) 100%);
      border-color:#e04848; }
    .dapwx-severe.on { display:flex; }
    .dapwx-severe .dapwx-label { background:#e04848; color:#1a0a0a; animation: dapwx-labelpulse 1.5s ease-out infinite; }
    @keyframes dapwx-labelpulse { 0%,100%{background:#e04848} 50%{background:#ff5a5a} }
    .dapwx-severe .dapwx-track { padding-left:124px; animation: dapwx-scroll 38s linear infinite; }
    .dapwx-atrack-item { font-size:11px; color:var(--text,#f5ecd4); flex-shrink:0; letter-spacing:.05em; }
    .dapwx-atrack-item strong { text-transform:uppercase; letter-spacing:.12em; font-weight:bold; margin-right:8px; padding-right:8px; border-right:1px solid rgba(224,72,72,.4); }
    .dapwx-atrack-item.warn strong { color:#ff3a4f; }
    .dapwx-atrack-item.watch strong { color:#ffd23d; border-right-color:rgba(255,210,61,.4); }
    .dapwx-atrack-item.md strong { color:#a06ec0; border-right-color:rgba(160,110,192,.4); }
    .dapwx-atrack-item.report strong { color:#e89050; border-right-color:rgba(232,144,80,.4); }

    /* ── modal (warnings) ── */
    .dapwx-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.55); backdrop-filter:blur(3px);
      z-index:9998; opacity:0; transition:opacity .3s; }
    .dapwx-backdrop.on { opacity:1; }
    .dapwx-modal { position:fixed; left:50%; top:50%; transform:translate(-50%,-50%) scale(.9);
      z-index:9999; width:min(620px, calc(100vw - 32px)); max-height:calc(100vh - 32px); overflow:auto;
      background:linear-gradient(180deg,#1a0808,#0a0506); border:2px solid #ff3a4f; border-radius:4px;
      opacity:0; transition:opacity .35s cubic-bezier(.16,1,.3,1), transform .35s cubic-bezier(.16,1,.3,1);
      box-shadow:0 0 0 1px rgba(255,58,79,.5),0 0 40px rgba(255,58,79,.6),0 20px 60px rgba(0,0,0,.8); }
    .dapwx-modal.on { opacity:1; transform:translate(-50%,-50%) scale(1); animation: dapwx-cardpulse 1.8s ease-out infinite; }
    @keyframes dapwx-cardpulse {
      0%,100%{ box-shadow:0 0 0 1px rgba(255,58,79,.5),0 0 30px rgba(255,58,79,.5),0 20px 60px rgba(0,0,0,.8); }
      50%    { box-shadow:0 0 0 2px rgba(255,58,79,.9),0 0 60px rgba(255,58,79,.85),0 20px 60px rgba(0,0,0,.8); } }

    .dapwx-card-head { display:flex; align-items:center; gap:10px; padding:9px 14px; color:#1a0408; background:#ff3a4f;
      animation: dapwx-headflash 1.5s ease-out infinite; }
    @keyframes dapwx-headflash { 0%,100%{background:#ff3a4f} 50%{background:#ff5a6f} }
    .dapwx-card-icon { width:26px; height:26px; flex-shrink:0; }
    .dapwx-card-icon svg { width:100%; height:100%; }
    .dapwx-card-type { font-size:11px; font-weight:bold; letter-spacing:.18em; text-transform:uppercase; flex:1; }
    .dapwx-card-timer { font-size:11px; font-weight:bold; letter-spacing:.08em; }
    .dapwx-card-x { background:rgba(0,0,0,.2); border:1px solid rgba(0,0,0,.3); color:#1a0408; width:22px; height:22px;
      border-radius:50%; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; font-size:13px; line-height:1; }
    .dapwx-card-body { padding:14px 16px 16px; }
    .dapwx-card-headline { font-family:var(--display,'Times New Roman',serif); font-size:18px; color:#fff; line-height:1.3; margin-bottom:4px; }
    .dapwx-card-headline strong { color:#ff3a4f; font-weight:normal; }
    .dapwx-card-sub { font-size:9px; color:rgba(255,255,255,.5); letter-spacing:.12em; text-transform:uppercase; margin-bottom:12px; }
    .dapwx-metrics { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
    .dapwx-metric { background:rgba(255,255,255,.04); border:1px solid rgba(255,58,79,.25); padding:7px 10px; border-radius:2px; }
    .dapwx-metric .ml { font-size:7px; letter-spacing:.18em; color:rgba(255,255,255,.45); text-transform:uppercase; }
    .dapwx-metric .mv { font-family:var(--display,'Times New Roman',serif); font-size:15px; color:#fff; margin-top:2px; }
    .dapwx-metric .mv.flagged { color:#ff3a4f; }
    .dapwx-nws { background:rgba(0,0,0,.4); border-left:3px solid #ff3a4f; padding:10px 12px; margin-bottom:12px;
      font-size:10px; line-height:1.6; color:rgba(255,255,255,.85); max-height:160px; overflow:auto; }
    .dapwx-nws .lbl { color:#ff3a4f; font-weight:bold; letter-spacing:.1em; text-transform:uppercase; }
    .dapwx-action { font-family:var(--display,'Times New Roman',serif); font-size:17px; color:#ff3a4f; text-align:center; padding:8px; font-style:italic; letter-spacing:.05em; animation: dapwx-actionpulse 1s ease-out infinite; }
    @keyframes dapwx-actionpulse { 0%,100%{opacity:1} 50%{opacity:.6} }
    .dapwx-src { font-size:8px; letter-spacing:.1em; color:rgba(255,255,255,.35); text-transform:uppercase; text-align:right; margin-top:8px; }

    /* themed modal variants */
    .dapwx-modal.cyan   { border-color:#5ec0e0; } .dapwx-modal.cyan .dapwx-card-head{background:#5ec0e0;color:#04101a;animation:none}
    .dapwx-modal.cyan .dapwx-card-headline strong,.dapwx-modal.cyan .dapwx-metric .mv.flagged,.dapwx-modal.cyan .dapwx-action,.dapwx-modal.cyan .dapwx-nws .lbl{color:#5ec0e0}
    .dapwx-modal.cyan .dapwx-nws{border-left-color:#5ec0e0}.dapwx-modal.cyan .dapwx-metric{border-color:rgba(94,192,224,.25)}
    .dapwx-modal.coral  { border-color:#c87850; } .dapwx-modal.coral .dapwx-card-head{background:#c87850;color:#1a0a04;animation:none}
    .dapwx-modal.coral .dapwx-card-headline strong,.dapwx-modal.coral .dapwx-metric .mv.flagged,.dapwx-modal.coral .dapwx-action,.dapwx-modal.coral .dapwx-nws .lbl{color:#c87850}
    .dapwx-modal.coral .dapwx-nws{border-left-color:#c87850}.dapwx-modal.coral .dapwx-metric{border-color:rgba(200,120,80,.25)}

    /* ── corner toasts (watch / md / report) ── */
    .dapwx-toasts { position:fixed; right:16px; bottom:16px; z-index:9997; display:flex; flex-direction:column; gap:10px; width:min(360px, calc(100vw - 32px)); }
    .dapwx-toast { background:linear-gradient(180deg,#1a1206,#0a0704); border:2px solid #ffd23d; border-radius:4px; overflow:hidden;
      transform:translateY(20px); opacity:0; transition:opacity .35s, transform .35s cubic-bezier(.16,1,.3,1); position:relative;
      box-shadow:0 0 24px rgba(255,210,61,.3),0 10px 28px rgba(0,0,0,.7); }
    .dapwx-toast.on { transform:translateY(0); opacity:1; }
    .dapwx-toast.md { border-color:#a06ec0; box-shadow:0 0 24px rgba(160,110,192,.3),0 10px 28px rgba(0,0,0,.7); }
    .dapwx-toast.report { border-color:#e89050; box-shadow:0 0 24px rgba(232,144,80,.3),0 10px 28px rgba(0,0,0,.7); }
    .dapwx-toast.report.tornado { border-color:#ff3a4f; }
    .dapwx-toast .dapwx-card-head { background:#ffd23d; color:#1a1408; animation:none; }
    .dapwx-toast.md .dapwx-card-head { background:#a06ec0; color:#1a0a1f; }
    .dapwx-toast.report .dapwx-card-head { background:#e89050; color:#1a0a04; }
    .dapwx-toast.report.tornado .dapwx-card-head { background:#ff3a4f; color:#1a0408; }
    .dapwx-toast .dapwx-card-headline { font-size:14px; }
    .dapwx-toast .dapwx-card-headline strong { color:#ffd23d; }
    .dapwx-toast.md .dapwx-card-headline strong { color:#a06ec0; }
    .dapwx-toast.report .dapwx-card-headline strong { color:#e89050; }
    .dapwx-toast .dapwx-quote { background:rgba(0,0,0,.4); border-left:3px solid #e89050; padding:8px 10px; margin-bottom:8px;
      font-family:var(--display,serif); font-size:12px; color:#fff; font-style:italic; line-height:1.4; }
    .dapwx-toast .dapwx-quote .qsrc { display:block; margin-top:4px; font-family:var(--mono,monospace); font-size:8px; letter-spacing:.1em; color:rgba(255,255,255,.5); text-transform:uppercase; font-style:normal; }
    .dapwx-progress { height:2px; background:rgba(255,255,255,.15); }
    .dapwx-progress > i { display:block; height:100%; background:#ffd23d; width:100%; transform-origin:left; }
    .dapwx-toast.md .dapwx-progress > i { background:#a06ec0; }
    .dapwx-toast.report .dapwx-progress > i { background:#e89050; }

    /* ── settings panel ── */
    .dapwx-settings { position:fixed; right:16px; top:16px; z-index:10000; width:min(320px, calc(100vw - 32px));
      background:var(--bg2,#0c0c10); border:1px solid var(--border2,rgba(212,170,80,.25)); border-radius:6px;
      box-shadow:0 16px 48px rgba(0,0,0,.7); padding:16px; display:none; }
    .dapwx-settings.on { display:block; }
    .dapwx-settings h3 { font-family:var(--display,serif); font-size:18px; color:var(--gold3,#f0cc78); font-style:italic; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; }
    .dapwx-settings h3 .x { cursor:pointer; color:var(--text2); font-size:16px; }
    .dapwx-set-row { display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border,rgba(212,170,80,.12)); }
    .dapwx-set-row:last-child { border-bottom:none; }
    .dapwx-set-row label { font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--text2,#a89060); }
    .dapwx-sw { width:38px; height:20px; border-radius:10px; background:var(--bg4,#17171e); border:1px solid var(--border2,rgba(212,170,80,.25)); position:relative; cursor:pointer; transition:background .2s; }
    .dapwx-sw.on { background:var(--gold,#d4aa50); }
    .dapwx-sw i { position:absolute; top:1px; left:1px; width:16px; height:16px; border-radius:50%; background:#fff; transition:left .2s; }
    .dapwx-sw.on i { left:19px; }
    .dapwx-settings input[type=range] { width:120px; accent-color:var(--gold,#d4aa50); }
    .dapwx-settings input[type=time] { background:var(--bg3,#111116); border:1px solid var(--border2,rgba(212,170,80,.25)); color:var(--text,#f5ecd4); font-family:var(--mono,monospace); font-size:11px; padding:3px 5px; border-radius:3px; }
    .dapwx-test { margin-top:12px; padding-top:12px; border-top:1px dashed var(--border,rgba(212,170,80,.12)); }
    .dapwx-test button { font-family:var(--mono,monospace); font-size:9px; letter-spacing:.08em; text-transform:uppercase; background:rgba(212,170,80,.1); border:1px solid rgba(212,170,80,.3); color:var(--gold3,#f0cc78); padding:5px 8px; border-radius:3px; cursor:pointer; margin:2px; }
    .dapwx-test button:hover { background:rgba(212,170,80,.2); }

    /* enable-sounds banner */
    .dapwx-soundbar { position:fixed; left:50%; bottom:18px; transform:translateX(-50%) translateY(20px); z-index:10001;
      display:flex; align-items:center; gap:12px; background:var(--bg2,#0c0c10); border:1px solid var(--gold,#d4aa50);
      border-radius:6px; padding:10px 14px; box-shadow:0 12px 36px rgba(0,0,0,.7),0 0 24px rgba(212,170,80,.25);
      opacity:0; transition:opacity .35s, transform .35s cubic-bezier(.16,1,.3,1); max-width:calc(100vw - 32px); }
    .dapwx-soundbar.on { opacity:1; transform:translateX(-50%) translateY(0); }
    .dapwx-soundbar .ic { width:22px; height:22px; color:var(--gold3,#f0cc78); flex-shrink:0; }
    .dapwx-soundbar .txt { font-family:var(--mono,monospace); font-size:11px; letter-spacing:.04em; color:var(--text,#f5ecd4); line-height:1.4; }
    .dapwx-soundbar .txt b { color:var(--gold3,#f0cc78); font-weight:normal; }
    .dapwx-soundbar .go { font-family:var(--mono,monospace); font-size:10px; letter-spacing:.1em; text-transform:uppercase;
      background:var(--gold,#d4aa50); color:#1a1408; border:none; padding:8px 14px; border-radius:3px; cursor:pointer; font-weight:bold; white-space:nowrap; }
    .dapwx-soundbar .go:hover { background:var(--gold3,#f0cc78); }
    .dapwx-soundbar .dismiss { color:var(--text2,#a89060); cursor:pointer; font-size:16px; line-height:1; padding:0 2px; }
    `;
    const el = document.createElement('style');
    el.id = 'dapwx-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* ───────────────────────── AUDIO ENGINE ───────────────────────── */
  function ctx() {
    if (!S.audioCtx) S.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (S.audioCtx.state === 'suspended') S.audioCtx.resume();
    return S.audioCtx;
  }
  // unlock audio on first user gesture (browser policy)
  function unlockAudioOnce() {
    const unlock = () => { try { ctx(); } catch (e) {} S.audioReady = true; const b = document.getElementById('dapwx-soundbar'); if (b) b.classList.remove('on'); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
  }
  // explicit banner so the very first alert is never silent on an unattended dashboard
  function showSoundBanner() {
    if (S.audioReady) return;
    if (document.getElementById('dapwx-soundbar')) return;
    const b = document.createElement('div');
    b.id = 'dapwx-soundbar'; b.className = 'dapwx-soundbar';
    b.innerHTML = `<div class="ic">${I.sound}</div><div class="txt">Enable <b>alert sounds</b> so warnings are heard, not just shown.</div><button class="go">Enable</button><span class="dismiss" title="dismiss">×</span>`;
    document.body.appendChild(b);
    requestAnimationFrame(() => b.classList.add('on'));
    b.querySelector('.go').onclick = () => { try { ctx(); } catch (e) {} S.audioReady = true; chirp(1); b.classList.remove('on'); setTimeout(() => b.remove(), 350); };
    b.querySelector('.dismiss').onclick = () => { b.classList.remove('on'); setTimeout(() => b.remove(), 350); };
  }
  function vol() { return S.settings.muted ? 0 : S.settings.volume; }
  function tone(freq, dur, type, v, t0) {
    if (vol() <= 0) return;
    const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(c.destination);
    const s = c.currentTime + (t0 || 0), peak = (v || .25) * vol();
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(peak, s + .012);
    g.gain.setValueAtTime(peak, s + dur - .04);
    g.gain.exponentialRampToValueAtTime(.0008, s + dur);
    o.start(s); o.stop(s + dur + .02);
  }
  // sound per tier (honors per-tier mute + DND)
  function chirp(pulses) { const d = .28, gap = .12; for (let i = 0; i < pulses; i++) tone(1050, d, 'sine', .3, i * (d + gap)); }
  function watchChime() { tone(880, .2, 'sine', .22, 0); tone(660, .32, 'sine', .22, .18); }
  function mdBeep() { tone(550, .4, 'sine', .18, 0); }
  function reportPing() { tone(1320, .15, 'triangle', .2, 0); }
  function speak(text) {
    if (!S.settings.voice || S.settings.muted) return;
    if (!('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1; u.pitch = 1; u.volume = Math.min(1, vol() + .3); speechSynthesis.speak(u); } catch (e) {}
  }
  function inDND() {
    if (!S.settings.dndEnabled) return false;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = S.settings.dndStart.split(':').map(Number);
    const [eh, em] = S.settings.dndEnd.split(':').map(Number);
    const st = sh * 60 + sm, en = eh * 60 + em;
    return st <= en ? (cur >= st && cur < en) : (cur >= st || cur < en);
  }
  function playFor(tier, opts) {
    opts = opts || {};
    if (S.settings.muted || inDND()) return;
    if (S.settings.mute[tier]) return;
    if (tier === 'warning') { chirp(opts.pulses || 2); if (CONFIG.voiceOnWarnings && opts.speak) setTimeout(() => speak(opts.speak), (opts.pulses || 2) * 400 + 200); }
    else if (tier === 'watch') watchChime();
    else if (tier === 'md') mdBeep();
    else if (tier === 'report') {
      if (opts.confirmedTornado) { chirp(3); if (CONFIG.voiceOnConfirmedTornadoLSR && opts.speak) setTimeout(() => speak(opts.speak), 1300); }
      else reportPing();
    }
  }

  /* ───────────────────────── ASTRONOMY ───────────────────────── */
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  function jd(date) { return date.getTime() / 86400000 + 2440587.5; }
  function dT(date) { return jd(date) - 2451545.0; }
  function sunEq(date) {
    const n = dT(date);
    const L = (280.460 + 0.9856474 * n) % 360;
    const g = ((357.528 + 0.9856003 * n) % 360) * D2R;
    const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
    const eps = (23.439 - 0.0000004 * n) * D2R;
    return { ra: Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)), dec: Math.asin(Math.sin(eps) * Math.sin(lam)) };
  }
  function gmst(date) { let v = (280.46061837 + 360.98564736629 * dT(date)) % 360; return v < 0 ? v + 360 : v; }
  function altOf(ra, dec, date) {
    const lat = CONFIG.lat * D2R;
    let H = (gmst(date) + CONFIG.lon) * D2R - ra;
    return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)) * R2D;
  }
  function sunAlt(date) { const s = sunEq(date); return altOf(s.ra, s.dec, date); }
  function moonEq(date) {
    const d = dT(date);
    const L = 218.316 + 13.176396 * d, M = (134.963 + 13.064993 * d) * D2R, F = (93.272 + 13.229350 * d) * D2R;
    const lam = (L + 6.289 * Math.sin(M)) * D2R, bet = (5.128 * Math.sin(F)) * D2R, eps = 23.439 * D2R;
    const ra = Math.atan2(Math.sin(lam) * Math.cos(eps) - Math.tan(bet) * Math.sin(eps), Math.cos(lam));
    const dec = Math.asin(Math.sin(bet) * Math.cos(eps) + Math.cos(bet) * Math.sin(eps) * Math.sin(lam));
    return { ra, dec };
  }
  function moonAlt(date) { const m = moonEq(date); return altOf(m.ra, m.dec, date); }
  function moonPhase(date) {
    const days = jd(date) - 2451550.1, syn = 29.530588853;
    let p = (days % syn) / syn; if (p < 0) p += 1;
    const illum = (1 - Math.cos(2 * Math.PI * p)) / 2;
    let name = 'New';
    if (p < .03 || p >= .97) name = 'New';
    else if (p < .22) name = 'Wax Crescent';
    else if (p < .28) name = 'First Qtr';
    else if (p < .47) name = 'Wax Gibbous';
    else if (p < .53) name = 'Full';
    else if (p < .72) name = 'Wan Gibbous';
    else if (p < .78) name = 'Last Qtr';
    else name = 'Wan Crescent';
    return { illum: Math.round(illum * 100), name };
  }
  // astronomical dark window (sun < -18deg) — sample tonight
  function astroDark() {
    const now = new Date();
    const start = new Date(now); start.setHours(15, 0, 0, 0);   // start scan at 15:00 local
    let dusk = null, dawn = null, prev = sunAlt(start) < -18;
    for (let m = 1; m <= 900; m++) {                            // scan 15h ahead, 1-min steps
      const t = new Date(start.getTime() + m * 60000);
      const dark = sunAlt(t) < -18;
      if (dark && !prev && !dusk) dusk = t;
      if (!dark && prev && dusk && !dawn) { dawn = t; break; }
      prev = dark;
    }
    return { dusk, dawn };
  }
  function fmtTime(d) { if (!d) return '—'; return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: CONFIG.tz }); }

  /* ───────────────────── WEATHER (NWS observed + Open-Meteo forecast) ─────────────────────
     Current conditions come from the nearest NWS observation station (OBSERVED, not modeled).
     Open-Meteo supplies forecast-only bits (sunrise/sunset, today high/low, UV, rain chance)
     and is the fallback if a station field is missing. */
  async function resolveStation() {
    if (S.obsUrl) return;
    try {
      const p = await (await fetch(`https://api.weather.gov/points/${CONFIG.lat},${CONFIG.lon}`, { headers: { Accept: 'application/geo+json' } })).json();
      const props = p.properties || {};
      if (props.county) CONFIG.countyZone = props.county.split('/').pop();
      if (props.forecastZone) CONFIG.forecastZone = props.forecastZone.split('/').pop();
      const stationsUrl = props.observationStations;
      if (!stationsUrl) return;
      const s = await (await fetch(stationsUrl, { headers: { Accept: 'application/geo+json' } })).json();
      const st = s.features && s.features[0];
      if (st) { S.obsId = st.properties.stationIdentifier; S.obsUrl = st.id + '/observations/latest'; }
    } catch (e) {}
  }
  async function fetchObs() {
    await resolveStation();
    if (!S.obsUrl) return;
    try {
      const o = await (await fetch(S.obsUrl, { headers: { Accept: 'application/geo+json' } })).json();
      if (o && o.properties) S.obs = o.properties;
    } catch (e) {}
  }
  async function fetchWeather() {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}`
      + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day`
      + `&hourly=precipitation_probability,uv_index,pressure_msl`
      + `&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,uv_index_max`
      + `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=${encodeURIComponent(CONFIG.tz)}&forecast_days=1`;
    try { const r = await fetch(u); if (r.ok) S.weather = await r.json(); } catch (e) {}
    await fetchObs();
    renderWeather();
  }

  function compass(deg) { if (deg == null) return ''; const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']; return dirs[Math.round(deg / 22.5) % 16]; }
  const C2F = c => c == null ? null : c * 9 / 5 + 32;
  const KMH2MPH = k => k == null ? null : k * 0.621371;
  const MS2MPH = m => m == null ? null : m * 2.236936;
  const PA2INHG = p => p == null ? null : p * 0.0002953;
  const M2MI = m => m == null ? null : m * 0.000621371;
  function num() { for (let i = 0; i < arguments.length; i++) { const v = arguments[i]; if (v != null && !Number.isNaN(v)) return v; } return null; }
  function obsVal(f) { const o = S.obs; return o && o[f] && o[f].value != null ? o[f].value : null; }
  function obsWindMph(f) { const o = S.obs; if (!o || !o[f] || o[f].value == null) return null; const uc = o[f].unitCode || ''; return uc.indexOf('m_s') >= 0 ? MS2MPH(o[f].value) : KMH2MPH(o[f].value); }
  function cloudFromLayers(layers) {
    if (!layers) return null;
    if (!layers.length) return { pct: 0, word: 'Clear' };
    const rank = { CLR: 0, SKC: 0, NCD: 0, NSC: 0, CAVOK: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4, VV: 4 };
    let max = 0; layers.forEach(l => { const r = rank[l.amount]; if (r > max) max = r; });
    return { pct: [0, 19, 44, 75, 100][max], word: ['Clear', 'Few clouds', 'Scattered', 'Broken', 'Overcast'][max] };
  }
  function pressureTrend() {
    const h = S.weather && S.weather.hourly; if (!h || !h.pressure_msl) return '';
    const now = new Date(); const idx = h.time.findIndex(t => new Date(t) > now);
    if (idx < 4) return '→';
    const d = h.pressure_msl[idx - 1] - h.pressure_msl[idx - 4];
    if (d <= -1.5) return '↘↘'; if (d < -0.4) return '↘';
    if (d >= 1.5) return '↗↗'; if (d > 0.4) return '↗'; return '→';
  }
  function rainChance() {
    const h = S.weather && S.weather.hourly; if (!h || !h.precipitation_probability) return null;
    const now = new Date(); const idx = h.time.findIndex(t => new Date(t) > now); if (idx < 0) return null;
    let m = 0; for (let i = idx; i < Math.min(idx + 6, h.precipitation_probability.length); i++) m = Math.max(m, h.precipitation_probability[i] || 0);
    return m;
  }
  function curUV() {
    const h = S.weather && S.weather.hourly; if (!h || !h.uv_index) return null;
    const now = new Date(); const idx = h.time.findIndex(t => new Date(t) > now); return idx > 0 ? Math.round(h.uv_index[idx - 1]) : null;
  }
  function isDay() { const c = S.weather && S.weather.current; return c ? c.is_day === 1 : true; }

  // Set a marquee's animation duration so it scrolls at a CONSTANT px/sec,
  // regardless of how much content is in it. Distance per loop = one content
  // copy = scrollWidth/2 (content is duplicated for seamless looping).
  function setMarqueeSpeed(trackId, pxPerSec) {
    const t = document.getElementById(trackId);
    if (!t) return;
    requestAnimationFrame(() => {
      const dist = t.scrollWidth / 2;
      if (dist <= 0) return;
      const dur = Math.max(10, dist / pxPerSec);   // never faster than a sane floor
      t.style.animationDuration = dur.toFixed(1) + 's';
    });
  }

  function renderWeather() {
    const c = (S.weather && S.weather.current) || {};
    const o = S.obs;
    // prefer OBSERVED (NWS station) values, fall back to Open-Meteo model
    const temp = num(C2F(obsVal('temperature')), c.temperature_2m);
    const dew  = num(C2F(obsVal('dewpoint')), c.dew_point_2m);
    const rh   = num(obsVal('relativeHumidity'), c.relative_humidity_2m);
    let   feels = num(C2F(obsVal('heatIndex')), C2F(obsVal('windChill')));
    if (feels == null && c.apparent_temperature != null) feels = c.apparent_temperature;
    const wind = num(obsWindMph('windSpeed'), c.wind_speed_10m);
    const gust = num(obsWindMph('windGust'), c.wind_gusts_10m);
    const wdir = compass(num(obsVal('windDirection'), c.wind_direction_10m));
    const inHg = num(PA2INHG(obsVal('barometricPressure')), c.pressure_msl != null ? c.pressure_msl * 0.02953 : null);
    const vis  = M2MI(obsVal('visibility'));
    const cond = (o && o.textDescription) ? o.textDescription : null;
    let   cloud = o ? cloudFromLayers(o.cloudLayers) : null;
    if (!cloud && c.cloud_cover != null) cloud = { pct: Math.round(c.cloud_cover), word: null };
    const d  = S.weather && S.weather.daily;
    const hi = d && d.temperature_2m_max ? Math.round(d.temperature_2m_max[0]) : null;
    const lo = d && d.temperature_2m_min ? Math.round(d.temperature_2m_min[0]) : null;
    const sr = d && d.sunrise ? new Date(d.sunrise[0]) : null;
    const ss = d && d.sunset ? new Date(d.sunset[0]) : null;
    const uv = curUV();
    const rain = rainChance();
    const pArrow = pressureTrend();

    if (temp == null && !cond) return;  // nothing to show yet

    const items = [];
    if (cond) items.push(['Now', cond, 'gold']);
    if (temp != null) items.push(['Temp', Math.round(temp) + '°F', '']);
    if (feels != null && temp != null && Math.abs(feels - temp) >= 3) items.push(['Feels', Math.round(feels) + '°F', feels >= 100 ? 'bad' : feels >= 90 ? 'warn' : feels <= 32 ? 'teal' : '']);
    if (rh != null) items.push(['Humidity', Math.round(rh) + '%', rh > 85 ? 'warn' : '']);
    if (dew != null) items.push(['Dew Pt', Math.round(dew) + '°F', '']);
    if (wind != null) items.push(['Wind', (Math.round(wind) === 0 ? 'Calm' : Math.round(wind) + (gust != null && gust >= wind + 6 ? ' G ' + Math.round(gust) : '') + ' mph ' + wdir), (wind >= 25 || (gust || 0) >= 35) ? 'warn' : '']);
    if (inHg != null) items.push(['Pressure', inHg.toFixed(2) + '" ' + pArrow, '']);
    if (vis != null) items.push(['Visibility', (vis >= 10 ? '10+' : vis.toFixed(0)) + ' mi', vis < 3 ? 'warn' : '']);
    if (cloud) items.push(['Clouds', (cloud.word ? cloud.word + ' · ' : '') + cloud.pct + '%', cloud.pct <= 25 ? 'good' : cloud.pct <= 60 ? 'gold' : 'warn']);
    if (rain != null) items.push(['Rain (6h)', rain + '%', rain >= 60 ? 'warn' : rain >= 30 ? 'gold' : 'good']);
    if (uv != null && isDay()) items.push(['UV', uv + (uv >= 8 ? ' Very High' : uv >= 6 ? ' High' : uv >= 3 ? ' Moderate' : ' Low'), uv >= 8 ? 'bad' : uv >= 6 ? 'warn' : '']);
    if (hi != null && lo != null) items.push(['Today', 'H ' + hi + '° / L ' + lo + '°', '']);
    if (sr) items.push(['Sunrise', fmtTime(sr), 'gold']);
    if (ss) items.push(['Sunset', fmtTime(ss), 'gold']);

    const one = items.map(([k, v, cls]) => `<span class="dapwx-item"><span class="k">${k}</span><span class="v ${cls}">${v}</span></span><span class="dapwx-div">·</span>`).join('');
    const track = document.getElementById('dapwx-weather-track');
    if (track) { track.innerHTML = one + one; setMarqueeSpeed('dapwx-weather-track', CONFIG.weatherSpeedPxSec); }   // duplicate for seamless loop
  }

  /* ───────────────────────── NWS ALERTS ───────────────────────── */
  const WARN_EVENTS = /Warning/i, WATCH_EVENTS = /Watch/i;
  function eventIcon(ev) {
    ev = ev.toLowerCase();
    if (ev.includes('tornado')) return I.tornado;
    if (ev.includes('thunderstorm')) return I.tstorm;
    if (ev.includes('flood')) return I.flood;
    if (ev.includes('fire') || ev.includes('red flag')) return I.fire;
    if (ev.includes('dust')) return I.dust;
    if (ev.includes('wind')) return I.wind;
    if (ev.includes('winter') || ev.includes('snow') || ev.includes('ice') || ev.includes('blizzard')) return I.winter;
    return I.tstorm;
  }
  function eventTheme(ev) {
    ev = ev.toLowerCase();
    if (ev.includes('flood')) return 'cyan';
    if (ev.includes('wind') || ev.includes('dust') || ev.includes('fire') || ev.includes('red flag') || ev.includes('winter') || ev.includes('snow') || ev.includes('ice')) return 'coral';
    return '';   // red default
  }
  function warnPulses(ev) { ev = ev.toLowerCase(); if (ev.includes('tornado')) return 3; if (ev.includes('thunderstorm') || ev.includes('flood')) return 2; return 1; }
  function actionFor(ev) {
    ev = ev.toLowerCase();
    if (ev.includes('tornado')) return 'TAKE COVER NOW.';
    if (ev.includes('flood')) return "Turn around · don't drown.";
    if (ev.includes('thunderstorm')) return 'Move indoors.';
    if (ev.includes('dust')) return 'Pull aside · stay alive.';
    if (ev.includes('fire') || ev.includes('red flag')) return 'No outdoor burning.';
    if (ev.includes('wind')) return 'Secure loose objects.';
    return 'Stay weather aware.';
  }

  async function fetchAlerts() {
    // Query by COUNTY + FORECAST ZONE (reliable for county/zone-issued products and
    // for storm-based warnings that clip the county) AND by point (covers polygon
    // warnings over the exact spot). Merge + dedupe by id. The point query alone
    // can miss alerts — NWS issues alerts by zone/county, so we query those directly.
    const zones = [CONFIG.countyZone, CONFIG.forecastZone].filter(Boolean).join(',');
    const urls = [];
    if (zones) urls.push(`https://api.weather.gov/alerts/active?zone=${zones}`);
    urls.push(`https://api.weather.gov/alerts/active?point=${CONFIG.lat},${CONFIG.lon}`);
    try {
      const sets = await Promise.all(urls.map(u =>
        fetch(u, { headers: { Accept: 'application/geo+json' } })
          .then(r => r.ok ? r.json() : { features: [] })
          .catch(() => ({ features: [] }))
      ));
      const byId = {};
      sets.forEach(d => (d.features || []).forEach(f => { const p = f.properties; if (p && p.event && p.id) byId[p.id] = p; }));
      const feats = Object.values(byId);
      S.alerts = feats;
      renderSevereTicker();
      feats.forEach(p => {
        const id = p.id || (p.event + p.expires);
        if (S.seen.has(id)) return; S.seen.add(id);
        announceAlert(p);
      });
    } catch (e) { /* keep last-good */ }
  }
  function announceAlert(p) {
    const ev = p.event;
    if (WARN_EVENTS.test(ev)) {
      showWarningModal(p);
      playFor('warning', { pulses: warnPulses(ev), speak: `${ev}. ${(p.areaDesc || '').split(';')[0]}. ${actionFor(ev)}` });
    } else if (WATCH_EVENTS.test(ev)) {
      showToast('watch', { icon: eventIcon(ev), type: ev, headline: (p.areaDesc || '').split(';')[0], sub: `${p.senderName || CONFIG.office} · until ${fmtExpire(p.expires)}`, action: actionFor(ev) }, 8000);
      playFor('watch');
    } else {
      // advisories etc -> toast like a watch
      showToast('watch', { icon: eventIcon(ev), type: ev, headline: (p.areaDesc || '').split(';')[0], sub: `${p.senderName || CONFIG.office}`, action: actionFor(ev) }, 8000);
      playFor('watch');
    }
  }
  function fmtExpire(iso) { try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: CONFIG.tz }); } catch (e) { return '—'; } }

  function renderSevereTicker() {
    const bar = document.getElementById('dapwx-severe');
    const track = document.getElementById('dapwx-severe-track');
    if (!bar || !track) return;
    const live = (S.alerts || []).concat(S._aux || []);
    if (!live.length) { bar.classList.remove('on'); return; }
    bar.classList.add('on');
    const items = live.map(p => {
      const ev = p.event, cls = WARN_EVENTS.test(ev) ? 'warn' : (p._kind === 'md' ? 'md' : (p._kind === 'report' ? 'report' : 'watch'));
      const area = (p.areaDesc || p._area || '').split(';')[0];
      const exp = p.expires ? ' · until ' + fmtExpire(p.expires) : '';
      const txt = p._tickerText || `${area}${exp}`;
      return `<span class="dapwx-atrack-item ${cls}"><strong>${ev}</strong>${txt}</span>`;
    }).join('');
    track.innerHTML = items + items;
    setMarqueeSpeed('dapwx-severe-track', CONFIG.severeSpeedPxSec);
  }

  /* ───────────── AUX: Mesoscale Discussions + Local Storm Reports (IEM) ─────────────
     NOTE: These IEM endpoints are best-known but UNVERIFIED from here (sandbox can't
     reach them). They fail gracefully. Verify on MyWeb; adjust URLs if needed.        */
  function haversineMi(lat, lon) {
    const R = 3958.8, dLat = (lat - CONFIG.lat) * D2R, dLon = (lon - CONFIG.lon) * D2R;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(CONFIG.lat * D2R) * Math.cos(lat * D2R) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  async function fetchAux() {
    S._aux = [];
    if (CONFIG.enableMD) { try { await fetchMD(); } catch (e) {} }
    if (CONFIG.enableLSR) { try { await fetchLSR(); } catch (e) {} }
    renderSevereTicker();
  }
  async function fetchMD() {
    // IEM SPC Mesoscale Convective Discussion for a point
    const u = `https://mesonet.agron.iastate.edu/json/spcmcd.py?lat=${CONFIG.lat}&lon=${CONFIG.lon}`;
    const r = await fetch(u); if (!r.ok) return; const d = await r.json();
    (d.mcds || d.products || []).forEach(m => {
      const num = m.product_id || m.year + '-' + m.num || ('#' + (m.num || ''));
      const obj = { event: 'Mesoscale Discussion', _kind: 'md', _area: 'NW Texas', _tickerText: ` · MD ${num}`, _num: num, _concerning: m.concerning || m.most_prob_tags || '', _raw: m.product_text || m.text || '' };
      S._aux.push(obj);
      const id = 'md-' + num;
      if (!S.seen.has(id)) { S.seen.add(id); showToast('md', { icon: I.md, type: 'Mesoscale Discussion', headline: 'NW Texas — ' + (obj._concerning || 'convective potential'), sub: `SPC · MD ${num}`, action: 'Watch issuance possible.' }, 6000); playFor('md'); }
    });
  }
  async function fetchLSR() {
    // IEM LSR geojson for recent reports near the point (last 2h)
    const ets = new Date(), sts = new Date(ets.getTime() - 2 * 3600 * 1000);
    const fmt = d => d.toISOString().slice(0, 19) + 'Z';
    const u = `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?sts=${fmt(sts)}&ets=${fmt(ets)}&wfos=LUB`;
    const r = await fetch(u); if (!r.ok) return; const d = await r.json();
    (d.features || []).forEach(f => {
      const c = f.geometry && f.geometry.coordinates; if (!c) return;
      const lat = c[1], lon = c[0]; const dist = haversineMi(lat, lon);
      if (dist > CONFIG.lsrRadiusMi) return;
      const pr = f.properties || {}; const typ = (pr.typetext || pr.type || 'Report');
      const isTorn = /tornado/i.test(typ);
      const id = 'lsr-' + (pr.valid || '') + '-' + typ + '-' + Math.round(lat * 100);
      const obj = { event: 'LSR · ' + typ, _kind: 'report', _area: pr.city || pr.county || '', _tickerText: ` · ${pr.magnitude ? pr.magnitude + ' ' : ''}${pr.city || ''} (${Math.round(dist)} mi)`, _raw: pr.remark || '' };
      S._aux.push(obj);
      if (!S.seen.has(id)) {
        S.seen.add(id);
        const icon = isTorn ? I.tornado : /hail/i.test(typ) ? I.hail : /flood/i.test(typ) ? I.flood : /wind|tstm|gust/i.test(typ) ? I.wind : I.report;
        showToast('report' + (isTorn ? ' tornado' : ''), {
          icon, type: 'LSR · ' + typ, headline: `${Math.round(dist)} mi · ${pr.city || pr.county || ''}`,
          sub: `${pr.source || 'Report'} · ${fmtExpire(pr.valid)}`, quote: pr.remark || '', qsrc: pr.source || '',
          action: isTorn ? 'TAKE COVER NOW.' : 'Stay sheltered.'
        }, isTorn ? 14000 : (dist <= 30 ? 12000 : 10000));
        if (isTorn) { showWarningModalRaw({ type: 'LSR · Tornado on Ground', headline: `${Math.round(dist)} mi · ${pr.city || pr.county || ''}`, sub: `Confirmed report · ${pr.source || ''}`, icon: I.tornado, theme: '', nws: pr.remark || 'Tornado reported on the ground.', action: 'TAKE COVER NOW.', expires: null }); playFor('report', { confirmedTornado: true, speak: `Tornado on the ground reported ${Math.round(dist)} miles away. Take cover now.` }); }
        else playFor('report');
      }
    });
  }

  /* ───────────────────────── CARDS ───────────────────────── */
  function ensureToastHost() {
    let h = document.getElementById('dapwx-toasts');
    if (!h) { h = document.createElement('div'); h.id = 'dapwx-toasts'; h.className = 'dapwx-toasts'; document.body.appendChild(h); }
    return h;
  }
  function showToast(kindClass, o, ttl) {
    const host = ensureToastHost();
    const el = document.createElement('div');
    el.className = 'dapwx-toast ' + kindClass;
    el.innerHTML = `
      <div class="dapwx-card-head">
        <div class="dapwx-card-icon">${o.icon}</div>
        <div class="dapwx-card-type">${o.type}</div>
        <div class="dapwx-card-x">×</div>
      </div>
      <div class="dapwx-card-body">
        <div class="dapwx-card-headline"><strong>${o.headline}</strong></div>
        <div class="dapwx-card-sub">${o.sub || ''}</div>
        ${o.quote ? `<div class="dapwx-quote">${o.quote}<span class="qsrc">— ${o.qsrc || ''}</span></div>` : ''}
        ${o.action ? `<div class="dapwx-action" style="font-size:13px">${o.action}</div>` : ''}
      </div>
      <div class="dapwx-progress"><i></i></div>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    const bar = el.querySelector('.dapwx-progress > i');
    if (bar) { bar.style.transition = `transform ${ttl}ms linear`; requestAnimationFrame(() => { bar.style.transform = 'scaleX(0)'; }); }
    const kill = () => { el.classList.remove('on'); setTimeout(() => el.remove(), 350); };
    el.querySelector('.dapwx-card-x').onclick = kill;
    el.onclick = (e) => { if (!e.target.closest('.dapwx-card-x')) { /* future: expand to modal */ } };
    setTimeout(kill, ttl);
  }
  function dismissModal() { if (!S.activeModal) return; const { modal, backdrop, timer } = S.activeModal; modal.classList.remove('on'); backdrop.classList.remove('on'); if (timer) clearInterval(timer); setTimeout(() => { modal.remove(); backdrop.remove(); }, 350); S.activeModal = null; }
  function showWarningModal(p) {
    const ev = p.event;
    showWarningModalRaw({
      type: ev, theme: eventTheme(ev), icon: eventIcon(ev),
      headline: (p.areaDesc || '').split(';')[0], sub: `${p.senderName || CONFIG.office} · issued ${fmtExpire(p.effective || p.sent)}`,
      nws: p.description || p.headline || '', instruction: p.instruction || '', action: actionFor(ev),
      expires: p.expires, source: p.senderName || CONFIG.office
    });
  }
  function showWarningModalRaw(o) {
    dismissModal();
    const backdrop = document.createElement('div'); backdrop.className = 'dapwx-backdrop';
    const modal = document.createElement('div'); modal.className = 'dapwx-modal' + (o.theme ? ' ' + o.theme : '');
    const nwsHtml = (o.nws || '').replace(/(HAZARD\.\.\.|SOURCE\.\.\.|IMPACT\.\.\.)/g, '<span class="lbl">$1</span>');
    modal.innerHTML = `
      <div class="dapwx-card-head">
        <div class="dapwx-card-icon">${o.icon}</div>
        <div class="dapwx-card-type">${o.type}</div>
        <div class="dapwx-card-timer" data-exp="${o.expires || ''}">${o.expires ? '—' : ''}</div>
        <div class="dapwx-card-x">×</div>
      </div>
      <div class="dapwx-card-body">
        <div class="dapwx-card-headline"><strong>${o.headline || ''}</strong></div>
        <div class="dapwx-card-sub">${o.sub || ''}</div>
        ${o.nws ? `<div class="dapwx-nws">${nwsHtml}${o.instruction ? '<br><br><span class="lbl">INSTRUCTION…</span> ' + o.instruction : ''}</div>` : ''}
        <div class="dapwx-action">${o.action || ''}</div>
        ${o.source ? `<div class="dapwx-src">Source · ${o.source}</div>` : ''}
      </div>`;
    document.body.appendChild(backdrop); document.body.appendChild(modal);
    requestAnimationFrame(() => { backdrop.classList.add('on'); modal.classList.add('on'); });
    const close = () => dismissModal();
    modal.querySelector('.dapwx-card-x').onclick = close; backdrop.onclick = close;
    let timer = null;
    const tEl = modal.querySelector('.dapwx-card-timer');
    if (o.expires) {
      const upd = () => { const ms = new Date(o.expires) - new Date(); if (ms <= 0) { tEl.textContent = 'EXPIRED'; clearInterval(timer); return; } const s = Math.floor(ms / 1000); tEl.textContent = `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`; };
      upd(); timer = setInterval(upd, 1000);
    }
    S.activeModal = { modal, backdrop, timer };
  }

  /* ───────────────────────── SETTINGS PANEL ───────────────────────── */
  function buildSettings() {
    const p = document.createElement('div'); p.className = 'dapwx-settings'; p.id = 'dapwx-settings';
    const sw = (on) => `<div class="dapwx-sw ${on ? 'on' : ''}"><i></i></div>`;
    p.innerHTML = `
      <h3>Weather Alerts <span class="x">×</span></h3>
      <div class="dapwx-set-row"><label>Master mute</label><div data-set="muted" class="dapwx-sw ${S.settings.muted?'on':''}"><i></i></div></div>
      <div class="dapwx-set-row"><label>Volume</label><input type="range" min="0" max="1" step="0.05" value="${S.settings.volume}" data-set="volume"></div>
      <div class="dapwx-set-row"><label>Spoken voice (warnings)</label><div data-set="voice" class="dapwx-sw ${S.settings.voice?'on':''}"><i></i></div></div>
      <div class="dapwx-set-row"><label>Mute warnings</label><div data-mute="warning" class="dapwx-sw ${S.settings.mute.warning?'on':''}"><i></i></div></div>
      <div class="dapwx-set-row"><label>Mute watches</label><div data-mute="watch" class="dapwx-sw ${S.settings.mute.watch?'on':''}"><i></i></div></div>
      <div class="dapwx-set-row"><label>Mute mesoscale</label><div data-mute="md" class="dapwx-sw ${S.settings.mute.md?'on':''}"><i></i></div></div>
      <div class="dapwx-set-row"><label>Mute reports</label><div data-mute="report" class="dapwx-sw ${S.settings.mute.report?'on':''}"><i></i></div></div>
      <div class="dapwx-set-row"><label>Do-not-disturb</label><div data-set="dndEnabled" class="dapwx-sw ${S.settings.dndEnabled?'on':''}"><i></i></div></div>
      <div class="dapwx-set-row"><label>DND window</label><span><input type="time" data-set="dndStart" value="${S.settings.dndStart}"> – <input type="time" data-set="dndEnd" value="${S.settings.dndEnd}"></span></div>
      <div class="dapwx-test">
        <button data-test="tornado-warning">Tornado Warn</button>
        <button data-test="severe-warning">Severe Warn</button>
        <button data-test="flood-warning">Flood Warn</button>
        <button data-test="tornado-watch">Watch</button>
        <button data-test="mesoscale">Mesoscale</button>
        <button data-test="lsr-tornado">LSR Tornado</button>
        <button data-test="lsr-hail">LSR Hail</button>
      </div>`;
    document.body.appendChild(p);
    p.querySelector('.x').onclick = () => p.classList.remove('on');
    p.querySelectorAll('[data-set]').forEach(el => {
      const key = el.getAttribute('data-set');
      if (el.classList.contains('dapwx-sw')) el.onclick = () => { S.settings[key] = !S.settings[key]; el.classList.toggle('on', S.settings[key]); saveSettings(); };
      else el.oninput = () => { S.settings[key] = el.type === 'range' ? parseFloat(el.value) : el.value; saveSettings(); };
    });
    p.querySelectorAll('[data-mute]').forEach(el => { const k = el.getAttribute('data-mute'); el.onclick = () => { S.settings.mute[k] = !S.settings.mute[k]; el.classList.toggle('on', S.settings.mute[k]); saveSettings(); }; });
    p.querySelectorAll('[data-test]').forEach(el => { el.onclick = () => DAPWeather.test(el.getAttribute('data-test')); });
  }

  /* ───────────────────────── SCAFFOLD ───────────────────────── */
  function buildScaffold() {
    const header = document.querySelector('.header'); if (!header) return false;
    const root = document.createElement('div'); root.id = 'dapwx-root';
    root.innerHTML = `
      <div class="dapwx-marq dapwx-severe" id="dapwx-severe">
        <div class="dapwx-label">⚠ NWS Alerts</div>
        <div class="dapwx-track" id="dapwx-severe-track"></div>
      </div>
      <div class="dapwx-marq dapwx-weather">
        <div class="dapwx-label">◉ Live · Paducah</div>
        <div class="dapwx-track" id="dapwx-weather-track">
          <span class="dapwx-item"><span class="k">Sky</span><span class="v">loading…</span></span>
        </div>
        <div class="dapwx-gear" id="dapwx-gear" title="Alert settings">${I.gear}</div>
      </div>`;
    header.insertAdjacentElement('afterend', root);
    document.getElementById('dapwx-gear').onclick = () => { const p = document.getElementById('dapwx-settings'); if (p) p.classList.toggle('on'); };
    return true;
  }

  /* ───────────────────────── TEST API ───────────────────────── */
  window.DAPWeather = {
    refresh() { fetchWeather(); fetchAlerts(); fetchAux(); },
    settings: S.settings,
    test(kind) {
      const A = (o) => o;
      switch (kind) {
        case 'tornado-warning': showWarningModalRaw({ type: 'Tornado Warning', icon: I.tornado, theme: '', headline: 'Cottle County, TX — radar rotation', sub: 'NWS Lubbock · issued now', nws: 'HAZARD... Tornado and quarter size hail. SOURCE... Radar indicated rotation. IMPACT... Flying debris will be dangerous to those caught without shelter.', instruction: 'Take cover now. Move to a basement or an interior room on the lowest floor of a sturdy building.', action: 'TAKE COVER NOW.', expires: new Date(Date.now() + 33 * 60000).toISOString(), source: 'NWS Lubbock' }); playFor('warning', { pulses: 3, speak: 'Tornado Warning. Cottle County. Take cover now.' }); break;
        case 'severe-warning': showWarningModalRaw({ type: 'Severe T-Storm Warning', icon: I.tstorm, theme: '', headline: 'Cottle, King — damaging storm', sub: 'NWS Lubbock · moving E @ 40 mph', nws: 'HAZARD... 70 mph wind gusts and quarter size hail. SOURCE... Radar indicated. IMPACT... Expect wind damage to roofs, siding, and trees.', action: 'Move indoors.', expires: new Date(Date.now() + 45 * 60000).toISOString(), source: 'NWS Lubbock' }); playFor('warning', { pulses: 2, speak: 'Severe Thunderstorm Warning. Cottle County. Move indoors.' }); break;
        case 'flood-warning': showWarningModalRaw({ type: 'Flash Flood Warning', icon: I.flood, theme: 'cyan', headline: 'Pease River basin — rising water', sub: 'NWS Lubbock · 3.2"/hr rates', nws: 'HAZARD... Life threatening flash flooding. SOURCE... Radar and gauges. IMPACT... Roadways and low water crossings will flood.', action: "Turn around · don't drown.", expires: new Date(Date.now() + 120 * 60000).toISOString(), source: 'NWS Lubbock' }); playFor('warning', { pulses: 2, speak: 'Flash Flood Warning. Cottle County. Turn around, do not drown.' }); break;
        case 'tornado-watch': showToast('watch', { icon: I.tornado, type: 'Tornado Watch', headline: 'NW Texas — conditions favorable', sub: 'SPC · PDS · 22 counties · until 11 PM', action: 'Stay weather aware.' }, 8000); playFor('watch'); break;
        case 'mesoscale': showToast('md', { icon: I.md, type: 'Mesoscale Discussion', headline: 'NW Texas — supercell potential', sub: 'SPC · MD #0847 · watch likely', action: 'Watch issuance possible.' }, 6000); playFor('md'); break;
        case 'lsr-tornado': showWarningModalRaw({ type: 'LSR · Tornado on Ground', icon: I.tornado, theme: '', headline: '3 mi N of Paducah — confirmed', sub: 'Cottle Co. Sheriff · 9:18 PM', nws: 'Tornado on the ground in open country north of town. Visible debris cloud.', action: 'TAKE COVER NOW.', expires: null, source: 'Cottle Co. Sheriff' }); playFor('report', { confirmedTornado: true, speak: 'Tornado on the ground 3 miles north of Paducah. Take cover now.' }); break;
        case 'lsr-wind': showToast('report', { icon: I.wind, type: 'LSR · Wind Gust', headline: 'Paducah Mesonet — 90 mph gust', sub: 'West Texas Mesonet · KCDS', quote: '90 MPH wind gust measured. Power lines down.', qsrc: 'WTM · Cottle Co.', action: 'Avoid travel.' }, 10000); playFor('report'); break;
        case 'lsr-hail': showToast('report', { icon: I.hail, type: 'LSR · Hail', headline: '5 mi SW — 1.75" hail (golf ball)', sub: 'Skywarn spotter · 9:12 PM', quote: 'Hail to 1.75 inches. Roof damage reported.', qsrc: 'Skywarn SP-2147', action: 'Stay sheltered.' }, 10000); playFor('report'); break;
        case 'lsr-flood': showToast('report', { icon: I.flood, type: 'LSR · Flooding', headline: 'FM-2278 — road impassable', sub: 'TxDOT · 10:04 PM', quote: 'Water over roadway approx 2 ft deep.', qsrc: 'TxDOT', action: "Turn around · don't drown." }, 10000); playFor('report'); break;
        default: console.warn('Unknown test:', kind);
      }
    }
  };

  /* ───────────────────────── INIT ───────────────────────── */
  function init() {
    injectStyles();
    if (!buildScaffold()) { console.warn('[dapwx] .header not found; aborting'); return; }
    buildSettings();
    unlockAudioOnce();
    showSoundBanner();
    fetchWeather(); fetchAlerts(); fetchAux();
    setInterval(fetchWeather, CONFIG.weatherPollMs);
    setInterval(fetchAlerts, CONFIG.alertPollMs);
    if (CONFIG.enableLSR || CONFIG.enableMD) setInterval(fetchAux, CONFIG.auxPollMs);
    // periodic light re-render so astro times stay current
    setInterval(renderWeather, 60 * 1000);
    // keep scroll speed constant if the window resizes
    let rzT; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { setMarqueeSpeed('dapwx-weather-track', CONFIG.weatherSpeedPxSec); setMarqueeSpeed('dapwx-severe-track', CONFIG.severeSpeedPxSec); }, 200); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
