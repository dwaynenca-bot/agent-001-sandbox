# Floral Quote Lab — foundation checkpoint

Browser-only, dependency-free foundation. Fictional prices only. This is an in-memory demonstration, not a saved quotation or a complete application.

## Confirmed calculation rules

GBP integer pence; quantities are positive whole numbers; unit prices, optional delivery and optional setup are non-negative. Subtotal is the sum of quantity × unit price; draft total is subtotal + delivery + setup. **Tax treatment not configured.** No VAT, discounts, deposits or fractional quantities are modelled. BigInt intermediates prevent rounding and reject totals beyond Number.MAX_SAFE_INTEGER pence. Strict money text accepts `0`, `1.2`, `1.23`; currency symbols, separators, whitespace, exponents, signs and excess decimal places are rejected.

`src/domain.js` owns validation, calculation and immutable edits. A version-1 quotation has `currency: 'GBP'`, `status: 'DRAFT'`, `items` and `charges`. Items contain `id`, `description`, `quantity`, `unitPence`; charges contain `id` (`delivery` or `setup`), `description`, `amountPence`. IDs must be unique across the quote. Later tax/deposit/discount rules should be introduced explicitly with validation and tests.

## Run locally

Requires Node 24 (tested); no npm install needed. From this directory:

```sh
npm test
npm start
```

Open http://127.0.0.1:4173. The Node server is a loopback development utility; the application itself runs in the browser. There is no backend, storage, external service or build step.

Browser tests require an already installed Playwright module and Chromium. Set `FLORAL_PLAYWRIGHT_PATH` to its absolute module directory when it is outside normal resolution, and optionally `FLORAL_CHROMIUM_PATH`. Run `npm run test:browser`. `FLORAL_EVIDENCE_DIR` optionally points to an existing screenshot directory outside the proposed source files. No runner is fetched automatically.

## Quality and provenance

Source baseline: `dwaynenca-bot/agent-001-sandbox` at `59185e7a7da073a0e4b9682fe40e3984fbc9001e`; intended path `prototypes/floral-quote-lab/` on `feature/agent-001-mission-002`. Local development is isolated from the broken checkout. No local Git branch is implied.

Use the baseline `tools/quality/run.mjs --plan` with this directory's `quality.foundation.json`; review scripts and the lockfile-bound digest, then run with that digest and a new evidence directory. The manifest and dependency-free npm v3 lockfile are deliberately included. No install was used to create them. Git metadata is unavailable in the isolated directory; record baseline/file hashes separately. Quality scripts generate only local test/browser evidence. No lint, production build, dependency audit or release approval is claimed.

The first checkpoint contains the engine, tests and minimal editable price/quantity shell only. Enquiry capture, full editable line/charge UI, local draft reopening, save failures, expanded examples and professional DRAFT print/PDF remain pending checkpoint approval. No real customer or business data is included.
