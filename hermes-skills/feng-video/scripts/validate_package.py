#!/usr/bin/env python3
"""Validate a feng-video planning or final production package."""
from __future__ import annotations
import argparse, json, re, subprocess
from pathlib import Path
from validate_action_timeline import validate_scene as validate_action_scene

ALLOWED = {"hook", "metaphor", "diagram", "chapter-card", "code-screen", "browser-demo", "data-chart", "character-beat", "result-proof", "comparison", "summary"}
INTERACTION_MODES = {"none", "gaze-gesture", "surface-contact", "force-contact", "body-support", "locomotion", "handoff", "environment-integrated"}
CONTACT_MODES = {"surface-contact", "force-contact", "body-support", "locomotion", "handoff", "environment-integrated"}
REQUIRED_PLAN = ["PROJECT.json", "source.md", "script-final.md", "BRIEF_DESIGN_PROPOSAL.md", "DESIGN.md", "STORYBOARD.md", "storyboard.json", "BEAT_MAP.json", "MOTION_MAP.json", "SCREEN_RECORDING_PLAN.md", "REVIEW_REPORT.md", "work/state.json", "originality-plan.json", "assets/manifest.json"]
SECRET_KEYS = {"api_key", "token", "secret", "password", "cookie", "credentials", "authorization_header"}


def deep_merge(base: dict, overlay: dict) -> dict:
    merged = dict(base)
    for key, value in overlay.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def embedded_secret_paths(value, trail=()):
    found = []
    if isinstance(value, dict):
        for key, child in value.items():
            current = trail + (key,)
            if key.lower() in SECRET_KEYS and child not in (None, "", "[REDACTED]"):
                found.append(".".join(current))
            found.extend(embedded_secret_paths(child, current))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            found.extend(embedded_secret_paths(child, trail + (str(index),)))
    return found


