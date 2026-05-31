import type { SolasteridState } from "./solasteridState";

const DEFAULT_TIMEOUT_MS = 7000;
const MAX_STRING_LENGTH = 4000;
const MAX_ARRAY_ITEMS = 250;
const MAX_OBJECT_KEYS = 250;
const MAX_REDACTION_DEPTH = 8;

const SENSITIVE_KEY_RE = /(api[_-]?key|openai[_-]?key|authorization|bearer|token|secret|password|credential)/i;
const API_KEY_VALUE_RE = /\bsk-[A-Za-z0-9_-]{12,}\b/g;

export type CollectorStatus =
  | { status: "skipped"; reason: "not_configured" }
  | { status: "submitted"; archivePath?: string }
  | { status: "failed"; error: string };

export type ArchitectureFossil = {
  schemaVersion: 1;
  exportId: string;
  createdAt: string;
  source: {
    app: "solasterid-studio";
    origin: string;
  };
  privacy: {
    openaiApiKeyIncluded: false;
    seedTextIncluded: false;
    transcriptIncluded: false;
    fullStateIncluded: false;
  };
  export: {
    filename: string;
    round: number;
    version: number;
  };
  metrics: {
    activeArmCount: number;
    probationArmCount: number;
    retiredArmCount: number;
    totalArmCount: number;
    committeeCount: number;
    mutationCount: number;
    seedEditCount: number;
    transcriptEventCount: number;
    visualEventCount: number;
  };
  seedFingerprint: {
    sha256: string | null;
    length: number;
    historyCount: number;
  };
  architecture: {
    arms: SolasteridState["arms"];
    committees: SolasteridState["committees"];
    mutations: Array<{
      id: string;
      round: number;
      type: string;
      summary: string;
      payload: unknown;
      timestamp: string;
    }>;
    v4Globals?: unknown;
  };
};

function getCollectorUrl(): string | null {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const raw = env.VITE_ARCHITECTURE_COLLECTOR_URL?.trim();
  return raw || null;
}

async function sha256Text(text: string): Promise<string | null> {
  try {
    if (!crypto.subtle) return null;
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

function redactString(value: string): string {
  const redacted = value.replace(API_KEY_VALUE_RE, "[REDACTED_API_KEY]");
  return redacted.length > MAX_STRING_LENGTH
    ? redacted.slice(0, MAX_STRING_LENGTH) + "…[truncated]"
    : redacted;
}

function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (depth > MAX_REDACTION_DEPTH) return "[truncated_depth]";
  if (value === null || value === undefined) return value;

  const kind = typeof value;
  if (kind === "string") return redactString(value as string);
  if (kind === "number" || kind === "boolean") return value;
  if (kind === "bigint") return String(value);
  if (kind === "symbol" || kind === "function") return `[omitted_${kind}]`;

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeUnknown(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = "[REDACTED_SENSITIVE_FIELD]";
      } else {
        out[key] = sanitizeUnknown(item, depth + 1);
      }
    }
    return out;
  }

  return "[omitted_unknown]";
}

export async function buildArchitectureFossil(
  state: SolasteridState,
  args: { exportId: string; createdAt: string; filename: string },
): Promise<ArchitectureFossil> {
  const activeArmCount = state.arms.filter((a) => a.status === "active").length;
  const probationArmCount = state.arms.filter((a) => a.status === "probation").length;
  const retiredArmCount = state.arms.filter((a) => a.status === "retired").length;

  return {
    schemaVersion: 1,
    exportId: args.exportId,
    createdAt: args.createdAt,
    source: {
      app: "solasterid-studio",
      origin: typeof window !== "undefined" ? window.location.origin : "unknown",
    },
    privacy: {
      openaiApiKeyIncluded: false,
      seedTextIncluded: false,
      transcriptIncluded: false,
      fullStateIncluded: false,
    },
    export: {
      filename: args.filename,
      round: state.round,
      version: state.version,
    },
    metrics: {
      activeArmCount,
      probationArmCount,
      retiredArmCount,
      totalArmCount: state.arms.length,
      committeeCount: state.committees.length,
      mutationCount: state.mutations.length,
      seedEditCount: state.seedHistory.length,
      transcriptEventCount: state.transcript.length,
      visualEventCount: state.visualEvents.length,
    },
    seedFingerprint: {
      sha256: await sha256Text(state.tempseed),
      length: state.tempseed.length,
      historyCount: state.seedHistory.length,
    },
    architecture: {
      arms: state.arms.map((arm) => ({ ...arm })),
      committees: state.committees.map((committee) => ({ ...committee })),
      mutations: state.mutations.map((mutation) => ({
        id: mutation.id,
        round: mutation.round,
        type: mutation.type,
        summary: redactString(mutation.summary),
        payload: sanitizeUnknown(mutation.payload),
        timestamp: mutation.timestamp,
      })),
      v4Globals: state.v4Globals ? sanitizeUnknown(state.v4Globals) : undefined,
    },
  };
}

export async function submitArchitectureFossil(
  state: SolasteridState,
  args: { exportId: string; createdAt: string; filename: string },
): Promise<CollectorStatus> {
  const url = getCollectorUrl();
  if (!url) return { status: "skipped", reason: "not_configured" };

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const fossil = await buildArchitectureFossil(state, args);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fossil),
      signal: controller.signal,
    });

    const text = await response.text().catch(() => "");
    let parsed: { archivePath?: string; error?: string } | null = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      return {
        status: "failed",
        error: parsed?.error || `Collector returned ${response.status}`,
      };
    }

    return { status: "submitted", archivePath: parsed?.archivePath };
  } catch (err) {
    const error = err instanceof DOMException && err.name === "AbortError"
      ? "Collector request timed out"
      : String(err);
    return { status: "failed", error };
  } finally {
    window.clearTimeout(timeout);
  }
}
