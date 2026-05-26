import type { GrowthModelResult } from "./modelSchemas";
import { DEFAULT_SEED } from "./defaultSeed";
export { DEFAULT_SEED };

export type SolasteridStatus = "idle" | "running" | "paused" | "error" | "complete";
export type ArmStatus = "active" | "probation" | "retired";

export type TranscriptEvent = {
  id: string;
  round: number;
  phase: string;
  speaker: string;
  content: string;
  timestamp: string;
};

export type SolasteridArm = {
  id: string;
  name: string;
  role: string;
  committeeIds: string[];
  status: ArmStatus;
  color?: string;
  createdRound: number;
  retiredRound?: number;
};

export type SolasteridCommittee = {
  id: string;
  name: string;
  purpose: string;
  armIds: string[];
  createdRound: number;
  color?: string;
  layer?: number;
};

export type SolasteridMutation = {
  id: string;
  round: number;
  type:
    | "add_arm"
    | "retire_arm"
    | "probation_arm"
    | "restore_arm"
    | "add_committee"
    | "rename_arm"
    | "update_policy"
    | "other";
  summary: string;
  payload: unknown;
  timestamp: string;
};

export type SeedHistoryEvent = {
  id: string;
  round: number;
  seed: string;
  source: "default" | "user_edit" | "system";
  timestamp: string;
};

export type VisualEvent = {
  id: string;
  round: number;
  type:
    | "sprout_arm"
    | "dim_arm"
    | "pulse_core"
    | "add_committee_glow"
    | "roses_meter_pulse"
    | "bubble_burst"
    | "other";
  targetId?: string;
  label?: string;
  payload?: unknown;
};

export type SolasteridState = {
  round: number;
  version: number;
  status: SolasteridStatus;
  tempseed: string;
  seedHistory: SeedHistoryEvent[];
  arms: SolasteridArm[];
  committees: SolasteridCommittee[];
  transcript: TranscriptEvent[];
  mutations: SolasteridMutation[];
  visualEvents: VisualEvent[];
  lastPromptInjectedSeedRound?: number;
  exportUnlocked: boolean;
  v4Globals?: Record<string, unknown>;
};

// (DEFAULT_SEED re-exported from ./defaultSeed)

const COMMITTEE_COLORS: Record<string, string> = {
  core_reasoning: "#7dd3fc",
  governance_safety: "#fb7185",
  memory_replay: "#c4b5fd",
  evolution_experimentation: "#fdba74",
  semantic_detectors: "#86efac",
  domain_specialists: "#5eead4",
  synthesis_cabinet: "#f0abfc",
  nutrition_trials: "#fde68a",
  cluster_trial_methods: "#67e8f9",
  environmental_health: "#4ade80",
  environmental_causal_rollout: "#34d399",
  bayesian_hierarchical_methods: "#a78bfa",
  environmental_rollout_methods: "#2dd4bf",
  design_critique: "#f87171",
  rollout_interference_methods: "#fb923c",
  sensitivity_grid_specification: "#facc15",
  human_factors_and_cognition: "#e879f9",
  mediation_and_rollout: "#818cf8",
  transportability_and_generalization: "#38bdf8",
  cross_site_policy_transport: "#60a5fa",
};

const FALLBACK_COLORS = [
  "#7dd3fc", "#5eead4", "#f0abfc", "#fb7185", "#fde68a",
  "#c4b5fd", "#fdba74", "#86efac", "#67e8f9", "#a78bfa",
];

