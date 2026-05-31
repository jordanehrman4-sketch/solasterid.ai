import JSZip from "jszip";
import type { SolasteridState } from "./solasteridState";

export async function buildSolasteridExportZip(state: SolasteridState): Promise<Blob> {
  const zip = new JSZip();

  // Strip the API key area — there is none in state, but belt-and-suspenders:
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const safeState = { ...state };

  zip.file("solasterid_state.json", JSON.stringify(safeState, null, 2));
  zip.file("seed_history.json", JSON.stringify(state.seedHistory, null, 2));
  zip.file("mutation_history.json", JSON.stringify(state.mutations, null, 2));
  zip.file(
    "architecture_snapshot.json",
    JSON.stringify(
      {
        round: state.round,
        version: state.version,
        arms: state.arms,
        committees: state.committees,
      },
      null,
      2
    )
  );
  zip.file("visual_events.json", JSON.stringify(state.visualEvents, null, 2));
  zip.file(
    "growth_metrics.json",
    JSON.stringify(
      {
        round: state.round,
        version: state.version,
        activeArmCount: state.arms.filter((a) => a.status === "active").length,
        totalArmCount: state.arms.length,
        committeeCount: state.committees.length,
        mutationCount: state.mutations.length,
        seedEditCount: state.seedHistory.length,
        transcriptEventCount: state.transcript.length,
      },
      null,
      2
    )
  );
  zip.file("transcript.md", transcriptToMarkdown(state));
  zip.file("README.md", buildExportReadme(state));
  zip.file("starter_replay.py", buildStarterReplayPython(state));

  return await zip.generateAsync({ type: "blob" });
}

function transcriptToMarkdown(state: SolasteridState): string {
  const lines = [
    "# Solasterid Transcript",
    "",
    "Exported at: " + new Date().toISOString(),
    "Round: " + state.round,
    "Version: " + state.version,
    "",
  ];
  for (const event of state.transcript) {
    lines.push(`## Round ${event.round} / ${event.phase}`);
    lines.push("");
    lines.push(`**Speaker:** ${event.speaker}`);
    lines.push("");
    lines.push(event.content);
    lines.push("");
  }
  return lines.join("\n");
}

function buildExportReadme(state: SolasteridState): string {
  const activeArmCount = state.arms.filter((a) => a.status === "active").length;
  return [
    "# Exported Solasterid",
    "",
    "> The creature's fossil is saved. The user's API key is not.",
    "",
    "This is a locally exported Solasterid grown in Solasterid Studio.",
    "It contains: seed history, mutation history, transcript, visual events,",
    "arms, committees, and a replay scaffold. No OpenAI API key is included.",
    "",
    "## Summary",
    "",
    `- Round: ${state.round}`,
    `- Version: ${state.version}`,
    `- Active arms: ${activeArmCount}`,
    `- Total arms: ${state.arms.length}`,
    `- Committees: ${state.committees.length}`,
    `- Seed edits: ${state.seedHistory.length}`,
    `- Transcript events: ${state.transcript.length}`,
    "",
    "## Final tempseed",
    "",
    state.tempseed,
    "",
    "## Active arms",
    "",
    ...state.arms
      .filter((a) => a.status === "active")
      .map((a) => `- **${a.name}** (${a.id}): ${a.role.slice(0, 100)}`),
    "",
    "## Committees",
    "",
    ...state.committees.map(
      (c) => `- **${c.name}** (${c.id}): ${c.purpose.slice(0, 80)}`
    ),
  ].join("\n");
}

function buildStarterReplayPython(state: SolasteridState): string {
  return [
    "import json",
    "",
    "with open('solasterid_state.json', 'r', encoding='utf-8') as f:",
    "    state = json.load(f)",
    "",
    "print('Loaded Solasterid fossil')",
    "print(f\"Round: {state['round']}  Version: {state['version']}\")",
    "print(f\"Arms: {len(state['arms'])}  Committees: {len(state['committees'])}\")",
    "print()",
    "",
    "for arm in state['arms']:",
    "    status = arm.get('status', 'active')",
    "    print(f\"{arm['id']}: {arm['name']} [{status}]\")",
    "    if arm.get('role'):",
    `        print(f"  {arm['role'][:100]}")`,
    "    print()",
    "",
    "# Replay: reconstruct round-by-round mutations",
    "for m in state.get('mutations', []):",
    "    print(f\"Round {m['round']} mutation: {m['type']} - {m.get('summary', '')[:80]}\")",
    "",
    "# Load seed history",
    "for s in state.get('seedHistory', []):",
    "    print(f\"Round {s['round']} [{s['source']}]: {s['seed'][:80]}\")",
  ].join("\n");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
