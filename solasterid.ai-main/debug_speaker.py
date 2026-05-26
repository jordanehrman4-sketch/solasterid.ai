"""Debug why the speakerbot API call is failing."""
import json, sys
from pathlib import Path

state = json.load(open("solasterid_v4/architecture_state.json", "r", encoding="utf-8"))

# Count active arms
arms = {a: v for a, v in state["arms"].items()
        if not v.get("retired") and v.get("status", "active") != "retired"}
comms = {c: v for c, v in state.get("committees", {}).items()
         if isinstance(v, dict) and not v.get("retired") and v.get("status", "active") != "retired"}

print(f"Active arms: {len(arms)}")
print(f"Active committees: {len(comms)}")

# Simulate what architecture_report() produces
arm_lines = []
for aid, arm in arms.items():
    t = arm.get("tuning", {})
    arm_lines.append(
        f"- {aid} / {arm.get('name')}: lens={arm.get('lens')}; "
        f"web_access={arm.get('web_access', True)}; "
        f"generation={arm.get('generation', 0)}; parents={arm.get('parents', [])}; "
        f"temperature={t.get('temperature')}; doubt={t.get('doubt')}; "
        f"precision={t.get('precision')}; creativity={t.get('creativity')}"
    )
arch_report_arms = "\n".join(arm_lines)

# Committee report
comm_lines = []
for cid, c in comms.items():
    leader = c.get("leader")
    leader_name = arms.get(leader, {}).get("name", leader) if leader else "?"
    member_names = [f"{m}:{arms.get(m, {}).get('name', m)}" for m in c.get("members", [])]
    comm_lines.append(
        f"- {cid} / {c.get('name')} (layer={c.get('layer')}, leader={leader}:{leader_name}) "
        f"members={member_names}"
    )
comm_report = "\n".join(comm_lines)

print(f"\nArchitecture report arm lines: {len(arch_report_arms)} chars")
print(f"Committee report: {len(comm_report)} chars")
print(f"Total arch report estimate: ~{len(arch_report_arms) + len(comm_report) + 2000} chars")

# Now simulate what the LISTENER gets
listener_user_payload = {
    "user_prompt": "test prompt here",
    "active_committees": {cid: {"name": c.get("name"), "leader": c.get("leader"),
                                 "members": [{"arm_id": m, "name": arms.get(m, {}).get("name"),
                                              "lens": arms.get(m, {}).get("lens")}
                                             for m in c.get("members", [])]}
                          for cid, c in comms.items()},
    "active_arms": {aid: {"name": arm.get("name"), "lens": arm.get("lens"),
                          "committees": arm.get("committees", [])}
                    for aid, arm in arms.items()},
}
listener_user = json.dumps(listener_user_payload, indent=2)
print(f"\nListener user payload: {len(listener_user)} chars (~{len(listener_user)//4} tokens)")

# Speaker gets arm reports too
# Simulate 24 truncated reports
fake_reports = [{"arm_id": f"arm_{i}", "stance": "refine", "confidence": 0.9,
                 "interpretation": "x" * 400, "candidate_patch_or_phrase": "y" * 400}
                for i in range(24)]
speaker_payload = json.dumps({
    "arm_reports": fake_reports,
    "user_prompt": "test",
    "committee_events": [{"type": "leader", "summary": "test"}] * 20,
}, indent=2)
print(f"Speaker user payload (24 reports): {len(speaker_payload)} chars (~{len(speaker_payload)//4} tokens)")

# Total for speaker = system (arch_report) + user (payload)
speaker_system_est = len(arch_report_arms) + len(comm_report) + 3000  # boilerplate
print(f"\nSpeaker TOTAL input estimate: ~{speaker_system_est + len(speaker_payload)} chars")
print(f"  = ~{(speaker_system_est + len(speaker_payload))//4} tokens (rough)")

# Check what error the actual call produces
print("\n--- Attempting actual speaker-sized API call ---")
try:
    from openai import OpenAI
    import os
    if not os.environ.get("OPENAI_API_KEY"):
        print("No API key set, skipping live test")
        sys.exit(0)
    client = OpenAI(timeout=30.0, max_retries=1)
    # Try a minimal call with the model
    resp = client.responses.create(
        model="gpt-5.4-mini",
        input=[
            {"role": "system", "content": "Say hello"},
            {"role": "user", "content": "Hi"},
        ],
        max_output_tokens=50,
    )
    print(f"Minimal call OK: {getattr(resp, 'output_text', str(resp))[:100]}")

    # Now try with the actual speaker-sized payload
    system_msg = f"You are Speakerbot.\n\n{arch_report_arms}\n\n{comm_report}"
    resp2 = client.responses.create(
        model="gpt-5.4-mini",
        input=[
            {"role": "system", "content": system_msg[:50000]},
            {"role": "user", "content": speaker_payload[:50000]},
        ],
        max_output_tokens=200,
    )
    print(f"Speaker-sized call OK: {getattr(resp2, 'output_text', str(resp2))[:100]}")
except Exception as e:
    print(f"API call failed: {type(e).__name__}: {e}")
