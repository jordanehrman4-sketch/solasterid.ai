"""Reproduce the crash by re-running the exact failing step."""
import json, traceback, sys, os
from pathlib import Path

# Load the architecture from the failing run
run_dir = Path("solasterid_v4/runs/run_20260524_204008_3f95029c")
state = json.load(open(run_dir / "architecture_before.json", "r", encoding="utf-8"))
transcript = json.load(open(run_dir / "transcript_so_far.json", "r", encoding="utf-8"))

print(f"Run: {run_dir.name}")
print(f"Arm reports so far: {len(transcript['arm_reports'])}")
print(f"Speaker decisions so far: {len(transcript['speaker_decisions'])}")
print(f"Committee events so far: {len(transcript['committee_events'])}")

# The crash happens during step 2's wave pass.
# Step 2 committee files exist: committee_2_1_core_reasoning, committee_2_2_*
# Let's see which step 2 committees got written:
step2_files = sorted([f.name for f in run_dir.iterdir() if f.name.startswith("committee_2_")])
print(f"\nStep 2 committee files ({len(step2_files)}):")
for f in step2_files:
    print(f"  {f}")

# Count step 2 arm reports in transcript
step2_reports = [r for r in transcript["arm_reports"] if r.get("step_index") == 2]
print(f"\nStep 2 arm reports in transcript: {len(step2_reports)}")

# Check if the speaker decision from step 1 has a speaker_msg_id
if transcript["speaker_decisions"]:
    sd = transcript["speaker_decisions"][-1]
    print(f"\nLast speaker decision:")
    print(f"  action: {sd.get('action')}")
    print(f"  speaker_msg_id: {sd.get('speaker_msg_id')}")
    print(f"  speaker_timestamp: {sd.get('speaker_timestamp')}")

# Check for liveness issues
print(f"\nLiveness log entries: {len(transcript.get('liveness_log', []))}")
for entry in transcript.get("liveness_log", []):
    print(f"  step {entry.get('step_index')}: gate_failed={entry.get('gate_failed')} reason={entry.get('gate_reason')}")

# Check coverage
print(f"\nCoverage log entries: {len(transcript.get('coverage_log', []))}")
for entry in transcript.get("coverage_log", []):
    print(f"  step {entry.get('step_index')}: ok={entry.get('ok')} cov={entry.get('committee_coverage')} arms={entry.get('distinct_arms')}")

# Check if the MIN_COMMITTEE_COVERAGE was mutated to something crazy
g = state.get("globals", {})
print(f"\nKey globals:")
print(f"  MAX_TOTAL_API_CALLS: {g.get('MAX_TOTAL_API_CALLS')}")
print(f"  MIN_COMMITTEE_COVERAGE: {g.get('MIN_COMMITTEE_COVERAGE')}")
print(f"  MAX_OUTPUT_STEPS: {g.get('MAX_OUTPUT_STEPS')}")
print(f"  MAX_COMMITTEES_PER_WAVE: {g.get('MAX_COMMITTEES_PER_WAVE')}")
print(f"  MAX_WAVES_PER_STEP: {g.get('MAX_WAVES_PER_STEP')}")

# Now check the CURRENT architecture_state.json for the same
current = json.load(open("solasterid_v4/architecture_state.json", "r", encoding="utf-8"))
cg = current.get("globals", {})
print(f"\nCURRENT architecture_state.json globals:")
print(f"  MAX_TOTAL_API_CALLS: {cg.get('MAX_TOTAL_API_CALLS')}")
print(f"  MIN_COMMITTEE_COVERAGE: {cg.get('MIN_COMMITTEE_COVERAGE')}")