def chars(text: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]", text or ""))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("project", type=Path)
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--phase", choices=["plan", "final"], default="plan")
    args = parser.parse_args()
    project = args.project.resolve()
    errors, warnings = [], []

    project_data = {}
    project_path = project / "PROJECT.json"
    if project_path.exists():
        try:
            project_data = json.loads(project_path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"invalid_project_json:{exc}")
    project_schema = str(project_data.get("schema_version", "legacy"))
    enforce_voice_profile = project_schema.startswith("2.")
    required_plan = list(REQUIRED_PLAN)
    if enforce_voice_profile:
        required_plan.extend(["VOICE_PROFILE.json", "VOICE_PRESETS.json"])

    for name in required_plan:
        path = project / name
        if not path.exists() or path.stat().st_size == 0:
            errors.append(f"missing_or_empty:{name}")

    resolved_voice_profile = None
    voice_profile_id = None
    voice_path = project / "VOICE_PROFILE.json"
    registry_path = project / "VOICE_PRESETS.json"
    if voice_path.exists():
        try:
            selector = json.loads(voice_path.read_text(encoding="utf-8"))
            secret_paths = embedded_secret_paths(selector)
            if secret_paths:
                errors.append("voice_profile_embedded_credentials:" + ",".join(secret_paths))
            voice_profile_id = selector.get("profile_id")
            registry_candidate = selector.get("registry_file", "VOICE_PRESETS.json")
            registry_path = Path(registry_candidate)
            if not registry_path.is_absolute():
                registry_path = project / registry_path
            if not registry_path.exists():
                errors.append(f"missing_voice_registry:{registry_candidate}")
            else:
                registry = json.loads(registry_path.read_text(encoding="utf-8"))
                secret_paths = embedded_secret_paths(registry)
                if secret_paths:
                    errors.append("voice_registry_embedded_credentials:" + ",".join(secret_paths))
                profiles = registry.get("profiles") or {}
                if voice_profile_id not in profiles:
                    errors.append(f"unknown_voice_profile:{voice_profile_id}")
                else:
                    resolved_voice_profile = deep_merge(profiles[voice_profile_id], selector.get("overrides") or {})
                    required_voice = ["profile_id", "display_name", "provider", "adapter", "voice_id", "language", "speed", "authorization", "output", "fallback_profile_id"]
                    missing_voice = [key for key in required_voice if not resolved_voice_profile.get(key)]
                    if missing_voice:
                        errors.append("voice_profile_missing_fields:" + ",".join(missing_voice))
                    fallback_id = resolved_voice_profile.get("fallback_profile_id")
                    if fallback_id not in profiles:
                        errors.append(f"unknown_fallback_voice_profile:{fallback_id}")
                    if voice_profile_id == "feng-yunxi":
                        if resolved_voice_profile.get("provider") != "edge" or resolved_voice_profile.get("voice_id") != "zh-CN-YunxiNeural":
                            errors.append("feng_yunxi_default_must_resolve_to_edge_yunxi")
                        auth = resolved_voice_profile.get("authorization") or {}
                        if auth.get("type") != "provider_preset" or auth.get("clone") is not False:
                            errors.append("feng_yunxi_must_be_provider_preset_not_clone")
                    if project_data.get("voice_profile") and project_data.get("voice_profile") != voice_profile_id:
                        errors.append("project_voice_profile_mismatch")
        except Exception as exc:
            errors.append(f"invalid_voice_configuration:{exc}")
    elif enforce_voice_profile:
        errors.append("missing_voice_profile")

    storyboard_path = project / "storyboard.json"
    scenes, storyboard_data = [], {}
    if storyboard_path.exists():
        try:
            storyboard_data = json.loads(storyboard_path.read_text(encoding="utf-8"))
            scenes = storyboard_data.get("scenes", [])
        except Exception as exc:
            errors.append(f"invalid_storyboard_json:{exc}")
    if len(scenes) < 3:
        errors.append("storyboard_requires_at_least_3_scenes")
    schema_version = str(storyboard_data.get("schema_version", "legacy"))
    enforce_interactions = schema_version.startswith("2.")
    enforce_action_timeline = schema_version.startswith("2.1") or schema_version.startswith("3.")

    originality_entries = {}
    originality_path = project / "originality-plan.json"
    if originality_path.exists():
        try:
            originality_data = json.loads(originality_path.read_text(encoding="utf-8"))
            originality_entries = {item.get("scene_id"): item for item in originality_data.get("scenes", [])}
        except Exception as exc:
            errors.append(f"invalid_originality_plan:{exc}")

    last_end = 0.0
    templates, feng_count, narration_chars = [], 0, 0
    for i, scene in enumerate(scenes):
        sid = scene.get("id", f"index-{i}")
        template = scene.get("visual_template")
        templates.append(template)
        if template not in ALLOWED:
            errors.append(f"{sid}:invalid_visual_template:{template}")
        source_span = scene.get("source_span") or {}
        if not source_span.get("excerpt"):
            errors.append(f"{sid}:missing_source_span")
        original = originality_entries.get(sid)
        if not original:
            errors.append(f"{sid}:missing_originality_entry")
        else:
            joined = json.dumps(original, ensure_ascii=False)
            if re.search(r"照参考视频|照第.{0,12}[分秒]|同样的角色换成峰峰|逐镜复刻", joined):
                errors.append(f"{sid}:forbidden_imitation_instruction")
        try:
            start, end = float(scene["start"]), float(scene["end"])
        except Exception:
            errors.append(f"{sid}:invalid_time")
            continue
        duration = end - start
        if start < last_end - 0.05:
            errors.append(f"{sid}:timeline_overlap")
        if start - last_end > 1.0:
            warnings.append(f"{sid}:timeline_gap:{start-last_end:.2f}s")
        if duration <= 0:
            errors.append(f"{sid}:nonpositive_duration")
        if template == "chapter-card" and not (0.6 <= duration <= 2.0):
            warnings.append(f"{sid}:chapter_card_duration:{duration:.2f}s")
        elif template in {"code-screen", "browser-demo"} and duration > 18:
            warnings.append(f"{sid}:screen_scene_too_long:{duration:.2f}s")
        elif template not in {"chapter-card", "code-screen", "browser-demo"} and duration > 12:
            warnings.append(f"{sid}:scene_too_long:{duration:.2f}s")
        cap_len = chars(scene.get("caption", ""))
        if cap_len > 20:
            warnings.append(f"{sid}:caption_too_long:{cap_len}")
        narration_chars += chars(scene.get("narration", ""))
        feng_role = scene.get("feng_role", "none")
        if feng_role != "none":
            feng_count += 1
            mode = scene.get("interaction_mode")
            contract = scene.get("interaction_contract") or {}
            def interaction_issue(message: str) -> None:
                (errors if enforce_interactions else warnings).append(f"{sid}:{message}")
            if mode not in INTERACTION_MODES - {"none"}:
                interaction_issue(f"invalid_or_missing_interaction_mode:{mode}")
            required = ["actor", "intent", "action", "target", "motion_or_force", "body_response", "object_response", "occlusion", "result_state"]
            missing = [key for key in required if not contract.get(key)]
            if missing:
                interaction_issue("missing_interaction_contract:" + ",".join(missing))
            if mode in CONTACT_MODES and not contract.get("contact_points"):
                interaction_issue("contact_mode_requires_contact_points")
            if enforce_action_timeline:
                for action_error in validate_action_scene(scene):
                    errors.append(f"{sid}:{action_error}")
            if args.phase == "final" and "DRAFT" in json.dumps(contract, ensure_ascii=False):
                errors.append(f"{sid}:unresolved_draft_interaction_contract")
        elif scene.get("interaction_mode") not in {None, "none"}:
            warnings.append(f"{sid}:interaction_mode_without_feng_role")
        if scene.get("asset_mode") == "real-screen" and scene.get("screen_source") in {None, "", "not-collected"}:
            warnings.append(f"{sid}:real_screen_not_collected")
        last_end = max(last_end, end)

    for i in range(2, len(templates)):
        if templates[i] == templates[i-1] == templates[i-2]:
            errors.append(f"three_consecutive_same_template_at:{i+1}")
    if scenes and scenes[0].get("visual_template") != "hook":
        errors.append("first_scene_must_be_hook")
    if len(scenes) >= 5:
        ratio = feng_count / len(scenes)
        if not (0.10 <= ratio <= 0.35):
            warnings.append(f"feng_scene_ratio:{ratio:.3f}:target_0.15_to_0.25")
    if last_end > 0:
        cpm = narration_chars / last_end * 60
        if not (240 <= cpm <= 380):
            warnings.append(f"narration_rate:{cpm:.1f}_chars_per_minute")
    if last_end > 120 and sum(1 for x in templates if x == "chapter-card") < 2:
        warnings.append("long_video_should_have_at_least_2_chapter_cards")

    if args.phase == "final":
        final_candidates = list((project / "renders").glob("*final*.mp4"))
        edl = project / "timeline/edit-decision-list.json"
        if not edl.exists() or edl.stat().st_size == 0:
            errors.append("missing_final_artifact:timeline/edit-decision-list.json")
        for scene in scenes:
            if scene.get("asset_mode") == "real-screen" and scene.get("screen_source") in {None, "", "not-collected"}:
                errors.append(f"{scene.get('id')}:unproven_real_screen_in_final")
        final_audio_required = [project / "audio/voiceover.mp3", project / "captions/voiceover.srt"]
        if enforce_voice_profile:
            final_audio_required.extend([
                project / "audio/voiceover.wav",
                project / "audio/voice-qa.json",
                project / "audio/pronunciation-log.json",
            ])
        for required in final_audio_required:
            if not required.exists() or required.stat().st_size == 0:
                errors.append(f"missing_final_artifact:{required.relative_to(project)}")
        if not final_candidates:
            errors.append("missing_final_mp4")
        else:
            cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(final_candidates[0])]
            probe = subprocess.run(cmd, capture_output=True, text=True)
            if probe.returncode != 0:
                errors.append("ffprobe_final_mp4_failed")

    report = {
        "ok": not errors,
        "phase": args.phase,
        "project": str(project),
        "project_schema": project_schema,
        "voice_profile_id": voice_profile_id,
        "voice_provider": resolved_voice_profile.get("provider") if resolved_voice_profile else None,
        "voice_id": resolved_voice_profile.get("voice_id") if resolved_voice_profile else None,
        "storyboard_schema": schema_version,
        "scenes": len(scenes),
        "duration": round(last_end, 2),
        "feng_scenes": feng_count,
        "errors": errors,
        "warnings": warnings,
    }
    (project / "validation-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if args.strict and errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
