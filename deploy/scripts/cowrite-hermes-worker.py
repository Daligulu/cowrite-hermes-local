#!/usr/bin/env python3
from __future__ import annotations

import fcntl
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

BASE_URL = os.environ.get("COWRITE_URL", "http://127.0.0.1:4320")
LOCK = Path("/run/cowrite-hermes-worker.lock")
HERMES = os.environ.get("HERMES_BIN", "/root/.local/bin/hermes")

PROMPT = r"""你是 Cowrite for Hermes 的定时任务 Worker。只处理一个任务，并对所有外部结果进行真实验证。

严格流程：
1. 调用 mcp_cowrite_cowrite_claim_task，不传 task_id，worker_id 使用 `cowrite-systemd-worker`。若没有排队任务，直接返回 `NO_TASK`，不得改动任何页面。
2. 对已领取任务逐一调用 skill_view 加载 task.recommendedSkills；如果推荐 Skill 不存在，选择当前 Hermes 中用途最接近的已安装 Skill并在结果中说明替代关系。
3. 调用 mcp_cowrite_cowrite_get_page 读取 pageId 的最新内容与 revision。根据 action、requirements、anchor 完成真实工作：
   - polish：优化正文并用 expected_revision 写回；
   - illustrate/feng-ip：真实生成图片、上传 Cowrite，按 anchor 插入；
   - slides：真实生成 PPTX/HTML，上传并把链接写回页面；
   - wechat-layout/xiaohongshu/feishu-doc/knowledge-base/video：调用对应 Skill 真实生成或发布，验证产物，再把可用链接或结果写回页面。
4. 写页面前再次读取最新 revision；发生冲突必须重新读取并合并，禁止覆盖用户刚修改的内容。
5. 只有真实产物已验证且页面已写回后，才能调用 mcp_cowrite_cowrite_complete_task。assets 填真实产物路径或链接。
6. 任一环节失败或受阻，必须调用 mcp_cowrite_cowrite_fail_task 写入真实错误，不能把失败标成成功，不能留下 running 状态。
7. 不创建新的定时任务，不处理第二个任务，不输出或记录凭据。
"""


def queued_count() -> int:
    last_error: Exception | None = None
    for attempt in range(10):
        try:
            with urlopen(f"{BASE_URL}/api/tasks?status=queued", timeout=10) as response:
                data = json.load(response)
            return len(data) if isinstance(data, list) else 0
        except URLError as exc:
            last_error = exc
            if attempt < 9:
                time.sleep(1)
    assert last_error is not None
    raise last_error


def main() -> int:
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    with LOCK.open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0
        if queued_count() == 0:
            return 0
        worker_id = f"cowrite-worker-{socket.gethostname()}-{os.getpid()}"
        env = os.environ.copy()
        env["COWRITE_WORKER_ID"] = worker_id
        completed = subprocess.run(
            [HERMES, "chat", "-Q", "--yolo", "--source", "cowrite-worker", "--max-turns", "120", "-q", PROMPT],
            env=env,
            text=True,
            timeout=1800,
        )
        return completed.returncode


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"cowrite worker failed before/after agent execution: {exc}", file=sys.stderr)
        raise
