#!/usr/bin/env python3
"""Create a feng-video production project from templates."""
from __future__ import annotations
import argparse, hashlib, json, re, shutil
from datetime import datetime, timezone
from pathlib import Path


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", value).strip("-")
    return value[:64] or "feng-video"


def rate_to_speed(value: str) -> float:
    match = re.fullmatch(r"([+-]?)(\d+(?:\.\d+)?)%", value.strip())
    if not match:
        raise SystemExit(f"invalid --rate value: {value}; expected e.g. +8%")
    amount = float(match.group(2)) / 100.0
    return 1.0 - amount if match.group(1) == "-" else 1.0 + amount


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--title", required=True)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--ratio", default="16:9")
    parser.add_argument("--duration", default="auto")
    parser.add_argument("--voice-profile", default="feng-yunxi", help="profile ID from VOICE_PRESETS.json")
    parser.add_argument("--voice", help="legacy Edge voice ID override; prefer --voice-profile")
    parser.add_argument("--rate", help="optional project speed override, e.g. +8%")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    templates = root / "templates"
    registry = json.loads((templates / "VOICE_PRESETS.json").read_text(encoding="utf-8"))
    profiles = registry.get("profiles") or {}
    if args.voice_profile not in profiles:
        available = ", ".join(sorted(profiles))
        raise SystemExit(f"unknown voice profile: {args.voice_profile}; available: {available}")
    selected_voice = dict(profiles[args.voice_profile])
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    for rel in ["assets/feng", "assets/illustration", "assets/screen", "assets/ui", "html", "audio", "captions", "renders", "review", "work", "timeline", "preview"]:
        (out / rel).mkdir(parents=True, exist_ok=True)

    replacements = {
        "{{TITLE}}": args.title,
        "{{RATIO}}": args.ratio,
        "{{DURATION}}": args.duration,
        "{{CORE_VIEWPOINT}}": "待从文稿提炼",
        "{{CONFLICT}}": "待从文稿提炼",
        "{{AUDIENCE}}": "默认：对主题有兴趣但不是专家的中文观众",
        "{{HOOK}}": "待生成",
        "{{PROMISE}}": "待生成",
        "{{EVIDENCE_SOURCES}}": "待盘点",
        "{{CTA}}": "待确定",
    }
    copied = []
    for path in templates.iterdir():
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for old, new in replacements.items():
            text = text.replace(old, new)
        target = out / path.name
        target.write_text(text, encoding="utf-8")
        copied.append(path.name)

    voice_overrides = {}
    if args.voice:
        voice_overrides["voice_id"] = args.voice
    if args.rate:
        voice_overrides["speed"] = rate_to_speed(args.rate)
    voice_selector = {
        "schema_version": "2.0",
        "profile_id": args.voice_profile,
        "registry_file": "VOICE_PRESETS.json",
        "overrides": voice_overrides,
    }
    (out / "VOICE_PROFILE.json").write_text(json.dumps(voice_selector, ensure_ascii=False, indent=2), encoding="utf-8")

    source_text = ""
    if args.source:
        if not args.source.exists():
            raise SystemExit(f"source not found: {args.source}")
        source_text = args.source.read_text(encoding="utf-8")
    (out / "source.md").write_text(source_text, encoding="utf-8")
    (out / "script-final.md").write_text(source_text, encoding="utf-8")
    source_hash = hashlib.sha256(source_text.encode("utf-8")).hexdigest()

    phases = {
        f"P{i}": {"status": "pending", "input_hash": None, "output_hash": None, "started_at": None, "ended_at": None, "error": None}
        for i in range(9)
    }
    phases["P0"].update({"status": "completed", "input_hash": source_hash, "ended_at": datetime.now(timezone.utc).isoformat()})
    state = {"schema_version": 1, "source_hash": source_hash, "phases": phases}
    (out / "work/state.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "originality-plan.json").write_text(json.dumps({"scenes": []}, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "assets/manifest.json").write_text(json.dumps({"assets": []}, ensure_ascii=False, indent=2), encoding="utf-8")

    project = {
        "schema_version": "2.0",
        "title": args.title,
        "slug": slugify(args.title),
        "ratio": args.ratio,
        "resolution": {"width": 1920, "height": 1080} if args.ratio == "16:9" else None,
        "fps": 30,
        "duration_target": args.duration,
        "voice_profile": args.voice_profile,
        "voice": voice_overrides.get("voice_id", selected_voice.get("voice_id")),
        "voice_rate": voice_overrides.get("speed", selected_voice.get("speed")),
        "character_skill": "feng-ip",
        "renderer_skills": ["html-video", "broll-hyperframes"],
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "source": str(args.source.resolve()) if args.source else None,
        "status": "scaffolded",
    }
    (out / "PROJECT.json").write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": True, "project": str(out), "templates": copied, "source_chars": len(source_text)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
