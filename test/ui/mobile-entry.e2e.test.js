import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const chrome = process.env.CHROME_PATH;
test('phone sign-in and alliance input are enlarged and remain on screen', {
  skip: !(process.env.SP_E2E === '1' && chrome && existsSync(chrome)),
}, async () => {
  const { startServer } = await import('../../server/index.js');
  const puppeteer = (await import('puppeteer-core')).default;
  const srv = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 915, height: 412, isMobile: true, hasTouch: true });
    await page.goto(`http://127.0.0.1:${srv.port}/`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.title-login');
    const login = await page.$eval('.title-login', (el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, top: r.top, bottom: r.bottom, input: el.querySelector('.field__box').getBoundingClientRect().height };
    });
    assert.ok(login.width >= 330);
    assert.ok(login.input >= 44);
    assert.ok(login.top >= 0 && login.bottom <= 412);
    await page.evaluate(async () => (await import('/js/store.js')).store.patch('session', { entered: true }));
    await page.waitForSelector('.join-panel');
    const join = await page.$eval('.join-panel', (el) => {
      const r = el.getBoundingClientRect();
      const input = el.querySelector('.field__box').getBoundingClientRect();
      return { bottom: r.bottom, height: r.height, inputHeight: input.height, inputWidth: input.width, width: r.width };
    });
    assert.ok(join.inputHeight >= 44);
    assert.ok(join.inputWidth >= join.width * .8);
    assert.ok(join.height >= 120);
    assert.ok(join.bottom <= 412);
  } finally { await browser?.close(); await srv.close(); }
});
