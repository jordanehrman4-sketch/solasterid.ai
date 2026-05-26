/**
 * Lightweight localStorage persistence for the live Solasterid creature.
 *
 * We deliberately use localStorage instead of IndexedDB for this hot-path:
 * IndexedDB is reserved for cold storage of exported fossils (in indexedDbExports.ts).
 *
 * The state object can grow unboundedly (transcript, mutations, visual_events)
 * over a long run, so we cap each history list before serializing. The capped
 * version is what gets restored on next page load — the user can still export
 * the full thing while the run is in memory.
 */
import type { SolasteridState } from "./solasteridState";

const KEY = "solasterid:state:v1";
const TRANSCRIPT_CAP = 300;
const MUTATIONS_CAP = 300;
const VISUAL_EVENTS_CAP = 200;
const SEED_HISTORY_CAP = 200;

export type SavedSolasteridSnapshot = {
  state: SolasteridState;
  savedAt: number; // epoch ms
};

export function loadSavedState(): SavedSolasteridSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSolasteridSnapshot;
    if (!parsed?.state || typeof parsed.state.round !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: SolasteridState): number | null {
  try {
    const trimmed: SolasteridState = {
      ...state,
      transcript: state.transcript.slice(-TRANSCRIPT_CAP),
      mutations: state.mutations.slice(-MUTATIONS_CAP),
      visualEvents: state.visualEvents.slice(-VISUAL_EVENTS_CAP),
      seedHistory: state.seedHistory.slice(-SEED_HISTORY_CAP),
    };
    const snapshot: SavedSolasteridSnapshot = {
      state: trimmed,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(snapshot));
    return snapshot.savedAt;
  } catch {
    // QuotaExceededError, JSON cycle, etc — bail silently.
    return null;
  }
}

export function clearSavedState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
