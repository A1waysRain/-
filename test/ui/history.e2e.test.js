import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const chrome = process.env.CHROME_PATH;
test('history UI opens stored details without changing live state, survives reload, and fits phone landscape', {
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
    for (const [width, height] of [[1365, 768], [915, 412]]) {
      await page.setViewport({ width, height });
      await page.goto(`http://127.0.0.1:${srv.port}/`, { waitUntil: 'networkidle0' });
      await page.evaluate(async () => {
        const { saveMatchResult } = await import('/js/ui/matchHistory.js');
        saveMatchResult({ resultId: 'ui-test', victory: true, roundsPassed: 9, difficulty: 'FUNNY',
          players: [{ playerId: 'p_history', name: '历史博士', alive: true, bandId: 'band_jesica',
            stats: { kills: 123 }, lineup: [{ id: 'chess_char_4_25_a', tier: 4 }] }] },
          { lastRound: 9 }, 'p_history');
        const { store } = await import('/js/store.js');
        store.patch('ui', { historyOpen: true });
      });
      await page.waitForSelector('.history-row');
      assert.match(await page.$eval('.history-row', (el) => el.textContent), /历史博士/);
      const original = await page.evaluate(async () => JSON.stringify((await import('/js/store.js')).store.get().match));
      await page.click('.history-row');
      await page.waitForSelector('.history-box--detail .rcard__name');
      assert.match(await page.$eval('.history-box--detail .rcard__name', (el) => el.textContent), /历史博士/);
      assert.match(await page.$eval('.history-box--detail', (el) => el.textContent), /123/);
      assert.equal(await page.evaluate(async () => JSON.stringify((await import('/js/store.js')).store.get().match)), original);
      assert.equal(await page.$eval('.history-box', (el) => el.scrollWidth <= el.clientWidth + 2), true);
      await page.keyboard.press('Escape');
      await page.waitForSelector('.history-row');
      await page.keyboard.press('Escape');
      await page.reload({ waitUntil: 'networkidle0' });
      assert.equal(await page.evaluate(async () => (await import('/js/ui/matchHistory.js')).loadMatchHistory().length), 1);
    }
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await srv.close(); }
});
