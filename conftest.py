# conftest.py  (project root)
# Adds the project root to sys.path so that `import backend.*` always works,
# whether you run pytest from the root or from a subdirectory.
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))