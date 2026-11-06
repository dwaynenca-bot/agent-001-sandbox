import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import Papa from 'papaparse';
const csv = (name, content) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(content) });
async function examples(page) {
  await page.getByLabel('Upload Inventory A').setInputFiles('public/examples/inventory-a.csv');
  await page.getByLabel('Upload Inventory B').setInputFiles('public/examples/inventory-b.csv');
  await expect(page.getByText('Comparison complete.', { exact: false })).toBeVisible();
}
test('example uploads, statistics, search, filters, downloads and reset', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const external = []; page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173')) external.push(request.url()); });
  await page.goto('/');
  const exampleDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: /Download example A/ }).click();
  const example = await exampleDownload;
  expect(await fs.readFile(await example.path(), 'utf8')).toContain('"Desk lamp, brass"');
  await examples(page);
  await expect(page.locator('tbody tr')).toHaveCount(7);
  const stats = page.locator('.stat strong');
  await expect(stats).toHaveText(['6', '6', '3', '2', '2', '0']);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.getByLabel('Filter issue type').selectOption('Quantity mismatch');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByLabel('Search results').fill('brass');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('-3');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export issues/ }).click();
  const report = await download;
  const content = await fs.readFile(await report.path(), 'utf8');
  expect(report.suggestedFilename()).toBe('stock-integrity-report.csv');
  expect(content).toContain('Missing from A'); expect(content).toContain('Missing from B');
  expect(content).toContain('"Lamp, brass"'.replace('Lamp', 'Desk lamp')); expect(content).not.toContain(',Match,');
  await page.getByRole('button', { name: /Reset workspace/ }).click();
  await expect(page.getByText('Your comparison starts here')).toBeVisible();
  await expect(page.getByRole('button', { name: /Export issues/ })).toBeDisabled();
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
test('invalid and duplicate SKUs are visible and excluded from comparisons', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Upload Inventory A').setInputFiles(csv('invalid.csv', 'sku,product_name,quantity\na,Apple,1\na,Apple,2\nb,Banana,-1'));
  await page.getByLabel('Upload Inventory B').setInputFiles(csv('valid.csv', 'sku,product_name,quantity\na,Apple,1\nb,Banana,2'));
  await expect(page.locator('.validation')).toContainText('2 validation problems');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('tbody')).toContainText('Duplicate SKU');
  await expect(page.locator('tbody')).toContainText('Invalid record');
  await expect(page.locator('tbody')).not.toContainText('Missing from');
});
test('file-level errors pause comparison and recover after replacement', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Upload Inventory A').setInputFiles(csv('empty.csv', ''));
  await page.getByLabel('Upload Inventory B').setInputFiles('public/examples/inventory-b.csv');
  await expect(page.getByText('Comparison paused.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Full Comparison CSV' })).toBeDisabled();
  await expect(page.locator('.validation')).toContainText('File is empty');
  await expect(page.locator('tbody')).not.toContainText('Missing from');
  await page.getByLabel('Upload Inventory A').setInputFiles('public/examples/inventory-a.csv');
  await expect(page.getByText('Comparison complete.', { exact: false })).toBeVisible();
  await expect(page.locator('.validation')).toHaveCount(0);
});
test('identical files have no exportable issues', async ({ page }) => {
  await page.goto('/');
  for (const source of ['A', 'B']) await page.getByLabel(`Upload Inventory ${source}`).setInputFiles('public/examples/inventory-a.csv');
  await expect(page.locator('tbody tr')).toHaveCount(6);
  await expect(page.getByRole('button', { name: /Export issues/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download Full Comparison CSV' })).toBeEnabled();
});
test('mobile layout keeps controls on screen and table scrolls internally', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await examples(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByLabel('Search results')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Full Comparison CSV' })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Full Comparison CSV' }).click();
  expect(Papa.parse(await fs.readFile(await (await download).path(), 'utf8'), { header: true }).data).toHaveLength(7);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('full export includes off-page and hidden records and resets safely', async ({ page }) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Download Full Comparison CSV' });
  await expect(button).toBeDisabled();
  const common = Array.from({ length: 55 }, (_, i) => `sku-${i},Product ${i},0`);
  await page.getByLabel('Upload Inventory A').setInputFiles(csv('a.csv', 'sku,product_name,quantity\n' + [...common, '=1+1,@SUM(1),4', 'only-a,Only A,2', 'duplicate,First,1', 'duplicate,Second,2', 'bad,Bad,nope'].join('\n')));
  await page.getByLabel('Upload Inventory B').setInputFiles(csv('b.csv', 'sku,product_name,quantity\n' + [...common, '=1+1,Name B,1', 'only-b,Only B,3', 'duplicate,Other,1', 'bad,Bad,1'].join('\n')));
  await expect(button).toBeEnabled();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  async function readDownload() {
    const pending = page.waitForEvent('download');
    await button.click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('stock-integrity-full-comparison.csv');
    return Papa.parse(await fs.readFile(await download.path(), 'utf8'), { header: true }).data;
  }
  const all = await readDownload();
  expect(all).toHaveLength(58);
  expect(all.filter(r => r.comparison_status === 'Match')).toHaveLength(55);
  expect(all.find(r => r.sku === "'=1+1")).toMatchObject({ product_name: "'@SUM(1)", difference_b_minus_a: '-3', comparison_status: 'Quantity mismatch' });
  expect(all.map(r => r.sku)).not.toContain('duplicate');
  expect(all.map(r => r.sku)).not.toContain('bad');
  await page.getByLabel('Filter issue type').selectOption('Match');
  await page.getByLabel('Search results').fill('no-such-product');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  expect(await readDownload()).toEqual(all);
  await page.getByRole('button', { name: /Reset workspace/ }).click();
  await expect(button).toBeDisabled();
});

for (const width of [1440, 375]) {
  test(`duplicate-heavy validation, exports and replacement recovery at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const external = []; page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
    await page.goto('/');
    const repeated = 2000;
    const a = 'sku,product_name,quantity\n' + [' dup ,First,1', 'bad,Invalid,nope', 'dup,Second,2', 'safe,"Lamp, brass",4', '+keep,@SUM(1),4', ...Array.from({ length: repeated }, () => 'dup,Fictional,1')].join('\n');
    const b = 'sku,product_name,quantity\ndup,Other,1\nbad,Other,1\nsafe,Other,1\n+keep,Other,1';
    await page.getByLabel('Upload Inventory A').setInputFiles(csv('duplicates.csv', a));
    await page.getByLabel('Upload Inventory B').setInputFiles(csv('reference.csv', b));
    await expect(page.getByText('Comparison complete.', { exact: false })).toBeVisible();
    await expect(page.locator('.validation summary')).toContainText('2 validation problems');
    const occurrenceRows = [2, 4, ...Array.from({ length: repeated }, (_, i) => i + 7)].join(', ');
    await expect(page.locator('.validation li').last()).toContainText(`SKU occurs in records ${occurrenceRows}. All occurrences excluded from comparison.`);
    await expect(page.locator('.stat strong')).toHaveText(['4', '4', '0', '2', '0', '1']);
    await expect(page.locator('tbody tr')).toHaveCount(4);
    await expect(page.locator('tbody')).not.toContainText('Missing from');
    async function downloadRows(name) {
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name }).click();
      return Papa.parse(await fs.readFile(await (await pending).path(), 'utf8'), { header: true }).data;
    }
    const issues = await downloadRows(/Export issues/);
    expect(issues.map(row => row.issue)).toEqual(['Invalid record', 'Duplicate SKU', 'Quantity mismatch', 'Quantity mismatch']);
    expect(issues[1]).toMatchObject({ sku: 'dup', record: occurrenceRows });
    expect(issues[3]).toMatchObject({ sku: "'+keep", product_name: "'@SUM(1)", difference_b_minus_a: '-3' });
    const full = await downloadRows('Download Full Comparison CSV');
    expect(full.map(row => row.sku)).toEqual(['safe', "'+keep"]);
    expect(full.map(row => row.difference_b_minus_a)).toEqual(['-3', '-3']);
    await page.getByLabel('Filter issue type').selectOption('Duplicate SKU');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('Search results').fill('dup');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    expect(await downloadRows('Download Full Comparison CSV')).toEqual(full);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${process.env.WATCHDOG_EVIDENCE_DIR || 'test-results'}/duplicates-${width}.png`, fullPage: true });
    await page.getByLabel('Filter issue type').selectOption('All results');
    await page.getByLabel('Search results').fill('');
    await page.getByLabel('Upload Inventory A').setInputFiles(csv('corrected.csv', b));
    await expect(page.locator('.validation')).toHaveCount(0);
    await expect(page.locator('tbody tr')).toHaveCount(4);
    await expect(page.locator('tbody .match')).toHaveCount(4);
    await expect(page.getByRole('button', { name: /Export issues/ })).toBeDisabled();
    await page.getByRole('button', { name: /Reset workspace/ }).click();
    await expect(page.getByText('Your comparison starts here')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download Full Comparison CSV' })).toBeDisabled();
    expect(errors).toEqual([]); expect(external).toEqual([]);
  });
}
