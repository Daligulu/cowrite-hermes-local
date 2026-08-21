#!/usr/bin/env python3
"""Generate provider-agnostic narration for a feng-video project."""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

SKILL_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY = SKILL_ROOT / "templates/VOICE_PRESETS.json"
DEFAULT_PROFILE = SKILL_ROOT / "templates/VOICE_PROFILE.json"
SECRET_KEYS = {"api_key", "token", "secret", "password", "cookie", "credentials", "authorization_header"}


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SystemExit(f"invalid JSON {path}: {exc}") from exc


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def deep_merge(base: dict, overlay: dict) -> dict:
    merged = dict(base)
    for key, value in overlay.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def reject_embedded_secrets(value: Any, trail: tuple[str, ...] = ()) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower() in SECRET_KEYS and child not in (None, "", "[REDACTED]"):
                raise SystemExit(f"embedded credential forbidden at {'.'.join(trail + (key,))}")
            reject_embedded_secrets(child, trail + (key,))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_embedded_secrets(child, trail + (str(index),))


def resolve_profile(profile_path: Path, registry_path: Path | None, profile_id_override: str | None) -> tuple[dict, dict, Path]:
    selector = read_json(profile_path)
    if registry_path is None:
        candidate = selector.get("registry_file", "VOICE_PRESETS.json")
        candidate_path = Path(candidate)
        registry_path = candidate_path if candidate_path.is_absolute() else profile_path.parent / candidate_path
        if not registry_path.exists():
            registry_path = DEFAULT_REGISTRY
    registry = read_json(registry_path)
    profiles = registry.get("profiles") or {}
    profile_id = profile_id_override or selector.get("profile_id") or registry.get("default_profile_id")
    if profile_id not in profiles:
        raise SystemExit(f"unknown voice profile: {profile_id}; use --list-profiles")
    profile = deep_merge(profiles[profile_id], selector.get("overrides") or {})
    profile["profile_id"] = profile_id
    reject_embedded_secrets(profile)
    return profile, registry, registry_path


def load_adapter(name: str):
    if not re.fullmatch(r"[a-z0-9_-]+", name or ""):
        raise SystemExit(f"invalid adapter name: {name}")
    path = SKILL_ROOT / "scripts/voice_adapters" / f"{name}.py"
    if not path.exists():
        raise SystemExit(f"voice adapter not installed: {name} ({path})")
    spec = importlib.util.spec_from_file_location(f"feng_video_voice_{name}", path)
    if not spec or not spec.loader:
        raise SystemExit(f"cannot load adapter: {name}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not callable(getattr(module, "render", None)):
        raise SystemExit(f"adapter {name} must define render(text_path, work_dir, profile)")
    return module


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, capture_output=True, text=True)


def loudness_analysis(audio: Path, target_i: float, target_tp: float) -> dict:
    command = [
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(audio),
        "-af", f"loudnorm=I={target_i}:TP={target_tp}:LRA=7:print_format=json",
        "-f", "null", "-",
    ]
    result = run(command)
    matches = re.findall(r"\{\s*\"input_i\".*?\}", result.stderr, flags=re.S)
    if not matches:
        raise SystemExit("ffmpeg loudnorm analysis did not return JSON")
    return json.loads(matches[-1])


def normalize(audio: Path, wav_out: Path, profile: dict) -> None:
    output = profile.get("output") or {}
    sample_rate = int(output.get("sample_rate", 48000))
    channels = int(output.get("channels", 1))
    target_i = float(output.get("target_lufs", -16.0))
    target_tp = float(output.get("true_peak_dbtp", -1.0))
    measured = loudness_analysis(audio, target_i, target_tp)
    filt = (
        f"loudnorm=I={target_i}:TP={target_tp}:LRA=7:"
        f"measured_I={measured['input_i']}:measured_LRA={measured['input_lra']}:"
        f"measured_TP={measured['input_tp']}:measured_thresh={measured['input_thresh']}:"
        f"offset={measured['target_offset']}:linear=true:print_format=summary,"
        f"aresample={sample_rate}"
    )
    wav_out.parent.mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(audio),
        "-af", filt, "-ar", str(sample_rate), "-ac", str(channels),
        "-c:a", "pcm_s24le", str(wav_out),
    ])


def make_preview(wav_path: Path, mp3_path: Path, profile: dict) -> None:
    bitrate = str((profile.get("output") or {}).get("preview_bitrate", "192k"))
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav_path),
        "-c:a", "libmp3lame", "-b:a", bitrate, str(mp3_path),
    ])


def probe(path: Path) -> dict:
    result = run([
        "ffprobe", "-v", "error", "-show_entries",
        "stream=codec_name,sample_rate,channels:format=duration,size,bit_rate",
        "-of", "json", str(path),
    ])
    return json.loads(result.stdout)


