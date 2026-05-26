"""Quick 3-run test of the updated v4 visualizer."""
import time, sys

# Tee all output to a log file
class Tee:
    def __init__(self, *files):
        self.files = files
    def write(self, s):
        for f in self.files:
            f.write(s)
            f.flush()
    def flush(self):
        for f in self.files:
            f.flush()

log = open('test_v4_log.txt', 'w')
sys.stdout = Tee(sys.__stdout__, log)
sys.stderr = Tee(sys.__stderr__, log)

import solasterid_viz_v4_captioned as viz
viz.MAX_RUNS = 71
viz.VIDEO_PATH = viz.OUTPUT_DIR / "v4_reef_test.mp4"

t0 = time.time()
print("Running 3-run test render...")
try:
    viz.render_video(max_runs=71)
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
elapsed = time.time() - t0
print(f"Done! Took {elapsed:.1f}s")
log.close()
