#!/usr/bin/env python3
"""Create a mechanical first-pass storyboard from a Chinese manuscript.

The output is deliberately a draft: the agent must refine visual metaphors,
evidence sources, Feng actions, and chapter structure before production.
"""
from __future__ import annotations
import argparse, json, re
from pathlib import Path

ALLOWED = {"hook", "metaphor", "diagram", "chapter-card", "code-screen", "browser-demo", "data-chart", "character-beat", "result-proof", "comparison", "summary"}


def clean_text(text: str) -> str:
    lines = []
    for line in text.splitlines():
        line = re.sub(r"^\s{0,3}#{1,6}\s*", "", line).strip()
        line = re.sub(r"^[-*+]\s+", "", line)
        if line:
            lines.append(line)
    return "\n".join(lines)


def split_units(text: str) -> list[str]:
    raw = [s.strip() for s in re.split(r"(?<=[。！？!?；;])|\n+", clean_text(text)) if s.strip()]
    units, buf = [], ""
    for sentence in raw:
        if len(buf) + len(sentence) <= 46:
            buf += sentence
        else:
            if buf:
                units.append(buf)
            while len(sentence) > 52:
                cut = max(sentence.rfind("，", 0, 42), sentence.rfind(",", 0, 42))
                if cut < 16:
                    cut = 42
                units.append(sentence[:cut + 1].strip())
                sentence = sentence[cut + 1:].strip()
            buf = sentence
    if buf:
        units.append(buf)
    return [u for u in units if u]


def classify(text: str, index: int, total: int) -> str:
    if index == 0:
        return "hook"
    if index == total - 1:
        return "summary"
    if re.search(r"代码|终端|命令|编译|报错|日志|仓库|源码", text):
        return "code-screen"
    if re.search(r"测试|结果|性能|提升|下降|数据|准确|耗时|对比", text):
        return "result-proof"
    if re.search(r"但是|然而|却|没想到|意外|失败|纠结|睡觉|惊讶", text):
        return "character-beat"
    if re.search(r"首先|其次|然后|接着|步骤|流程|模块|架构", text):
        return "diagram"
    if re.search(r"为什么|本质|意味着|就像|比如|原理|理解为", text):
        return "metaphor"
    return "diagram" if index % 2 == 0 else "metaphor"


def caption(text: str) -> str:
    value = re.sub(r"[，。！？!?；;：:]", "", text)
    return value[:18]


def actions_for(template: str) -> list[str]:
    return {
        "hook": ["reveal", "emphasize"],
        "metaphor": ["reveal", "connect", "transform"],
        "diagram": ["reveal", "connect", "write-state"],
        "code-screen": ["crop", "highlight", "zoom"],
        "result-proof": ["compare", "check", "emphasize"],
        "character-beat": ["react", "decide"],
        "summary": ["collect", "hold"],
    }.get(template, ["reveal", "hold"])


