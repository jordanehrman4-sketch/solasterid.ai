# Solasterid Process Visualizer v4 - Captioned Edition
# ====================================================
# Based on v2 split-screen starfish, with these additions:
#   - Topic-arc detection: scans all prompts, groups runs into named topic arcs
#   - Persistent topic banner on every frame (big, clean, readable)
#   - Topic-transition title cards when the subject changes
#   - Follow-up runs inherit the previous topic (no orphan "General Task" gaps)
#   - Slower pacing on speaker output for readability
#   - Run as .py from terminal for speed (VS Code notebook is too slow)

from __future__ import annotations
import json, math, os, re, textwrap, hashlib, warnings
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch, Wedge, Polygon
from matplotlib.collections import PatchCollection
from matplotlib import patheffects as pe
from PIL import Image
import imageio.v2 as imageio

matplotlib.rcParams['text.parse_math'] = False
warnings.filterwarnings("ignore", category=UserWarning)

# =========================
# Configuration
# =========================
STORAGE_ROOT = Path("solasterid_v4")
RUNS_DIR = STORAGE_ROOT / "runs"
OUTPUT_DIR = Path("solasterid_viz_output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

FPS = 24
FIGSIZE = (19.2, 10.8)          # 1920x1080 at 100 DPI
FRAME_DPI = 100
MACRO_BLOCK = 16                # ensure video dimensions divisible by this

# =========================
# Unified color palette
# =========================
PALETTE = {
    # water / environment
    "waterTop":      "#14324A",
    "waterMid":      "#0E4B5A",
    "waterBottom":   "#081520",
    "vignette":      "rgba(4, 10, 18, 0.38)",
    "caustic":       "rgba(150, 220, 235, 0.07)",
    "particulate":   "rgba(220, 245, 250, 0.20)",
    # outlines / strokes
    "outline":       "rgba(17, 28, 46, 0.58)",
    "outlineSoft":   "rgba(17, 28, 46, 0.28)",
    "innerHighlight":"rgba(255, 255, 255, 0.18)",
    # coral / reef accents
    "coralPink":     "#D97C8E",
    "coralRose":     "#C9657B",
    "coralOrange":   "#D97A4E",
    "coralPeach":    "#E8A06E",
    "coralLavender": "#9D8AE8",
    "coralPlum":     "#705C9C",
    "seafoam":       "#8ED8C3",
    "kelp":          "#4F8C72",
    "spongeGold":    "#C8A05A",
    "sand":          "#B99863",
    # starfish / glow
    "starGold":      "#F1B35E",
    "starAmber":     "#D9903D",
    "starShadow":    "rgba(95, 55, 18, 0.22)",
    "glowTeal":      "rgba(85, 224, 212, 0.16)",
    "glowLavender":  "rgba(170, 150, 255, 0.12)",
    # text / UI
    "text":          "#F4F7FB",
    "textDim":       "#D7E2F0",
    "textShadow":    "rgba(0, 0, 0, 0.35)",
    "captionBg":     "rgba(8, 18, 30, 0.70)",
    "labelBg":       "rgba(13, 31, 48, 0.58)",
    "divider":       "rgba(190, 230, 240, 0.16)",
}

def _rgba(s: str):
    """Parse 'rgba(r,g,b,a)' string to matplotlib-compatible tuple, or pass through hex."""
    if s.startswith("rgba("):
        parts = s[5:-1].split(",")
        return (int(parts[0])/255, int(parts[1])/255, int(parts[2])/255, float(parts[3]))
    return s

# Pre-parsed palette shortcuts for hot-path drawing code
P = {k: _rgba(v) for k, v in PALETTE.items()}

# Legacy aliases -- bridge old names to the new palette so nothing breaks
BG_DEEP    = PALETTE["waterTop"]
BG_MID     = PALETTE["waterMid"]
BG_SAND    = PALETTE["waterBottom"]
DRIFTWOOD  = "#1A2A38"           # panel fill (deep slate-blue)
DRIFTWOOD_LIGHT = "#24364A"     # lighter inner panel
DRIFTWOOD_BORDER = "#5A7A8A"    # muted teal-grey edge
ACCENT     = "#1B5E72"           # teal accent
TEXT_BRIGHT = PALETTE["text"]
TEXT_DIM    = PALETTE["textDim"]
TEXT_MUTED  = "#6A8A94"          # muted teal
BORDER      = "#2A6F7F"          # teal border
TOPIC_BG    = "#0D2538"          # topic banner fill
TOPIC_BORDER = "#2A7F8F"         # topic banner edge
CORAL_PINK  = PALETTE["coralPink"]
SEAFOAM     = PALETTE["seafoam"]
SAND_GOLD   = PALETTE["starGold"]

# Fonts
FONT_FUN    = "Ink Free"          # handwritten playful headers
FONT_BODY   = "Segoe UI"         # clean readable body
FONT_TITLE  = "Ink Free"          # title card font

# Timing (seconds per scene) - slightly slower for readability
T_RUN_TITLE      = 1.0           # run title card
T_COMMITTEE      = 0.3           # per committee flash
T_COMMITTEE_HOLD = 0.8           # hold on last committee
T_SPEAKER        = 2.0           # final output page
T_MUTATION       = 1.0           # mutation summary
T_INTRODUCTION   = 1.2           # new arm/committee intro card
T_TOPIC_CARD     = 2.5           # topic transition card
T_FINDINGS       = 3.0           # findings summary slide (before next topic)

MAX_RUNS = None
MAX_COMMITTEE_SCENES = None
QUOTE_WORDS = 35
SPEAKER_WORDS_PER_PAGE = 140    # fewer words per page = more readable

VIDEO_PATH = OUTPUT_DIR / "solasterid_v4_captioned.mp4"

ROLE_COLORS = {
    "governance_safety":  PALETTE["coralRose"],
    "memory_continuity":  "#6AACD0",
    "mechanics_code":     PALETTE["seafoam"],
    "evolution_planning": PALETTE["coralLavender"],
    "domain_specialist":  PALETTE["starGold"],
    "creative_synthesis": PALETTE["coralPink"],
    "economy_protocol":   "#5CC4A8",
    "literal_grounding":  PALETTE["coralPeach"],
    "speaker":            PALETTE["text"],
    "unknown":            "#7A9AAA",
}

TOPIC_COLORS = {
    "School Lunch Program":        PALETTE["seafoam"],
    "Clinical Trial Design":       "#6AACD0",
    "Access Control Protocol":     PALETTE["coralRose"],
    "Heat Alert / Cooling Centers": PALETTE["coralPeach"],
    "Composting Rollout Study":    "#5CC4A8",
    "Smoke-Free Housing Policy":   PALETTE["coralPink"],
    "Utopian Society Benchmark":   PALETTE["coralLavender"],
    "System Bootstrap":            "#7A9AAA",
    "Transportability Analysis":   PALETTE["starGold"],
    "Staggered Adoption Study":    "#6AACD0",
    "General Task":                "#7A9AAA",
}

# =========================
# Topic detection engine
# =========================
TOPIC_KEYWORDS = [
    ("School Lunch Program",        ["school lunch", "lunch program", "vegetable consumption",
                                      "cafeteria", "lunch menu", "lunch label", "lunch-menu",
                                      "school-lunch", "school meal", "lunch-period"]),
    ("Clinical Trial Design",       ["randomized controlled trial", "cluster-randomized",
                                      "medication reconciliation", "pragmatic trial"]),
    ("Access Control Protocol",     ["access-control", "authorization token", "FINAL_RENDER",
                                      "replay-resistant"]),
    ("Heat Alert / Cooling Centers", ["heat-alert", "cooling-center", "cooling center",
                                      "heat alert", "heat-related", "neighborhood cooling"]),
    ("Composting Rollout Study",    ["composting", "curbside composting"]),
    ("Smoke-Free Housing Policy",   ["smoke-free housing", "public housing"]),
    ("Transportability Analysis",   ["transportability"]),
    ("Staggered Adoption Study",    ["staggered rollout", "staggered-adoption", "staggered adoption"]),
    ("Utopian Society Benchmark",   ["utopian society", "best possible society",
                                      "science-fictional", "100 iterations"]),
    ("System Bootstrap",            ["solasterid v4", "synthetic collective intelligence",
                                      "MAXIMUM ARMS"]),
]


def classify_topic(prompt_text: str) -> Optional[str]:
    low = prompt_text.lower()
    for topic, keywords in TOPIC_KEYWORDS:
        if any(k.lower() in low for k in keywords):
            return topic
    return None


def build_topic_map(run_dirs: List[Path]) -> Dict[str, str]:
    """Scan all prompts, assign each run a topic.
    Follow-up runs with no clear topic inherit the previous non-bootstrap topic."""
    topic_map = {}
    prev_topic = None
    for rd in run_dirs:
        p = rd / "prompt.json"
        prompt_text = ""
        if p.exists():
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                prompt_text = data.get("user_prompt", "")
            except Exception:
                pass
        topic = classify_topic(prompt_text)
        if topic is None:
            # Inherit previous non-bootstrap topic for follow-up refinements
            topic = prev_topic if prev_topic and prev_topic != "System Bootstrap" else "General Task"
        topic_map[rd.name] = topic
        if topic != "System Bootstrap":
            prev_topic = topic
    return topic_map


def topic_color(topic: str) -> str:
    return TOPIC_COLORS.get(topic, "#7B8DAF")


print("Config loaded.")

# =========================
# IO helpers
# =========================

def load_json(path: Path, default=None):
    if not path or not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

def safe_read_text(path: Path, default=""):
    try:
        return path.read_text(encoding="utf-8") if path.exists() else default
    except Exception:
        return default

def parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None

def run_sort_key(run_dir: Path):
    prompt = load_json(run_dir / "prompt.json", {}) or {}
    transcript = load_json(run_dir / "transcript.json", {}) or load_json(run_dir / "transcript_so_far.json", {}) or {}
    dt = parse_dt(prompt.get("created_at") or transcript.get("created_at"))
    return dt.timestamp() if dt else run_dir.stat().st_mtime

def discover_runs(runs_dir=RUNS_DIR, max_runs=MAX_RUNS):
    if not runs_dir.exists():
        print(f"No runs directory: {runs_dir.resolve()}")
        return []
    runs = sorted([p for p in runs_dir.iterdir() if p.is_dir()], key=run_sort_key)
    if max_runs:
        runs = runs[-int(max_runs):]
    print(f"Found {len(runs)} runs.")
    return runs

def load_run_bundle(run_dir: Path):
    transcript = load_json(run_dir / "transcript.json") or load_json(run_dir / "transcript_so_far.json", {}) or {}
    arch_before = load_json(run_dir / "architecture_before.json") or load_json(run_dir / "architecture_snapshot.json", {}) or {}
    arch_after = load_json(run_dir / "architecture_after_mutation.json") or load_json(run_dir / "architecture_after.json") or arch_before
    return {
        "run_dir": run_dir,
        "run_id": (load_json(run_dir / "prompt.json", {}) or {}).get("run_id", run_dir.name),
        "prompt": load_json(run_dir / "prompt.json", {}) or {},
        "architecture_before": arch_before,
        "architecture_after": arch_after,
        "transcript": transcript,
        "evolution": load_json(run_dir / "evolution_proposal.json", {}) or {},
        "mutation_results": load_json(run_dir / "mutation_results.json", []) or [],
        "final_output": safe_read_text(run_dir / "final_output.txt") or transcript.get("final_output", ""),
    }

runs = discover_runs()
print(f"Ready: {len(runs)} runs.")

# =========================
# Anatomy helpers
# =========================

def active_arms(state: dict) -> dict:
    arms = state.get("arms", {}) if isinstance(state.get("arms"), dict) else {}
    return {k: v for k, v in arms.items() if isinstance(v, dict) and not v.get("retired") and v.get("status", "active") != "retired"}

def active_committees(state: dict) -> dict:
    committees = state.get("committees", {}) if isinstance(state.get("committees"), dict) else {}
    arms = active_arms(state)
    out = {}
    for cid, c in committees.items():
        if not isinstance(c, dict) or c.get("status") == "retired":
            continue
        members = [m for m in c.get("members", []) if m in arms]
        leader = c.get("leader") if c.get("leader") in arms else (members[0] if members else None)
        if not leader and not members:
            continue
        c2 = dict(c)
        c2["members"] = members or ([leader] if leader else [])
        c2["leader"] = leader
        c2.setdefault("name", cid)
        c2.setdefault("layer", 0)
        out[cid] = c2
    return out

def committees_or_pseudo(state: dict) -> dict:
    c = active_committees(state)
    if c:
        return c
    out = {}
    for aid, arm in active_arms(state).items():
        out[f"pseudo_{aid}"] = {"name": arm.get("name", aid), "leader": aid, "members": [aid], "layer": 0, "status": "active", "_pseudo": True}
    return out

# Classify committees by their ID/name only (not member text, which is too noisy)
COMMITTEE_ROLE_PATTERNS = [
    ("governance_safety", r"governance|safety|gatekeep|validate|pre_evolution"),
    ("memory_continuity", r"memory|replay|continuity|historian"),
    ("mechanics_code", r"mechanic|code|runtime|implementation|debug|software"),
    ("evolution_planning", r"evolution|experiment|mutation|benchmark|planner|stress|calibrat|threshold|proof_benchmark|proof_mutation"),
    ("domain_specialist", r"domain_specialist|proof_reasoning|count_integrity|total_ordering|core_reasoning"),
    ("literal_grounding", r"literal|question_selection|semantic_detect|schema|format_sentinel"),
    ("creative_synthesis", r"dream|creative|synthesis_cabinet|synthesis_strategy|synthesis_planning"),
    ("economy_protocol", r"latency|routing|collapse|triage|evidence|claim|source|ranking|diversity|frozen|bundle|counterfactual|borderline|edge_case|failure|membership|decision|branch"),
]

def classify_role(*parts: str) -> str:
    blob = " ".join(str(p or "") for p in parts).lower()
    for role, pat in COMMITTEE_ROLE_PATTERNS:
        if re.search(pat, blob):
            return role
    return "unknown"

def committee_role(cid: str, c: dict, state: dict) -> str:
    # Only use committee ID and name for classification (not member arm text)
    return classify_role(cid, c.get("name", ""))

def role_color(role: str) -> str:
    return ROLE_COLORS.get(role, ROLE_COLORS["unknown"])

# =========================
# Text helpers
# =========================
_WORD_RE = re.compile(r"\S+")

def clean_text(x):
    if x is None: return ""
    if isinstance(x, (dict, list)):
        try: x = json.dumps(x, ensure_ascii=False)
        except: x = str(x)
    return re.sub(r"\s+", " ", str(x)).strip()

def first_words(text, n=QUOTE_WORDS):
    words = _WORD_RE.findall(clean_text(text))
    return " ".join(words[:n]) + (" ..." if len(words) > n else "")

def wrap(text, width=80, max_lines=None):
    lines = textwrap.wrap(clean_text(text), width=width, break_long_words=False)
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1].rstrip(" .,") + " ..."
    return "\n".join(lines)

