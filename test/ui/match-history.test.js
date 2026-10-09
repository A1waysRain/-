import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMatchHistory, saveMatchResult } from '../../public/js/ui/matchHistory.js';
import { normalizeResult } from '../../public/js/ui/gameLogic.js';

const result = (id) => ({ resultId: id, victory: true, roundsPassed: 9, durationMs: 123456,
  players: [{ playerId: 'p_0', name: '博士', bandId: 'band_jesica', alive: true, lp: 12,
    lineup: [{ id: 'chess_char_4_25_a', golden: false, tier: 4, items: [] }], stats: { kills: 50 } }] });

function withStorage(fn) {
  const oldStorage = globalThis.localStorage;
  const oldBridge = globalThis.StrongholdAndroid;
  const values = new Map();
  delete globalThis.StrongholdAndroid;
  globalThis.localStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  try { fn(values); } finally {
    if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage;
    if (oldBridge === undefined) delete globalThis.StrongholdAndroid; else globalThis.StrongholdAndroid = oldBridge;
  }
}

test('history keeps exactly the last 20 results, newest first; reconnect is deduplicated', () => withStorage(() => {
  for (let i = 0; i < 25; i++) assert.equal(saveMatchResult(result(String(i)), { lastRound: 9 }, 'p_0', i).saved, true);
  let records = loadMatchHistory();
  assert.equal(records.length, 20);
  assert.deepEqual(records.map((r) => r.id), Array.from({ length: 20 }, (_, i) => String(24 - i)));
  assert.equal(saveMatchResult(result('24'), null, 'p_0', 999).duplicate, true);
  records = loadMatchHistory();
  assert.equal(records[0].savedAt, 24);
  assert.equal(records[0].result.lastRound, 9);
  assert.equal(records[0].result.players[0].stats.kills, 50);
  assert.equal(records[0].result.players[0].lineup[0].id, 'chess_char_4_25_a');
}));

test('spectators and incomplete results are not saved; old hosts deduplicate too', () => withStorage(() => {
  assert.equal(saveMatchResult(result('x'), null, 'spectator').skipped, true);
  assert.equal(saveMatchResult({}, null, 'p_0').skipped, true);
  assert.equal(loadMatchHistory().length, 0);
  const r = result('old'); delete r.resultId;
  assert.equal(saveMatchResult(r, null, 'p_0').saved, true);
  assert.equal(saveMatchResult(r, null, 'p_0').duplicate, true);
  const next = { ...r, durationMs: r.durationMs + 1 };
  assert.equal(saveMatchResult(next, null, 'p_0').saved, true);
  assert.equal(loadMatchHistory().length, 2);
}));

test('Android history survives origin changes independently of skills and session data', () => withStorage((values) => {
  let native = '';
  globalThis.StrongholdAndroid = { loadMatchHistory: () => native, saveMatchHistory: (v) => { native = v; return true; } };
  assert.equal(saveMatchResult(result('native'), null, 'p_0').saved, true);
  values.clear();
  assert.equal(loadMatchHistory()[0].id, 'native');
  assert.equal(values.has('sp.pref.loadout'), false);
  assert.equal(values.has('sp.pref.session'), false);
  const saved = native;
  native = '';
  values.set('sp.pref.matchHistory', saved);
  assert.equal(loadMatchHistory()[0].id, 'native');
  assert.equal(native, saved, 'existing browser history migrates to native storage');
}));

test('shared final LP and fallback mode data survive history detail normalization', () => withStorage(() => {
  saveMatchResult({ ...result('lp'), teamLp: 30 }, { difficulty: 'HARD', lastRound: 14 }, 'p_0');
  const r = normalizeResult(loadMatchHistory()[0].result, null);
  assert.equal(r.players[0].lp, 30);
  assert.equal(r.players[0].lpShared, true);
  assert.equal(r.difficulty, 'HARD');
}));

test('corrupt data and storage failure do not break settlement', () => withStorage((values) => {
  values.set('sp.pref.matchHistory', 'bad JSON');
  assert.deepEqual(loadMatchHistory(), []);
  values.set('sp.pref.matchHistory', JSON.stringify({ v: 1, records: [null, {}] }));
  assert.deepEqual(loadMatchHistory(), []);
  globalThis.localStorage.setItem = () => { throw new Error('quota'); };
  assert.equal(saveMatchResult(result('full'), null, 'p_0').saved, false);
}));
