"""Add traceback logging to the driver loop so we can see the ACTUAL crash."""
import json
from pathlib import Path

NB = Path("pentamind_v4_solasterid_async.ipynb")
nb = json.loads(NB.read_text(encoding="utf-8"))

def replace_in_cell(nb, cell_idx, old, new):
    src = "".join(nb["cells"][cell_idx]["source"])
    assert old in src, f"Target not found in cell {cell_idx}:\n{repr(old[:200])}"
    src = src.replace(old, new, 1)
    nb["cells"][cell_idx]["source"] = src.splitlines(keepends=True)
    if nb["cells"][cell_idx]["source"] and not nb["cells"][cell_idx]["source"][-1].endswith("\n"):
        nb["cells"][cell_idx]["source"][-1] += "\n"

# Find the driver cell
for ci, cell in enumerate(nb["cells"]):
    if cell.get("cell_type") == "code":
        src = "".join(cell["source"])
        if "except Exception as e:" in src and "Error occurred in iteration" in src:
            print(f"Found driver cell at index {ci}")
            
            old_except = (
                '    except Exception as e:\n'
                '        print(f"Error occurred in iteration {i}: {e}")\n'
                '        # Keep the current prompt; the error may be transient.'
            )
            new_except = (
                '    except Exception as e:\n'
                '        import traceback\n'
                '        print(f"Error occurred in iteration {i}: {e}")\n'
                '        traceback.print_exc()\n'
                '        # Keep the current prompt; the error may be transient.'
            )
            
            replace_in_cell(nb, ci, old_except, new_except)
            print(f"  Patched except block with traceback.print_exc()")
            break
else:
    print("ERROR: driver cell not found!")
    exit(1)

NB.write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
print(f"Patched {NB}")
