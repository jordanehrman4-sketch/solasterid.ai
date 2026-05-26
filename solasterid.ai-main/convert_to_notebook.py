"""
Convert the plain-text solasterid_process_visualizer.ipynb into valid Jupyter notebook JSON.
"""
import json, re

with open("solasterid_process_visualizer.ipynb", "r", encoding="utf-8", errors="replace") as f:
    raw = f.read()

# The file is structured with markdown sections and code blocks.
# We'll split on the natural boundaries visible in the pasted content.

cells = []

def md_cell(source_lines):
    return {
        "cell_type": "markdown",
        "metadata": {},
        "source": [line + "\n" for line in source_lines[:-1]] + [source_lines[-1]] if source_lines else []
    }

def code_cell(source_lines):
    return {
        "cell_type": "code",
        "metadata": {},
        "execution_count": None,
        "outputs": [],
        "source": [line + "\n" for line in source_lines[:-1]] + [source_lines[-1]] if source_lines else []
    }

lines = raw.split("\n")

# State machine: walk lines, detect boundaries
current_lines = []
current_type = None  # 'md' or 'code'

# Heuristics for this specific file:
# - Lines starting with "# =" separators mark code section starts
# - Lines starting with "## " are markdown headers
# - Lines that are pure Python (import, def, class, @, etc.) are code
# - The file has clear section separators

# Let's identify the sections by the actual structure.
# Looking at the content, sections are separated by blank lines and 
# "# ====...====" comment blocks.

# Strategy: manually define split points based on the known structure.
# Each section between the markdown prose and the code blocks.

# First, let's find all the "# =====" separator lines
separator_indices = []
for i, line in enumerate(lines):
    if re.match(r'^# =+$', line.strip()):
        separator_indices.append(i)

print(f"Found {len(separator_indices)} separator lines at: {separator_indices}")

# Let's also find the markdown header for the title
# and the "## Extra upgrades" section at the end

# Parse approach: 
# 1. Everything before the first code line is markdown cell 1
# 2. Each code section (between separators or between known boundaries) is a code cell
# 3. The final "## Extra upgrades" section is a markdown cell

# Let me take a simpler approach: find blocks that are clearly code vs markdown

# The structure from the user's paste is:
# CELL 1 (markdown): Title + description (lines starting with # Solasterid... through "...run artifacts...")
# CELL 2 (code): Package install helper
# CELL 3 (code): Imports
# CELL 4 (code): Configuration knobs
# CELL 5 (code): IO helpers + discover_runs()
# CELL 6 (code): Anatomy normalization
# CELL 7 (code): Role/color classification  
# CELL 8 (code): Text extraction
# CELL 9 (code): Committee-scene extraction + summarize
# CELL 10 (code): Geometry + drawing primitives
# CELL 11 (code): Starfish renderer (big cell)
# CELL 12 (code): Frame conversion + video writer
# CELL 13 (code): Main render pipeline
# CELL 14 (code): Preview latest run
# CELL 15 (code): Make the video
# CELL 16 (markdown): Extra upgrades

# Find key markers
def find_line(pattern, start=0):
    for i in range(start, len(lines)):
        if re.search(pattern, lines[i]):
            return i
    return None

# Identify section starts
title_line = find_line(r'^# Solasterid Process Visualizer')
optional_install = find_line(r'^# Optional install helpers')
imports_line = find_line(r'^from __future__ import')
config_line = find_line(r'^# =+$', 0)  # First separator

# Find all separator-titled sections
sections = []
i = 0
while i < len(lines):
    # Check for separator block: # ====, # Title, # ====
    if (re.match(r'^# =+$', lines[i].strip()) and 
        i + 2 < len(lines) and 
        re.match(r'^# =+$', lines[i+2].strip())):
        section_title = lines[i+1].strip().lstrip('# ')
        sections.append((i, section_title))
        i += 3
    else:
        i += 1

print(f"Found {len(sections)} named sections:")
for idx, (line_no, title) in enumerate(sections):
    print(f"  [{idx}] Line {line_no}: {title}")

# Now build cells properly
# Cell 1: Markdown - from start to "# Optional install"
md_end = optional_install if optional_install else find_line(r'^import sys')
if title_line is not None and md_end is not None:
    md_lines = []
    for line in lines[title_line:md_end]:
        # Clean up any encoding artifacts
        cleaned = line.replace('\udce5\udc99', '').replace('\udce5', '').replace('\udc99', '')
        # Remove stray bytes
        cleaned = re.sub(r'[^\x00-\x7f\u00a0-\uffff]', '', cleaned)
        md_lines.append(cleaned)
    # Strip trailing blank lines
    while md_lines and md_lines[-1].strip() == '':
        md_lines.pop()
    cells.append(md_cell(md_lines))

# Cell 2: Code - Optional install + imports block
# From "# Optional install" to just before the first "# =====" section
first_section_line = sections[0][0] if sections else len(lines)

# But there's a natural split: install helpers, then imports
# Let's find the split between install and imports
install_end = imports_line
if optional_install is not None:
    install_block = lines[optional_install:install_end]
    while install_block and install_block[-1].strip() == '':
        install_block.pop()
    cells.append(code_cell(install_block))

# Imports block: from "from __future__" to first section separator
if imports_line is not None:
    import_block = lines[imports_line:first_section_line]
    while import_block and import_block[-1].strip() == '':
        import_block.pop()
    cells.append(code_cell(import_block))

# Now process each named section
for sec_idx, (sec_start, sec_title) in enumerate(sections):
    # Determine end of this section
    if sec_idx + 1 < len(sections):
        sec_end = sections[sec_idx + 1][0]
    else:
        # Last section ends at "## Extra upgrades" or end of file
        extra_line = find_line(r'^## Extra upgrades', sec_start)
        sec_end = extra_line if extra_line else len(lines)
    
    # The section header (3 lines: ===, title, ===) is part of the code
    block = lines[sec_start:sec_end]
    
    # Strip trailing blank lines
    while block and block[-1].strip() == '':
        block.pop()
    
    if block:
        cells.append(code_cell(block))

# Final markdown cell: "## Extra upgrades..."
extra_line = find_line(r'^## Extra upgrades')
if extra_line is not None:
    md_block = lines[extra_line:]
    while md_block and md_block[-1].strip() == '':
        md_block.pop()
    if md_block:
        cells.append(md_cell(md_block))

# Build notebook
notebook = {
    "nbformat": 4,
    "nbformat_minor": 5,
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3"
        },
        "language_info": {
            "name": "python",
            "version": "3.11.0"
        }
    },
    "cells": cells
}

output_path = "solasterid_process_visualizer.ipynb.bak"
# First backup the original
import shutil
shutil.copy2("solasterid_process_visualizer.ipynb", "solasterid_process_visualizer_raw_backup.txt")

# Write the proper notebook
with open("solasterid_process_visualizer.ipynb", "w", encoding="utf-8") as f:
    json.dump(notebook, f, indent=1, ensure_ascii=False)

print(f"\nCreated {len(cells)} cells")
for i, c in enumerate(cells):
    src = c["source"]
    preview = src[0].strip() if src else "(empty)"
    print(f"  Cell {i+1} [{c['cell_type']}]: {preview[:80]}")

# Validate
with open("solasterid_process_visualizer.ipynb", "r", encoding="utf-8") as f:
    validated = json.load(f)
print(f"\nValidation: OK - {len(validated['cells'])} cells, valid JSON ✓")
