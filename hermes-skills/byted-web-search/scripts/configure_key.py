#!/usr/bin/env python3
"""Safely manage the local Hermes credential for Byted Web Search."""

from __future__ import annotations

import argparse
import getpass
import os
from pathlib import Path

CUSTOM_KEY_NAME = "WEB_SEARCH_CUSTOM_API_KEY"
GLOBAL_KEY_NAME = "WEB_SEARCH_GLOBAL_API_KEY"
# Backward-compatible alias for callers that configure the default Custom version.
KEY_NAME = CUSTOM_KEY_NAME


def hermes_env_path() -> Path:
    home = Path(os.environ.get("HERMES_HOME", "~/.hermes")).expanduser()
    return home / ".env"


def upsert_env_value(path: Path, name: str, value: str) -> str:
    if not value or "\n" in value or "\r" in value:
        raise ValueError("credential must be one non-empty line")
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    replacement = f"{name}={value}"
    output = []
    replaced = False
    for line in existing:
        if line.lstrip().startswith(f"{name}=") or line.lstrip().startswith(f"export {name}="):
            if not replaced:
                output.append(replacement)
                replaced = True
        else:
            output.append(line)
    if not replaced:
        output.append(replacement)
    path.write_text("\n".join(output).rstrip() + "\n", encoding="utf-8")
    os.chmod(path, 0o600)
    return f"{name} 已安全写入 {path}（权限 0600）"


def remove_env_value(path: Path, name: str) -> str:
    if not path.exists():
        return f"{name} 未配置"
    lines = path.read_text(encoding="utf-8").splitlines()
    kept = [
        line for line in lines
        if not line.lstrip().startswith(f"{name}=")
        and not line.lstrip().startswith(f"export {name}=")
    ]
    path.write_text("\n".join(kept).rstrip() + ("\n" if kept else ""), encoding="utf-8")
    os.chmod(path, 0o600)
    return f"{name} 已从 {path} 删除"


def is_configured(path: Path, name: str) -> bool:
    if not path.exists():
        return False
    return any(
        line.lstrip().startswith(f"{name}=") or line.lstrip().startswith(f"export {name}=")
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines()
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="管理 Hermes 本地豆包搜索凭据（不会回显 Key）")
    parser.add_argument("--version", choices=["custom", "global"], default="custom")
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--set", action="store_true", help="交互式写入 API Key")
    action.add_argument("--status", action="store_true", help="仅检查是否已配置")
    action.add_argument("--remove", action="store_true", help="删除本地 API Key")
    args = parser.parse_args()
    path = hermes_env_path()
    key_name = CUSTOM_KEY_NAME if args.version == "custom" else GLOBAL_KEY_NAME

    if args.status:
        print(f"{key_name}: {'configured' if is_configured(path, key_name) else 'not configured'}")
        print(f"path: {path}")
        return 0 if is_configured(path, key_name) else 1
    if args.remove:
        print(remove_env_value(path, key_name))
        return 0

    value = getpass.getpass(f"火山引擎联网搜索 {args.version} API Key（输入不回显）: ").strip()
    if not value:
        print("未写入：Key 为空")
        return 1
    print(upsert_env_value(path, key_name, value))
    print("请重启 Hermes Gateway/新开会话以加载凭据。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
