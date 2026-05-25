import type { SolasteridState } from "./solasteridState";

export function shouldInjectFullSeed(round: number): boolean {
  return round === 1 || round % 5 === 0;
}

export function buildGrowthPrompt(state: SolasteridState): string {
  const nextRound = state.round + 1;
  const injectFullSeed = shouldInjectFullSeed(nextRound);

  const activeArms = state.arms.filter((a) => a.status === "active");
  const recentTranscript = state.transcript.slice(-12);
  const recentMutations = state.mutations.slice(-8);

  const seedBlock = injectFullSeed
    ? `FULL RECURRENT SEED INJECTION (every 5 rounds):\nseed=<${state.tempseed}>`
    : `Seed reminder: tempseed is active but this is not a full checkpoint round.`;

  const archSummary = {
    round: state.round,
    version: state.version,
    activeArmCount: activeArms.length,
    arms: state.arms.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role.slice(0, 120),
      status: a.status,
      committeeIds: a.committeeIds,
    })),
    committees: state.committees.map((c) => ({
      id: c.id,
      name: c.name,
      purpose: c.purpose.slice(0, 100),
      armIds: c.armIds,
      layer: c.layer ?? 0,
    })),
    v4Globals: state.v4Globals ?? {},
    exportUnlocked: state.exportUnlocked,
  };

  const responseSchema = {
    round_summary: "string — what happened this round, what grew, what was decided",
    arm_reports: [
      {
        arm_id: "string (existing arm id, e.g. arm_1)",
        arm_name: "string",
        quote: "string — one sentence in character, from this arm's perspective",
        recommendation: "string — concrete recommendation for the architecture or next prompt",
      },
    ],
    speaker_decision: {
      action: "CONTINUE_DELIBERATION | FINAL_RENDER | MUTATE",
      content: "string — the speaker's synthesis or directive",
    },
    mutations: [
      {
        type: "add_arm | retire_arm | probation_arm | restore_arm | add_committee | rename_arm | update_policy | other",
        target_id: "optional — existing arm or committee id to target",
        name: "optional — new name (for add_arm, rename_arm)",
        role: "optional — lens/role description (for add_arm)",
        reason: "string — why this mutation is being made",
        payload: {},
      },
    ],
    visual_events: [
      {
        type: "sprout_arm | dim_arm | pulse_core | add_committee_glow | roses_meter_pulse | bubble_burst | other",
        target_id: "optional string",
        label: "optional string",
        payload: {},
      },
    ],
  };

  return [
    "You are the growth engine for Solasterid Studio — a living multi-agent starfish intelligence.",
    "",
    "ARCHITECTURE OVERVIEW:",
    "Solasterid v4 uses a wave scheduler, coverage gate, dynamic specialist spawning, and loop-break",
    "detection. Arms are reasoning lenses. Committees are groups of arms that deliberate together.",
    "The wave scheduler visits committees in dependency layers (layer 0 = core, 1 = secondary, 2+ = specialist).",
    "The coverage gate prevents finalization until enough committees have reported.",
    "Dynamic spawning: an arm can flag a domain_gap, and the orchestrator spawns a specialist mid-run.",
    "Loop-break: repeating schema signatures route the system to unvisited domain committees.",
    "",
    "DIVISION OF LABOR:",
    "- ARMS = reasoning lenses + domain experts. They think, they deliberate, they recommend.",
    "- ENGINE FUNCTIONS (wave scheduling, coverage gating, spawning) = code. Cannot be recreated as arms.",
    "- MUTATIONS = bounded additions/retirements. Avoid runaway bloat.",
    "",
    seedBlock,
    "",
    "CURRENT ROUND: " + String(nextRound),
    "",
    "CURRENT ARCHITECTURE:",
    JSON.stringify(archSummary, null, 2),
    "",
    "RECENT TRANSCRIPT (last 12 events):",
    JSON.stringify(recentTranscript, null, 2),
    "",
    "RECENT MUTATIONS (last 8):",
    JSON.stringify(recentMutations, null, 2),
    "",
    "TASK: Advance the Solasterid by exactly one round.",
    "",
    "Growth rules:",
    "- Maintain continuity with the existing arm roster and committee structure.",
    "- Add specialist arms only when a genuine domain gap exists — and name them concretely.",
    "- Retire or probation arms that have become redundant (reason required).",
    "- Let the current seed influence growth direction.",
    "- At least 3 active arms must report. Include the core arms (arm_1, arm_3, arm_4) when relevant.",
    "- Produce concrete, inspectable changes. No vague self-congratulation.",
    "- Maintain personality: this creature is weird, resilient, slightly cursed, and operationally useful.",
    "- Suggest 0-2 mutations per round. Do NOT suggest scheduling/spawning mechanisms as new arms.",
    "",
    "Return STRICT JSON ONLY. No markdown. No prose outside JSON. No code fences.",
    "",
    "RESPONSE SCHEMA:",
    JSON.stringify(responseSchema, null, 2),
  ].join("\n");
}
