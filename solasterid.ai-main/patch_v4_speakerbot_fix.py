"""Patch for pentamind_v4_solasterid_async.ipynb -- fixes three bugs:

1. MAX_TOTAL_API_CALLS too low (400) for a 44-arm / 20-committee roster.
   Bumped default to 800 and added auto-scaling in the driver loop.

2. No API-budget guard inside the wave loop.  Added a check so the loop
   bails out ~5 calls before exhaustion, leaving room for speakerbot.

3. Comment/code mismatch on seed-prompt interval (aligned to every 10).

Run:  python patch_v4_speakerbot_fix.py
"""
import json
from pathlib import Path

NB = Path("pentamind_v4_solasterid_async.ipynb")
nb = json.loads(NB.read_text(encoding="utf-8"))

def cell_sources(nb):
    """Yield (cell_index, joined_source_text) for code cells."""
    for i, cell in enumerate(nb.get("cells", [])):
        if cell.get("cell_type") == "code":
            yield i, "".join(cell["source"])

def replace_in_cell(nb, cell_idx, old, new):
    src = "".join(nb["cells"][cell_idx]["source"])
    assert old in src, f"Target not found in cell {cell_idx}"
    src = src.replace(old, new, 1)
    nb["cells"][cell_idx]["source"] = src.splitlines(keepends=True)
    # make sure last line ends with newline
    if nb["cells"][cell_idx]["source"] and not nb["cells"][cell_idx]["source"][-1].endswith("\n"):
        nb["cells"][cell_idx]["source"][-1] += "\n"

patched = 0

for ci, src in cell_sources(nb):
    # --- Fix 1: bump default budget ---
    if '"MAX_TOTAL_API_CALLS": 400,' in src:
        replace_in_cell(
            nb, ci,
            '"MAX_TOTAL_API_CALLS": 400,              # Hard ceiling so a bloated arm roster can\'t hang.',
            '"MAX_TOTAL_API_CALLS": 800,              # Hard ceiling; auto-scaled at run start if roster outgrows it.',
        )
        patched += 1
        print(f"[1/3] cell {ci}: bumped MAX_TOTAL_API_CALLS 400 -> 800")

    # --- Fix 2: budget guard in wave loop ---
    if 'for committee_id in scheduled:' in src and 'visit_ceiling' in src and 'active_committee_ids' in src:
        old_block = (
            '        for committee_id in scheduled:\n'
            '            if total_visits >= visit_ceiling:\n'
            '                rprint("[yellow]Committee visit ceiling reached; ending waves early.[/yellow]")\n'
            '                break\n'
            '            if committee_id not in active_committee_ids(state):\n'
            '                continue'
        )
        new_block = (
            '        for committee_id in scheduled:\n'
            '            if total_visits >= visit_ceiling:\n'
            '                rprint("[yellow]Committee visit ceiling reached; ending waves early.[/yellow]")\n'
            '                break\n'
            '            # Budget guard: stop wave early so speakerbot still has room to run.\n'
            '            if API_CALLS_USED >= int(g.get("MAX_TOTAL_API_CALLS", 800)) - 5:\n'
            '                rprint("[yellow]API budget nearly exhausted; ending wave early so speaker can run.[/yellow]")\n'
            '                break\n'
            '            if committee_id not in active_committee_ids(state):\n'
            '                continue'
        )
        replace_in_cell(nb, ci, old_block, new_block)
        patched += 1
        print(f"[2/3] cell {ci}: added API-budget guard in wave loop")

    # --- Fix 3: driver loop -- add auto-scale budget before save ---
    if 'The seed prompt reappears every 5 iterations' in src:
        old_driver = (
            'state = load_architecture_state()\n'
            'state["globals"]["PRINT_FULL_ARM_REPORTS"] = False   # keep logs readable with many arms\n'
            'save_architecture_state(state, reason="enable_compact_reports")'
        )
        new_driver = (
            'state = load_architecture_state()\n'
            'state["globals"]["PRINT_FULL_ARM_REPORTS"] = False   # keep logs readable with many arms\n'
            '\n'
            '# ---- Auto-scale API budget to roster size ----\n'
            '# Formula: listener + (committees * (1 leader + members)) + speaker/evo/spawn headroom\n'
            '_n_arms = len(active_arm_ids(state))\n'
            '_n_comms = len(active_committee_ids(state))\n'
            '_member_slots = sum(\n'
            '    len(v.get("members", []))\n'
            '    for v in state.get("committees", {}).values()\n'
            '    if isinstance(v, dict)\n'
            '    and not v.get("retired")\n'
            '    and v.get("status", "active") != "retired"\n'
            ')\n'
            '_est_per_step = 1 + _n_comms + _member_slots + 10  # listener + leaders + arms + headroom\n'
            '_max_steps = int(state["globals"].get("MAX_OUTPUT_STEPS", 6))\n'
            '_min_budget = _est_per_step * min(_max_steps, 2) + 50  # at least 2 steps + safety margin\n'
            '_cur_budget = int(state["globals"].get("MAX_TOTAL_API_CALLS", 800))\n'
            'if _cur_budget < _min_budget:\n'
            '    state["globals"]["MAX_TOTAL_API_CALLS"] = _min_budget\n'
            '    rprint(\n'
            '        f"[yellow]Auto-scaled MAX_TOTAL_API_CALLS: {_cur_budget} -> {_min_budget} "\n'
            '        f"(roster: {_n_arms} arms, {_n_comms} committees, "\n'
            '        f"{_member_slots} member-slots)[/yellow]"\n'
            '    )\n'
            '\n'
            'save_architecture_state(state, reason="enable_compact_reports")'
        )
        replace_in_cell(nb, ci, old_driver, new_driver)
        patched += 1
        print(f"[3/3] cell {ci}: added auto-scale budget before save")

assert patched == 3, f"Expected 3 patches, applied {patched}"

NB.write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
print(f"\nPatched {NB} successfully ({patched}/3 fixes).")
print(f"File size: {NB.stat().st_size:,} bytes")
