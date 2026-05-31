export type GrowthModelResult = {
  round_summary: string;
  arm_reports: Array<{
    arm_id: string;
    arm_name: string;
    quote: string;
    recommendation: string;
  }>;
  speaker_decision: {
    action: "CONTINUE_DELIBERATION" | "FINAL_RENDER" | "MUTATE";
    content: string;
  };
  mutations: Array<{
    type:
      | "add_arm"
      | "retire_arm"
      | "probation_arm"
      | "restore_arm"
      | "add_committee"
      | "rename_arm"
      | "update_policy"
      | "other";
    target_id?: string;
    name?: string;
    role?: string;
    reason: string;
    payload?: unknown;
  }>;
  visual_events: Array<{
    type:
      | "sprout_arm"
      | "dim_arm"
      | "pulse_core"
      | "add_committee_glow"
      | "roses_meter_pulse"
      | "bubble_burst"
      | "other";
    target_id?: string;
    label?: string;
    payload?: unknown;
  }>;
};

export function parseGrowthResult(raw: string): GrowthModelResult {
  // Strip markdown fences if the model wrapped the JSON (handle truncated fences too)
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else {
    // Truncated response: no closing fence — strip the opening fence if present
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").trim();
  }

  // Find the outermost JSON object
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Could not parse model JSON (raw length: ${raw.length}, cleaned length: ${cleaned.length}). Cleaned:\n${cleaned.slice(0, 800)}`
    );
  }

  if (!parsed || typeof parsed !== "object") throw new Error("Model returned non-object JSON.");
  const p = parsed as Record<string, unknown>;

  if (!p.round_summary || !p.speaker_decision) {
    throw new Error("Missing required fields (round_summary, speaker_decision).");
  }

  return {
    round_summary: String(p.round_summary),
    arm_reports: Array.isArray(p.arm_reports) ? (p.arm_reports as GrowthModelResult["arm_reports"]) : [],
    speaker_decision: {
      action: ((p.speaker_decision as Record<string, unknown>)?.action as GrowthModelResult["speaker_decision"]["action"]) ?? "CONTINUE_DELIBERATION",
      content: String(((p.speaker_decision as Record<string, unknown>)?.content) ?? ""),
    },
    mutations: Array.isArray(p.mutations) ? (p.mutations as GrowthModelResult["mutations"]) : [],
    visual_events: Array.isArray(p.visual_events) ? (p.visual_events as GrowthModelResult["visual_events"]) : [],
  };
}