def report_quote(report: dict, n=QUOTE_WORDS):
    cf = report.get("committee_finding")
    cf_val = cf.get("value") if isinstance(cf, dict) else ""
    for v in [cf_val, report.get("interpretation"), report.get("candidate_patch_or_phrase"),
              report.get("scratch"), report.get("candidate_final_answer")]:
        q = clean_text(v)
        if q: return first_words(q, n)
    return "(no quote captured)"

def split_pages(text, wpp=SPEAKER_WORDS_PER_PAGE):
    words = _WORD_RE.findall(clean_text(text))
    if not words: return ["(No final output produced.)"]
    return [" ".join(words[i:i+wpp]) for i in range(0, len(words), wpp)]

# =========================
# Scene extraction (simplified - one per committee)
# =========================
@dataclass
class CommitteeScene:
    committee_id: str
    committee_name: str
    role: str
    reports: List[dict]
    member_names: List[str]

def extract_committee_scenes(bundle: dict, max_scenes=MAX_COMMITTEE_SCENES) -> List[CommitteeScene]:
    state = bundle["architecture_before"]
    committees = committees_or_pseudo(state)
    transcript = bundle.get("transcript", {}) or {}
    reports = transcript.get("arm_reports", []) or []
    events = transcript.get("committee_events", []) or []

    # Group reports by committee
    by_committee = defaultdict(list)
    order_seen = []
    for r in reports:
        cid = r.get("committee_id") or f"pseudo_{r.get('arm_id', 'unknown')}"
        if cid not in by_committee:
            order_seen.append(cid)
        by_committee[cid].append(r)

    # Also capture event-only committees
    for ev in events:
        cid = ev.get("committee_id")
        if cid and cid not in by_committee and cid not in order_seen:
            order_seen.append(cid)

    scenes = []
    arms = active_arms(state)
    for cid in order_seen:
        c = committees.get(cid, {"name": cid})
        reps = by_committee.get(cid, [])
        member_names = []
        for r in reps:
            aid = r.get("arm_id", "")
            name = (arms.get(aid) or {}).get("name", aid)
            if name not in member_names:
                member_names.append(name)
        scenes.append(CommitteeScene(
            committee_id=cid,
            committee_name=c.get("name", cid),
            role=committee_role(cid, c, state),
            reports=reps,
            member_names=member_names,
        ))

    if max_scenes:
        scenes = scenes[:int(max_scenes)]
    return scenes

# =========================
# Starfish geometry
# =========================
@dataclass
class ArmLayout:
    angle: float
    end: Tuple[float, float]
    color: str

def compute_starfish_layout(state: dict, cx: float, cy: float, radius: float = 2.8) -> Dict[str, ArmLayout]:
    """Compute committee arm positions centered at (cx, cy)."""
    committees = committees_or_pseudo(state)
    if not committees:
        return {}
    items = sorted(committees.items(), key=lambda kv: (int((kv[1] or {}).get("layer", 0) or 0), kv[0]))
    n = len(items)
    start = math.pi / 2
    layout = {}
    for idx, (cid, c) in enumerate(items):
        angle = start - idx * 2 * math.pi / max(n, 1)
        layer = int(c.get("layer", 0) or 0)
        r = radius + min(layer, 3) * 0.15
        x = cx + r * math.cos(angle)
        y = cy + r * math.sin(angle)
        role = committee_role(cid, c, state)
        layout[cid] = ArmLayout(angle=angle, end=(x, y), color=role_color(role))
    return layout

# =========================
# Drawing primitives
# =========================

def _arm_polygon(cx, cy, tip_x, tip_y, base_half_w=0.28, tip_half_w=0.06,
                  wave_amp=0.08, wave_freq=2.5, n_pts=28, seed=0):
    """Build a tapered, slightly wavy arm polygon from (cx,cy) to (tip_x,tip_y).
    Returns list of (x,y) vertices suitable for matplotlib Polygon."""
    rng = np.random.RandomState(seed)
    dx, dy = tip_x - cx, tip_y - cy
    length = math.hypot(dx, dy)
    if length < 1e-6:
        return [(cx, cy)]
    # Unit vectors along and perpendicular to arm
    ux, uy = dx / length, dy / length
    px, py = -uy, ux  # perpendicular

    ts = np.linspace(0, 1, n_pts)
    # Half-width tapers from base_half_w to tip_half_w
    widths = base_half_w * (1 - ts) + tip_half_w * ts
    # Slight organic wobble
    wobble = wave_amp * np.sin(ts * wave_freq * math.pi) * (1 - ts * 0.5)
    wobble += rng.uniform(-0.015, 0.015, size=n_pts)  # micro-jitter

    left_side = []
    right_side = []
    for i, t in enumerate(ts):
        mx = cx + t * dx + wobble[i] * px
        my = cy + t * dy + wobble[i] * py
        w = widths[i]
        left_side.append((mx + w * px, my + w * py))
        right_side.append((mx - w * px, my - w * py))

    # Close the polygon: left side forward, right side backward
    verts = left_side + right_side[::-1]
    return verts


def _spine_dots(cx, cy, tip_x, tip_y, n_spines=8, spread=0.18, seed=0):
    """Generate positions for small spine/ossicle dots along an arm."""
    rng = np.random.RandomState(seed + 999)
    dx, dy = tip_x - cx, tip_y - cy
    length = math.hypot(dx, dy)
    if length < 1e-6:
        return [], []
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    xs, ys = [], []
    for i in range(n_spines):
        t = rng.uniform(0.15, 0.92)
        off = rng.uniform(-spread * (1 - t * 0.6), spread * (1 - t * 0.6))
        xs.append(cx + t * dx + off * px)
        ys.append(cy + t * dy + off * py)
    return xs, ys