def action_phases(duration: float, contact: bool) -> list[dict]:
    cuts = [0.0, 0.16, 0.30, 0.70, 0.84, 1.0]
    names = ["anticipation", "contact", "manipulation", "release", "result"]
    values = []
    for i, name in enumerate(names):
        values.append({
            "name": name,
            "start": round(duration * cuts[i], 2),
            "end": round(duration * cuts[i + 1], 2),
            "contact": bool(contact and name in {"contact", "manipulation"}),
        })
    return values


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("project", type=Path)
    parser.add_argument("--chars-per-second", type=float, default=5.4)
    args = parser.parse_args()
    project = args.project.resolve()
    source = project / "script-final.md"
    if not source.exists() or not source.read_text(encoding="utf-8").strip():
        source = project / "source.md"
    if not source.exists() or not source.read_text(encoding="utf-8").strip():
        raise SystemExit("source.md/script-final.md is empty")

    units = split_units(source.read_text(encoding="utf-8"))
    if not units:
        raise SystemExit("no narration units found")
    project_data = json.loads((project / "PROJECT.json").read_text(encoding="utf-8"))
    title = project_data["title"]
    scenes, cursor = [], 0.0
    previous = None
    for i, unit in enumerate(units):
        template = classify(unit, i, len(units))
        if template == previous:
            if template == "code-screen":
                template = "diagram"
            elif template == "result-proof":
                template = "data-chart"
            else:
                template = "metaphor" if template != "metaphor" else "diagram"
        duration = max(3.0, min(12.0, len(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]", unit)) / args.chars_per_second + 0.8))
        role = "none"
        if i == 0:
            role = "question"
        elif template == "character-beat":
            role = "reaction"
        elif i == len(units) - 1:
            role = "summary"
        elif i % 6 == 0:
            role = "operator"
        asset_mode = "real-screen" if template in {"code-screen", "browser-demo"} else ("hybrid" if role != "none" else "code")
        if role == "none":
            interaction_mode = "none"
            interaction_contract = None
            motion_strategy = "none"
            phases = []
        elif role == "operator":
            interaction_mode = "force-contact"
            motion_strategy = "integrated-frame"
            phases = action_phases(duration, contact=True)
            interaction_contract = {
                "actor": "Feng", "intent": "DRAFT—明确动作目的", "action": "DRAFT—具体可见动词",
                "target": "DRAFT—动作对象及部位", "contact_points": ["DRAFT—身体部位 ↔ 对象部位"],
                "motion_or_force": "DRAFT—方向/旋转轴/受力", "body_response": "DRAFT—重心与关节响应",
                "object_response": "DRAFT—对象可见变化", "occlusion": "DRAFT—接触处前后遮挡",
                "result_state": "DRAFT—动作完成后的可验证状态",
            }
        else:
            interaction_mode = "gaze-gesture"
            motion_strategy = "static-overlay"
            phases = action_phases(duration, contact=False)
            interaction_contract = {
                "actor": "Feng", "intent": "DRAFT—明确叙事目的", "action": "DRAFT—观察/指向/反应",
                "target": "DRAFT—视线或手势目标", "contact_points": [],
                "motion_or_force": "DRAFT—视线/手势方向", "body_response": "DRAFT—头部、眼神、手势与表情",
                "object_response": "DRAFT—目标强调或无物理变化", "occlusion": "none",
                "result_state": "DRAFT—注意力或情绪结果",
            }
        scene = {
            "id": f"s{i+1:03d}", "title": f"Scene {i+1}",
            "start": round(cursor, 2), "end": round(cursor + duration, 2),
            "narration": unit, "caption": caption(unit),
            "source_span": {"unit_index": i, "excerpt": unit},
            "visual_template": template, "asset_mode": asset_mode,
            "visual_job": "DRAFT—需人工提炼为一个可见主张",
            "main_object": "DRAFT—需从原文选择具体物件",
            "actions": actions_for(template),
            "feng_role": role,
            "feng_asset": f"assets/feng/s{i+1:03d}.png" if role != "none" else None,
            "interaction_mode": interaction_mode,
            "interaction_contract": interaction_contract,
            "motion_strategy": motion_strategy,
            "action_phase_timebase": "scene-relative",
            "action_phases": phases,
            "screen_source": "not-collected" if asset_mode == "real-screen" else None,
            "transition": "object-handoff" if i < len(units) - 1 else "hold",
        }
        scenes.append(scene); cursor += duration; previous = template

    data = {
        "schema_version": "2.1",
        "title": title,
        "resolution": {"width": 1920, "height": 1080},
        "fps": 30,
        "voice_profile": project_data.get("voice_profile"),
        "voice": project_data.get("voice"),
        "voice_rate": project_data.get("voice_rate"),
        "draft": True,
        "scenes": scenes,
    }
    (project / "storyboard.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    originality = {
        "scenes": [
            {
                "scene_id": s["id"],
                "borrowed_grammar": s["visual_template"],
                "new_metaphor": "DRAFT—根据当前文稿重新设计，不复刻参考视频物件或构图",
                "reference_asset_used": False,
                "difference": "人物、文案、物件、镜头顺序和构图均须为新设计",
            }
            for s in scenes
        ]
    }
    (project / "originality-plan.json").write_text(json.dumps(originality, ensure_ascii=False, indent=2), encoding="utf-8")
    md = [f"# STORYBOARD · {title}", "", "> 机械初稿：必须补真实证据、具体物件和峰峰动作后才能制作。", ""]
    for s in scenes:
        md += [f"## {s['id']} · {s['visual_template']}", "", f"- Time：{s['start']:.2f}–{s['end']:.2f}", f"- Narration：{s['narration']}", f"- Caption：{s['caption']}", f"- Asset mode：{s['asset_mode']}", f"- Feng role：{s['feng_role']}", f"- Interaction mode：{s['interaction_mode']}", f"- Interaction contract：{json.dumps(s['interaction_contract'], ensure_ascii=False) if s['interaction_contract'] else 'n/a'}", f"- Actions：{', '.join(s['actions'])}", f"- Screen source：{s['screen_source'] or 'n/a'}", ""]
    (project / "STORYBOARD.md").write_text("\n".join(md), encoding="utf-8")
    print(json.dumps({"ok": True, "scenes": len(scenes), "estimated_duration": round(cursor, 2), "storyboard": str(project / 'storyboard.json')}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
