import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from '../tools/serve.mjs';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.FLORAL_PLAYWRIGHT_PATH || 'playwright');
async function fixture(width, callback, init) {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath: process.env.FLORAL_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox']});
    const page = await browser.newPage({viewport: {width, height: 950}}), errors = [], outbound = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:')) outbound.push(req.url()); });
    page.on('dialog', dialog => dialog.accept());
    if (init) await page.addInitScript(init);
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => document.querySelector('#total').textContent === '£0.00');
    await callback(page);
    assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
const click = (page, name) => page.getByRole('button', {name, exact: true}).click();
const fill = (page, label, value) => page.getByLabel(label, {exact: true}).fill(value);
async function total(page, value) { await page.waitForFunction(expected => document.querySelector('#total').textContent === expected, value); }
async function add(page, description, quantity, price) { await fill(page, 'Description', description); await fill(page, 'Quantity', quantity); await fill(page, 'Unit price (£)', price); await click(page, 'Add line item'); }
for (const width of [1280, 375]) {
  test(`enquiry, editing, charges, saving and independent reopening at ${width}px`, async () => fixture(width, async page => {
    await fill(page, 'Name', 'Taylor (fictional)'); await fill(page, 'Event type', 'Wedding'); await fill(page, 'Email', 'taylor@example.invalid');
    await fill(page, 'Phone', 'Fictional phone'); await fill(page, 'Event date', '2028-06-12'); await fill(page, 'Venue', 'Fictional Glasshouse'); await fill(page, 'Notes', 'Peach and cream; fictional details.');
    await add(page, 'Fictional bouquet', '2', '45.50'); await total(page, '£91.00');
    await fill(page, 'Delivery (£)', '12.50'); await fill(page, 'Setup (£)', '7.50'); await click(page, 'Apply charges'); await total(page, '£111.00');
    await click(page, 'Edit Fictional bouquet'); await fill(page, 'Quantity', '3'); await fill(page, 'Unit price (£)', '10.10'); await click(page, 'Apply item changes'); await total(page, '£50.30');
    await click(page, 'Save draft in this browser'); assert.match(await page.getByRole('status').textContent(), /^Saved in this browser/);
    await page.reload(); await page.waitForFunction(() => document.querySelector('#saved-drafts').options.length === 2);
    await page.getByLabel('Saved in this browser', {exact: true}).selectOption({index: 1}); await click(page, 'Open');
    await total(page, '£50.30'); assert.equal(await page.getByLabel('Name', {exact: true}).inputValue(), 'Taylor (fictional)');
    assert.equal(await page.getByLabel('Event date', {exact: true}).inputValue(), '2028-06-12');
    await click(page, 'Celebration example'); await total(page, '£71.00'); await click(page, 'Save draft in this browser');
    assert.equal(await page.locator('#saved-drafts option').count(), 3);
    await page.getByLabel('Saved in this browser', {exact: true}).selectOption({index: 1}); await click(page, 'Open'); await total(page, '£50.30');
    assert.equal(await page.getByLabel('Notes', {exact: true}).inputValue(), 'Peach and cream; fictional details.');
    await click(page, 'Remove Fictional bouquet'); await total(page, '£20.00');
    await fill(page, 'Delivery (£)', ''); await fill(page, 'Setup (£)', '0'); await click(page, 'Apply charges'); await total(page, '£0.00');
    assert.equal(await page.locator('#delivery-total').textContent(), 'Not added'); assert.equal(await page.locator('#setup-total').textContent(), '£0.00');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const button of await page.getByRole('button').all()) { const box = await button.boundingBox(); if (box) assert.ok(box.height >= 44); }
  }));
  test(`fictional example and professional DRAFT print at ${width}px`, async () => fixture(width, async page => {
    await click(page, 'Wedding example'); await total(page, '£430.00');
    await page.evaluate(() => { window.print = () => { window.printCalls = (window.printCalls || 0) + 1; }; });
    await click(page, 'Print / Save PDF'); assert.equal(await page.evaluate(() => window.printCalls), 1);
    if (process.env.FLORAL_EVIDENCE_DIR) await page.screenshot({path: `${process.env.FLORAL_EVIDENCE_DIR}/workflow-${width}.png`, fullPage: true});
    await page.emulateMedia({media: 'print'});
    assert.ok(await page.locator('#print-quote').isVisible()); assert.ok(!(await page.locator('#save-draft').isVisible()));
    assert.equal(await page.locator('.print-draft').textContent(), 'DRAFT'); assert.equal(await page.locator('#print-items tr').count(), 2);
    assert.match(await page.locator('#print-totals').textContent(), /£430.00/); assert.match(await page.locator('.document-note').textContent(), /Tax treatment not configured/);
    if (process.env.FLORAL_EVIDENCE_DIR) {
      const pdf = await page.pdf({path: `${process.env.FLORAL_EVIDENCE_DIR}/draft-${width}.pdf`, format: 'A4', preferCSSPageSize: true}); assert.ok(pdf.subarray(0, 4).toString() === '%PDF');
      await page.screenshot({path: `${process.env.FLORAL_EVIDENCE_DIR}/print-${width}.png`, fullPage: true});
    }
  }));
}
test('invalid and unapplied edits never silently enter saved or printed totals', async () => fixture(375, async page => {
  await add(page, 'Fictional stems', '1.5', '1.00'); assert.match(await page.getByRole('alert').textContent(), /whole number/); await total(page, '£0.00');
  await fill(page, 'Quantity', '2'); await fill(page, 'Unit price (£)', '1.001'); await click(page, 'Add line item'); assert.match(await page.getByRole('alert').textContent(), /decimal places/);
  await fill(page, 'Unit price (£)', '90071992547409.91'); await click(page, 'Add line item'); assert.match(await page.getByRole('alert').textContent(), /safe integer/);
  await click(page, 'Save draft in this browser'); assert.match(await page.getByRole('alert').textContent(), /Apply or clear/); assert.match(await page.getByRole('status').textContent(), /Not saved/);
  await click(page, 'Print / Save PDF'); assert.match(await page.getByRole('alert').textContent(), /Could not prepare print/);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); assert.match(await page.locator('.document-note').textContent(), /DRAFT INCOMPLETE/);
  await click(page, 'Clear form'); await add(page, 'Fictional stems', '3', '0.10'); await total(page, '£0.30');
  await fill(page, 'Delivery (£)', '10'); await fill(page, 'Setup (£)', '-1'); await click(page, 'Apply charges'); await total(page, '£0.30');
  await fill(page, 'Setup (£)', '0'); await click(page, 'Apply charges'); await total(page, '£10.30');
  await fill(page, 'Email', 'invalid'); await click(page, 'Save draft in this browser'); assert.match(await page.getByRole('alert').textContent(), /valid email/);
  await fill(page, 'Email', ''); await click(page, 'Save draft in this browser'); assert.match(await page.getByRole('status').textContent(), /^Saved/);
}));
test('quota failure preserves current work and previous saved bytes; retry succeeds', async () => fixture(1280, async page => {
  await click(page, 'Wedding example'); await click(page, 'Save draft in this browser');
  const before = await page.evaluate(() => localStorage.getItem('floral-quote-lab.drafts.v1'));
  await fill(page, 'Name', 'Edited fictional name');
  await page.evaluate(() => { window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function() { throw new DOMException('Storage quota exceeded', 'QuotaExceededError'); }; });
  await click(page, 'Save draft in this browser'); assert.match(await page.getByRole('status').textContent(), /Not saved/); assert.match(await page.getByRole('alert').textContent(), /quota exceeded/);
  assert.equal(await page.evaluate(() => localStorage.getItem('floral-quote-lab.drafts.v1')), before); await total(page, '£430.00');
  assert.equal(await page.getByLabel('Name', {exact: true}).inputValue(), 'Edited fictional name');
  await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; }); await click(page, 'Save draft in this browser'); assert.match(await page.getByRole('status').textContent(), /^Saved/);
}));
test('corrupt storage is preserved, and page remains editable', async () => fixture(375, async page => {
  assert.match(await page.getByRole('alert').textContent(), /could not be read/);
  await add(page, 'Fictional bouquet', '1', '10'); await total(page, '£10.00'); await click(page, 'Save draft in this browser');
  assert.match(await page.getByRole('status').textContent(), /Not saved/); assert.equal(await page.evaluate(() => localStorage.getItem('floral-quote-lab.drafts.v1')), '{bad');
}, () => { localStorage.setItem('floral-quote-lab.drafts.v1', '{bad'); }));
test('denied storage access does not prevent calculation or printing', async () => fixture(1280, async page => {
  assert.match(await page.getByRole('alert').textContent(), /could not be read/); await click(page, 'Celebration example'); await total(page, '£71.00');
  await click(page, 'Save draft in this browser'); assert.match(await page.getByRole('status').textContent(), /Not saved/);
  await page.evaluate(() => { window.print = () => window.printed = true; }); await click(page, 'Print / Save PDF'); assert.equal(await page.evaluate(() => window.printed), true);
}, () => { Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('Access denied', 'SecurityError'); }}); }));
test('untrusted input is rendered as text through save, reopen and print', async () => fixture(375, async page => {
  const hostile = '<img src=x onerror="window.injected=true">';
  await fill(page, 'Name', hostile); await fill(page, 'Notes', '<script>window.injected=true</script>'); await add(page, hostile, '1', '1.00');
  await click(page, 'Save draft in this browser'); await page.reload(); await page.waitForFunction(() => document.querySelector('#saved-drafts').options.length === 2);
  await page.getByLabel('Saved in this browser', {exact: true}).selectOption({index: 1}); await click(page, 'Open');
  assert.equal(await page.getByLabel('Name', {exact: true}).inputValue(), hostile); assert.equal(await page.locator('#print-items td').first().textContent(), hostile);
  assert.equal(await page.locator('img, #print-notes script').count(), 0); assert.equal(await page.evaluate(() => window.injected), undefined);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}));
