# DAP Object Catalog

A browser-based catalog and observation-planning tool for tracking astronomical objects — variable stars, cataclysmic variables, exoplanet-transit targets, and deep-sky objects — built as a single-page web app with no backend server.

**Live site:** -> https://www.myweb.ttu.edu/dperla/DAP_Catalog/

---

## Intro

The DAP Object Catalog is an all-in-one observation-planning tool I built to serve two roles at once: logging targets for my astrophotography, and supporting my ongoing research into cataclysmic variable systems — symbiotic novae, recurrent novae, dwarf novae, and related eruptive objects. As well as upcoming exoplanet transits directy from the NASA Exoplanet Archive directly from TESS and any new canidates.

Beyond cataloging, it actively monitors targets of interest, pulling live data and surfacing alerts when an object shows unusual activity so I can catch an outburst or eruption as it happens rather than after the fact. It also connects directly to the National Weather Service (NWS) for severe-weather reporting at my remote site, the West Texas Observatory (WTO) which is located in the most darkest skies (Bortle 1), giving me early warning of any conditions that could threaten the equipment. Roof safety itself is handled by the observatory's own automated precautions; DAP's role is timely notification, flagging developing threats before they become a problem.

## Technologies Used

- **Vanilla JavaScript / HTML / CSS** — no framework; single-file app architecture for portability and zero build step
- **TTU MyWeb** — hosting for the live site
- **Cloudflare Workers** — lightweight proxies for CORS-restricted astronomy services (SIMBAD queries and DSS sky-survey imagery)
- **Client-side persistence** — catalog state saved in the browser (`localStorage`) <!-- TODO: confirm current save mechanism now that it's on MyWeb -->
- **External data sources** — SIMBAD (object resolution), Digitized Sky Survey (DSS) images, ZTF and AAVSO (light curves), Gaia (color–magnitude diagrams), NWS (weather alerts), NOAA GOES-19 satellite IR, Open-Meteo (conditions), NEA TESS

## Features

### Object catalog

A catalog that makes observation planning much easier. It covers all variants of stellar types along with galaxy morphology, star-cluster variants, and galaxy-cluster variants. Each page holds up to 25 targets and provides live progress tracking, showing which targets are actively being imaged, which are planned for upcoming sessions, and which are flagged as urgent at a collaborator's request.

### Per-object detail panel

Selecting a target opens a full observation-planning dossier — not just a data readout, but everything needed to decide *whether, when, and how* to image an object, in one view. The panel is classification-aware: it surfaces different modules depending on object type.

**Identification & overview**
- DSS finder thumbnail, cross-catalog IDs (NGC / UGC / PGC), and classification tags (e.g. Hubble type `Sbc`, "Grand Design" arm structure)
- Auto-generated scientific overview compiled from Wikipedia and SIMBAD, with a one-click **Regenerate** and a sourced, timestamped footer
- Physical-properties grid — distance, redshift, radial velocity, apparent/absolute magnitude, B–V color, physical diameter, angular dimensions, and morphological type

**Observability, computed for my site**
- Coordinates, constellation, best-months window, transit altitude, and circumpolar status for the observing location
- A **"Tonight" altitude/airmass curve** with rise/set, transit time and altitude, minimum airmass, astronomical dark window, and the best low-airmass (X < 1.3) window
- **Moon panel** — phase and illumination, moon rise/set, angular separation from the target, interference rating, and next new-moon date, with an LRGB-suitability recommendation
- A **14-night planner** showing dark-window and moon conditions for each upcoming night
 Per-target **imaging plan** — rig, exposure recipe, filter set, status, priority, and difficulty rating
 
  **Imaging log**
- Per-target **imaging plan** — rig, exposure recipe, filter set, status, priority, and difficulty rating
-  tracks total integration time against a per-target goal, broken down per filter (L / R / G / B), with a session table (date, frames, exposure, filter, integration, notes) and a completion percentage. Supports **Project** vs. **Monitoring** log modes, add-session entry, and CSV export

**Rig-aware framing & imagery**
- **Framing simulation** for my actual rig (Lacerta 250/1000 + QHY268M) — object size vs. field of view, pixel scale, sensor dimensions, and a mosaic-vs-single-frame recommendation
- **Interactive FOV viewer** — rotatable, zoomable field overlay drawn over switchable sky surveys (DSS2 / PanSTARRS / SDSS / 2MASS)
- **Surface-brightness overlay** — isophote contours (μ ≈ 20 → 27) drawn on the survey image, each mapped to an estimated integration time for my rig from a Bortle 1.5 site (inner disk ~1 hr L, outer arms ~8 hr LRGB, faint halo ~15 hr). This is the piece I'm proudest of: it turns a surface-brightness profile into a concrete exposure plan.

**Live transient monitoring**
- **ZTF activity via ALeRCE** (cone search) and recent **TNS / ATEL alerts** within a search radius, so I'm warned of any transient activity on or near a target

** Plots visibil by oject type
- Gloublar clusters and open star clusters show CMD plots that are populated from Gaia DR3
- All variable star types  have connection directly through the AAVSO API to pull varability plots that spad from 7 days to one year.

