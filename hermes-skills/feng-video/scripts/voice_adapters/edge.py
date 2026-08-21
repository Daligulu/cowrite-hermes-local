from __future__ import annotations

import subprocess
from pathlib import Path


def _rate(speed: float) -> str:
    percent = round((float(speed) - 1.0) * 100)
    return f"{percent:+d}%"


def _pitch(pitch_hz: float) -> str:
    return f"{round(float(pitch_hz)):+d}Hz"


def render(text_path: Path, work_dir: Path, profile: dict) -> dict:
    """Render Edge TTS audio and provider timestamps.

    Adapter contract: return {audio: Path, subtitles: Path|None}.
    """
    work_dir.mkdir(parents=True, exist_ok=True)
    audio = work_dir / "provider-audio.mp3"
    subtitles = work_dir / "provider-subtitles.srt"
    command = [
        "edge-tts",
        "--voice", profile["voice_id"],
        f"--rate={_rate(profile.get('speed', 1.0))}",
        f"--pitch={_pitch(profile.get('pitch_hz', 0))}",
        "--file", str(text_path),
        "--write-media", str(audio),
        "--write-subtitles", str(subtitles),
    ]
    subprocess.run(command, check=True)
    return {"audio": audio, "subtitles": subtitles if subtitles.exists() else None}
