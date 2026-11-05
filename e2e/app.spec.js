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
