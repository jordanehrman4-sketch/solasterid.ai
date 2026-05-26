"""Simulate the exact step-2 crash path without API calls to find the exception."""
import json, traceback, copy, re, hashlib, uuid, os, sys
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter, defaultdict

# Load full transcript
run_dir = Path("solasterid_v4/runs/run_20260524_204008_3f95029c")
state = json.load(open(run_dir / "architecture_before.json", "r", encoding="utf-8"))
transcript = json.load(open(run_dir / "transcript_so_far.json", "r", encoding="utf-8"))
listener = transcript["listener_output"]

# Helper stubs
def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")

SHARED_MEMORY_PATH = Path("solasterid_v4/memory/shared_memory.jsonl")

def read_jsonl(path, max_items=None):
    path = Path(path)
    if not path.exists():
        return []
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except Exception:
                pass
    return rows[-max_items:] if max_items else rows

def coerce_importance(value, default=0.75):
    if isinstance(value, (int, float)):
        v = float(value)
    elif isinstance(value, str):
        try:
            v = float(value)
        except ValueError:
            v = default
    else:
        v = default
    return max(0.0, min(1.0, v))

def retrieve_memory(path, query, top_k=3):
    rows = read_jsonl(path)
    if not rows:
        return []
    q_words = set(re.findall(r"[a-zA-Z0-9_]+", query.lower()))
    scored = []
    for row in rows:
        text = (row.get("content", "") + " " + " ".join(row.get("tags", []))).lower()
        words = set(re.findall(r"[a-zA-Z0-9_]+", text))
        overlap = len(q_words & words)
        score = overlap + coerce_importance(row.get("importance", 0)) * 2.0
        scored.append((score, row))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for s, r in scored[:top_k]]

# Simulate the code path up to where arm_deliberate is called
def _active_existing_arm_ids(state):
    arms = state.get("arms", {})
    return [aid for aid, arm in arms.items()
            if isinstance(arm, dict)
            and not arm.get("retired", False)
            and arm.get("status", "active") != "retired"]

def active_arm_ids(state):
    return _active_existing_arm_ids(state)

def active_committee_ids(state):
    committees = state.get("committees", {}) if isinstance(state.get("committees"), dict) else {}
    return [cid for cid, c in committees.items()
            if isinstance(c, dict)
            and not c.get("retired", False)
            and c.get("status", "active") != "retired"
            and c.get("members")]

def committee_member_ids(state, committee_id, include_leader=True):
    c = (state.get("committees") or {}).get(committee_id, {})
    ids = list(c.get("members", []) or [])
    if include_leader and c.get("leader") and c["leader"] not in ids:
        ids.insert(0, c["leader"])
    active = set(_active_existing_arm_ids(state))
    return [aid for aid in ids if aid in active]

def committee_report(state):
    state2 = copy.deepcopy(state)
    lines = []
    for cid in active_committee_ids(state2):
        c = state2["committees"][cid]
        leader = c.get("leader")
        leader_name = state2.get("arms", {}).get(leader, {}).get("name", leader)
        member_names = [f"{aid}:{state2['arms'][aid].get('name')}" for aid in committee_member_ids(state2, cid)]
        lines.append(f"- {cid} / {c.get('name')} members={member_names}")
    return "\n".join(lines)

def architecture_report(state):
    arms_lines = []
    for arm_id in active_arm_ids(state):
        arm = state["arms"][arm_id]
        t = arm.get("tuning", {})
        arms_lines.append(
            f"- {arm_id} / {arm.get('name')}: lens={arm.get('lens')}; "
            f"temperature={t.get('temperature')}"
        )
    g = state["globals"]
    return f"ARCH REPORT: {len(active_arm_ids(state))} arms\n" + "\n".join(arms_lines) + "\n" + committee_report(state)

def personal_memory_path(arm_id):
    return Path("solasterid_v4/memory") / f"{arm_id}_personal_memory.jsonl"

print("Simulating step 2 build_arm_prompt...")

