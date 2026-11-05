# Hearth — Home Improvement Enquiry & Quote Assistant

Standalone local prototype. No external runtime services, authentication, emails or calendar bookings. All prices are fictional DEMO rules, not market prices. Use fictional customer details.

## Run and preview

Requires Node.js 22.12+ (tested with 24.19), npm, and Chromium for browser tests.

```sh
cd /workspace/agent-001-mission-002/prototypes/home-improvement-enquiry
npm ci
npm run dev -- --port 5173
```

Open http://localhost:5173/#customer for the customer wizard and http://localhost:5173/#business for the separate business demonstration. `npm run build` writes `dist/`; `npm run preview -- --port 4173` previews that build locally. No hosting or publication is performed.

```sh
npm test
npm run build
npm run test:browser
```

Browser tests use `/usr/bin/chromium`. Change `executablePath` in `playwright.config.js` if Chromium is elsewhere. Tests run six scenarios at each of 1440×1000 and 375×812. Screenshots are written under `artifacts/`. Test isolation is disabled for Node unit tests to avoid child-process test reporting issues in this managed environment.

## Acceptance criteria

- Three service choices present relevant work and measurement questions; collect property, location and notes.
- Roofing and roughcasting accept 1–1000 m². Openings accept whole quantities (0–50 windows, 0–20 doors, at least one total); notes can capture sizes and frame preferences.
- Show non-binding DEMO range, every calculation line and pricing assumptions before requesting a visit.
- Require name, valid email, phone, a future date and one offered preferred time. Confirm explicitly that the result is a request, with no booking or message sent.
- Business view includes three fictional samples, searchable/filterable enquiries, requirements, contact details, saved calculation, preferred visit and persisted status changes.
- Responsive, labelled controls, keyboard focus styling, validation errors, no horizontal overflow at tested mobile width.
- Unit tests, Chromium tests and production build pass; document limitations and fixes.

## Architecture

Vanilla JavaScript ES modules and CSS, built with Vite. No runtime library or remote assets. `src/domain.js` holds pure calculation, filtering, date validation, sample data and local storage loading. `src/main.js` renders a three-step customer wizard and a hash-routed business view. `src/style.css` contains responsive presentation. Form values persist while navigating steps; unfinished drafts are memory-only. Completed enquiries and status changes persist in localStorage under `hearth-demo-enquiries-v1`. Samples are loaded when the key is absent. Storage failures show errors without claiming a successful save. Corrupt stored data is not overwritten automatically.

## Editable DEMO pricing

Edit `RULES` in `src/domain.js` and increment its version when changing it. Fictional GBP values:

| Item | Demo rate |
| --- | ---: |
| Roofing repair | £35/m² |
| Roofing replacement | £95/m² |
| Roughcasting repair | £28/m² |
| Roughcasting full application | £65/m² |
| Window | £420 each |
| Door | £850 each |
| Setup allowance per enquiry | £180 |

Midpoint = quantity × applicable rate(s) + setup. Range = midpoint ±20%, rounded to whole pounds. Example: roofing repair 40 m² = £1,400 + £180 = £1,580; guide range £1,264–£1,896. New/replacement opening work uses the same unit rates. Property and location are recorded but do not change pricing. There is no separate modelling of tax, access, materials or survey findings. Calculations are saved as snapshots with rule version so subsequent edits do not change historical enquiries. Sample records are recalculated when seeded. To reset, delete only the named localStorage key via browser developer tools and reload.

## Boundaries

Data is local to a browser and origin; it is not shared between devices or ports. Dashboard access is not protected. No production security, availability, lead delivery or real business workflow is implied. Do not use real personal data. Dates use the user's local calendar; fixed example dates are illustrative and may be historical later. No real-time synchronization across tabs. Only Chromium has been verified; no automated accessibility audit or Safari/Firefox verification was performed.

See REPORT.md for results and build-test-fix history.
