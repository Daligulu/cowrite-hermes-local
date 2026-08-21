#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
峰峰 IP 批量配图脚本 v1.0 (2026-08-20)
========================================
把「选锚点图 → 组装身份块 → gpt-image-2-vip 生成 → 门禁 → 重试」全部固定在此脚本内，
worker/agent 只负责提供场景描述列表。杜绝子会话自行编排导致的身份漂移。

用法:
  python3 feng_ip_batch.py --out-dir <dir> --scenes-file <file>
  python3 feng_ip_batch.py --out-dir <dir> --scene "场景1" --scene "场景2"

选项:
  --out-dir DIR      输出目录（必须）
  --scenes-file FILE 场景描述文件，每行一个场景（空行跳过）
  --scene TEXT       单个场景描述，可重复（与 scenes-file 二选一或并存）
  --anchor PATH      身份锚点图，默认 Canon/07_crossed.png
  --reference PATH   动作参考图，可重复（可选）
  --model NAME       默认 gpt-image-2-vip（A/B 实测锁身份最强）
  --aspect STR       默认 landscape（16:9）
  --threshold N      门禁阈值，默认 7.0
  --max-retries N    每张门禁不过时的重试次数，默认 2
  --json             输出 JSON 摘要到 stdout（worker 解析用）

退出码: 0=全部 pass；1=存在 warn 但无 fail；2=存在 fail（worker 应上报）
"""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

# --- 常量（勿在调用方改写）---
DEFAULT_ANCHOR = "/root/Documents/Obsidian Vault/30-Assets/PersonalBrand/峰峰IP-Canon/07_crossed.png"
APIYI = os.path.expanduser("~/.hermes/skills/creative/apiyi-image-generation/scripts/apiyi_image.py")
GATE = os.path.expanduser("~/.hermes/skills/creative/feng-ip/scripts/check_character_consistency.py")

ID_BLOCK = (
    "Quirky hand-drawn editorial sketch style. The SAME male character as in the reference images: "
    "a young adult male Japanese 2D anime character with no glasses, thick short deep navy-black hair "
    "with a natural side part and defined loose spikes, slightly long oval face, natural clear heroic "
    "eyebrows with a gentle arch, warm open dark eyes with visible pupils and small highlights, "
    "restrained friendly smile; face, ears, neck and every visible hand filled with a natural warm peach "
    "skin tone (never white/gray). Wearing a bright white hoodie with visible hood, collar and two "
    "drawstrings, plus a deep navy jacket with lapels and pockets. White background, black ink linework, "
    "minimal soft blue and soft orange accents; Feng must be the main actor performing the core "
    "information-bearing action. No text, no letters, no words, no watermark, no empty text boxes."
)


def run(cmd, timeout=400):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def generate_one(model, prompt, refs, aspect, out_path):
    cmd = ["python3", APIYI, "--model", model, "--prompt", prompt,
           "--aspect-ratio", aspect, "--output", out_path]
    for r in refs:
        cmd += ["--reference-image", r]
    r = run(cmd)
    ok = os.path.exists(out_path) and os.path.getsize(out_path) > 0
    return ok, r.stdout[:200], r.stderr[:200]


def gate_one(anchor, img):
    r = run(["python3", GATE, "--anchor", anchor, "--target", img, "--json"], timeout=120)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"score": 0.0, "verdict": "fail", "error": r.stdout[:200] + r.stderr[:200]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--scenes-file")
    ap.add_argument("--scene", action="append", default=[])
    ap.add_argument("--anchor", default=DEFAULT_ANCHOR)
    ap.add_argument("--reference", action="append", default=[])
    ap.add_argument("--model", default="gpt-image-2-vip")
    ap.add_argument("--aspect", default="landscape")
    ap.add_argument("--threshold", type=float, default=7.0)
    ap.add_argument("--max-retries", type=int, default=2)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    scenes = list(args.scene)
    if args.scenes_file:
        with open(args.scenes_file, encoding="utf-8") as f:
            scenes += [ln.strip() for ln in f if ln.strip()]

    if not scenes:
        print(json.dumps({"error": "no scenes provided"}, ensure_ascii=False) if args.json
              else "ERROR: no scenes provided")
        return 2

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    refs = [args.anchor] + args.reference

    results = []
    worst = 0  # 0 pass / 1 warn / 2 fail
    for i, scene in enumerate(scenes, 1):
        out_path = str(out_dir / f"0{i}.png")
        prompt = f"{ID_BLOCK} Scene: {scene}"
        score, verdict, retries = 0.0, "fail", 0
        attempts = 1 + args.max_retries
        for attempt in range(attempts):
            t0 = time.time()
            ok, so, se = generate_one(args.model, prompt, refs, args.aspect, out_path)
            dt = round(time.time() - t0, 1)
            if not ok:
                print(f"[{i}] gen failed attempt {attempt + 1}: {se or so}", file=sys.stderr)
                continue
            g = gate_one(args.anchor, out_path)
            score, verdict = g.get("score", 0.0), g.get("verdict", "fail")
            retries = attempt
            print(f"[{i}] attempt {attempt + 1} score={score} verdict={verdict} ({dt}s)")
            if verdict == "pass" or score >= args.threshold:
                break
        if score >= args.threshold:
            pass
        elif verdict in ("warn",) or score >= args.threshold - 2:
            worst = max(worst, 1)
        else:
            worst = 2
        results.append({"index": i, "scene": scene[:80], "path": out_path,
                        "score": score, "verdict": verdict, "retries": retries})

    summary = {"model": args.model, "anchor": args.anchor, "threshold": args.threshold,
               "images": results, "worst": worst}
    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        for r in results:
            print(f"{r['path']}  score={r['score']}  verdict={r['verdict']}  retries={r['retries']}")
    return worst


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(2)
