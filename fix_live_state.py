"""Fix the live architecture_state.json:
1. Bump MAX_TOTAL_API_CALLS from 400 to match roster needs
2. Report MIN_COMMITTEE_COVERAGE (may have been mutated too high)
"""
import json
from pathlib import Path

STATE = Path("solasterid_v4/architecture_state.json")
state = json.load(open(STATE, "r", encoding="utf-8"))
g = state["globals"]

# Count roster
arms = {a: v for a, v in state["arms"].items()
        if not v.get("retired") and v.get("status", "active") != "retired"}
comms = {c: v for c, v in state.get("committees", {}).items()
         if isinstance(v, dict) and not v.get("retired") and v.get("status", "active") != "retired"}
member_slots = sum(len(v.get("members", [])) for v in comms.values())

print(f"Active arms: {len(arms)}")
print(f"Active committees: {len(comms)}")
print(f"Member slots: {member_slots}")

# Compute needed budget
est_per_step = 1 + len(comms) + member_slots + 10
max_steps = int(g.get("MAX_OUTPUT_STEPS", 6))
min_budget = est_per_step * min(max_steps, 2) + 50
old_budget = int(g.get("MAX_TOTAL_API_CALLS", 400))

print(f"\nEstimated calls per step: {est_per_step}")
print(f"Min budget (2 steps + margin): {min_budget}")
print(f"Current budget: {old_budget}")

changes = []

if old_budget < min_budget:
    g["MAX_TOTAL_API_CALLS"] = min_budget
    changes.append(f"MAX_TOTAL_API_CALLS: {old_budget} -> {min_budget}")
    print(f"  FIXED: {old_budget} -> {min_budget}")
else:
    print(f"  Budget OK")

# Check MIN_COMMITTEE_COVERAGE
old_cov = g.get("MIN_COMMITTEE_COVERAGE")
print(f"\nMIN_COMMITTEE_COVERAGE: {old_cov}")
if old_cov and old_cov > 0.65:
    print(f"  WARNING: coverage threshold is very high ({old_cov})")
    print(f"  With {len(comms)} committees, you need {int(old_cov * len(comms))} to report")
    print(f"  Resetting to 0.50 (still meaningful but achievable)")
    g["MIN_COMMITTEE_COVERAGE"] = 0.50
    changes.append(f"MIN_COMMITTEE_COVERAGE: {old_cov} -> 0.50")

if changes:
    # Write
    tmp = STATE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(STATE)
    print(f"\nApplied {len(changes)} fix(es) to {STATE}:")
    for c in changes:
        print(f"  {c}")
else:
    print("\nNo changes needed.")
