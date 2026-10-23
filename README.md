# Stock Integrity Watchdog 0.1

A responsive, browser-only dashboard for comparing two stock inventory CSV files. Upload Inventory A (reference) and Inventory B, review validation problems and stock differences, search/filter results, and download an issues-only CSV report. Downloadable examples deliberately include two quantity mismatches and one missing SKU in each direction.

## Run locally

Requires Node.js 20.19+ or 22.12+ (validated with Node 24) and npm.

```sh
npm ci --cache .npm-cache
npm run dev -- --host 127.0.0.1
```

Open the local address printed by Vite. Use the existing repository checkout; no worktree is needed. Download both example CSVs from the upload panels, then upload each into its corresponding panel. Expected: 6 unique SKUs per file, 3 matching SKUs, 2 quantity mismatches, 2 missing SKUs, and no duplicate warnings. Export includes all detected issues, regardless of the table's active search or filter. Reset clears loaded inventory and filters.

## CSV format and validation

```csv
sku,product_name,quantity
DESK-01,"Desk lamp, brass",24
DESK-02,Notebook,0
```

- Required, case-sensitive headers: `sku`, `product_name`, `quantity`. Header whitespace is trimmed; extra columns are allowed but each row must have the correct number of fields.
- PapaParse supports UTF-8 BOMs, quoted commas, escaped quotes, multiline fields, CRLF, and blank lines. Use comma-separated UTF-8 text.
- Surrounding SKU whitespace is trimmed. SKU case remains meaningful; `abc` and `ABC` are distinct. Empty SKUs and control characters are rejected. Product names never determine identity; empty names are allowed because SKU is the identifier.
- Quantities must be nonnegative whole numbers (0 through JavaScript's maximum safe integer, 9,007,199,254,740,991). Decimals, negative numbers, exponent notation, nonnumeric text, and empty quantities are rejected. Surrounding quantity whitespace is allowed; values are never guessed or rounded.
- Every repeated normalized SKU is flagged once per file and all its occurrences are excluded. Duplicate quantities are never summed or chosen arbitrarily.
- A SKU with an invalid quantity or duplicate in either inventory is excluded from comparison in both, preventing false missing/matching classifications. Other valid SKUs can still be compared.
- File-level errors (empty/header-only files, missing/duplicate columns, parser errors) pause comparison until the affected file is replaced. Validation problems can still be exported when both files have been selected.
- Validation record numbers count parsed CSV records with the header as record 1. They are not physical text line numbers when quoted fields contain newlines or blank lines are skipped.

## How differences are calculated

For each valid, unambiguous SKU present in both files:

**Difference = Inventory B quantity − Inventory A quantity.**

Positive means B has more stock; negative means B has less; zero is a match. Missing SKUs show a blank quantity and difference, never an invented zero. Name differences alone do not count as stock discrepancies. Unique SKU totals include nonempty, valid SKU identifiers even when their quantities are invalid; duplicate identifiers count once. File-level-invalid inventories have no trusted SKU total. Matching stock counts equal-quantity pairs only. Duplicate warning counts are per-file unique duplicate identifiers.

## Test and build

```sh
npm test
npm run build
npm run test:e2e
```

Vitest exercises parsing, validation, duplicate exclusion, SKU identity, stock arithmetic, and report escaping. Playwright runs five browser checks against the production build: examples/search/filter/export/reset, invalid and duplicate records, file-error recovery, identical inventories, and mobile layout. Run `npm run build` before browser tests.

The browser configuration defaults to the system Chromium at `/usr/bin/chromium` used in this environment. Elsewhere install a compatible Chromium and set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable path. The browser tests start and stop their own local preview on port 4173; that port must be free.

To review the production output manually:

```sh
npm run preview -- --host 127.0.0.1
```

`dist/` is generated locally. Nothing is deployed or published by these commands.

## Privacy and limitations

Inventory data stays in browser memory: no database, API, analytics, accounts, browser persistence, or external fonts. Refresh/reset discards it. Downloads are explicitly initiated by the user. Exported text is protected against spreadsheet formulas using PapaParse's formula escaping (a leading apostrophe for formula-like text).

This prototype accepts files up to 10 MB each. Parsing and comparison run on the main browser thread and may briefly pause the interface for large inputs; the table paginates at 50 rows. It does not reconcile warehouses, units, product-name changes, fractional stock, alternate encodings, or semicolon-separated formats. Validation can identify problems, but correcting source records remains a human decision. Accessibility and visual checks are representative, not a full assistive-technology audit. CSV contents are treated as untrusted text and React escapes rendered values.

## Project files

- `src/inventory.js`: CSV validation, comparison, and report serialization.
- `src/inventory.test.js`: automated logic tests.
- `src/main.jsx`, `src/style.css`: dashboard and responsive styling.
- `public/examples/`: downloadable sample inventories.
- `e2e/app.spec.js`, `playwright.config.js`: production browser checks.
- `vite.config.js`, `index.html`, `package.json`, `package-lock.json`: build, dependencies, and entry point.

No external services, API keys, paid services, Base44 access, or deployment are required.