def draw_starfish(ax, state: dict, cx: float, cy: float, radius: float = 2.8,
                  highlight_cid: Optional[str] = None, highlight_color: Optional[str] = None):
    """Draw a biological solasterid: tapered wavy arms, spiny texture, fleshy disc."""
    layout = compute_starfish_layout(state, cx, cy, radius)
    committees = committees_or_pseudo(state)
    disc_radius = 0.7

    # ---- Soft environmental glow behind starfish ----
    ax.add_patch(Circle((cx, cy), radius * 0.9,
                        fc=P["glowTeal"][:3], ec="none",
                        alpha=P["glowTeal"][3], zorder=1))
    ax.add_patch(Circle((cx, cy), radius * 0.55,
                        fc=P["glowLavender"][:3], ec="none",
                        alpha=P["glowLavender"][3], zorder=1))
    # Faint shadow under starfish
    ax.add_patch(Circle((cx, cy - 0.15), radius * 0.7,
                        fc=P["starShadow"][:3], ec="none",
                        alpha=P["starShadow"][3], zorder=1))

    # ---- Draw each arm as a filled tapered polygon ----
    for cid, L in layout.items():
        is_sel = (cid == highlight_cid)
        alpha = 0.88 if is_sel else (0.22 if highlight_cid else 0.50)
        color = highlight_color if (is_sel and highlight_color) else L.color
        seed = hash(cid) & 0xFFFF

        base_w = 0.35 if is_sel else 0.25
        tip_w = 0.08 if is_sel else 0.05
        wave_a = 0.10 if is_sel else 0.07

        verts = _arm_polygon(cx, cy, L.end[0], L.end[1],
                             base_half_w=base_w, tip_half_w=tip_w,
                             wave_amp=wave_a, seed=seed)

        # Outer glow for highlighted arm
        if is_sel:
            glow_verts = _arm_polygon(cx, cy, L.end[0], L.end[1],
                                      base_half_w=base_w + 0.15, tip_half_w=tip_w + 0.06,
                                      wave_amp=wave_a, seed=seed)
            glow_poly = Polygon(glow_verts, closed=True, fc=color, ec="none",
                                alpha=0.10, zorder=1)
            ax.add_patch(glow_poly)

        # Main arm body with subtle outline stroke
        arm_stroke = Polygon(verts, closed=True, fc="none",
                             ec=P["outlineSoft"], lw=1.0,
                             alpha=alpha * 0.4, zorder=3 if is_sel else 2)
        ax.add_patch(arm_stroke)
        arm_poly = Polygon(verts, closed=True, fc=color, ec="none",
                           alpha=alpha, zorder=3 if is_sel else 2)
        ax.add_patch(arm_poly)

        # Darker midline stripe for depth
        mid_pts = 12
        dx, dy = L.end[0] - cx, L.end[1] - cy
        for i in range(mid_pts):
            t = (i + 1) / (mid_pts + 1)
            mx = cx + t * dx
            my = cy + t * dy
            # Midline gets narrower toward tip
            stripe_w = (base_w * 0.3) * (1 - t)
            ax.plot([mx], [my], '.', color="#000000", markersize=stripe_w * 12,
                    alpha=alpha * 0.15, zorder=3)

        # Spine dots (ossicles)
        n_sp = 12 if is_sel else 6
        sx, sy = _spine_dots(cx, cy, L.end[0], L.end[1],
                             n_spines=n_sp, spread=base_w * 0.7, seed=seed)
        if sx:
            spine_alpha = alpha * 0.7
            sizes = np.random.RandomState(seed + 42).uniform(3, 10, len(sx))
            ax.scatter(sx, sy, s=sizes, color="white", alpha=spine_alpha * 0.5,
                       zorder=4, edgecolors="none")
            # Colored spine highlights
            ax.scatter(sx, sy, s=sizes * 0.5, color=color, alpha=spine_alpha * 0.8,
                       zorder=5, edgecolors="none")

        # Rounded tip (tube foot cluster)
        ax.scatter([L.end[0]], [L.end[1]],
                   s=140 if is_sel else 40,
                   color=color, alpha=alpha * 0.9, zorder=5,
                   edgecolor="white" if is_sel else "none",
                   linewidth=1.2 if is_sel else 0)

    # ---- Central disc ----
    # Fleshy disc body (warm tones)
    disc_body_c = "#4A2A1A"   # warm brown body
    disc_edge_c = "#6B4C3B"   # lighter brown ring
    ax.add_patch(Circle((cx, cy), disc_radius + 0.08, fc="none", ec=SAND_GOLD,
                        lw=0.8, alpha=0.25, zorder=7))
    ax.add_patch(Circle((cx, cy), disc_radius, fc=disc_body_c, ec=disc_edge_c,
                        lw=1.5, alpha=0.95, zorder=8))

    # Ossicle ring on disc edge
    n_oss = 20
    for i in range(n_oss):
        a = 2 * math.pi * i / n_oss
        r_oss = disc_radius - 0.06
        ox = cx + r_oss * math.cos(a)
        oy = cy + r_oss * math.sin(a)
        ax.scatter([ox], [oy], s=6, color=SAND_GOLD, alpha=0.45, zorder=9,
                   edgecolors="none")

    # Inner disc texture ring
    n_inner = 12
    for i in range(n_inner):
        a = 2 * math.pi * i / n_inner + 0.15
        r_in = disc_radius * 0.55
        ix = cx + r_in * math.cos(a)
        iy = cy + r_in * math.sin(a)
        ax.scatter([ix], [iy], s=4, color="#8B6B4A", alpha=0.5, zorder=9,
                   edgecolors="none")

    # Mouth (central opening)
    ax.add_patch(Circle((cx, cy), 0.24, fc="#0A0604", ec=CORAL_PINK,
                        lw=1.5, alpha=0.95, zorder=10))
    ax.add_patch(Circle((cx, cy), 0.13, fc="#000000", ec="none",
                        alpha=0.7, zorder=11))

    # Madreporite (sieve plate)
    mad_angle = math.pi * 0.35
    mad_x = cx + disc_radius * 0.4 * math.cos(mad_angle)
    mad_y = cy + disc_radius * 0.4 * math.sin(mad_angle)
    ax.scatter([mad_x], [mad_y], s=20, color=SAND_GOLD, alpha=0.7,
              zorder=10, edgecolors="#8B7540", linewidth=0.5, marker="h")

    return layout


def draw_member_sprouts(ax, state: dict, cx: float, cy: float, radius: float,
                        committee_id: str, member_names: List[str]):
    """Draw tube-feet-like branches fanning off the highlighted arm tip,
    one per member, with sucker-tip dots and name labels."""
    layout = compute_starfish_layout(state, cx, cy, radius)
    if committee_id not in layout or not member_names:
        return

    L = layout[committee_id]
    tip_x, tip_y = L.end
    n = len(member_names)
    fan_half = min(0.7, 0.25 * n)
    angles = np.linspace(-fan_half, fan_half, max(n, 1)) if n > 1 else [0.0]
    branch_len = 0.9

    for j, (name, fan_a) in enumerate(zip(member_names, angles)):
        theta = L.angle + float(fan_a)
        bx = tip_x + branch_len * math.cos(theta)
        by = tip_y + branch_len * math.sin(theta)

        # Tube foot stalk (tapered line)
        for seg in range(4):
            t0 = seg / 4
            t1 = (seg + 1) / 4
            x0 = tip_x + t0 * (bx - tip_x)
            y0 = tip_y + t0 * (by - tip_y)
            x1 = tip_x + t1 * (bx - tip_x)
            y1 = tip_y + t1 * (by - tip_y)
            lw = 3.5 - seg * 0.6  # taper
            ax.plot([x0, x1], [y0, y1], color=L.color, lw=lw, alpha=0.55,
                    solid_capstyle="round", zorder=11)

        # Sucker-tip (double circle like a real tube foot end)
        ax.scatter([bx], [by], s=45, color=L.color, alpha=0.85, zorder=12,
                   edgecolor="white", linewidth=0.8)
        ax.scatter([bx], [by], s=12, color="white", alpha=0.6, zorder=13,
                   edgecolors="none")  # inner sucker dot

        # Name label pushed past the sucker
        lx = bx + 0.22 * math.cos(theta)
        ly = by + 0.22 * math.sin(theta)
        ha = "left" if math.cos(theta) >= 0 else "right"
        ax.text(lx, ly, name, color=TEXT_BRIGHT, fontsize=7.5, ha=ha, va="center",
                zorder=14, alpha=0.9, fontfamily=FONT_BODY,
                bbox=dict(boxstyle="round,pad=0.14", fc=DRIFTWOOD, ec=L.color,
                          lw=0.8, alpha=0.85))


def diff_architecture(before: dict, after: dict) -> dict:
    """Find new/retired arms and new committees between two architecture snapshots."""
    b_arms = active_arms(before)
    a_arms = active_arms(after)
    b_comms = committees_or_pseudo(before)
    a_comms = committees_or_pseudo(after)

    new_arms = {}
    for aid in set(a_arms) - set(b_arms):
        new_arms[aid] = a_arms[aid]

    retired_arms = {}
    for aid in set(b_arms) - set(a_arms):
        retired_arms[aid] = b_arms[aid]

    new_committees = {}
    for cid in set(a_comms) - set(b_comms):
        new_committees[cid] = a_comms[cid]

    retired_committees = {}
    for cid in set(b_comms) - set(a_comms):
        retired_committees[cid] = b_comms[cid]

    return {
        "new_arms": new_arms,
        "retired_arms": retired_arms,
        "new_committees": new_committees,
        "retired_committees": retired_committees,
    }


# =========================
# Text wrapping / layout helpers
# =========================

def wrap_text_lines(text: str, max_chars: int = 55) -> List[str]:
    """Word-wrap text to a list of lines respecting max character width.
    Handles explicit newlines, overly-long words, and empty input."""
    cleaned = clean_text(text)
    if not cleaned:
        return []
    # respect explicit newlines first
    paragraphs = cleaned.split("\n")
    lines = []
    for para in paragraphs:
        wrapped = textwrap.wrap(para.strip(), width=max_chars,
                                break_long_words=True, break_on_hyphens=True)
        lines.extend(wrapped if wrapped else [""])
    return lines


def _measure_body_lines(body_text: str, max_chars: int, max_lines: int = 50) -> List[str]:
    """Wrap body text and clamp to max_lines with ellipsis fallback."""
    lines = wrap_text_lines(body_text, max_chars)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        if lines:
            lines[-1] = lines[-1].rstrip(" .,") + " ..."
    return lines


