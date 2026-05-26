"""Add try/except with traceback INSIDE the wave loop around arm_deliberate,
so we can see exactly which call crashes and why."""
import json
from pathlib import Path

NB = Path("pentamind_v4_solasterid_async.ipynb")
nb = json.loads(NB.read_text(encoding="utf-8"))

def replace_in_cell(nb, cell_idx, old, new):
    src = "".join(nb["cells"][cell_idx]["source"])
    assert old in src, f"Target not found in cell {cell_idx}"
    src = src.replace(old, new, 1)
    nb["cells"][cell_idx]["source"] = src.splitlines(keepends=True)
    if nb["cells"][cell_idx]["source"] and not nb["cells"][cell_idx]["source"][-1].endswith("\n"):
        nb["cells"][cell_idx]["source"][-1] += "\n"

patched = False
for ci, cell in enumerate(nb["cells"]):
    if cell.get("cell_type") != "code":
        continue
    src = "".join(cell["source"])
    if "def run_wave_deliberation_pass" not in src:
        continue
    
    # Wrap the arm_deliberate call in a try/except
    old = (
        '            if action != "route_only":\n'
        '                for aid in committee_member_ids(state, committee_id):\n'
        '                    member_packet = (leader_output.get("per_member") or {}).get(aid, {})\n'
        '                    heard = (member_packet.get("heard")\n'
        '                             or (listener.get("per_arm", {}).get(aid, {}) or {}).get("heard")\n'
        '                             or user_prompt)\n'
        '                    context = {\n'
        '                        "committee_id": committee_id, "committee_name": c.get("name", committee_id),\n'
        '                        "committee_layer": c.get("layer", 0),\n'
        '                        "leader_id": leader_output.get("committee_leader_id"),\n'
        '                        "leader_name": leader_output.get("committee_leader_name"),\n'
        '                        "committee_charge": ((listener.get("per_committee") or {}).get(committee_id, {}) or {}).get("heard"),\n'
        '                        "leader_summary": leader_output.get("leader_summary"),\n'
        '                        "role_in_committee": member_packet.get("role_in_committee"),\n'
        '                        "expected_output": member_packet.get("expected_output"),\n'
        '                        "release_to_speaker": release_flag, "wave_index": wave_index,\n'
        '                    }\n'
        '                    report = arm_deliberate(aid, user_prompt, heard, state, transcript["shared_scratch"],\n'
        '                                            step_index, wave_index, run_dir, liveness_evidence,\n'
        '                                            transcript=transcript, committee_context=context)\n'
        '                    report["committee_released_to_speaker"] = release_flag\n'
        '                    all_reports.append(report); wave_reports.append(report)\n'
        '                    committee_member_reports.append(report)\n'
        '                    if release_flag:\n'
        '                        released_reports.append(report)\n'
        '                    _append_arm_report_to_transcript(transcript, state, report, aid, step_index, wave_index)\n'
        '                    _print_arm_report_summary(state, report, aid, g)'
    )
    
    new = (
        '            if action != "route_only":\n'
        '                for aid in committee_member_ids(state, committee_id):\n'
        '                  try:\n'
        '                    member_packet = (leader_output.get("per_member") or {}).get(aid, {})\n'
        '                    heard = (member_packet.get("heard")\n'
        '                             or (listener.get("per_arm", {}).get(aid, {}) or {}).get("heard")\n'
        '                             or user_prompt)\n'
        '                    context = {\n'
        '                        "committee_id": committee_id, "committee_name": c.get("name", committee_id),\n'
        '                        "committee_layer": c.get("layer", 0),\n'
        '                        "leader_id": leader_output.get("committee_leader_id"),\n'
        '                        "leader_name": leader_output.get("committee_leader_name"),\n'
        '                        "committee_charge": ((listener.get("per_committee") or {}).get(committee_id, {}) or {}).get("heard"),\n'
        '                        "leader_summary": leader_output.get("leader_summary"),\n'
        '                        "role_in_committee": member_packet.get("role_in_committee"),\n'
        '                        "expected_output": member_packet.get("expected_output"),\n'
        '                        "release_to_speaker": release_flag, "wave_index": wave_index,\n'
        '                    }\n'
        '                    report = arm_deliberate(aid, user_prompt, heard, state, transcript["shared_scratch"],\n'
        '                                            step_index, wave_index, run_dir, liveness_evidence,\n'
        '                                            transcript=transcript, committee_context=context)\n'
        '                    report["committee_released_to_speaker"] = release_flag\n'
        '                    all_reports.append(report); wave_reports.append(report)\n'
        '                    committee_member_reports.append(report)\n'
        '                    if release_flag:\n'
        '                        released_reports.append(report)\n'
        '                    _append_arm_report_to_transcript(transcript, state, report, aid, step_index, wave_index)\n'
        '                    _print_arm_report_summary(state, report, aid, g)\n'
        '                  except Exception as _arm_err:\n'
        '                    import traceback as _tb\n'
        '                    rprint(f"[red]CRASH in arm_deliberate({aid}, committee={committee_id}, step={step_index}, wave={wave_index}): {_arm_err}[/red]")\n'
        '                    _tb.print_exc()\n'
        '                    # Build a synthetic error report so the run can continue\n'
        '                    report = {"stance": "uncertain", "confidence": "0.0", "interpretation": f"arm crashed: {_arm_err}",\n'
        '                              "ready_to_final_render": "false", "scratch": "crash_recovery",\n'
        '                              "arm_id": aid, "arm_name": state["arms"].get(aid, {}).get("name", aid),\n'
        '                              "committee_id": committee_id, "step_index": step_index, "deliberation_round": wave_index,\n'
        '                              "committee_released_to_speaker": release_flag, "_crash_error": str(_arm_err)}\n'
        '                    all_reports.append(report); wave_reports.append(report)\n'
        '                    committee_member_reports.append(report)'
    )
    
    replace_in_cell(nb, ci, old, new)
    patched = True
    print(f"Patched cell {ci}: wrapped arm_deliberate loop in try/except")
    break

assert patched, "Could not find the target block"

NB.write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
print(f"Patched {NB}")
