#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
峰峰 IP 配图人物一致性门禁 (v1.0, 2026-08-20)

用法:
    python3 check_character_consistency.py --anchor A.png --target B.png [--threshold 7] [--json]

两层门禁:
  v1 (默认, 零依赖): 峰峰标志特征色彩签名 + imagehash 结构提示。
      - 深蓝黑发占比 / 白 hoodie 占比 / 深海军蓝夹克占比 / 暖桃肤色占比
      - 锚点图 vs 目标图各特征占比差异越大, 人物特征漂移越严重
      - 构图不同会放大差异, 阈值已放宽; 判 fail 时优先收紧 Prompt 重生成
  v2 (预留, 需可用视觉 key): 设置以下环境变量后自动启用, 调用 OpenAI 兼容视觉模型
      对「锚点图 vs 成图」打分 (0-10, 10=同一人), 替代 v1 作为主判据:
      CONSISTENCY_VISION_API_KEY / CONSISTENCY_VISION_BASE_URL (默认 https://api.openai.com/v1)
      CONSISTENCY_VISION_MODEL (默认 gpt-4o-mini)

输出:
  score 0-10, verdict: pass(>=threshold) | warn(<threshold 且 >=5) | fail(<5)
  exit code: 0=pass, 1=warn, 2=fail, 3=错误

说明:
  v1 是"特征保真度"而非"人脸相似度"。脸部长相是否同一人, 在无视觉 key / 无 GPU 时
  仍需人眼复核; 有可用视觉 key 后启用 v2 可做脸级自动门禁。
"""
import argparse
import base64
import io
import json
import os
import sys

from PIL import Image

try:
    import imagehash
    HAS_IMAGEHASH = True
except Exception:
    HAS_IMAGEHASH = False


def _b64_small(path, size=768):
    im = Image.open(path).convert("RGB")
    im.thumbnail((size, size))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=88)
    return base64.b64encode(buf.getvalue()).decode()


def color_signature(path):
    """计算峰峰特征色占比签名。"""
    im = Image.open(path).convert("RGB")
    im.thumbnail((1024, 1024))
    px = im.load()
    w, h = im.size
    total = max(w * h, 1)
    cnt = {"hair_navy_black": 0, "hoodie_white": 0, "jacket_navy": 0, "skin_peach": 0}
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            # 深蓝黑发: 蓝高于红, 整体深色
            if b > r + 15 and r < 90 and g < r + 10:
                cnt["hair_navy_black"] += 1
            # 白 hoodie: 近白
            elif r > 215 and g > 215 and b > 215:
                cnt["hoodie_white"] += 1
            # 深海军蓝夹克: 蓝显著, 中等亮度
            elif b > 90 and b > r + 30 and 40 < g < 180:
                cnt["jacket_navy"] += 1
            # 暖桃肤色: 红>蓝, 暖调
            elif r > 140 and r > b + 25 and 90 < g < 215 and b < 200:
                cnt["skin_peach"] += 1
    return {k: v / total for k, v in cnt.items()}


def v1_score(anchor_path, target_path):
    sig_a = color_signature(anchor_path)
    sig_t = color_signature(target_path)
    diff = {k: abs(sig_a[k] - sig_t[k]) for k in sig_a}
    score = 10.0
    notes = []
    # 特征存在性: 目标图峰峰标志特征远低于锚点图基准 => 人物缺失/风格漂移, 重罚
    min_skin = max(0.01, sig_a["skin_peach"] * 0.4)
    min_navy = max(0.003, sig_a["jacket_navy"] * 0.4)
    min_hair = max(0.005, sig_a["hair_navy_black"] * 0.4)
    if sig_t["skin_peach"] < min_skin:
        score -= 3.0
        notes.append("目标图暖桃肤色缺失 (人物脸/手可能漂移)")
    if sig_t["jacket_navy"] < min_navy:
        score -= 3.0
        notes.append("目标图深海军蓝夹克色缺失 (服装漂移)")
    if sig_t["hair_navy_black"] < min_hair:
        score -= 2.0
        notes.append("目标图深蓝黑发色缺失 (发色漂移)")
    # 特征占比差异: 与锚点图相比明显偏差
    if diff["hair_navy_black"] > 0.05:
        score -= 2.0
        notes.append(f"发色占比差 {diff['hair_navy_black']:.3f}")
    if diff["hoodie_white"] > 0.12:
        score -= 1.0
        notes.append(f"hoodie 白色占比差 {diff['hoodie_white']:.3f}")
    if diff["jacket_navy"] > 0.05:
        score -= 2.0
        notes.append(f"夹克深蓝占比差 {diff['jacket_navy']:.3f}")
    if diff["skin_peach"] > 0.05:
        score -= 1.5
        notes.append(f"肤色占比差 {diff['skin_peach']:.3f}")
    hash_dist = None
    if HAS_IMAGEHASH:
        h1 = imagehash.dhash(Image.open(anchor_path).convert("RGB"))
        h2 = imagehash.dhash(Image.open(target_path).convert("RGB"))
        hash_dist = int(h1 - h2)
        if hash_dist > 30:
            score -= 1.0
            notes.append(f"整体构图差异大 (dhash={hash_dist})")
    score = max(0.0, min(10.0, round(score, 1)))
    return score, {"method": "v1-signature", "diff": {k: round(v, 4) for k, v in diff.items()},
                   "target_sig": {k: round(v, 4) for k, v in sig_t.items()},
                   "dhash": hash_dist, "notes": notes}


def v2_vision_score(anchor_path, target_path):
    key = os.environ.get("CONSISTENCY_VISION_API_KEY", "")
    base_url = os.environ.get("CONSISTENCY_VISION_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("CONSISTENCY_VISION_MODEL", "gpt-4o-mini")
    if not key:
        return None, "CONSISTENCY_VISION_API_KEY not set"
    import urllib.request
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": (
                "Compare these two images. They should show the SAME anime-style male character "
                "(deep navy-blue-black short hair, natural heroic eyebrows, gentle dark eyes, "
                "white hoodie, dark navy jacket, warm peach skin tone). "
                "Rate character identity consistency 0-10 (10 = clearly the same character). "
                'Reply in JSON only: {"score": <0-10>, "reason": "<one short sentence in Chinese>"}'
            )},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{_b64_small(anchor_path)}"}},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{_b64_small(target_path)}"}},
        ]}],
        "max_tokens": 300,
    }
    req = urllib.request.Request(
        base_url + "/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode())
    content = data["choices"][0]["message"]["content"]
    m = json.loads(content)
    return float(m["score"]), m.get("reason", "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--anchor", required=True, help="身份锚点图路径")
    ap.add_argument("--target", required=True, help="待检成图路径")
    ap.add_argument("--threshold", type=float, default=7.0)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    try:
        score, detail = v1_score(args.anchor, args.target)
        method = "v1-signature"
        if os.environ.get("CONSISTENCY_VISION_API_KEY"):
            v2, reason = v2_vision_score(args.anchor, args.target)
            if v2 is not None:
                score, method, detail = v2, "v2-vision", {"reason": reason, "v1": detail}
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(3)

    verdict = "pass" if score >= args.threshold else ("warn" if score >= 5 else "fail")
    out = {"score": score, "verdict": verdict, "method": method, "threshold": args.threshold, "detail": detail}
    if args.json:
        print(json.dumps(out, ensure_ascii=False))
    else:
        print(f"score={score}/10 verdict={verdict} method={method}")
        if isinstance(detail, dict) and detail.get("notes"):
            print("notes:", "; ".join(detail["notes"]))
        elif isinstance(detail, dict) and detail.get("reason"):
            print("reason:", detail["reason"])
    sys.exit(0 if verdict == "pass" else (1 if verdict == "warn" else 2))


if __name__ == "__main__":
    main()