# This is what happens in step 2:
user_prompt = transcript["user_prompt"]
shared_scratch = transcript["shared_scratch"]
prev_speaker = transcript["speaker_decisions"][-1]

# Build liveness evidence for step 2
forwarded = {
    "speaker_msg_id": prev_speaker.get("speaker_msg_id"),
    "speaker_timestamp": prev_speaker.get("speaker_timestamp"),
}
liveness_evidence = {
    "speaker_msg_id": forwarded["speaker_msg_id"],
    "speaker_timestamp": forwarded["speaker_timestamp"],
    "present": True,
    "matched": True,
    "missing_reason": "",
}

# Try building an arm prompt for the first member of core_reasoning
committee_id = "core_reasoning"
member_ids = committee_member_ids(state, committee_id)
print(f"core_reasoning members: {member_ids}")

aid = member_ids[0]
arm = state["arms"][aid]
g = state["globals"]

try:
    # This is what build_arm_prompt does:
    heard_prompt = user_prompt
    query = user_prompt + "\n" + heard_prompt
    
    shared_mem = retrieve_memory(SHARED_MEMORY_PATH, query, g["SHARED_MEMORY_TOP_K"])
    print(f"  shared_mem items: {len(shared_mem)}")
    
    personal_mem = retrieve_memory(personal_memory_path(aid), query, g["PERSONAL_MEMORY_TOP_K"])
    print(f"  personal_mem items: {len(personal_mem)}")
    
    recent_scratch = shared_scratch[-g["SHARED_SCRATCH_RECENT_K"]:]
    print(f"  recent_scratch items: {len(recent_scratch)}")
    
    arch_rep = architecture_report(state)
    print(f"  architecture_report length: {len(arch_rep)}")
    
    # Build the full payload
    payload = {
        "architecture_report": arch_rep,
        "arm_id": aid,
        "arm_name": arm["name"],
        "arm_lens": arm["lens"],
        "arm_tuning": arm.get("tuning", {}),
        "arm_committees": arm.get("committees", []),
        "committee_context": {},
        "web_access": arm.get("web_access", True),
        "user_prompt": user_prompt,
        "heard_prompt": heard_prompt,
        "shared_memory": shared_mem,
        "personal_memory": personal_mem,
        "recent_shared_scratch": recent_scratch,
        "recent_speaker_decisions": transcript.get("speaker_decisions", [])[-3:],
        "liveness_evidence": liveness_evidence,
        "task": "Produce a compact arm report.",
    }
    
    payload_json = json.dumps(payload, ensure_ascii=False, indent=2)
    print(f"  payload JSON length: {len(payload_json)} chars")
    
    # Try to sanitize it (this is what call_openai_text does)
    def sanitize_text_for_api(s):
        if s is None:
            return ""
        if not isinstance(s, str):
            try:
                s = json.dumps(s, ensure_ascii=True)
            except Exception:
                s = str(s)
        return s.encode("ascii", "replace").decode("ascii")
    
    sanitized = sanitize_text_for_api(payload_json)
    print(f"  sanitized length: {len(sanitized)} chars")
    
    print("\nPayload construction succeeded! The crash is in the API call itself.")
    print("The API is probably returning non-JSON text for the larger payloads.")
    
except Exception as e:
    print(f"\nCRASH FOUND: {type(e).__name__}: {e}")
    traceback.print_exc()

# Now let's check: is the shared_scratch getting REALLY big?
print(f"\n--- shared_scratch stats ---")
print(f"Total entries: {len(shared_scratch)}")
total_chars = sum(len(json.dumps(s, ensure_ascii=False)) for s in shared_scratch)
print(f"Total chars: {total_chars}")

# Check recent_speaker_decisions for non-serializable content
print(f"\n--- speaker_decisions check ---")
for i, sd in enumerate(transcript.get("speaker_decisions", [])):
    try:
        s = json.dumps(sd, ensure_ascii=False)
        print(f"  decision {i}: {len(s)} chars, action={sd.get('action')}")
    except Exception as e:
        print(f"  decision {i}: SERIALIZE ERROR: {e}")