export function randomArmColor(index: number): string {
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// Convert the raw v4 architecture_state.json (from the Python notebook) into SolasteridState.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertV4Architecture(v4: any): SolasteridState {
  const now = new Date().toISOString();
  const version = Number(v4.architecture_version) || 0;

  // Build a map of committee memberships for each arm
  const armCommitteeMap: Record<string, string[]> = {};
  const committees: SolasteridCommittee[] = [];

  if (v4.committees && typeof v4.committees === "object") {
    let ci = 0;
    for (const [cid, craw] of Object.entries(v4.committees) as [string, any][]) {
      if (craw.retired) continue;
      const memberIds: string[] = Array.isArray(craw.members) ? craw.members : [];
      for (const mid of memberIds) {
        if (!armCommitteeMap[mid]) armCommitteeMap[mid] = [];
        armCommitteeMap[mid].push(cid);
      }
      committees.push({
        id: cid,
        name: craw.name || cid,
        purpose: craw.routing_hint || craw.purpose || craw.name || "",
        armIds: memberIds,
        createdRound: 0,
        color: COMMITTEE_COLORS[cid] ?? FALLBACK_COLORS[ci % FALLBACK_COLORS.length],
        layer: Number(craw.layer) || 0,
      });
      ci++;
    }
  }

  // Convert arms
  const arms: SolasteridArm[] = [];
  if (v4.arms && typeof v4.arms === "object") {
    let ai = 0;
    for (const [aid, araw] of Object.entries(v4.arms) as [string, any][]) {
      const isRetired = araw.retired === true || araw.status === "retired";
      const isProbation = araw.status === "probation";
      const status: ArmStatus = isRetired ? "retired" : isProbation ? "probation" : "active";

      // Pick color from first committee membership, or fallback
      const firstCommittee = (armCommitteeMap[aid] ?? [])[0];
      const color = firstCommittee
        ? (COMMITTEE_COLORS[firstCommittee] ?? randomArmColor(ai))
        : randomArmColor(ai);

      arms.push({
        id: aid,
        name: araw.name || aid,
        role: araw.lens || araw.role || "",
        committeeIds: armCommitteeMap[aid] ?? [],
        status,
        color,
        createdRound: 0,
        retiredRound: isRetired ? version : undefined,
      });
      ai++;
    }
  }

  const tempseed = DEFAULT_SEED;

  return {
    round: version,
    version,
    status: "idle",
    tempseed,
    seedHistory: [
      {
        id: crypto.randomUUID(),
        round: version,
        seed: tempseed,
        source: "default",
        timestamp: now,
      },
    ],
    arms,
    committees,
    transcript: [
      {
        id: crypto.randomUUID(),
        round: version,
        phase: "bootstrap",
        speaker: "solasterid",
        content: `Loaded from v4 architecture (version ${version}). ${arms.filter(a => a.status === "active").length} active arms, ${committees.length} committees. The creature stirs.`,
        timestamp: now,
      },
    ],
    mutations: [],
    visualEvents: [],
    exportUnlocked: version >= 50,
    v4Globals: v4.globals ?? {},
  };
}

export function createInitialSolasteridState(): SolasteridState {
  const now = new Date().toISOString();
  return {
    round: 0,
    version: 0,
    status: "idle",
    tempseed: DEFAULT_SEED,
    seedHistory: [{ id: crypto.randomUUID(), round: 0, seed: DEFAULT_SEED, source: "default", timestamp: now }],
    arms: [
      { id: "arm_1", name: "Literalist", role: "Exact wording, scope, definitions, formatting constraints, and output contracts.", committeeIds: ["committee_core"], status: "active", createdRound: 0, color: "#7dd3fc" },
      { id: "arm_3", name: "Mechanic", role: "Implementation feasibility, architecture, runtime, code shape, and operational state.", committeeIds: ["committee_core"], status: "active", createdRound: 0, color: "#5eead4" },
      { id: "arm_3d", name: "Dreamer", role: "Speculative, creative, high-variance possibilities.", committeeIds: ["committee_core"], status: "active", createdRound: 0, color: "#f0abfc" },
      { id: "arm_4", name: "Adversary", role: "Contradictions, overclaims, safety problems, epistemic risk, failure modes.", committeeIds: ["committee_core"], status: "active", createdRound: 0, color: "#fb7185" },
      { id: "arm_5", name: "Verifier", role: "Output validity, evidence, schemas, and export readiness.", committeeIds: ["committee_core"], status: "active", createdRound: 0, color: "#fde68a" },
    ],
    committees: [
      { id: "committee_core", name: "Core Radial Committee", purpose: "Initial five-arm deliberative structure.", armIds: ["arm_1", "arm_3", "arm_3d", "arm_4", "arm_5"], createdRound: 0, color: "#22d3ee", layer: 0 },
    ],
    transcript: [],
    mutations: [],
    visualEvents: [],
    exportUnlocked: false,
  };
}

