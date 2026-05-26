# Solasterid Process Visualizer v2 - Split-Screen Starfish
# ========================================================
# DESIGN: Left 1/3 = starfish organism with arms lighting up per committee
#         Right 2/3 = LARGE readable text (committee name, findings, mutations)
# SPEED:  No sprout animation. One frame per committee. ~3s per run target.
#         200 runs in ~10 minutes.

from __future__ import annotations
import json, math, os, re, textwrap, hashlib, warnings
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch, Wedge
from matplotlib import patheffects as pe
from PIL import Image
import imageio.v2 as imageio

matplotlib.rcParams['text.parse_math'] = False
warnings.filterwarnings("ignore", category=UserWarning)

# =========================
# Configuration
# =========================
STORAGE_ROOT = Path("solasterid_v1_2")
RUNS_DIR = STORAGE_ROOT / "runs"
OUTPUT_DIR = Path("solasterid_viz_output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

FPS = 24
FIGSIZE = (19.2, 10.8)          # 1920x1080 at 100 DPI
FRAME_DPI = 100
MACRO_BLOCK = 16                # ensure video dimensions divisible by this

# Deep ocean palette
BG_DARK   = "#060B18"
BG_PANEL  = "#0C1225"
ACCENT    = "#1A2744"
TEXT_BRIGHT = "#F0EDE4"
TEXT_DIM    = "#8B9BB4"
TEXT_MUTED  = "#4A5A78"
BORDER      = "#1E3054"

# Timing (seconds per scene) - tuned for 200 runs in ~10 min
T_RUN_TITLE     = 0.8           # run title card
T_COMMITTEE     = 0.25          # per committee flash
T_COMMITTEE_HOLD = 0.6          # hold on last committee
T_SPEAKER       = 1.5           # final output page
T_MUTATION      = 0.8           # mutation summary
T_INTRODUCTION  = 1.0           # new arm/committee intro card

MAX_RUNS = None
MAX_COMMITTEE_SCENES = None
QUOTE_WORDS = 35
SPEAKER_WORDS_PER_PAGE = 160

VIDEO_PATH = OUTPUT_DIR / "solasterid_v2.mp4"

ROLE_COLORS = {
    "governance_safety":  "#FF5C8A",
    "memory_continuity":  "#4EA5FF",
    "mechanics_code":     "#53D769",
    "evolution_planning": "#B77CFF",
    "domain_specialist":  "#FFD166",
    "creative_synthesis": "#FF8BD1",
    "economy_protocol":   "#2DD4BF",
    "literal_grounding":  "#F97316",
    "speaker":            "#F8F4E3",
    "unknown":            "#7B8DAF",
}

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

def draw_starfish(ax, state: dict, cx: float, cy: float, radius: float = 2.8,
                  highlight_cid: Optional[str] = None, highlight_color: Optional[str] = None):
    """Draw the starfish organism. If highlight_cid is set, that arm glows bright, others dim."""
    layout = compute_starfish_layout(state, cx, cy, radius)
    committees = committees_or_pseudo(state)

    for cid, L in layout.items():
        is_sel = (cid == highlight_cid)
        alpha = 0.92 if is_sel else (0.25 if highlight_cid else 0.55)
        lw = 18 if is_sel else 8
        color = highlight_color if (is_sel and highlight_color) else L.color

        # Arm line
        line, = ax.plot([cx, L.end[0]], [cy, L.end[1]], color=color, lw=lw,
                        alpha=alpha, solid_capstyle="round", zorder=3 if is_sel else 2)
        if is_sel:
            line.set_path_effects([
                pe.Stroke(linewidth=lw + 12, foreground=color, alpha=0.15),
                pe.Stroke(linewidth=lw + 5, foreground=color, alpha=0.25),
                pe.Normal(),
            ])
        # Tip dot
        ax.scatter([L.end[0]], [L.end[1]], s=180 if is_sel else 50, color=color,
                   alpha=alpha, zorder=4, edgecolor="white" if is_sel else "none",
                   linewidth=1.5 if is_sel else 0)

    # Central disc (the "mouth hole")
    ax.add_patch(Circle((cx, cy), 0.55, fc=BG_DARK, ec="#F8F4E3", lw=2.0, alpha=0.95, zorder=8))
    ax.add_patch(Circle((cx, cy), 0.22, fc="#000000", ec="#7C6CF2", lw=1.2, alpha=0.98, zorder=9))

    return layout


def draw_member_sprouts(ax, state: dict, cx: float, cy: float, radius: float,
                        committee_id: str, member_names: List[str]):
    """Draw small branch lines fanning off the highlighted committee arm tip,
    one per member, with their name labels. Shows who's thinking."""
    layout = compute_starfish_layout(state, cx, cy, radius)
    if committee_id not in layout or not member_names:
        return

    L = layout[committee_id]
    tip_x, tip_y = L.end
    n = len(member_names)
    # Fan angle range narrows as member count grows so they don't overlap too much
    fan_half = min(0.7, 0.25 * n)
    angles = np.linspace(-fan_half, fan_half, max(n, 1)) if n > 1 else [0.0]
    branch_len = 0.9

    for j, (name, fan_a) in enumerate(zip(member_names, angles)):
        theta = L.angle + float(fan_a)
        bx = tip_x + branch_len * math.cos(theta)
        by = tip_y + branch_len * math.sin(theta)

        # Branch line
        ax.plot([tip_x, bx], [tip_y, by], color=L.color, lw=3, alpha=0.65,
                solid_capstyle="round", zorder=11)
        # Dot at end
        ax.scatter([bx], [by], s=35, color=L.color, alpha=0.8, zorder=12,
                   edgecolor="white", linewidth=0.6)
        # Name label
        # Push label slightly past the dot
        lx = bx + 0.2 * math.cos(theta)
        ly = by + 0.2 * math.sin(theta)
        ha = "left" if math.cos(theta) >= 0 else "right"
        ax.text(lx, ly, name, color=TEXT_BRIGHT, fontsize=7, ha=ha, va="center",
                zorder=13, alpha=0.85,
                bbox=dict(boxstyle="round,pad=0.12", fc=BG_DARK, ec=L.color,
                          lw=0.5, alpha=0.7))


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


def draw_text_panel(ax, x0, y0, width, height, title, body, title_color=TEXT_BRIGHT,
                    title_size=22, body_size=13, body_color=TEXT_BRIGHT, subtitle="",
                    subtitle_color=TEXT_DIM, subtitle_size=11):
    """Draw a large readable text panel on the right side."""
    # Panel background
    panel = FancyBboxPatch((x0, y0), width, height,
                           boxstyle="round,pad=0.02,rounding_size=0.15",
                           fc=BG_PANEL, ec=BORDER, lw=1.5, alpha=0.95, zorder=15)
    ax.add_patch(panel)

    # Title
    ty = y0 + height - 0.45
    ax.text(x0 + 0.4, ty, title, color=title_color, fontsize=title_size,
            fontweight="bold", ha="left", va="top", zorder=20,
            path_effects=[pe.withStroke(linewidth=3, foreground=BG_DARK, alpha=0.5)])

    # Subtitle
    if subtitle:
        ax.text(x0 + 0.4, ty - 0.52, subtitle, color=subtitle_color,
                fontsize=subtitle_size, ha="left", va="top", zorder=20)

    # Body text
    body_y = ty - (1.0 if subtitle else 0.6)
    ax.text(x0 + 0.4, body_y, body, color=body_color, fontsize=body_size,
            ha="left", va="top", zorder=20, linespacing=1.4,
            fontfamily="monospace")


def get_prompt_subtitle(bundle: dict, max_words: int = 18) -> str:
    """Extract a short prompt summary for use as a persistent subtitle."""
    prompt_text = clean_text((bundle.get("prompt", {}) or {}).get("user_prompt", ""))
    if not prompt_text:
        return ""
    return first_words(prompt_text, max_words)


def setup_frame(run_idx: int, total_runs: int, run_id: str,
                prompt_subtitle: str = ""):
    """Create a figure with the dark ocean background, header, and prompt subtitle."""
    fig, ax = plt.subplots(figsize=FIGSIZE, dpi=FRAME_DPI)
    fig.patch.set_facecolor(BG_DARK)
    ax.set_facecolor(BG_DARK)
    ax.set_xlim(-0.5, 19.2)
    ax.set_ylim(-0.5, 10.8)
    ax.set_aspect("equal")
    ax.axis("off")

    # Top bar
    ax.axhline(y=10.3, xmin=0.02, xmax=0.98, color=BORDER, lw=1, zorder=1)
    ax.text(0.3, 10.55, "S O L A S T E R I D", color=TEXT_DIM, fontsize=9,
            ha="left", va="center", fontweight="bold", zorder=5)
    ax.text(19.0, 10.55, f"Run {run_idx}/{total_runs}", color=TEXT_DIM,
            fontsize=10, ha="right", va="center", zorder=5)

    # Prompt subtitle - big, centered below the top bar
    if prompt_subtitle:
        ax.text(9.6, 9.85, prompt_subtitle, color=TEXT_DIM, fontsize=13,
                ha="center", va="center", fontstyle="italic", zorder=5)

    # Progress bar
    bar_y = 10.15
    bar_w = 18.4
    progress = run_idx / max(total_runs, 1)
    ax.plot([0.4, 0.4 + bar_w], [bar_y, bar_y], color=ACCENT, lw=3, solid_capstyle="round", zorder=2)
    ax.plot([0.4, 0.4 + bar_w * progress], [bar_y, bar_y], color="#4EA5FF", lw=3, solid_capstyle="round", zorder=3)

    return fig, ax

# Starfish center coordinates (left third of the canvas)
SF_CX, SF_CY = 4.0, 4.8
SF_RADIUS = 2.6
# Text panel coordinates (right two-thirds)
TP_X0, TP_Y0, TP_W, TP_H = 8.2, 0.3, 10.5, 9.5

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


def render_run_title(bundle: dict, run_idx: int, total_runs: int) -> np.ndarray:
    """Run title card: full starfish anatomy + run info."""
    state = bundle["architecture_before"]
    n_committees = len(committees_or_pseudo(state))
    n_arms = len(active_arms(state))
    prompt_sub = get_prompt_subtitle(bundle)
    prompt_long = first_words(clean_text((bundle.get("prompt", {}) or {}).get("user_prompt", "")), 50)

    fig, ax = setup_frame(run_idx, total_runs, bundle["run_id"],
                          prompt_subtitle=prompt_sub)
    draw_starfish(ax, state, SF_CX, SF_CY, SF_RADIUS)

    # Run info on the right panel
    title = f"Run {run_idx}"
    subtitle = f"{n_arms} active arms  |  {n_committees} committees"
    body = wrap(prompt_long or "(no prompt captured)", width=70, max_lines=8)
    draw_text_panel(ax, TP_X0, TP_Y0, TP_W, TP_H, title, body,
                    title_size=28, body_size=14, subtitle=subtitle)

    # Run ID label under starfish
    ax.text(SF_CX, SF_CY - SF_RADIUS - 0.9, bundle["run_id"],
            color=TEXT_MUTED, fontsize=7, ha="center", va="top", zorder=10)

    return fig_to_array(fig)


def render_committee_scene(bundle: dict, scene: CommitteeScene,
                           scene_idx: int, total_scenes: int,
                           run_idx: int, total_runs: int) -> np.ndarray:
    """One committee highlighted on starfish with member sprouts, findings on the right."""
    state = bundle["architecture_before"]
    prompt_sub = get_prompt_subtitle(bundle)
    fig, ax = setup_frame(run_idx, total_runs, bundle["run_id"],
                          prompt_subtitle=prompt_sub)

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
        body_lines.append(wrap(quote, width=65, max_lines=3))
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
                        page_count: int, run_idx: int, total_runs: int) -> np.ndarray:
    """Speakerbot final output - large readable text."""
    state = bundle["architecture_before"]
    fig, ax = setup_frame(run_idx, total_runs, bundle["run_id"])

    # Starfish with no highlight (all arms gently lit)
    draw_starfish(ax, state, SF_CX, SF_CY, SF_RADIUS)

    # Mouth glow
    ax.add_patch(Circle((SF_CX, SF_CY), 0.7, fc="none", ec="#F8F4E3",
                        lw=3, alpha=0.4, zorder=7))

    title = "Final Output"
    subtitle = f"Page {page_idx + 1}/{page_count}" if page_count > 1 else "Speakerbot"
    body = wrap(page_text, width=72, max_lines=22)
    draw_text_panel(ax, TP_X0, TP_Y0, TP_W, TP_H, title, body,
                    title_color="#F8F4E3", title_size=26,
                    body_size=11, subtitle=subtitle)

    return fig_to_array(fig)