def draw_text_panel(ax, x0, y0, width, height, title, body, title_color=TEXT_BRIGHT,
                    title_size=22, body_size=13, body_color=TEXT_BRIGHT, subtitle="",
                    subtitle_color=TEXT_DIM, subtitle_size=11):
    """Draw a translucent panel with properly-measured text wrapping."""
    pad = 0.45          # inner horizontal padding
    pad_top = 0.45      # top padding from panel edge

    # Panel background
    panel = FancyBboxPatch((x0, y0), width, height,
                           boxstyle="round,pad=0.04,rounding_size=0.25",
                           fc=P["captionBg"][:3], ec=DRIFTWOOD_BORDER,
                           lw=1.8, alpha=P["captionBg"][3] + 0.15, zorder=15)
    ax.add_patch(panel)
    # Subtle inner highlight
    inner = FancyBboxPatch((x0 + 0.10, y0 + 0.10), width - 0.20, height - 0.20,
                           boxstyle="round,pad=0.02,rounding_size=0.2",
                           fc=DRIFTWOOD_LIGHT, ec="none", lw=0, alpha=0.12, zorder=16)
    ax.add_patch(inner)
    # Divider line under title area
    div_y = y0 + height - pad_top - 0.6
    ax.plot([x0 + pad, x0 + width - pad], [div_y, div_y],
            color=P["divider"][:3], lw=0.8, alpha=0.3, zorder=17)

    # Title
    ty = y0 + height - pad_top
    ax.text(x0 + pad, ty, title, color=title_color, fontsize=title_size,
            fontweight="bold", ha="left", va="top", zorder=20,
            fontfamily=FONT_FUN,
            path_effects=[pe.withStroke(linewidth=3, foreground=BG_DEEP, alpha=0.6)])

    # Subtitle
    cursor_y = ty - 0.55
    if subtitle:
        ax.text(x0 + pad, cursor_y, subtitle, color=subtitle_color,
                fontsize=subtitle_size, ha="left", va="top", zorder=20,
                fontfamily=FONT_BODY,
                path_effects=[pe.withStroke(linewidth=1, foreground=BG_DEEP, alpha=0.4)])
        cursor_y -= 0.48

    # Body text — properly wrapped and measured
    # Compute available chars per line from panel width and font size
    chars_per_line = max(20, int((width - 2 * pad) / (body_size * 0.0085)))
    # clamp to a reasonable width
    chars_per_line = min(chars_per_line, 65)
    line_height_data = body_size * 0.018  # approx data-units per text line
    available_height = cursor_y - y0 - 0.3
    max_lines = max(3, int(available_height / line_height_data))

    body_lines = _measure_body_lines(body, chars_per_line, max_lines)

    cursor_y -= 0.15  # small gap after subtitle/divider
    for line in body_lines:
        if cursor_y < y0 + 0.2:
            break
        ax.text(x0 + pad, cursor_y, line, color=body_color,
                fontsize=body_size, ha="left", va="top", zorder=20,
                fontfamily=FONT_BODY,
                path_effects=[pe.withStroke(linewidth=1, foreground=BG_DEEP, alpha=0.3)])
        cursor_y -= line_height_data


def get_prompt_subtitle(bundle: dict, max_words: int = 18) -> str:
    """Extract a short prompt summary for use as a persistent subtitle."""
    prompt_text = clean_text((bundle.get("prompt", {}) or {}).get("user_prompt", ""))
    if not prompt_text:
        return ""
    return first_words(prompt_text, max_words)


# ---- Cached reef layer (expensive coral/kelp/sand rendered once) ----
_REEF_CACHE = None
SAND_Y = 1.6  # shared constant so fish/bubbles know the floor height

def _render_reef_once() -> np.ndarray:
    """Render the static reef (coral, kelp, sand, gradient) to a pixel array once."""
    global _REEF_CACHE
    if _REEF_CACHE is not None:
        return _REEF_CACHE
    print("  Rendering reef background (one time)...")
    fig, ax = plt.subplots(figsize=FIGSIZE, dpi=FRAME_DPI)
    fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
    fig.patch.set_facecolor(BG_DEEP)
    ax.set_facecolor(BG_DEEP)
    ax.set_xlim(-0.5, 19.2)
    ax.set_ylim(-0.5, 10.8)
    ax.set_aspect("equal")
    ax.axis("off")
    _draw_reef_static(ax)
    fig.canvas.draw()
    w, h = fig.canvas.get_width_height()
    buf = np.frombuffer(fig.canvas.buffer_rgba(), dtype=np.uint8).reshape(h, w, 4)
    _REEF_CACHE = buf[:, :, :3].copy()
    plt.close(fig)
    print("  Reef cached.")
    return _REEF_CACHE


# =========================
# Coral archetype helpers
# =========================

def _draw_branching_coral(ax, bx, by, height, angle_bias, color, rng,
                          depth=0, max_depth=4, alpha=0.22, z=0):
    """Recursive branching coral with tapered strokes and rounded tips."""
    if depth > max_depth or height < 0.15:
        # terminal rounded tip
        ax.scatter([bx], [by], s=rng.uniform(20, 55), color=color,
                   alpha=alpha * 0.8, zorder=z, edgecolors=P["outlineSoft"],
                   linewidth=0.4)
        return
    # Main stem
    ang = math.pi / 2 + angle_bias + rng.uniform(-0.25, 0.25)
    ex = bx + height * math.cos(ang)
    ey = by + height * math.sin(ang)
    lw = max(1.0, 5.0 - depth * 1.1)
    ax.plot([bx, ex], [by, ey], color=color, lw=lw, alpha=alpha,
            solid_capstyle="round", zorder=z)
    # thin outline stroke for definition
    ax.plot([bx, ex], [by, ey], color=P["outlineSoft"], lw=lw + 0.6,
            alpha=alpha * 0.25, solid_capstyle="round", zorder=z)
    # Branch into 2-3 children
    n_kids = rng.randint(2, 4)
    for _ in range(n_kids):
        child_h = height * rng.uniform(0.45, 0.7)
        child_bias = angle_bias + rng.uniform(-0.5, 0.5)
        _draw_branching_coral(ax, ex, ey, child_h, child_bias, color, rng,
                              depth + 1, max_depth, alpha, z)


def _draw_fan_coral(ax, fx, fy, width, height, color, rng, alpha=0.18, z=0):
    """Fan coral: semicircular spread with branching vein mesh."""
    # Outer fan silhouette (filled semicircle)
    theta = np.linspace(0, math.pi, 30)
    sx_arr = fx + width * 0.5 * np.cos(theta)
    sy_arr = fy + height * np.sin(theta)
    verts = [(fx, fy)] + list(zip(sx_arr, sy_arr)) + [(fx, fy)]
    fan_poly = Polygon(verts, closed=True, fc=color, ec=P["outlineSoft"],
                       lw=0.8, alpha=alpha, zorder=z)
    ax.add_patch(fan_poly)
    # Inner vein network
    n_veins = rng.randint(5, 9)
    for i in range(n_veins):
        va = math.pi * (i + 0.5) / n_veins
        vr = rng.uniform(0.6, 0.95)
        vex = fx + width * 0.5 * vr * math.cos(va)
        vey = fy + height * vr * math.sin(va)
        ax.plot([fx, vex], [fy, vey], color=color, lw=rng.uniform(0.6, 1.5),
                alpha=alpha * 1.2, solid_capstyle="round", zorder=z)
        # sub-veins
        for _ in range(rng.randint(1, 3)):
            t = rng.uniform(0.3, 0.8)
            svx = fx + t * (vex - fx) + rng.uniform(-0.1, 0.1) * width
            svy = fy + t * (vey - fy) + rng.uniform(0, 0.1) * height
            ax.plot([fx + t * (vex - fx), svx], [fy + t * (vey - fy), svy],
                    color=color, lw=0.5, alpha=alpha * 0.8,
                    solid_capstyle="round", zorder=z)


def _draw_sponge_coral(ax, sx, sy, n_tubes, color, rng, alpha=0.18, z=0):
    """Sponge / tube / anemone cluster: whimsical bulbs and tubes."""
    for _ in range(n_tubes):
        tube_h = rng.uniform(0.3, 1.0)
        tube_w = rng.uniform(0.08, 0.2)
        ang = math.pi / 2 + rng.uniform(-0.4, 0.4)
        tx = sx + rng.uniform(-0.3, 0.3)
        ty_base = sy
        tx2 = tx + tube_h * math.cos(ang)
        ty2 = ty_base + tube_h * math.sin(ang)
        # tube body
        ax.plot([tx, tx2], [ty_base, ty2], color=color,
                lw=tube_w * 40, alpha=alpha, solid_capstyle="round", zorder=z)
        ax.plot([tx, tx2], [ty_base, ty2], color=P["outlineSoft"],
                lw=tube_w * 40 + 1, alpha=alpha * 0.2, solid_capstyle="round", zorder=z)
        # bulb/osculum at top
        ax.scatter([tx2], [ty2], s=rng.uniform(25, 70), color=color,
                   alpha=alpha * 0.9, zorder=z, edgecolors=P["outlineSoft"],
                   linewidth=0.5)
        # inner highlight dot
        ax.scatter([tx2], [ty2], s=rng.uniform(5, 15),
                   color=P["innerHighlight"], alpha=0.3, zorder=z,
                   edgecolors="none")


