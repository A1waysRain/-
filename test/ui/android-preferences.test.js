import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPref, savePref } from '../../public/js/store.js';

test('Android loadout survives a new WebView origin and remembers resets', () => {
  const previousBridge = globalThis.StrongholdAndroid;
  const previousStorage = globalThis.localStorage;
  let saved = '';
  let originStorage = new Map();
  globalThis.StrongholdAndroid = {
    loadLoadout: () => saved,
    saveLoadout: (raw) => { saved = raw; return true; },
  };
  globalThis.localStorage = {
    getItem: (key) => originStorage.get(key) ?? null,
    setItem: (key, value) => originStorage.set(key, value),
  };
  try {
    const preset = { v: 1, entries: { chess_char_1_01_a: { skill: 0, module: 'none' } } };
    savePref('loadout', preset);
    originStorage = new Map(); // restart with a different port, or connect to a host
    assert.deepEqual(loadPref('loadout', null), preset);
    savePref('loadout', { v: 1, entries: {} });
    originStorage = new Map();
    assert.deepEqual(loadPref('loadout', null), { v: 1, entries: {} });
    savePref('session', { token: 'local-only' });
    assert.deepEqual(JSON.parse(saved), { v: 1, entries: {} }, 'session data stays separate');
    saved = '';
    originStorage.set('sp.pref.loadout', JSON.stringify(preset));
    assert.deepEqual(loadPref('loadout', null), preset);
    assert.deepEqual(JSON.parse(saved), preset, 'existing browser configuration is migrated');
    saved = 'invalid json';
    assert.deepEqual(loadPref('loadout', null), preset, 'corrupt native data falls back');
    delete globalThis.StrongholdAndroid;
    assert.deepEqual(loadPref('loadout', null), preset, 'PC browser keeps its storage behavior');
  } finally {
    if (previousBridge === undefined) delete globalThis.StrongholdAndroid;
    else globalThis.StrongholdAndroid = previousBridge;
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