def render_introduction(bundle: dict, intro_type: str, name: str, detail: str,
                        color: str, run_idx: int, total_runs: int) -> np.ndarray:
    """Big introduction card for a new arm/committee (or retirement)."""
    state = bundle.get("architecture_after") or bundle["architecture_before"]
    fig, ax = setup_frame(run_idx, total_runs, bundle["run_id"])
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


def render_mutation_scene(bundle: dict, run_idx: int, total_runs: int) -> np.ndarray:
    """Mutation summary."""
    state = bundle.get("architecture_after") or bundle["architecture_before"]
    fig, ax = setup_frame(run_idx, total_runs, bundle["run_id"])

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
                    title_color="#A7FF83", title_size=24, body_size=11,
                    subtitle="Architecture evolution")

    return fig_to_array(fig)


# =========================
# Video writer + pipeline
# =========================

def render_video(runs_dir=RUNS_DIR, output_path=VIDEO_PATH,
                 max_runs=MAX_RUNS, max_scenes=MAX_COMMITTEE_SCENES, fps=FPS):
    run_dirs = discover_runs(runs_dir, max_runs)
    if not run_dirs:
        raise FileNotFoundError(f"No runs in {runs_dir.resolve()}")

    total = len(run_dirs)
    writer = imageio.get_writer(str(output_path), fps=fps, codec="libx264",
                                quality=8, pixelformat="yuv420p",
                                macro_block_size=1)

    def add_frame(arr, seconds):
        n = max(1, int(round(seconds * fps)))
        for _ in range(n):
            writer.append_data(arr)

    try:
        for idx, run_dir in enumerate(run_dirs, 1):
            bundle = load_run_bundle(run_dir)
            print(f"[{idx}/{total}] {bundle['run_id']}")

            # 1) Run title
            add_frame(render_run_title(bundle, idx, total), T_RUN_TITLE)

            # 2) Committee scenes - rapid fire
            scenes = extract_committee_scenes(bundle, max_scenes)
            for si, scene in enumerate(scenes):
                arr = render_committee_scene(bundle, scene, si, len(scenes), idx, total)
                hold = T_COMMITTEE_HOLD if si == len(scenes) - 1 else T_COMMITTEE
                add_frame(arr, hold)

            # 3) Speaker output
            final_text = bundle.get("final_output", "")
            if final_text.strip():
                pages = split_pages(final_text)
                for pi, page in enumerate(pages):
                    add_frame(render_speaker_page(bundle, page, pi, len(pages), idx, total), T_SPEAKER)

            # 4) Mutation
            if bundle.get("mutation_results") or bundle.get("evolution"):
                add_frame(render_mutation_scene(bundle, idx, total), T_MUTATION)

            # 5) Introduction cards for new/retired arms and committees
            diff = diff_architecture(bundle["architecture_before"],
                                     bundle["architecture_after"])
            for aid, arm in diff["new_arms"].items():
                name = arm.get("name", aid)
                lens = arm.get("lens", "")
                arr = render_introduction(bundle, "Arm", name, lens,
                                          "#A7FF83", idx, total)
                add_frame(arr, T_INTRODUCTION)
            for cid, comm in diff["new_committees"].items():
                cname = comm.get("name", cid).replace("_", " ").title()
                members = comm.get("members", [])
                detail = f"{len(members)} members" if members else ""
                arr = render_introduction(bundle, "Committee", cname, detail,
                                          "#4EA5FF", idx, total)
                add_frame(arr, T_INTRODUCTION)
            for aid, arm in diff["retired_arms"].items():
                name = arm.get("name", aid)
                arr = render_introduction(bundle, "retired arm", name,
                                          "Removed from active duty.",
                                          "#FF5C8A", idx, total)
                add_frame(arr, T_INTRODUCTION)

    finally:
        writer.close()
        print(f"Saved: {output_path.resolve()}")

    return output_path


if __name__ == "__main__":
    render_video()
