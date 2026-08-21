import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "validate_action_timeline.py"
spec = importlib.util.spec_from_file_location("validate_action_timeline", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
validate_scene = module.validate_scene


def phases(contact=True):
    return [
        {"name": "anticipation", "start": 0.0, "end": 0.5, "contact": False},
        {"name": "contact", "start": 0.5, "end": 0.8, "contact": True},
        {"name": "manipulation", "start": 0.8, "end": 1.6, "contact": contact},
        {"name": "release", "start": 1.6, "end": 1.8, "contact": False},
        {"name": "result", "start": 1.8, "end": 2.4, "contact": False},
    ]


def test_rejects_static_overlay_for_force_contact():
    scene = {"id": "s1", "feng_role": "operator", "interaction_mode": "force-contact", "motion_strategy": "static-overlay", "action_phases": phases()}
    assert "static_overlay_forbidden_for_contact" in validate_scene(scene)


def test_rejects_contact_loss_during_manipulation():
    scene = {"id": "s1", "feng_role": "operator", "interaction_mode": "surface-contact", "motion_strategy": "anchored-micro-motion", "action_phases": phases(contact=False)}
    assert "manipulation_must_preserve_contact" in validate_scene(scene)


def test_accepts_anchored_micro_motion_for_simple_press():
    scene = {"id": "s1", "feng_role": "operator", "interaction_mode": "surface-contact", "motion_strategy": "anchored-micro-motion", "action_phases": phases()}
    assert validate_scene(scene) == []


def test_force_contact_pose_sequence_requires_three_poses():
    scene = {"id": "s1", "feng_role": "operator", "interaction_mode": "force-contact", "motion_strategy": "pose-sequence", "pose_count": 2, "action_phases": phases()}
    assert "pose_sequence_requires_at_least_3_poses" in validate_scene(scene)