test('discard cancellation preserves unsaved work and keyboard navigation remains available', async () => fixture(375, async page => {
  await fill(page, 'Name', 'Unsaved fictional name'); page.removeAllListeners('dialog'); page.on('dialog', dialog => dialog.dismiss());
  await click(page, 'New draft'); assert.equal(await page.getByLabel('Name', {exact: true}).inputValue(), 'Unsaved fictional name');
  await page.getByLabel('Description', {exact: true}).focus(); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.name), 'quantity');
  page.removeAllListeners('dialog'); page.on('dialog', dialog => dialog.accept());
}));
test('long quotation prints all line items over multiple A4 pages', async () => fixture(1280, async page => {
  const expected = await page.evaluate(async () => {
    const {createDraft, saveDraft} = await import('/src/drafts.js');
    const {calculateQuote} = await import('/src/domain.js');
    const draft = createDraft(); draft.enquiry.name = 'Long fictional quotation'; draft.enquiry.notes = 'Fictional notes. '.repeat(80);
    draft.quote.items = Array.from({length: 45}, (_, i) => ({id: 'item-'+i, description: `Fictional arrangement ${i + 1} with seasonal flowers and foliage`, quantity: i + 1, unitPence: 1234}));
    saveDraft(localStorage, draft); return calculateQuote(draft.quote).totalPence;
  });
  await page.reload(); await page.waitForFunction(() => document.querySelector('#saved-drafts').options.length === 2);
  await page.getByLabel('Saved in this browser', {exact: true}).selectOption({index: 1}); await click(page, 'Open');
  assert.equal(await page.locator('#items .item-row').count(), 45);
  await page.emulateMedia({media: 'print'}); assert.equal(await page.locator('#print-items tr').count(), 45);
  assert.match(await page.locator('#print-totals').textContent(), new RegExp((expected / 100).toLocaleString('en-GB', {minimumFractionDigits: 2}).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  if (process.env.FLORAL_EVIDENCE_DIR) await page.pdf({path: `${process.env.FLORAL_EVIDENCE_DIR}/draft-multipage.pdf`, format: 'A4', preferCSSPageSize: true});
}));
