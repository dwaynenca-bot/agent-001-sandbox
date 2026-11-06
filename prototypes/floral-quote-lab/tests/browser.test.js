import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from '../tools/serve.mjs';

// Reuse an installed runner. Never download packages implicitly.
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.FLORAL_PLAYWRIGHT_PATH || 'playwright');
for (const width of [1280, 375]) {
  test(`foundation calculator, invalid input and recovery at ${width}px`, async () => {
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
      browser = await chromium.launch({executablePath: process.env.FLORAL_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox']});
      const page = await browser.newPage({viewport: {width, height: 900}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(() => document.querySelector('#total').textContent === '£91.00');
      await page.getByLabel('Quantity', {exact: true}).fill('3');
      await page.getByLabel('Unit price (£)', {exact: true}).fill('0.10');
      await page.getByRole('button', {name: 'Calculate draft'}).click();
      assert.equal(await page.locator('#total').textContent(), '£0.30');
      await page.getByLabel('Quantity', {exact: true}).fill('1.5');
      await page.getByRole('button', {name: 'Calculate draft'}).click();
      assert.match(await page.getByRole('alert').textContent(), /positive whole number/);
      assert.equal(await page.locator('#total').textContent(), 'Check inputs');
      await page.getByLabel('Quantity', {exact: true}).fill('2');
      await page.getByLabel('Unit price (£)', {exact: true}).fill('-1');
      await page.getByRole('button', {name: 'Calculate draft'}).click();
      assert.match(await page.getByRole('alert').textContent(), /decimal places/);
      await page.getByLabel('Unit price (£)', {exact: true}).fill('12.34');
      await page.getByRole('button', {name: 'Calculate draft'}).click();
      assert.equal(await page.locator('#total').textContent(), '£24.68');
      assert.equal(await page.getByRole('alert').textContent(), '');
      assert.ok(await page.getByText('Tax treatment not configured', {exact: false}).isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const button = await page.getByRole('button', {name: 'Calculate draft'}).boundingBox();
      assert.ok(button.height >= 44);
      await page.getByLabel('Unit price (£)', {exact: true}).focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BUTTON');
      assert.deepEqual(errors, []);
      if (process.env.FLORAL_EVIDENCE_DIR) await page.screenshot({path: `${process.env.FLORAL_EVIDENCE_DIR}/foundation-${width}.png`, fullPage: true});
    } finally {
      await browser?.close();
      await new Promise(resolve => server.close(resolve));
    }
  });
}