def measured_summary(path: Path) -> dict:
    result = run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
        "-af", "ebur128=peak=true", "-f", "null", "-",
    ])
    summary = result.stderr.split("Summary:")[-1]
    integrated = re.search(r"I:\s*(-?[0-9.]+) LUFS", summary)
    peak = re.search(r"Peak:\s*(-?[0-9.]+) dBFS", summary)
    return {
        "integrated_lufs": float(integrated.group(1)) if integrated else None,
        "true_peak_dbtp": float(peak.group(1)) if peak else None,
    }


def list_profiles(registry_path: Path) -> int:
    registry = read_json(registry_path)
    default_id = registry.get("default_profile_id")
    rows = []
    for profile_id, profile in (registry.get("profiles") or {}).items():
        rows.append({
            "profile_id": profile_id,
            "default": profile_id == default_id,
            "display_name": profile.get("display_name"),
            "provider": profile.get("provider"),
            "adapter": profile.get("adapter"),
            "voice_id": profile.get("voice_id"),
            "style": profile.get("style"),
        })
    print(json.dumps({"default_profile_id": default_id, "profiles": rows}, ensure_ascii=False, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, help="feng-video project directory")
    parser.add_argument("--text", type=Path, help="narration text; defaults to project/script-final.md")
    parser.add_argument("--profile", type=Path, help="VOICE_PROFILE.json path")
    parser.add_argument("--registry", type=Path, help="VOICE_PRESETS.json path")
    parser.add_argument("--profile-id", help="override selected profile ID")
    parser.add_argument("--out-dir", type=Path, help="audio output directory")
    parser.add_argument("--list-profiles", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.list_profiles:
        return list_profiles((args.registry or DEFAULT_REGISTRY).resolve())

    project = args.project.resolve() if args.project else None
    profile_path = (args.profile or (project / "VOICE_PROFILE.json" if project else DEFAULT_PROFILE)).resolve()
    text_path = (args.text or (project / "script-final.md" if project else None))
    if text_path is None:
        raise SystemExit("--text is required without --project")
    text_path = text_path.resolve()
    if not text_path.exists() or not text_path.read_text(encoding="utf-8").strip():
        raise SystemExit(f"missing or empty narration text: {text_path}")

    registry_path = args.registry.resolve() if args.registry else None
    profile, registry, resolved_registry = resolve_profile(profile_path, registry_path, args.profile_id)
    if args.dry_run:
        print(json.dumps({
            "ok": True,
            "profile": profile,
            "registry": str(resolved_registry),
            "text": str(text_path),
        }, ensure_ascii=False, indent=2))
        return 0

    out_dir = (args.out_dir or (project / "audio" if project else Path.cwd() / "audio")).resolve()
    captions_dir = (project / "captions" if project else out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    captions_dir.mkdir(parents=True, exist_ok=True)
    work_dir = out_dir / ".voice-work"
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True)

    adapter = load_adapter(str(profile.get("adapter") or profile.get("provider")))
    rendered = adapter.render(text_path, work_dir, profile)
    provider_audio = Path(rendered["audio"])
    provider_subtitles = Path(rendered["subtitles"]) if rendered.get("subtitles") else None
    if not provider_audio.exists() or provider_audio.stat().st_size == 0:
        raise SystemExit("provider adapter returned missing audio")

    wav_out = out_dir / "voiceover.wav"
    mp3_out = out_dir / "voiceover.mp3"
    srt_out = captions_dir / "voiceover.srt"
    normalize(provider_audio, wav_out, profile)
    make_preview(wav_out, mp3_out, profile)
    if provider_subtitles and provider_subtitles.exists():
        shutil.copy2(provider_subtitles, srt_out)
        timestamp_status = "provider"
    else:
        timestamp_status = "alignment_required"

    qa = {
        "schema_version": "1.0",
        "ok": True,
        "profile_id": profile["profile_id"],
        "display_name": profile.get("display_name"),
        "provider": profile.get("provider"),
        "adapter": profile.get("adapter"),
        "voice_id": profile.get("voice_id"),
        "authorization_type": (profile.get("authorization") or {}).get("type"),
        "identity_claim": (profile.get("authorization") or {}).get("identity_claim", False),
        "timestamp_status": timestamp_status,
        "master": probe(wav_out),
        "preview": probe(mp3_out),
        "levels": measured_summary(wav_out),
        "fallback_profile_id": profile.get("fallback_profile_id"),
        "credentials_embedded": False,
    }
    write_json(out_dir / "voice-qa.json", qa)
    write_json(out_dir / "pronunciation-log.json", {
        "schema_version": "1.0",
        "profile_id": profile["profile_id"],
        "items": [],
        "status": "pending_manual_review",
    })
    write_json(out_dir / "resolved-voice-profile.json", profile)
    shutil.rmtree(work_dir)

    result = {
        "ok": True,
        "profile_id": profile["profile_id"],
        "voice_id": profile.get("voice_id"),
        "audio_wav": str(wav_out),
        "audio_mp3": str(mp3_out),
        "subtitles": str(srt_out) if srt_out.exists() else None,
        "qa": str(out_dir / "voice-qa.json"),
        "levels": qa["levels"],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        if exc.stderr:
            print(exc.stderr[-4000:], file=sys.stderr)
        raise