def _draw_reef_static(ax):
    """Heavy static elements: palette-driven gradient, vignette, caustics,
    sand, three coral archetypes, kelp, rocks, particulates."""
    rng = np.random.RandomState(42)
    sand_y = SAND_Y

    # ---- Water gradient (top->bottom via PALETTE) ----
    grad_stops = [
        (1.0, PALETTE["waterTop"]),
        (0.5, PALETTE["waterMid"]),
        (0.0, PALETTE["waterBottom"]),
    ]
    n_bands = 40
    for i in range(n_bands):
        t = i / n_bands
        y_lo = 10.8 * t
        y_hi = 10.8 * (t + 1 / n_bands)
        # interpolate between the three stops
        frac = t  # 0=bottom, 1=top
        if frac < 0.5:
            f2 = frac / 0.5
            c0 = matplotlib.colors.to_rgb(grad_stops[2][1])
            c1 = matplotlib.colors.to_rgb(grad_stops[1][1])
        else:
            f2 = (frac - 0.5) / 0.5
            c0 = matplotlib.colors.to_rgb(grad_stops[1][1])
            c1 = matplotlib.colors.to_rgb(grad_stops[0][1])
        cr = c0[0] + (c1[0] - c0[0]) * f2
        cg = c0[1] + (c1[1] - c0[1]) * f2
        cb = c0[2] + (c1[2] - c0[2]) * f2
        ax.axhspan(y_lo, y_hi, fc=(cr, cg, cb), alpha=0.95, zorder=0)

    # ---- Vignette (dark edges) ----
    vig_c = P["vignette"]
    for side_x, w_vig in [(-.5, 3.0), (19.2 - 3.0, 3.5)]:
        ax.axvspan(side_x, side_x + w_vig, fc=(vig_c[0], vig_c[1], vig_c[2]),
                   alpha=vig_c[3] * 0.5, zorder=0)
    ax.axhspan(-0.5, 1.5, fc=(vig_c[0], vig_c[1], vig_c[2]),
               alpha=vig_c[3] * 0.7, zorder=0)

    # ---- Caustic light rays from above ----
    for sx_b in [1.8, 5.5, 9.0, 13.5, 17.0]:
        drift = rng.uniform(-0.8, 0.8)
        beam_pts = [
            (sx_b - 0.2, 10.8), (sx_b + 0.4, 10.8),
            (sx_b + 2.0 + drift, -0.5),
            (sx_b - 1.8 + drift, -0.5),
        ]
        ax.add_patch(Polygon(beam_pts, closed=True,
                             fc=P["caustic"][:3], ec="none",
                             alpha=P["caustic"][3], zorder=0))
    # secondary thinner beams
    for sx_b in [3.2, 7.8, 11.2, 15.5, 18.5]:
        drift = rng.uniform(-0.5, 0.5)
        beam_pts = [
            (sx_b - 0.1, 10.8), (sx_b + 0.2, 10.8),
            (sx_b + 1.0 + drift, -0.5),
            (sx_b - 1.0 + drift, -0.5),
        ]
        ax.add_patch(Polygon(beam_pts, closed=True,
                             fc=P["caustic"][:3], ec="none",
                             alpha=P["caustic"][3] * 0.5, zorder=0))

    # ---- Sandy floor ----
    sand_pts = [(-.5, -.5), (-.5, sand_y)]
    for x in np.linspace(-0.5, 19.7, 60):
        sand_pts.append((x, sand_y + rng.uniform(-0.15, 0.15)))
    sand_pts += [(19.7, -.5)]
    ax.add_patch(Polygon(sand_pts, closed=True, fc="#1C150B", ec="none",
                         alpha=0.80, zorder=0))
    # Sand highlight
    sand_hi = [(-.5, -.5), (-.5, sand_y - 0.25)]
    for x in np.linspace(-0.5, 19.7, 60):
        sand_hi.append((x, sand_y - 0.25 + rng.uniform(-0.08, 0.08)))
    sand_hi += [(19.7, -.5)]
    ax.add_patch(Polygon(sand_hi, closed=True, fc=PALETTE["sand"], ec="none",
                         alpha=0.08, zorder=0))
    # Sand speckles
    sx_s = rng.uniform(0, 19.2, 70)
    sy_s = rng.uniform(-0.3, sand_y + 0.15, 70)
    ax.scatter(sx_s, sy_s, s=rng.uniform(1, 5, 70), color=PALETTE["sand"],
              alpha=0.15, zorder=0, edgecolors="none")
    # Small rocks / rubble along sand line
    for rx in rng.uniform(0.5, 18.5, 8):
        rr = rng.uniform(0.12, 0.3)
        ry = sand_y + rng.uniform(-0.05, 0.1)
        ax.add_patch(Circle((rx, ry), rr, fc="#1A140C",
                            ec=P["outlineSoft"], lw=0.5, alpha=0.25, zorder=0))

    # ---- Far-background coral silhouettes (very low alpha) ----
    far_colors = [PALETTE["coralPlum"], PALETTE["coralLavender"], PALETTE["kelp"]]
    for fbx in [1.0, 4.5, 8.0, 12.5, 16.0, 18.5]:
        fc_c = rng.choice(far_colors)
        _draw_branching_coral(ax, fbx, sand_y, rng.uniform(1.5, 3.0),
                              rng.uniform(-0.3, 0.3), fc_c, rng,
                              max_depth=3, alpha=0.07, z=0)

    # ---- Midground: branching coral clusters (palette-coherent) ----
    branch_defs = [
        (0.6,  PALETTE["coralPink"]),
        (2.2,  PALETTE["coralOrange"]),
        (6.5,  PALETTE["coralRose"]),
        (14.0, PALETTE["coralPeach"]),
        (17.0, PALETTE["coralPink"]),
        (18.8, PALETTE["coralOrange"]),
    ]
    for bcx, bcc in branch_defs:
        _draw_branching_coral(ax, bcx, sand_y, rng.uniform(1.2, 2.2),
                              rng.uniform(-0.2, 0.2), bcc, rng,
                              max_depth=4, alpha=0.20, z=0)

    # ---- Fan coral ----
    fan_defs = [
        (3.5,  sand_y, 1.4, 1.6, PALETTE["coralLavender"]),
        (9.0,  sand_y, 1.0, 1.2, PALETTE["coralPlum"]),
        (15.5, sand_y, 1.2, 1.4, PALETTE["coralRose"]),
    ]
    for ffx, ffy, fw, fh, ffc in fan_defs:
        _draw_fan_coral(ax, ffx, ffy, fw, fh, ffc, rng, alpha=0.16, z=0)

    # ---- Sponge / anemone clusters ----
    sponge_defs = [
        (1.2,  sand_y, 4, PALETTE["spongeGold"]),
        (7.0,  sand_y, 3, PALETTE["seafoam"]),
        (11.5, sand_y, 5, PALETTE["coralPeach"]),
        (16.0, sand_y, 3, PALETTE["spongeGold"]),
    ]
    for ssx, ssy, sn, ssc in sponge_defs:
        _draw_sponge_coral(ax, ssx, ssy, sn, ssc, rng, alpha=0.18, z=0)

    # ---- Kelp / seaweed (palette-coherent greens) ----
    kelp_colors = [PALETTE["kelp"], "#3D7A5F", "#5A9E7A", PALETTE["seafoam"]]
    for sx_base in [0.3, 1.8, 4.5, 7.5, 10.0, 13.5, 16.0, 18.5]:
        n_seg = rng.randint(8, 16)
        swx = [sx_base]
        swy = [sand_y]
        kc = rng.choice(kelp_colors)
        sway = rng.uniform(0.15, 0.4)
        for s in range(n_seg):
            swx.append(sx_base + sway * math.sin(s * 0.6 + rng.uniform(0, 2)))
            swy.append(sand_y + (s + 1) * 0.28)
        lw_k = rng.uniform(2, 4.5)
        # outline stroke then fill
        ax.plot(swx, swy, color=P["outlineSoft"], lw=lw_k + 1.0,
                alpha=0.10, solid_capstyle="round", zorder=0)
        ax.plot(swx, swy, color=kc, lw=lw_k, alpha=0.18,
                solid_capstyle="round", zorder=0)
        # leaf fronds
        for s in range(2, n_seg, 3):
            lx = swx[s] + rng.uniform(-0.25, 0.25)
            ly = swy[s]
            ax.add_patch(FancyBboxPatch((lx - 0.12, ly - 0.04), 0.24, 0.10,
                         boxstyle="round,pad=0.02,rounding_size=0.04",
                         fc=kc, ec=P["outlineSoft"], lw=0.4,
                         alpha=0.14, zorder=0))

    # ---- Particulates / plankton specks ----
    px_arr = rng.uniform(-0.5, 19.7, 100)
    py_arr = rng.uniform(sand_y + 0.5, 10.5, 100)
    ps_arr = rng.uniform(0.5, 4, 100)
    ax.scatter(px_arr, py_arr, s=ps_arr,
              color=P["particulate"][:3], alpha=0.15,
              zorder=0, edgecolors="none")


# Global frame counter for fish/bubble drift
_FRAME_SEQ = 0

def _draw_fish(ax, x, y, scale, direction, color, alpha=0.12):
    """Draw a tiny connected fish: teardrop body + attached triangular tail + eye."""
    d = direction  # +1 = facing right, -1 = facing left
    body_w = 0.20 * scale
    body_h = 0.10 * scale
    # Body ellipse (teardrop via polygon)
    theta = np.linspace(0, 2 * math.pi, 20)
    # teardrop: wider at front, narrower at back
    bx_arr = x + body_w * np.cos(theta) * (1 + 0.3 * np.cos(theta) * d)
    by_arr = y + body_h * np.sin(theta)
    body_poly = Polygon(list(zip(bx_arr, by_arr)), closed=True,
                        fc=color, ec=P["outlineSoft"], lw=0.4,
                        alpha=alpha, zorder=1)
    ax.add_patch(body_poly)
    # Tail (triangle, attached at rear of body)
    tail_base_x = x - d * body_w * 0.8
    tail_tip_x = x - d * body_w * 1.5
    tail_pts = [
        (tail_base_x, y + body_h * 0.5),
        (tail_base_x, y - body_h * 0.5),
        (tail_tip_x, y),
    ]
    tail_poly = Polygon(tail_pts, closed=True, fc=color,
                        ec=P["outlineSoft"], lw=0.3, alpha=alpha * 0.9, zorder=1)
    ax.add_patch(tail_poly)
    # Tiny eye
    eye_x = x + d * body_w * 0.45
    ax.scatter([eye_x], [y + body_h * 0.15], s=2 * scale,
              color="white", alpha=alpha * 1.5, zorder=1, edgecolors="none")


def _draw_bubble(ax, x, y, radius, alpha=0.10):
    """Draw a translucent bubble with crescent highlight."""
    ax.add_patch(Circle((x, y), radius, fc="none", ec="white",
                        lw=0.5, alpha=alpha, zorder=1))
    # crescent highlight
    hx = x - radius * 0.25
    hy = y + radius * 0.25
    ax.scatter([hx], [hy], s=radius * 80, color="white",
              alpha=alpha * 0.4, zorder=1, edgecolors="none")


