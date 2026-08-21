#!/usr/bin/env python3
"""Compatibility wrapper for image-processing/scripts/add_labels.py."""
from pathlib import Path
import os
import runpy

hermes_home = Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes")))
target = hermes_home / "skills" / "creative" / "image-processing" / "scripts" / "add_labels.py"
if not target.is_file():
    raise SystemExit(f"shared label tool not found: {target}")
runpy.run_path(str(target), run_name="__main__")
