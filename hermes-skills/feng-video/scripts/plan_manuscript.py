#!/usr/bin/env python3
"""Estimate timing, scene budget, evidence quota, and Feng-IP beats for feng-video."""
from __future__ import annotations
import argparse, json, math, re
from pathlib import Path

TECH = re.compile(r"代码|模型|API|数据库|性能|测试|编译|终端|算法|系统|软件|产品|网页|工具|框架|部署|开源|参数|数据")
EVIDENCE = re.compile(r"\d|提升|下降|快|慢|成功|失败|通过|准确|耗时|性能|跑分|测试|实测|结果|对比|证明|验证")
TURN = re.compile(r"但是|然而|却|没想到|失败|意外|纠结|选择|决定|惊讶|问题|风险")

def clean(text: str) -> str:
    text = re.sub(r"^\s{0,3}#{1,6}\s*", "", text, flags=re.M)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.M)
    return text.strip()

def units(text: str) -> list[str]:
    return [x.strip() for x in re.split(r"(?<=[。！？!?；;])|\n+", clean(text)) if x.strip()]

def count_chars(text: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]", text))

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("source", type=Path)
    ap.add_argument("--duration", type=float, help="target seconds; omit for natural duration")
    ap.add_argument("--chars-per-minute", type=float, default=320.0)
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()
    text = args.source.read_text(encoding="utf-8")
    seq = units(text)
    n_chars = count_chars(text)
    natural = max(1.0, n_chars / args.chars_per_minute * 60.0)
    duration = args.duration or natural
    compression = n_chars / max(1.0, duration / 60.0 * args.chars_per_minute)
    technical_score = (len(TECH.findall(text)) / max(1, len(seq)))
    technical = technical_score >= 0.22
    target_median = 4.8 if duration <= 30 else 5.4
    scene_count = max(3, round(duration / target_median))
    if duration <= 18:
        scene_count = 4
    evidence_ratio = 0.36 if technical else 0.18
    evidence_scenes = max(1 if technical else 0, round(scene_count * evidence_ratio))
    feng_scenes = max(1, round(scene_count * 0.20))
    feng_scenes = min(feng_scenes, max(1, math.floor(scene_count * 0.25)))
    chapter_cards = 0 if duration < 90 else (2 if duration <= 240 else max(3, round(duration / 100)))
    evidence_candidates = [u for u in seq if EVIDENCE.search(u)]
    turn_candidates = [u for u in seq if TURN.search(u)]
    warnings = []
    if compression > 1.12:
        warnings.append("target_duration_requires_compression_or_faster_than_default_narration")
    if technical and not evidence_candidates:
        warnings.append("technical_manuscript_has_no_explicit_evidence_cue; collect real proof before final render")
    plan = {
        "schema_version": "1.0",
        "source": str(args.source.resolve()),
        "effective_chars": n_chars,
        "natural_duration_seconds": round(natural, 2),
        "target_duration_seconds": round(duration, 2),
        "compression_ratio": round(compression, 3),
        "technical": technical,
        "technical_score": round(technical_score, 3),
        "scene_budget": {
            "total": scene_count,
            "target_median_seconds": target_median,
            "hook_deadline_seconds": min(12.0, max(3.0, duration * 0.08)),
            "evidence_scenes": evidence_scenes,
            "feng_ip_scenes": feng_scenes,
            "chapter_cards": chapter_cards,
            "white_animation_ratio_target": [0.55, 0.70] if technical else [0.70, 0.90],
            "real_evidence_ratio_target": [0.30, 0.45] if technical else [0.10, 0.25]
        },
        "required_arc": ["hook", "explain", "process_or_mechanism", "proof", "judgment"],
        "evidence_candidates": evidence_candidates,
        "turn_candidates": turn_candidates,
        "warnings": warnings
    }
    payload = json.dumps(plan, ensure_ascii=False, indent=2)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(payload + "\n", encoding="utf-8")
    print(payload)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