def draw_ocean_background(ax):
    """Blit cached reef + draw proper fish and bubbles (cheap, varies per frame)."""
    global _FRAME_SEQ
    _FRAME_SEQ += 1

    # Fast blit of the heavy reef layer
    reef = _render_reef_once()
    ax.imshow(reef, extent=[-0.5, 19.2, -0.5, 10.8], aspect="auto",
              zorder=0, interpolation="bilinear")

    rng = np.random.RandomState(42 + _FRAME_SEQ)
    sand_y = SAND_Y

    # ---- Proper tiny fish (midground, connected body+tail) ----
    fish_palette = [PALETTE["coralPeach"], PALETTE["seafoam"], PALETTE["coralPink"],
                    PALETTE["coralLavender"], PALETTE["starGold"], PALETTE["coralOrange"]]
    n_fish = 8
    for _ in range(n_fish):
        fx = rng.uniform(0.5, 18.5)
        fy = rng.uniform(sand_y + 1.5, 9.0)
        fscale = rng.uniform(0.7, 1.4)
        fdir = rng.choice([-1.0, 1.0])
        fc = fish_palette[rng.randint(0, len(fish_palette))]
        _draw_fish(ax, fx, fy, fscale, fdir, fc, alpha=0.10)

    # ---- Bubbles (distinct translucent circles, drifting upward) ----
    n_bubbles = 20
    for _ in range(n_bubbles):
        bx = rng.uniform(0, 19.2)
        by = rng.uniform(sand_y + 0.5, 10.5)
        br = rng.uniform(0.04, 0.18)
        _draw_bubble(ax, bx, by, br, alpha=rng.uniform(0.05, 0.12))

    # ---- Tiny plankton sparkles ----
    sp_x = rng.uniform(0.5, 18.5, 12)
    sp_y = rng.uniform(sand_y + 1, 10, 12)
    ax.scatter(sp_x, sp_y, s=rng.uniform(0.5, 3, 12),
              color=P["particulate"][:3], alpha=0.12,
              zorder=1, edgecolors="none")


def setup_frame(run_idx: int, total_runs: int, run_id: str,
                prompt_subtitle: str = "",
                topic: str = "", topic_run_num: int = 0, topic_run_total: int = 0):
    """Create figure with ocean background, reef, title bar, topic banner."""
    fig, ax = plt.subplots(figsize=FIGSIZE, dpi=FRAME_DPI)
    fig.subplots_adjust(left=0, right=1, top=1, bottom=0)  # no wasted margins
    fig.patch.set_facecolor(BG_DEEP)
    ax.set_facecolor(BG_DEEP)
    ax.set_xlim(-0.5, 19.2)
    ax.set_ylim(-0.5, 10.8)
    ax.set_aspect("equal")
    ax.axis("off")

    # Draw the ocean + reef backdrop
    draw_ocean_background(ax)

    # Title bar
    ax.text(0.3, 10.5, "Solasterid.ai", color=SAND_GOLD, fontsize=14,
            ha="left", va="center", fontweight="bold", zorder=5,
            fontfamily=FONT_TITLE,
            path_effects=[pe.withStroke(linewidth=2, foreground=BG_DEEP, alpha=0.7)])
    ax.text(3.6, 10.5, "by Jordan Ehrman", color=TEXT_DIM, fontsize=9,
            ha="left", va="center", zorder=5, fontfamily=FONT_BODY,
            path_effects=[pe.withStroke(linewidth=1, foreground=BG_DEEP, alpha=0.5)])
    ax.text(18.8, 10.5, f"Run {run_idx}/{total_runs}", color=TEXT_DIM,
            fontsize=10, ha="right", va="center", zorder=5, fontfamily=FONT_BODY,
            path_effects=[pe.withStroke(linewidth=1, foreground=BG_DEEP, alpha=0.5)])

    # Progress bar (seafoam colored)
    bar_y = 10.15
    bar_w = 18.4
    progress = run_idx / max(total_runs, 1)
    ax.plot([0.4, 0.4 + bar_w], [bar_y, bar_y], color=ACCENT, lw=4,
            solid_capstyle="round", zorder=2, alpha=0.5)
    ax.plot([0.4, 0.4 + bar_w * progress], [bar_y, bar_y], color=SEAFOAM, lw=4,
            solid_capstyle="round", zorder=3)

    # ---- TOPIC BANNER ----
    if topic and topic != "System Bootstrap":
        tc = topic_color(topic)
        banner = FancyBboxPatch((0.3, 9.3), 18.4, 0.7,
                                boxstyle="round,pad=0.02,rounding_size=0.15",
                                fc=TOPIC_BG, ec=tc, lw=2.0, alpha=0.88, zorder=25)
        ax.add_patch(banner)
        ax.text(0.8, 9.65, topic, color=tc, fontsize=20,
                fontweight="bold", ha="left", va="center", zorder=30,
                fontfamily=FONT_FUN,
                path_effects=[pe.withStroke(linewidth=2, foreground=BG_DEEP, alpha=0.5)])
        if topic_run_num and topic_run_total:
            counter = f"step {topic_run_num}/{topic_run_total}"
            ax.text(18.3, 9.65, counter, color=tc, fontsize=13,
                    ha="right", va="center", zorder=30, alpha=0.85,
                    fontfamily=FONT_BODY)
    elif topic == "System Bootstrap":
        ax.text(9.6, 9.65, "System Bootstrap",
                color=TEXT_MUTED, fontsize=15, ha="center", va="center",
                fontstyle="italic", zorder=5, alpha=0.7, fontfamily=FONT_FUN)

    # Prompt subtitle
    if prompt_subtitle:
        sub_y = 9.05 if topic else 9.75
        ax.text(9.6, sub_y, prompt_subtitle, color=TEXT_DIM, fontsize=11,
                ha="center", va="center", fontstyle="italic", zorder=5,
                fontfamily=FONT_BODY,
                path_effects=[pe.withStroke(linewidth=1.5, foreground=BG_DEEP, alpha=0.5)])

    return fig, ax

def render_topic_transition(topic: str, run_idx: int, total_runs: int,
                            arc_run_count: int) -> np.ndarray:
    """Full-screen topic transition card -- driftwood sign underwater."""
    fig, ax = plt.subplots(figsize=FIGSIZE, dpi=FRAME_DPI)
    fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
    fig.patch.set_facecolor(BG_DEEP)
    ax.set_facecolor(BG_DEEP)
    ax.set_xlim(-0.5, 19.2)
    ax.set_ylim(-0.5, 10.8)
    ax.set_aspect("equal")
    ax.axis("off")

    draw_ocean_background(ax)

    tc = topic_color(topic)

    # Big centered driftwood sign
    pill_w, pill_h = 14.0, 3.5
    pill_x = (19.2 - pill_w) / 2 - 0.25
    pill_y = (10.8 - pill_h) / 2 - 0.25
    pill = FancyBboxPatch((pill_x, pill_y), pill_w, pill_h,
                          boxstyle="round,pad=0.06,rounding_size=0.35",
                          fc=P["captionBg"][:3], ec=DRIFTWOOD_BORDER, lw=3, alpha=0.92, zorder=10)
    ax.add_patch(pill)
    # Inner highlight
    ax.add_patch(FancyBboxPatch((pill_x + 0.15, pill_y + 0.15),
                                pill_w - 0.3, pill_h - 0.3,
                                boxstyle="round,pad=0.04,rounding_size=0.3",
                                fc=DRIFTWOOD_LIGHT, ec="none", lw=0, alpha=0.10, zorder=11))

    # "NEW TOPIC" label
    ax.text(9.35, pill_y + pill_h - 0.6, "~ new topic ~",
            color=SAND_GOLD, fontsize=15, ha="center", va="top",
            fontweight="bold", zorder=20, fontfamily=FONT_FUN,
            path_effects=[pe.withStroke(linewidth=1.5, foreground=BG_DEEP, alpha=0.5)])

    # Big topic name
    ax.text(9.35, pill_y + pill_h / 2 - 0.1, topic,
            color=tc, fontsize=38, ha="center", va="center",
            fontweight="bold", zorder=20, fontfamily=FONT_TITLE,
            path_effects=[pe.withStroke(linewidth=4, foreground=BG_DEEP, alpha=0.6)])

    # Run count hint
    if arc_run_count > 1:
        ax.text(9.35, pill_y + 0.55, f"{arc_run_count} runs in this arc",
                color=TEXT_DIM, fontsize=13, ha="center", va="bottom", zorder=20,
                fontfamily=FONT_BODY)

    # Progress bar
    bar_y = 10.15
    bar_w = 18.4
    progress = run_idx / max(total_runs, 1)
    ax.plot([0.4, 0.4 + bar_w], [bar_y, bar_y], color=ACCENT, lw=4,
            solid_capstyle="round", zorder=2, alpha=0.5)
    ax.plot([0.4, 0.4 + bar_w * progress], [bar_y, bar_y], color=tc, lw=4,
            solid_capstyle="round", zorder=3)

    ax.text(0.3, 10.5, "Solasterid.ai", color=SAND_GOLD, fontsize=14,
            ha="left", va="center", fontweight="bold", zorder=5,
            fontfamily=FONT_TITLE)

    return fig_to_array(fig)


# Layout: starfish on left, text panel on right — USE THE WHOLE CANVAS
SF_CX, SF_CY = 4.8, 4.8
SF_RADIUS = 3.8                  # big beautiful starfish
# Text panel: fills right half generously
TP_X0, TP_Y0, TP_W, TP_H = 9.8, 0.3, 9.0, 8.8

# =========================
# Scene renderers
# =========================

def fig_to_array(fig) -> np.ndarray:
    """Convert figure to numpy array and close it."""
    fig.canvas.draw()
    w, h = fig.canvas.get_width_height()
    buf = np.frombuffer(fig.canvas.buffer_rgba(), dtype=np.uint8).reshape(h, w, 4)
    arr = buf[:, :, :3].copy()  # RGB only, contiguous
    plt.close(fig)
    return arr


def render_run_title(bundle: dict, run_idx: int, total_runs: int,
                     topic: str = "", topic_run_num: int = 0,
                     topic_run_total: int = 0) -> np.ndarray:
    """Run title card: full starfish anatomy + run info."""
    state = bundle["architecture_before"]
    n_committees = len(committees_or_pseudo(state))
    n_arms = len(active_arms(state))
    prompt_sub = get_prompt_subtitle(bundle)
    prompt_long = first_words(clean_text((bundle.get("prompt", {}) or {}).get("user_prompt", "")), 50)

    fig, ax = setup_frame(run_idx, total_runs, bundle["run_id"],
                          prompt_subtitle=prompt_sub,
                          topic=topic, topic_run_num=topic_run_num,
                          topic_run_total=topic_run_total)
    draw_starfish(ax, state, SF_CX, SF_CY, SF_RADIUS)

    # Run info on the right panel
    title = f"Run {run_idx}"
    subtitle = f"{n_arms} active arms  |  {n_committees} committees"
    body = wrap(prompt_long or "(no prompt captured)", width=55, max_lines=7)
    draw_text_panel(ax, TP_X0, TP_Y0, TP_W, TP_H, title, body,
                    title_size=28, body_size=14, subtitle=subtitle)

    # Run ID label under starfish
    ax.text(SF_CX, SF_CY - SF_RADIUS - 1.0, bundle["run_id"],
            color=TEXT_MUTED, fontsize=7, ha="center", va="top", zorder=10,
            fontfamily=FONT_BODY)

    return fig_to_array(fig)


