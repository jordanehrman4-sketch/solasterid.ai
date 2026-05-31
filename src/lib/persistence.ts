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
import { DEFAULT_SEED } from "./defaultSeed";

const KEY = "solasterid:state:v1";
const TRANSCRIPT_CAP = 300;
const MUTATIONS_CAP = 300;
const VISUAL_EVENTS_CAP = 200;
const SEED_HISTORY_CAP = 200;

export type SavedSolasteridSnapshot = {
  state: SolasteridState;
  savedAt: number; // epoch ms
};

/**
 * The persisted `tempseed` can go stale: when we ship a new DEFAULT_SEED, a
 * returning visitor still has the *old* default frozen in localStorage, so the
 * studio keeps using it forever. This refreshes the seed to the current default
 * — but ONLY when the user never hand-edited it. We detect a user edit by
 * looking at the most recent seedHistory entry: if its source is "user_edit"
 * and it matches the live tempseed, that seed is sacred and we leave it alone.
 */
function migrateSeed(state: SolasteridState): SolasteridState {
  // Already on the current default — nothing to do.
  if (state.tempseed === DEFAULT_SEED) return state;

  const history = state.seedHistory ?? [];
  const latest = history.length > 0 ? history[history.length - 1] : undefined;

  // If the newest seed entry came from the user AND it's what's live right now,
  // the current tempseed is a deliberate edit. Don't touch it.
  const seedIsUserAuthored =
    latest?.source === "user_edit" && latest.seed === state.tempseed;
  if (seedIsUserAuthored) return state;

  // Otherwise the live seed is a leftover default (or system) seed that predates
  // the current DEFAULT_SEED. Refresh it and note the migration in history.
  return {
    ...state,
    tempseed: DEFAULT_SEED,
    seedHistory: [
      ...history,
      {
        id: crypto.randomUUID(),
        round: state.round,
        seed: DEFAULT_SEED,
        source: "default",
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function loadSavedState(): SavedSolasteridSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSolasteridSnapshot;
    if (!parsed?.state || typeof parsed.state.round !== "number") return null;
    parsed.state = migrateSeed(parsed.state);
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
