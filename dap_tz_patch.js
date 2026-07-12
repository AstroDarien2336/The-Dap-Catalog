/* ═══════════════════════════════════════════════════════════════════
 * DAP Catalog · Timezone Patch v1.0
 * ═══════════════════════════════════════════════════════════════════
 *
 * Fixes the "transit times off by a few hours" bug in the exoplanet
 * transit section.
 *
 * ROOT CAUSE
 *   The host's jdToLocalTime() / jdToLocalDateLabel() format JD via
 *   Date.getHours()/getDate(), which resolve to the VIEWER'S BROWSER
 *   timezone — while the whole tool assumes Paducah/Central and hard-
 *   codes "CDT" labels. Opened on any device not set to America/Chicago
 *   (a phone on Eastern, a laptop on Pacific, anything defaulting to UTC),
 *   every printed time silently shifts by the offset — hence "a few hours."
 *   The underlying JD / ephemeris math is correct; only the display layer
 *   was wrong.
 *
 * WHAT THIS DOES
 *   1. Overrides window.jdToLocalTime + window.jdToLocalDateLabel so all
 *      JD → wall-clock output is pinned to America/Chicago on every device.
 *      This covers the main transit table, twilight bracket, detail panel,
 *      altitude-graph axis, and the .ics / Voyager exports.
 *   2. Exposes window.chicagoTzAbbr(jd) → "CST" / "CDT" (DST-aware).
 *   3. Cosmetic: in winter only (when Central is actually CST), rewrites the
 *      two hard-coded " CDT" subtitle labels to " CST" so the abbreviation
 *      matches the (now-correct) time. No-op the rest of the year.
 *
 * USAGE in index.html — add AFTER the host script and the other patches,
 * near the bottom before </body>:
 *
 *   <script src="dap_tz_patch.js"></script>
 *
 * NOTE: dap_features_patch.js has its own internal jdToHHMM() (a closure,
 * not reachable from here) used for the "Recommended capture" baseline line
 * on each transit row. That one still uses browser time until you change its
 * body to match — see the one-line fix at the bottom of this file.
 *
 * ═══════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  var TZ = 'America/Chicago';

  function jdToMs(jd) { return (jd - 2440587.5) * 86400000; }

  // JD → "HH:MM" in Central, regardless of the viewer's browser timezone.
  function fmtTime(jd) {
    return new Date(jdToMs(jd)).toLocaleTimeString('en-US', {
      timeZone: TZ, hour12: false, hour: '2-digit', minute: '2-digit',
    });
  }

  // JD → "Sat, 12 Jul 2026" in Central (also fixes wrong-day rollover
  // for transits near midnight when viewed off-Central).
  function fmtDateLabel(jd) {
    return new Date(jdToMs(jd)).toLocaleDateString('en-US', {
      timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  // JD → "CST" or "CDT" (DST-aware for the actual date).
  function tzAbbr(jd) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, timeZoneName: 'short',
    }).formatToParts(new Date(jdToMs(jd)));
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === 'timeZoneName') return parts[i].value;
    }
    return 'CT';
  }

  // Install the overrides. Host functions are global `function` declarations
  // in a classic <script>, so reassigning the window property replaces what
  // every internal call site resolves to.
  function install() {
    window.jdToLocalTime      = fmtTime;
    window.jdToLocalDateLabel = fmtDateLabel;
    window.chicagoTzAbbr      = tzAbbr;
    console.log('[DAP tz patch] JD formatters pinned to ' + TZ +
                ' (currently ' + tzAbbr((Date.now() / 86400000) + 2440587.5) + ')');
    maybeFixLabels();
  }

  // Cosmetic label fix: only needed when Central is currently CST but the
  // source hard-codes "CDT". No-op during daylight time. Scoped to the exo
  // section + any exo-* container so it can't touch unrelated text.
  function maybeFixLabels() {
    var nowJd = (Date.now() / 86400000) + 2440587.5;
    if (tzAbbr(nowJd) !== 'CST') return; // it's CDT — nothing to correct

    var pass = function () {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (!n.nodeValue || n.nodeValue.indexOf(' CDT') === -1) return NodeFilter.FILTER_REJECT;
          var el = n.parentElement;
          while (el) {
            var id = el.id || '', cls = (el.className && el.className.toString()) || '';
            if (id.indexOf('exo') !== -1 || cls.indexOf('exo') !== -1) return NodeFilter.FILTER_ACCEPT;
            el = el.parentElement;
          }
          return NodeFilter.FILTER_REJECT;
        },
      });
      var hits = [];
      while (walker.nextNode()) hits.push(walker.currentNode);
      hits.forEach(function (n) { n.nodeValue = n.nodeValue.replace(/ CDT\b/g, ' CST'); });
    };

    pass();
    // Re-run after exo content (re)renders. Debounced, scoped to exo section.
    var host = document.getElementById('exoTransitsSection') || document.body;
    var t;
    new MutationObserver(function () {
      clearTimeout(t); t = setTimeout(pass, 250);
    }).observe(host, { childList: true, subtree: true });
  }

  // Apply immediately (patch tag sits after the host script, so the host
  // globals already exist), and again on DOMContentLoaded to win any
  // odd load-order cases.
  install();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  }
})();

/* ───────────────────────────────────────────────────────────────────
 * OPTIONAL — one-line fix inside dap_features_patch.js
 *
 * That patch's own jdToHHMM() (used for the per-row "Recommended capture"
 * baseline window) is a closure this file can't reach. To pin it to Central
 * too, replace its body with:
 *
 *   function jdToHHMM(jd) {
 *     return new Date((jd - 2440587.5) * 86400000)
 *       .toLocaleTimeString('en-US', { timeZone: 'America/Chicago',
 *         hour12: false, hour: '2-digit', minute: '2-digit' });
 *   }
 * ─────────────────────────────────────────────────────────────────── */