def render_committee_scene(bundle: dict, scene: CommitteeScene,
                           scene_idx: int, total_scenes: int,
                           run_idx: int, total_runs: int,
                           topic: str = "", topic_run_num: int = 0,
                           topic_run_total: int = 0) -> np.ndarray:
    """One committee highlighted on starfish with member sprouts, findings on the right."""
    state = bundle["architecture_before"]
    prompt_sub = get_prompt_subtitle(bundle)
    fig, ax = setup_frame(run_idx, total_runs, bundle["run_id"],
                          prompt_subtitle=prompt_sub,
                          topic=topic, topic_run_num=topic_run_num,
                          topic_run_total=topic_run_total)

    # Draw starfish with this committee highlighted
    draw_starfish(ax, state, SF_CX, SF_CY, SF_RADIUS,
                  highlight_cid=scene.committee_id,
                  highlight_color=role_color(scene.role))

    # Draw member sprouts branching off the committee arm
    draw_member_sprouts(ax, state, SF_CX, SF_CY, SF_RADIUS,
                        scene.committee_id, scene.member_names)

    # Build the text panel content
    title = scene.committee_name.replace("_", " ").title()
    subtitle = f"Committee {scene_idx + 1}/{total_scenes}  |  {len(scene.member_names)} members"

    # Member names + best quotes
    body_lines = []
    if scene.member_names:
        body_lines.append("Members: " + ", ".join(scene.member_names[:6]))
        if len(scene.member_names) > 6:
            body_lines[-1] += f" (+{len(scene.member_names) - 6} more)"
        body_lines.append("")

    # Show up to 3 report quotes
    shown = 0
    for r in scene.reports:
        if shown >= 3:
            break
        aid = r.get("arm_id", "")
        name = (active_arms(state).get(aid) or {}).get("name", aid)
        quote = report_quote(r, QUOTE_WORDS)
        body_lines.append(f"{name}:")
        body_lines.append(wrap(quote, width=52, max_lines=3))
        body_lines.append("")
        shown += 1

    if not scene.reports:
        body_lines.append("(Committee convened; no individual reports captured.)")

    body = "\n".join(body_lines)
    draw_text_panel(ax, TP_X0, TP_Y0, TP_W, TP_H, title, body,
                    title_color=role_color(scene.role), title_size=24,
                    body_size=12, subtitle=subtitle)

    return fig_to_array(fig)


def render_speaker_page(bundle: dict, page_text: str, page_idx: int,
                        page_count: int, run_idx: int, total_runs: int,
                        topic: str = "", topic_run_num: int = 0,
                        topic_run_total: int = 0) -> np.ndarray:
    """Speakerbot final output - large readable text."""
    state = bundle["architecture_before"]
    fig, ax = setup_frame(run_idx, total_runs, bundle["run_id"],
                          topic=topic, topic_run_num=topic_run_num,
                          topic_run_total=topic_run_total)

    # Starfish with no highlight (all arms gently lit)
    draw_starfish(ax, state, SF_CX, SF_CY, SF_RADIUS)

    # Mouth glow (warm)
    ax.add_patch(Circle((SF_CX, SF_CY), 0.8, fc="none", ec=SAND_GOLD,
                        lw=3, alpha=0.35, zorder=7))

    title = "Final Output"
    subtitle = f"Page {page_idx + 1}/{page_count}" if page_count > 1 else "Speakerbot"
    body = wrap(page_text, width=58, max_lines=18)
    draw_text_panel(ax, TP_X0, TP_Y0, TP_W, TP_H, title, body,
                    title_color="#F8F4E3", title_size=26,
                    body_size=11, subtitle=subtitle)

    return fig_to_array(fig)


def render_introduction(bundle: dict, intro_type: str, name: str, detail: str,
                        color: str, run_idx: int, total_runs: int,
                        topic: str = "") -> np.ndarray:
    """Big introduction card for a new arm/committee (or retirement)."""
    state = bundle.get("architecture_after") or bundle["architecture_before"]
    fig, ax = setup_frame(run_idx, total_runs, bundle["run_id"], topic=topic)
    draw_starfish(ax, state, SF_CX, SF_CY, SF_RADIUS)

    # Large announcement on the text panel
    is_retired = "retire" in intro_type.lower()
    heading = f"RETIRED {intro_type.upper()}" if is_retired else f"NEW {intro_type.upper()}"
    body = wrap(detail, width=65, max_lines=10) if detail else ""
    draw_text_panel(ax, TP_X0, TP_Y0, TP_W, TP_H, heading, body,
                    title_color=color, title_size=20,
                    body_size=13, subtitle=name, subtitle_size=22,
                    subtitle_color=color)
    return fig_to_array(fig)


def render_mutation_scene(bundle: dict, run_idx: int, total_runs: int,
                          topic: str = "") -> np.ndarray:
    """Mutation summary."""
    state = bundle.get("architecture_after") or bundle["architecture_before"]
    fig, ax = setup_frame(run_idx, total_runs, bundle["run_id"], topic=topic)

    draw_starfish(ax, state, SF_CX, SF_CY, SF_RADIUS)

    # Build mutation text
    muts = bundle.get("mutation_results", []) or []
    evo = bundle.get("evolution", {}) or {}
    lines = []
    if muts:
        for m in muts[:8]:
            if isinstance(m, dict):
                typ = m.get("type") or m.get("mutation_type") or m.get("action") or "mutation"
                applied = m.get("applied")
                reason = first_words(m.get("reason") or m.get("notes") or m.get("target") or "", 20)
                status = "APPLIED" if applied else "skipped"
                lines.append(f"[{status}] {typ}")
                if reason:
                    lines.append(f"  {reason}")
            else:
                lines.append(f"  {first_words(m, 25)}")
    else:
        proposed = evo.get("mutations") or evo.get("proposed_mutations") or []
        for m in proposed[:6]:
            if isinstance(m, dict):
                lines.append(f"proposed: {m.get('type', 'mutation')}")
                r = first_words(m.get('reason') or m.get('rationale') or '', 20)
                if r:
                    lines.append(f"  {r}")

    if not lines:
        lines = ["No mutation artifacts for this run."]

    body = "\n".join(lines)
    draw_text_panel(ax, TP_X0, TP_Y0, TP_W, TP_H, "Mutation Tide", body,
                    title_color=SEAFOAM, title_size=24, body_size=11,
                    subtitle="Architecture evolution")

    return fig_to_array(fig)


# =========================
# Findings summary (end-of-arc wisdom slides)
# =========================

def extract_findings_bullets(final_text: str, max_bullets: int = 6,
                            max_words_per: int = 30) -> List[str]:
    """Extract key bullet points from a final output text.
    Tries to split on sentence boundaries and pick the meatiest ones."""
    text = clean_text(final_text)
    if not text or len(text) < 20:
        return []

    # Split into sentences (period, semicolon, or numbered items)
    raw = re.split(r'(?<=[.;!?])\s+|(?=\d+\.\s)', text)
    # Also try splitting on markdown-style bullets/dashes
    if len(raw) <= 2:
        raw = re.split(r'\n+|(?:^|\s)-\s', text)

    bullets = []
    for s in raw:
        s = s.strip().strip('-').strip('*').strip()
        if len(s) < 15:  # too short to be meaningful
            continue
        words = _WORD_RE.findall(s)
        if len(words) < 4:
            continue
        # Truncate long sentences
        if len(words) > max_words_per:
            bullet = ' '.join(words[:max_words_per]) + ' ...'
        else:
            bullet = ' '.join(words)
        bullets.append(bullet)
        if len(bullets) >= max_bullets:
            break

    return bullets


def get_arc_findings(run_dirs: List[Path], arc_run_names: List[str]) -> Tuple[str, List[str]]:
    """Get findings from the last run in an arc that has meaningful output.
    Returns (final_text_source_run_name, bullet_list)."""
    # Walk backward through the arc to find the best final output
    for rn in reversed(arc_run_names):
        rd = None
        for d in run_dirs:
            if d.name == rn:
                rd = d
                break
        if rd is None:
            continue
        fo_path = rd / 'final_output.txt'
        text = ''
        if fo_path.exists():
            text = safe_read_text(fo_path)
        if not text or len(text.strip()) < 30:
            # Try transcript
            t = load_json(rd / 'transcript.json', {})
            text = (t or {}).get('final_output', '')
        if text and len(text.strip()) >= 30:
            bullets = extract_findings_bullets(text)
            if bullets:
                return rn, bullets
    return '', []


