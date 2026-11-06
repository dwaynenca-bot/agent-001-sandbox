# Floral Quote Lab

A dependency-free, browser-only quotation prototype for fictional florist enquiries. Local development is complete for review; no deployment or production readiness is claimed.

## Use

From `prototypes/floral-quote-lab/`, with Node 24 (tested):

```sh
npm start
```

Open http://127.0.0.1:4173. No package installation or build step is needed. The Node server is a loopback development utility; quotation logic, editing and storage run entirely in the browser. Use a consistent browser profile and origin/port to reopen saved drafts.

1. Start a blank draft or load either fictional example. Example prices are editable.
2. Capture optional name, contact details, occasion, date, venue and notes. Email and calendar dates are validated when saving/printing.
3. Add line items. Edit or remove an arrangement using its controls. Apply or clear unfinished edits before saving or printing.
4. Set optional delivery/setup charges, then Apply charges. Blank omits a charge; `0` explicitly applies a zero charge.
5. Save in this browser. After reload, choose the named draft from the saved list and Open. Reload starts a blank workspace; reopening is explicit. Saving an edited draft replaces that draft only.
6. Print / Save PDF opens the browser print dialog. Choose Save as PDF if available. A4 print styling includes enquiry, arrangements, line totals, charges, notes, DRAFT and “Tax treatment not configured.” Browser-menu printing with unapplied/invalid edits carries an incomplete warning and shows applied amounts.

There is no automatic save, cloud sync or backup. A save failure retains work on the page and never claims success. Quota, denied access and unreadable storage are reported; corrupt data is preserved rather than silently overwritten. Keep the page open while resolving failures, or print a valid draft. Browser storage is capped at 100 drafts, is not encrypted, and can be cleared by the browser. Use one editing tab at a time: concurrent same-draft edits are not conflict-merged. Unsaved replacement/navigation prompts are best effort and depend on browser behavior. This prototype has no delete/export/import or automatic recovery facility.

## Confirmed calculation rules

GBP integer pence; positive whole-unit quantities; non-negative unit prices, delivery and setup. Subtotal = sum of quantity × unit price. Draft total = subtotal + delivery + setup. **Tax treatment not configured.** No VAT, discounts, deposits or fractional quantities are modelled.

`src/domain.js` owns strict validation, calculation and immutable quotation edits. BigInt intermediates avoid rounding and reject aggregate values beyond Number.MAX_SAFE_INTEGER pence. Currency text accepts `0`, `1.2`, `1.23`; signs, whitespace, currency symbols, grouping, exponents and excess decimal places are rejected. `src/drafts.js` owns a versioned draft/enquiry schema and local storage; `src/app.js` renders user-provided values as text. Later tax/deposit/discount rules require explicit model, UI and test changes. Current document status is always DRAFT.

## Testing and evidence

```sh
npm test
# Use an existing installed Playwright module and Chromium; no implicit downloads:
FLORAL_PLAYWRIGHT_PATH=/absolute/path/to/playwright npm run test:browser
```

`FLORAL_CHROMIUM_PATH` optionally selects an installed executable (default `/usr/bin/chromium`). `FLORAL_EVIDENCE_DIR` optionally selects an existing directory outside the source for screenshots and PDFs. The Playwright runner is a test-only environment prerequisite; it is not an application dependency. The v3 zero-dependency npm lockfile is intentionally authored and included. No packages were installed.

The baseline quality toolkit remains unchanged. Run its `run.mjs --plan` with this directory's `quality.json`, review scripts/config/lockfile, then supply the exact digest with `--approve-plan` and a new output directory. The agent reviews that digest within authorized local testing; it grants no remote authority. `quality.foundation.json` is the original checkpoint configuration retained for provenance; `quality.json` is the current local MVP plan. Git metadata is unavailable in this isolated directory; record source hashes and remote baseline explicitly.

Unit tests cover exact monetary arithmetic, overflow, invalid inputs, editing, storage validation, update isolation and failed saves. Chromium checks cover desktop/375px workflows, enquiry editing, line/charge changes, saved-draft reload/reopen, invalid/unapplied edits, quota and denied storage, corrupt storage preservation, safe text rendering, keyboard navigation, unsaved cancellation, A4 printing and a long multi-page document. Screenshots/PDFs are local evidence only. No lint, bundler build, dependency audit, physical printer, real mobile device, Firefox or Safari verification is claimed. Florist acceptance of wording and workflow remains pending.

## Preservation

Repository: `dwaynenca-bot/agent-001-sandbox`, branch `feature/agent-001-mission-002`.
Original baseline: `59185e7a7da073a0e4b9682fe40e3984fbc9001e`.
Verified foundation checkpoint: `a46ab211342598707261e8f1bbcb9055a52eabd5`.

The foundation's exact 11-file GitHub readback is preserved separately in local evidence. The remaining MVP changes exist locally until separately approved for GitHub handover. No further remote writes, deployment, Base44 actions, real customer records or external messages are authorized by this documentation. A working preview or browser-local saved draft is not a durable source handover.
