import { loadPref, savePref } from '../store.js';
import { normalizeResult } from './gameLogic.js';

export const HISTORY_LIMIT = 20;

export function loadMatchHistory() {
  const data = loadPref('matchHistory', null);
  if (data?.v !== 1 || !Array.isArray(data.records)) return [];
  const ids = new Set();
  return data.records.filter((r) => {
    if (!r || typeof r.id !== 'string' || !Number.isFinite(r.savedAt)
        || !Array.isArray(r.result?.players) || typeof r.myId !== 'string' || ids.has(r.id)) return false;
    ids.add(r.id);
    return true;
  }).slice(0, HISTORY_LIMIT);
}

/** Save only completed results of games this player participated in. Reconnects do not add duplicates. */
export function saveMatchResult(result, publicState, myId, now = Date.now()) {
  if (!myId || !Array.isArray(result?.players)
      || !result.players.some((p) => p?.playerId === myId && !p.isBot)
      || typeof result.victory !== 'boolean') return { saved: false, skipped: true };
  const summary = normalizeResult(result, publicState);
  summary.teamLp = result.teamLp ?? publicState?.teamLp ?? null;
  // Older hosts do not send resultId. Their immutable settlement payload is the fallback identity.
  const id = result.resultId || JSON.stringify([result.seed, result.durationMs, result.modeId, result.players]);
  const records = loadMatchHistory();
  if (records.some((r) => r.id === id)) return { saved: true, duplicate: true };
  const record = { id, savedAt: now, myId, result: summary };
  return { saved: savePref('matchHistory', { v: 1, records: [record, ...records].slice(0, HISTORY_LIMIT) }) };
}
