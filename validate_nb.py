import json

with open("solasterid_process_visualizer.ipynb", "r", encoding="utf-8") as f:
    nb = json.load(f)

print(f"Valid JSON notebook with {len(nb['cells'])} cells")
print(f"nbformat: {nb['nbformat']}.{nb['nbformat_minor']}")
for i, c in enumerate(nb["cells"]):
    src = c["source"]
    if src:
        preview = src[0].strip()[:70].encode("ascii", "replace").decode()
    else:
        preview = "(empty)"
    print(f"  Cell {i+1:2d} [{c['cell_type']:8s}] {preview}")