**Planning, context & references**
- Per-target **imaging plan** (rig, exposure recipe, filter set, status, priority, difficulty rating) and an **imaging-session log**
- **Constellation context** — wide-field DSS view with constellation overlay and your other catalog objects sorted by angular distance
- **Embedded WorldWide Telescope** sky view, plus quick-launch to Stellarium, Aladin, SIMBAD, and NED
- Personal notes and one-click external references — SIMBAD, NED, ADS, Aladin Lite, Wikipedia, AAVSO VSX


### Variable-star photometry

A curated catalog of 47 variable stars built specifically for **undergraduate photometry labs** — each star is selected and tagged for the lab exercise it best supports.

- **Organized by lab type** — period determination, eclipsing-binary (EB) timing, period–luminosity (P–L) relation, long-period monitoring, CV / outburst monitoring, and photometry calibration
- **Filterable by variable class** (Cepheid, RR Lyrae, δ Scuti, eclipsing, Mira, semi-regular, R CrB, CV) and by a three-tier ranking — **Prime** (flagship, in-season, bright, short-period), **Flagship** (pedagogically rich but possibly out of season), and **Standard**
- **Season-aware** — surfaces which stars are in season and transiting tonight, so labs can be scheduled around what's actually observable

Each star opens a detail page with:
- A **phase-folded AAVSO V-band light curve**, folded on the star's period from thousands of observations over a multi-year baseline, alongside data-quality metrics (observation count, time span, cycles covered, σ scatter, filter)
- A **canonical shape reference** for the variable class (e.g. the asymmetric Cepheid saw-tooth from radial pulsation) to compare the real curve against
- **Per-rig photometry recommendations** — per-frame exposure, cadence, filter, and defocus guidance worked out for each telescope (e.g. *"defocus required — bright star saturates focused in 0.54 s,"* SNR ~167/frame)
- A **hand-curated scientific overview** for flagship targets — why the star matters and what students learn from it — plus full astrophysical parameters and deep links to Aladin Lite, SIMBAD, AAVSO VSX, and the AAVSO Light Curve Generator

AAVSO data refreshes weekly.
### Narrowband photometry

A curated catalog of 17 emission-line targets built for **SHO (Hα / OIII / SII) narrowband labs**, focused on objects whose science lives in their emission lines — symbiotic stars, Wolf–Rayet / Mira variables, and planetary-nebula central stars.

- **Filter-availability matrix** — maps each of my rigs to the narrowband filters it actually carries (Lacerta 250/1000 with Chroma 5 nm Hα/OIII/SII at the Bortle 1.5 site; the LX200 + QHY268M as broadband-only; the LX200 + SBIG STC-428P with Baader 5 nm), so recommendations only suggest what's physically possible on a given setup
- **Organized by target class** with the relevant emission diagnostic — e.g. symbiotic stars tracked by Hα equivalent width (accretion-zone emission that tracks state changes), PN central stars by OIII
- **Guidance on where narrowband helps** — Hα for symbiotic/WR/Mira stellar variability, OIII for ionized nebulae — and where it doesn't (SII has limited stellar use)

Each target opens a detail page with:
- A **hand-curated scientific overview** and a **system-architecture schematic** (e.g. the red-giant → wind-capture → accretion-zone → white-dwarf structure of a symbiotic binary)
- An **Hα activity-history timeline** — photometric state vs. time with annotated events and a marker for the current observing date
- **State-aware photometry recommendations** *(the standout)* — exposure and cadence that change with the target's state, because a symbiotic in outburst vs. quiescence needs wildly different exposures (e.g. ~1 s active vs. ~24 s quiescent), plus a warning when Hα equivalent width drops below the threshold where narrowband stops adding value
- Full parameters and deep links to Aladin Lite, SIMBAD, AAVSO VSX, and ARAS spectra


### Live sky chart

Zenith-centered, azimuthal-equidistant all-sky projection (N up / E left) with zoom and drag-pan, showing what's up from the observing site in real time.

### Exoplanet transits

A full transit-planning engine that scores every upcoming transit against each of my rigs and tells me which are actually worth capturing — then hands the chosen target off to the telescope.

- **Hundreds of transits tracked** with a live clock and an "N active now" indicator; the view updates in real time, and the sky map alone plots 630 transits (75 rated PRIME, 190 partial)
- **PRIME scoring** — every transit is scored independently against each rig on host brightness, transit depth, mid-transit altitude, and coverage/baseline. A transit earns PRIME only if it clears 4+ points, is fully observable, and stays above 30° altitude. **Per-rig envelopes** encode each telescope's sweet-spot magnitude range and depth thresholds (e.g. Lacerta: V 9–11 sweet spot, depth ≥ 10 ppt for full points)
- **Sky map of transit paths** — an all-sky plot of every transit arc, color-coded PRIME / regular / partial, with ingress–mid–egress markers and a live "position right now" that refreshes every ~60 s; click any arc to open that transit's detail page