export function applyUserSeedUpdate(state: SolasteridState, nextSeed: string): SolasteridState {
  const trimmed = nextSeed.trim();
  if (!trimmed) return state;
  const now = new Date().toISOString();
  return {
    ...state,
    tempseed: trimmed,
    seedHistory: [
      ...state.seedHistory,
      { id: crypto.randomUUID(), round: state.round, seed: trimmed, source: "user_edit", timestamp: now },
    ],
    transcript: [
      ...state.transcript,
      {
        id: crypto.randomUUID(),
        round: state.round,
        phase: "seed_update",
        speaker: "user",
        content: "User updated tempseed: " + trimmed.slice(0, 300),
        timestamp: now,
      },
    ],
  };
}

export function applyGrowthResult(state: SolasteridState, result: GrowthModelResult): SolasteridState {
  const now = new Date().toISOString();
  const nextRound = state.round + 1;

  let nextArms = [...state.arms];
  let nextCommittees = [...state.committees];

  const transcriptEvents: TranscriptEvent[] = [
    {
      id: crypto.randomUUID(),
      round: nextRound,
      phase: "round_summary",
      speaker: "solasterid",
      content: result.round_summary,
      timestamp: now,
    },
    ...result.arm_reports.map((r) => ({
      id: crypto.randomUUID(),
      round: nextRound,
      phase: "arm_report",
      speaker: r.arm_name || r.arm_id,
      content: r.quote + "\nRecommendation: " + r.recommendation,
      timestamp: now,
    })),
    {
      id: crypto.randomUUID(),
      round: nextRound,
      phase: "speaker_decision",
      speaker: "Speakerbot",
      content: result.speaker_decision.content,
      timestamp: now,
    },
  ];

  const mutations: SolasteridMutation[] = result.mutations.map((m) => ({
    id: crypto.randomUUID(),
    round: nextRound,
    type: m.type,
    summary: m.reason || m.type,
    payload: m,
    timestamp: now,
  }));

  for (const mutation of result.mutations) {
    if (mutation.type === "add_arm" && mutation.name && mutation.role) {
      const newId = "arm_" + String(nextArms.length + 1) + "_r" + nextRound;
      nextArms.push({
        id: newId,
        name: mutation.name,
        role: mutation.role,
        committeeIds: [],
        status: "active",
        createdRound: nextRound,
        color: randomArmColor(nextArms.length),
      });
    }
    if (mutation.type === "retire_arm" && mutation.target_id) {
      nextArms = nextArms.map((arm) =>
        arm.id === mutation.target_id ? { ...arm, status: "retired", retiredRound: nextRound } : arm
      );
    }
    if (mutation.type === "probation_arm" && mutation.target_id) {
      nextArms = nextArms.map((arm) =>
        arm.id === mutation.target_id ? { ...arm, status: "probation" } : arm
      );
    }
    if (mutation.type === "restore_arm" && mutation.target_id) {
      nextArms = nextArms.map((arm) =>
        arm.id === mutation.target_id ? { ...arm, status: "active" } : arm
      );
    }
    if (mutation.type === "add_committee" && mutation.name) {
      const newId = "committee_" + String(nextCommittees.length + 1) + "_r" + nextRound;
      nextCommittees.push({
        id: newId,
        name: mutation.name,
        purpose: mutation.role ?? mutation.reason ?? "New committee.",
        armIds: [],
        createdRound: nextRound,
        color: randomArmColor(nextCommittees.length + 7),
        layer: 2,
      });
    }
  }

  const visualEvents: VisualEvent[] = result.visual_events.map((v) => ({
    id: crypto.randomUUID(),
    round: nextRound,
    type: v.type,
    targetId: v.target_id,
    label: v.label,
    payload: v.payload,
  }));

  return {
    ...state,
    round: nextRound,
    version: Math.max(state.version, nextRound),
    arms: nextArms,
    committees: nextCommittees,
    transcript: [...state.transcript, ...transcriptEvents],
    mutations: [...state.mutations, ...mutations],
    visualEvents: [...state.visualEvents, ...visualEvents],
    lastPromptInjectedSeedRound:
      nextRound === 1 || nextRound % 5 === 0 ? nextRound : state.lastPromptInjectedSeedRound,
    exportUnlocked: nextRound >= 50 || state.exportUnlocked,
  };
}
