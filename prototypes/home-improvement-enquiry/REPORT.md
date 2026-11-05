# Mission 002 prototype and recovery report

## Outcome and completed features

Ready for review, not deployed or production-ready. Standalone Home Improvement Enquiry & Quote Assistant at `prototypes/home-improvement-enquiry/`.

Customer: Roofing, Roughcasting, Windows & Doors; relevant project questions, property type, approximate measurements, work, location and notes; editable fictional DEMO rates; non-binding price range and calculation lines; contact details and preferred date/time; explicit request-only confirmation. No messages or real bookings.

Business: separate view with three sample enquiries, requirements, contact details, saved calculation snapshots, preferred visits, search, service/status filters, editable persisted status and summary counts. Browser-local storage only, including visible read/write failure states. Customer input is escaped before HTML rendering.

## Initial checkout issue and recovery

Mission 002 initially ran in `/workspace/agent-001-sandbox` on local branch `work`, at `e5b067b1fe18196ad002cfbfe98b01136c75938a` (initial `main` commit). Its fetch configuration covered only main. AGENTS.md and the build-test-fix skill were absent there, as was Stock Integrity Watchdog. The original implementation followed the user's explicit workflow, but should have checked remote branches before proceeding.

Read-only handoff investigation located both instructions on `feature/agent-001-file-skills-v01`. Recovery was explicitly authorised by the owner, including one descriptive commit and a push of only `feature/agent-001-mission-002` if preservation and test checks passed.

Recovery completed on 2026-11-05:

1. Copied all 16 non-generated prototype files to `/workspace/mission-002-backup/home-improvement-enquiry/`. Includes source, documentation, tests, lockfile and four review screenshots. SHA-256 manifest: `/workspace/mission-002-backup/SHA256-MANIFEST.json`. Generated dependencies, builds and test output were excluded and regenerated.
2. Fetched only `feature/agent-001-file-skills-v01` through the normal approved network mechanism.
3. Created separate worktree `/workspace/agent-001-mission-002`, branch `feature/agent-001-mission-002`, based exactly on `0cc1fc84d00a3c7b7fd9d36511e0d08d8951ffea`.
4. Confirmed destination absent (no collisions), copied from backup, and verified every transferred file against both original and backup SHA-256 hashes before changing documentation or running tests.
5. Verified all 21 tracked base files byte-for-byte against the specified base commit. This includes AGENTS.md, `.agents/skills/build-test-fix/SKILL.md`, and every Stock Integrity Watchdog file. Read the recovered instructions and root README and applied the skill for verification.
6. Installed locked dependencies separately for each application, ran all checks below, and updated only prototype documentation. Browser tests regenerated review captures in the recovered worktree; original captures remain unchanged in the original checkout and backup.

The original working directory and external backup remain intact. No base application or instruction files were changed. The remote file-skills, Stock Watchdog and main branch tips were checked before commit and remain at their original values.

## Acceptance criteria

All requested customer and business features are implemented. Three services, relevant questions, illustrative documented editable DEMO pricing, preferred appointment request and explicit non-booking confirmation are covered. Mobile layout, local-only data, sample enquiries, dashboard status/search/filters, automated tests and run documentation are present. No authentication claims, external runtime services or production deployment.

## Files added

All additions are contained under `prototypes/home-improvement-enquiry/`:

- `.gitignore`, `package.json`, `package-lock.json`: standalone tooling and generated-file exclusions.
- `index.html`: entry point.
- `src/domain.js`: editable rates, calculations, validation, filtering, storage and samples.
- `src/main.js`, `src/style.css`: customer wizard, business dashboard and responsive styling.
- `tests/unit.test.js`: seven domain tests.
- `tests/app.spec.js`, `playwright.config.js`: six scenarios at desktop and mobile widths.
- `README.md`, `REPORT.md`: run instructions, pricing assumptions, limitations and recovery evidence.
- `artifacts/desktop-customer.png`, `desktop-dashboard.png`, `mobile-customer.png`, `mobile-dashboard.png`: review captures refreshed during recovery verification.

Generated `node_modules/`, `dist/` and `test-results/` are ignored. No existing tracked files outside the prototype were changed.

## Recovery verification: actual commands and results

| Application | Command | Observed result |
| --- | --- | --- |
| Mission 002 | `npm ci --cache /tmp/hearth-npm-cache --fetch-retries=0 --fetch-timeout=20000` | Passed; locked dependencies installed |
| Mission 002 | `npm test` | Passed: 7 tests |
| Mission 002 | `npm run build` | Passed; HTML 0.42 kB, CSS 7.71 kB, JS 14.64 kB before gzip |
| Mission 002 | `npm run test:browser` | Passed: 12 Chromium tests in 13.5s |
| Stock Watchdog | `npm ci --cache /tmp/hearth-npm-cache --fetch-retries=0 --fetch-timeout=20000` | Passed; locked dependencies installed |
| Stock Watchdog | `npm test` | Passed: 36 tests across 2 files |
| Stock Watchdog | `npm run build` | Passed |
| Stock Watchdog | `npm run test:e2e` | Passed: 6 Chromium tests in 5.8s |

All recovery checks passed on their first run; no recovery code fixes were needed. Skill retry limit: stop after three unsuccessful fix/retest iterations on the same issue. No tests were weakened or removed. No required checks were left unrun.

Mission 002 unit coverage includes all pricing paths, arithmetic, invalid quantities/areas, appointment validation, filters and storage seeding/corruption. Browser coverage includes persisted submission and status, all service paths, back navigation, invalid quantity handling, incomplete/past-date rejection and storage failure. Six scenarios run at each of 1440×1000 and 375×812. The complete submission/dashboard scenario checks for browser error events. Mobile overflow assertions pass; customer and dashboard screenshots were visually reviewed during initial development and captures regenerated during recovery.

Watchdog regression coverage includes CSV parsing/validation, duplicate handling, leading-zero identifiers, stock comparisons, exports, upload/search/filter/reset, full export of off-page records and mobile layout.

## Initial development fixes (historical)

Initial dependency installation/local server needed approved execution escalation for network/socket restrictions. Removed an unnecessary CSS data-URL import rejected by Vite. Corrected an exact-label test selector to use the accessible combobox role. Fixed dashboard feedback targeting a nested select's sibling instead of its parent label's sibling; updated summary counters immediately. Used Node no-isolation mode to visibly report all seven unit tests in this environment. Initial final verification was 7/7 unit tests, 12/12 browser tests and a passing build; the recovery results above are fresh runs.

## Limits, preview and approval scope

Fictional pricing only; local browser storage; no server, authentication, email, booking or external integration. Drafts do not survive reload; no multi-tab synchronization. Chromium was verified; Safari and Firefox were not. No full automated accessibility audit. See README.md for pricing and all limitations.

Run `npm run dev -- --port 5173` from `/workspace/agent-001-mission-002/prototypes/home-improvement-enquiry/`, then open `http://localhost:5173/#customer` or `#business`. Build preview: `npm run preview -- --port 4173`; run separately from Watchdog browser tests, which also use 4173. No phone-accessible Cloud URL has been established; the available tools do not expose a temporary HTTP preview endpoint.

Owner authorisation covers one descriptive commit and pushing only the new Mission 002 branch once checks pass. No force push, merge, deployment, publishing, existing branch alteration or external integration is authorised or performed. Original prototype and backup must remain preserved. Final commit SHA and push outcome are reported in the handoff after this report is committed.