Each transit opens a detail page with:
- **Transit timing** — ingress / mid / egress (local + BJD), duration, period, cycles since epoch, and **ephemeris uncertainty** surfaced explicitly, since TESS ephemerides drift with each cycle (one target showed ±900+ minutes)
- An **altitude-through-the-night curve** with airmass at mid-transit, a meridian-flip check, moon proximity, and the percentage of the transit observable within the dark window
- A **system view** — top-down orbit shape, transit geometry (impact parameter), and sky field
- A **finder chart** with the selected rig's FOV framing box overlaid on a DSS image
- **Per-rig photometry feasibility** — for each telescope / camera / optical config, the recommended filter, exposure, binning, pixel scale, and **expected detection significance** (e.g. Chroma R, 55 s × 250 → ~23σ), with regime notes (read-limited, saturation warnings)
- Full **planet, atmosphere, host-star, and system** parameters, plus links to NASA Exoplanet Archive, Swarthmore, SIMBAD, Aladin Lite, ETD, and MAST

Ephemerides come from **TESS Objects of Interest (TOI)**, with disposition flags (KP = known planet, PC = candidate).

### Pointing & telescope handoff

Planning only matters if the scope ends up on target, so DAP closes the loop: from a target's page it exports a ready-to-run **sequence file for the acquisition software that drives the mount** — NINA target file (`.xml`), Sequence Generator Pro (`.sgf`), or Voyager target list (`.txt`). The planned coordinates and imaging recipe flow straight into the software that slews, plate-solves, and centers the telescope, so a target chosen in DAP can be acquired without re-entering anything by hand. Any target can also be added to the main DAP catalog in one click.

### Observing opportunities (OPPS)

Surfaces time-sensitive events worth pointing at — meteor-shower peaks and other observing windows.
In the case any upcoming events like oppositions, meteor showers, reocurrent nova events  etc they will show up as an alert or urgent alerts that may come up unexpected from TNS

### Notifications & alerts

- **Severe-weather alerts** — NWS watches/warnings for the observing location, with an on-screen severe-weather ticker
- **Audible alerting** — NWR-style chirp tones and text-to-speech for warnings
- **Weather & sky conditions** — GOES-19 satellite IR imagery and current conditions

### Data & persistence

Catalog state is saved client-side (`localStorage`).

## Process

I built the catalog incrementally around a single-file architecture, then hit the classic constraint of a client-only app: everything astronomy-related lives behind CORS-restricted or auth-gated services. That drove a key decision — standing up **Cloudflare Workers as thin proxies** for SIMBAD and DSS, so the browser could pull survey imagery and object data directly without a backend of my own.

As the object model grew, I refactored the classification system so the UI renders only the fields that make sense for a given object type, rather than a flat form. For maintainability on a large single HTML file, I moved fixes and enhancements into **modular external patch files** (e.g. timezone and weather patches) that override behavior at load time instead of editing the monolith directly.

## What I Learned

- **A client-only app can still be data-rich — you design around the constraints.** Cloudflare Workers for proxying CORS-locked services let me integrate professional astronomy data with no server of my own to run.
- **Time and timezones are where astronomy apps quietly break.** A transit-display bug traced back to browser-local time methods that silently produced wrong results on machines outside the observatory's timezone; the fix pinned all conversions to a fixed timezone and handled daylight-saving transitions explicitly.
- **Host-environment quirks are real.** An iOS Safari failure in the transit badges came from an unreliable pattern for reading `let`-scoped globals; wrapping the compute function to cache results into a stable `window` property fixed it across browsers.
- **Modular patches beat editing a monolith.** Keeping fixes in separate load-time patch files kept a large single-file app maintainable.

## Improvements / Roadmap

- Componentize the single-file app to make features easier to test in isolation
- Broaden site support beyond a single hard-coded observing location (configurable coordinates/timezone)
- Add automated tests around the transit and coordinate math, which are the highest-risk areas
- Offline/PWA support so the catalog is usable at dark-sky sites with poor connectivity
- add for each target of interest for photography, an embeded panel that shows related targets from othe photograhers to determine the righ exposure and imaging plan for my setup and duration of integration

## AI Assistance

I used AI tools (Anthropic's Claude) as a pair-programming and debugging aid during development — mainly for working through tricky bugs (the timezone and iOS Safari issues above), sketching implementation options, and reviewing code. Architecture, data model, feature decisions, and final implementation were my own; the AI accelerated iteration rather than replacing the design work.

---

<!-- TODO before publishing:
     1. Paste the MyWeb URL into the "Live site" line up top.
     2. Confirm what "DAP" stands for and spell it out in the intro if you'd like.
     3. Tell me what "ZTS" refers to so I can add it to the detail-panel feature.
     4. Confirm the current save/persistence mechanism now that it's on MyWeb.
     5. Add a screenshot/GIF (biggest single improvement).
     6. Add a LICENSE file and reference it here (MIT is a common, recruiter-friendly default).
     7. Set the repo "About" description + topics: astronomy, astrophotography, javascript,
        cloudflare-workers, exoplanets, variable-stars, observing-tool.
     8. Pin this repo on your GitHub profile. -->