def render_findings_summary(topic: str, bullets: List[str], page_idx: int,
                            page_count: int, run_idx: int, total_runs: int,
                            arc_run_count: int) -> np.ndarray:
    """Full-screen driftwood findings card -- wisdom from the completed arc."""
    fig, ax = plt.subplots(figsize=FIGSIZE, dpi=FRAME_DPI)
    fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
    fig.patch.set_facecolor(BG_DEEP)
    ax.set_facecolor(BG_DEEP)
    ax.set_xlim(-0.5, 19.2)
    ax.set_ylim(-0.5, 10.8)
    ax.set_aspect('equal')
    ax.axis('off')

    draw_ocean_background(ax)

    tc = topic_color(topic)

    # Large centered driftwood panel
    panel_w, panel_h = 16.0, 7.5
    panel_x = (19.2 - panel_w) / 2 - 0.25
    panel_y = 0.8
    panel = FancyBboxPatch((panel_x, panel_y), panel_w, panel_h,
                           boxstyle='round,pad=0.06,rounding_size=0.35',
                           fc=P["captionBg"][:3], ec=DRIFTWOOD_BORDER, lw=2.5,
                           alpha=0.92, zorder=10)
    ax.add_patch(panel)
    # Inner highlight
    ax.add_patch(FancyBboxPatch((panel_x + 0.15, panel_y + 0.15),
                                panel_w - 0.3, panel_h - 0.3,
                                boxstyle='round,pad=0.04,rounding_size=0.3',
                                fc=DRIFTWOOD_LIGHT, ec='none', lw=0,
                                alpha=0.08, zorder=11))

    # Header
    header_y = panel_y + panel_h - 0.5
    ax.text(panel_x + panel_w / 2, header_y, 'Key Findings',
            color=SAND_GOLD, fontsize=28, ha='center', va='top',
            fontweight='bold', zorder=20, fontfamily=FONT_FUN,
            path_effects=[pe.withStroke(linewidth=3, foreground=BG_DEEP, alpha=0.6)])

    # Topic name + arc info
    ax.text(panel_x + panel_w / 2, header_y - 0.7, topic,
            color=tc, fontsize=18, ha='center', va='top',
            fontweight='bold', zorder=20, fontfamily=FONT_FUN)

    page_label = f'({page_idx + 1}/{page_count})' if page_count > 1 else ''
    if page_label:
        ax.text(panel_x + panel_w - 0.4, header_y - 0.7, page_label,
                color=TEXT_DIM, fontsize=11, ha='right', va='top',
                zorder=20, fontfamily=FONT_BODY)

    # Bullet points
    bullet_y = header_y - 1.5
    bullet_spacing = 0.85
    for i, bullet in enumerate(bullets):
        by = bullet_y - i * bullet_spacing
        if by < panel_y + 0.4:
            break
        # Bullet marker (little seafoam dot)
        ax.scatter([panel_x + 1.0], [by - 0.05], s=35, color=tc,
                   alpha=0.8, zorder=20, edgecolors='none', marker='o')
        # Bullet text
        wrapped = wrap(bullet, width=70, max_lines=2)
        ax.text(panel_x + 1.5, by, wrapped,
                color=TEXT_BRIGHT, fontsize=12.5, ha='left', va='top',
                zorder=20, linespacing=1.4, fontfamily=FONT_BODY,
                path_effects=[pe.withStroke(linewidth=1, foreground=BG_DEEP, alpha=0.4)])

    # Progress bar
    bar_y = 10.15
    bar_w = 18.4
    progress = run_idx / max(total_runs, 1)
    ax.plot([0.4, 0.4 + bar_w], [bar_y, bar_y], color=ACCENT, lw=4,
            solid_capstyle='round', zorder=2, alpha=0.5)
    ax.plot([0.4, 0.4 + bar_w * progress], [bar_y, bar_y], color=tc, lw=4,
            solid_capstyle='round', zorder=3)

    # Title bar
    ax.text(0.3, 10.5, 'Solasterid.ai', color=SAND_GOLD, fontsize=14,
            ha='left', va='center', fontweight='bold', zorder=5,
            fontfamily=FONT_TITLE,
            path_effects=[pe.withStroke(linewidth=2, foreground=BG_DEEP, alpha=0.7)])
    ax.text(3.6, 10.5, 'by Jordan Ehrman', color=TEXT_DIM, fontsize=9,
            ha='left', va='center', zorder=5, fontfamily=FONT_BODY)

    # Topic banner
    banner = FancyBboxPatch((0.3, 9.3), 18.4, 0.7,
                            boxstyle='round,pad=0.02,rounding_size=0.15',
                            fc=TOPIC_BG, ec=tc, lw=2.0, alpha=0.88, zorder=25)
    ax.add_patch(banner)
    ax.text(0.8, 9.65, f'{topic}  ~  arc complete', color=tc, fontsize=18,
            fontweight='bold', ha='left', va='center', zorder=30,
            fontfamily=FONT_FUN,
            path_effects=[pe.withStroke(linewidth=2, foreground=BG_DEEP, alpha=0.5)])

    return fig_to_array(fig)


# =========================
# Video writer + pipeline
# =========================

def compute_arc_info(run_dirs: List[Path], topic_map: Dict[str, str]):
    """For each run, compute which arc it belongs to and its position within that arc.
    Returns (info_dict, arcs_list).
    info_dict: run_name -> {topic, run_num, arc_total, is_first, is_last, arc_idx}
    arcs_list: [(topic, [run_names]), ...]"""
    # Group consecutive runs with the same topic into arcs
    arcs = []  # list of (topic, [run_names])
    for rd in run_dirs:
        t = topic_map.get(rd.name, "General Task")
        if arcs and arcs[-1][0] == t:
            arcs[-1][1].append(rd.name)
        else:
            arcs.append((t, [rd.name]))

    info = {}
    for arc_idx, (arc_topic, arc_runs) in enumerate(arcs):
        for i, rn in enumerate(arc_runs):
            info[rn] = {
                "topic": arc_topic,
                "run_num": i + 1,
                "arc_total": len(arc_runs),
                "is_first": i == 0,
                "is_last": i == len(arc_runs) - 1,
                "arc_idx": arc_idx,
            }
    return info, arcs


def render_video(runs_dir=RUNS_DIR, output_path=VIDEO_PATH,
                 max_runs=MAX_RUNS, max_scenes=MAX_COMMITTEE_SCENES, fps=FPS):
    run_dirs = discover_runs(runs_dir, max_runs)
    if not run_dirs:
        raise FileNotFoundError(f"No runs in {runs_dir.resolve()}")

    total = len(run_dirs)

    # Build topic map and arc info
    topic_map = build_topic_map(run_dirs)
    arc_info, arcs_list = compute_arc_info(run_dirs, topic_map)

    # Pre-compute findings for each arc (for end-of-arc summary slides)
    arc_findings = {}  # arc_idx -> bullet list
    for ai_idx, (atopic, anames) in enumerate(arcs_list):
        if atopic == 'System Bootstrap':
            continue
        _, bullets = get_arc_findings(run_dirs, anames)
        if bullets:
            arc_findings[ai_idx] = bullets
            print(f"  Findings for [{atopic}]: {len(bullets)} bullets")
    print(f"  {len(arc_findings)} arcs have findings summaries.\n")

    # Print topic arc summary
    print("\n=== Topic Arc Summary ===")
    prev = None
    for rd in run_dirs:
        ai = arc_info[rd.name]
        if ai["topic"] != prev:
            print(f"  [{ai['topic']}] x{ai['arc_total']} runs")
            prev = ai["topic"]
    print("========================\n")

    writer = imageio.get_writer(str(output_path), fps=fps, codec="libx264",
                                quality=8, pixelformat="yuv420p",
                                macro_block_size=1)

    def add_frame(arr, seconds):
        n = max(1, int(round(seconds * fps)))
        for _ in range(n):
            writer.append_data(arr)

    prev_topic = None

    try:
        for idx, run_dir in enumerate(run_dirs, 1):
            bundle = load_run_bundle(run_dir)
            ai = arc_info[run_dir.name]
            cur_topic = ai["topic"]
            t_num = ai["run_num"]
            t_total = ai["arc_total"]

            print(f"[{idx}/{total}] {bundle['run_id']}  |  {cur_topic} ({t_num}/{t_total})")

            # 0) Topic transition card (when topic changes, skip for bootstrap)
            if cur_topic != prev_topic and cur_topic != "System Bootstrap":
                add_frame(render_topic_transition(cur_topic, idx, total, t_total),
                          T_TOPIC_CARD)
            prev_topic = cur_topic

            # 1) Run title
            add_frame(render_run_title(bundle, idx, total,
                                       topic=cur_topic, topic_run_num=t_num,
                                       topic_run_total=t_total), T_RUN_TITLE)

            # 2) Committee scenes
            scenes = extract_committee_scenes(bundle, max_scenes)
            for si, scene in enumerate(scenes):
                arr = render_committee_scene(bundle, scene, si, len(scenes),
                                             idx, total,
                                             topic=cur_topic, topic_run_num=t_num,
                                             topic_run_total=t_total)
                hold = T_COMMITTEE_HOLD if si == len(scenes) - 1 else T_COMMITTEE
                add_frame(arr, hold)

            # 3) Speaker output
            final_text = bundle.get("final_output", "")
            if final_text.strip():
                pages = split_pages(final_text)
                for pi, page in enumerate(pages):
                    add_frame(render_speaker_page(bundle, page, pi, len(pages),
                                                   idx, total,
                                                   topic=cur_topic,
                                                   topic_run_num=t_num,
                                                   topic_run_total=t_total),
                              T_SPEAKER)

            # 4) Mutation
            if bundle.get("mutation_results") or bundle.get("evolution"):
                add_frame(render_mutation_scene(bundle, idx, total,
                                                topic=cur_topic), T_MUTATION)

            # 5) Introduction cards for new/retired arms and committees
            diff = diff_architecture(bundle["architecture_before"],
                                     bundle["architecture_after"])
            for aid, arm in diff["new_arms"].items():
                name = arm.get("name", aid)
                lens = arm.get("lens", "")
                arr = render_introduction(bundle, "Arm", name, lens,
                                          "#A7FF83", idx, total,
                                          topic=cur_topic)
                add_frame(arr, T_INTRODUCTION)
            for cid, comm in diff["new_committees"].items():
                cname = comm.get("name", cid).replace("_", " ").title()
                members = comm.get("members", [])
                detail = f"{len(members)} members" if members else ""
                arr = render_introduction(bundle, "Committee", cname, detail,
                                          "#4EA5FF", idx, total,
                                          topic=cur_topic)
                add_frame(arr, T_INTRODUCTION)
            for aid, arm in diff["retired_arms"].items():
                name = arm.get("name", aid)
                arr = render_introduction(bundle, "retired arm", name,
                                          "Removed from active duty.",
                                          "#FF5C8A", idx, total,
                                          topic=cur_topic)
                add_frame(arr, T_INTRODUCTION)

            # 6) Findings summary slides (at end of arc, before next topic)
            if ai["is_last"] and ai["arc_idx"] in arc_findings:
                bullets = arc_findings[ai["arc_idx"]]
                # Split into pages of ~5 bullets each
                bpp = 5  # bullets per page
                pages = [bullets[i:i+bpp] for i in range(0, len(bullets), bpp)]
                for pi, page_bullets in enumerate(pages):
                    arr = render_findings_summary(
                        cur_topic, page_bullets, pi, len(pages),
                        idx, total, t_total)
                    add_frame(arr, T_FINDINGS)
                print(f"    -> Findings summary: {len(bullets)} bullets, {len(pages)} page(s)")

    finally:
        writer.close()
        print(f"\nSaved: {output_path.resolve()}")

    return output_path


if __name__ == "__main__":
    render_video()
