#!/usr/bin/env python3
"""Validate temporal coherence for Feng character actions.

The validator blocks single-still overlays from pretending to perform articulated
contact actions and requires a complete anticipation→contact→manipulation→release→result arc.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path

PHASES = ["anticipation", "contact", "manipulation", "release", "result"]
CONTACT_MODES = {"surface-contact", "force-contact", "body-support", "locomotion", "handoff", "environment-integrated"}
STRONG_MODES = {"force-contact", "body-support", "locomotion", "handoff", "environment-integrated"}
STRATEGIES = {"static-overlay", "anchored-micro-motion", "rigged-animation", "pose-sequence", "integrated-frame", "generated-video"}


def validate_scene(scene: dict) -> list[str]:
    if scene.get("feng_role", "none") == "none":
        return []
    errors: list[str] = []
    mode = scene.get("interaction_mode")
    strategy = scene.get("motion_strategy")
    phases = scene.get("action_phases") or []
    if strategy not in STRATEGIES:
        errors.append("invalid_or_missing_motion_strategy")
    if mode in CONTACT_MODES and strategy == "static-overlay":
        errors.append("static_overlay_forbidden_for_contact")
    if mode in STRONG_MODES and strategy == "anchored-micro-motion":
        errors.append("anchored_micro_motion_forbidden_for_strong_action")
    if mode in STRONG_MODES and strategy not in {"rigged-animation", "pose-sequence", "integrated-frame", "generated-video"}:
        errors.append("strong_action_requires_articulated_or_integrated_motion")
    if strategy == "pose-sequence" and int(scene.get("pose_count") or 0) < 3:
        errors.append("pose_sequence_requires_at_least_3_poses")
    names = [p.get("name") for p in phases]
    if names != PHASES:
        errors.append("action_phases_must_be_anticipation_contact_manipulation_release_result")
        return errors
    last_end = None
    for phase in phases:
        try:
            start, end = float(phase["start"]), float(phase["end"])
        except Exception:
            errors.append("action_phase_invalid_time")
            continue
        if end <= start:
            errors.append("action_phase_nonpositive_duration")
        if last_end is not None and abs(start - last_end) > 0.05:
            errors.append("action_phases_must_be_contiguous")
        last_end = end
    by_name = {p.get("name"): p for p in phases}
    if mode in CONTACT_MODES:
        if not by_name["contact"].get("contact"):
            errors.append("contact_phase_must_establish_contact")
        if not by_name["manipulation"].get("contact"):
            errors.append("manipulation_must_preserve_contact")
    if strategy == "anchored-micro-motion" and mode != "surface-contact":
        errors.append("anchored_micro_motion_only_for_surface_contact")
    return list(dict.fromkeys(errors))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("storyboard", type=Path)
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args()
    data = json.loads(args.storyboard.read_text(encoding="utf-8"))
    findings = []
    for scene in data.get("scenes", []):
        for error in validate_scene(scene):
            findings.append(f"{scene.get('id','unknown')}:{error}")
    report = {"ok": not findings, "findings": findings, "scenes": len(data.get("scenes", []))}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if args.strict and findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
