import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const chrome = process.env.CHROME_PATH;
test('bond strip toggles without changing match data and fits desktop and phone HUD', {
  skip: !(process.env.SP_E2E === '1' && chrome && existsSync(chrome)),
}, async () => {
  const { startServer } = await import('../../server/index.js');
  const puppeteer = (await import('puppeteer-core')).default;
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [width, height] of [[2048, 922], [915, 412]]) {
      await page.setViewport({ width, height });
      await page.goto(`http://127.0.0.1:${srv.port}/dev/game-mock.html?phase=COMBAT&shot=1&render=fallback`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.gtop__bondtoggle');
      const original = await page.evaluate(() => JSON.stringify(__MOCK__.store.get().match.private.bonds));
      assert.equal(await page.$eval('#game-bond-strip', (el) => getComputedStyle(el).display !== 'none'), true);
      await page.click('.gtop__bondtoggle');
      assert.equal(await page.$eval('#game-bond-strip', (el) => getComputedStyle(el).display), 'none');
      assert.match(await page.$eval('.gtop__bondtoggle', (el) => el.textContent), /展开/);
      assert.equal(await page.$eval('.gtop__bondtoggle', (el) => el.getAttribute('aria-expanded')), 'false');
      assert.equal(await page.evaluate(() => JSON.stringify(__MOCK__.store.get().match.private.bonds)), original);
      await page.click('.gtop__bondtoggle');
      assert.equal(await page.$eval('#game-bond-strip', (el) => getComputedStyle(el).display !== 'none'), true);
      assert.equal(await page.evaluate(() => {
        const button = document.querySelector('.gtop__bondtoggle').getBoundingClientRect();
        const center = document.querySelector('.gtop__center').getBoundingClientRect();
        return button.left >= 0 && button.right <= center.left + 1 && button.bottom <= innerHeight;
      }), true, 'button stays left of the central HUD without overlap');
    }
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await srv.close(); }
});
