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
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE_URL = os.environ.get("COWRITE_URL", "http://127.0.0.1:4320")
LOCK = Path("/run/cowrite-hermes-worker.lock")
HERMES = os.environ.get("HERMES_BIN", "/root/.local/bin/hermes")
COWRITE_HOME = Path(os.environ.get("COWRITE_HOME", str(Path.home() / ".cowrite")))
STATUS_FILE = COWRITE_HOME / "worker-status.json"
ALERT_FILE = COWRITE_HOME / "worker-alert.json"

PROMPT = r"""你是 Cowrite for Hermes 的定时任务 Worker。只处理一个任务，并对所有外部结果进行真实验证。

严格流程：
1. 调用 mcp_cowrite_cowrite_claim_task，不传 task_id，worker_id 使用 `cowrite-systemd-worker`。若没有排队任务，直接返回 `NO_TASK`，不得改动任何页面。
2. 对已领取任务，先通过 HTTP GET `http://127.0.0.1:4320/api/action-config` 读取该任务 action 的配置（若 GET 失败可用 mcp_cowrite_cowrite_get_status 或直接按 recommendedSkills 兜底）：
   - skills：按配置的 skills 数组逐个 skill_view 加载（可多个）；如果某 Skill 不存在，选择当前 Hermes 中用途最接近的已安装 Skill 并在结果中说明替代关系。
   - prompts：按配置的 prompts 列表（id/role/text）作为本动作的处理提示词；未配置则按 recommendedSkills 默认处理。
   - workflow：按配置的 workflow 步骤顺序执行（load=加载技能、process=用指定 skill+prompt 处理、verify=校验产物、write=写回页面）；未配置 workflow 时默认：加载全部 skills → 用全部 prompts 处理 → 写回页面。
3. 调用 mcp_cowrite_cowrite_get_page 读取 pageId 的最新内容与 revision。根据 action、requirements、anchor 完成真实工作：
   - 信息检索路由（当 requirements 或动作内容含 搜索/收集/寻找/调研/查资料/找资料/了解/汇总/整理信息 等检索意图时，必须先按此路由获取信息，再写回结果；路由逻辑与 Hermes 现有 Web 路由一致）：
     a. 普通网页 / 通用知识 / 海外技术 / 英文资料 → 用 Hermes 原生 Web 工具：web_search 搜索 + web_extract 抓取正文（Tavily 后端；优先 web_search 而非直接猜 URL）。
     b. 中文时效 / 政策 / 金融 / 汇率 / 国内公司产品动态 / 中文事实核查 / 用户说“豆包搜索” → 加载 research/byted-web-search skill（豆包搜索；默认 Custom，明确要全球网页/跨语言长摘要时用 Global；要求只看权威来源时用 --auth-level 1）。
     c. 平台站内内容（小红书、知乎、微博、微信公众号、X/Twitter、B站、YouTube、Reddit、V2EX、GitHub 等）→ 加载 research/agent-reach skill，按其路由规则访问对应平台。
     d. 动态页面（JS 渲染、需交互/登录、普通抓取拿不到正文）→ 用 browser 工具访问。
     e. 已知 URL 的正文读取 → 优先 web_extract，失败再用 browser。
     f. 检索到的资料写回页面时附来源链接；无法核实的信息标注不确定。
   - polish：优化正文并用 expected_revision 写回；
   - illustrate/feng-ip：真实生成图片、上传 Cowrite，按 anchor 插入；
   - slides：真实生成 PPTX/HTML，上传并把链接写回页面；
   - wechat-layout/xiaohongshu/feishu-doc/knowledge-base/video：调用对应 Skill 真实生成或发布，验证产物，再把可用链接或结果写回页面。
   - wechat-sticker：制作微信贴图草稿，固定顺序：① 按 requirements 中的主题搜索相关内容（走信息检索路由）；② 先写 280-320 字文案（分段，加 ①②③ 编号，humanizer-zh 润色）；③ 根据文案用 ApiYi 真实文生图生成 3:4 竖版贴图（推荐 1080×1440）；④ 新建独立页面《贴图草稿·主题》，顶部嵌图 + 正文为文案。只建草稿页，不发布。requirements 中「风格：xxx」为可选风格（预设或手动描述），用于出图 prompt。
   - publish-sticker：发布当前页到微信公众号草稿箱（不群发）。校验页面标题带「贴图草稿·」前缀；提取第一张图（校验 3:4 竖版）、正文去标题作文案、标题去前缀；用 wechat-sticker-publisher 的 publish_sticker.py --mode newspic 发布，账号取 requirements 中「账号：xxx」（读 /root/.cowrite/wechat-accounts.json 凭据）；成功后把 media_id 与草稿链接写回页面末尾。
   - 自定义 action：按配置的 skills/prompts/workflow 完成处理并写回页面。
4. 写页面前再次读取最新 revision；发生冲突必须重新读取并合并，禁止覆盖用户刚修改的内容。
5. 只有真实产物已验证且页面已写回后，才能调用 mcp_cowrite_cowrite_complete_task。assets 填真实产物路径或链接。
6. 任一环节失败或受阻，必须调用 mcp_cowrite_cowrite_fail_task 写入真实错误，不能把失败标成成功，不能留下 running 状态。
7. 不创建新的定时任务，不处理第二个任务，不输出或记录凭据。
"""

BACKOFF_DELAYS = [30, 60, 120, 240, 480]  # 429/限流时的指数退避，累计约 15 分钟


def http_json(path: str, method: str = "GET", body: dict | None = None, timeout: int = 15):
    data = None if body is None else json.dumps(body).encode()
    request = Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={"content-type": "application/json"},
        method=method,
    )
    with urlopen(request, timeout=timeout) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


def queued_count() -> int:
    last_error: Exception | None = None
    for attempt in range(10):
        try:
            return len(http_json("/api/tasks?status=queued") or [])
        except (URLError, HTTPError) as exc:
            last_error = exc
            if attempt < 9:
                time.sleep(1)
    assert last_error is not None
    raise last_error


def recover_leases() -> None:
    try:
        http_json("/api/tasks/recover", method="POST")
    except Exception:
        pass


def is_rate_limit(output: str) -> bool:
    lowered = output.lower()
    return "429" in output or "usage limit" in lowered or "rate limit" in lowered or "too many requests" in lowered


def fail_stale_running_tasks(reason: str) -> None:
    """If the agent exited abnormally, any task it had claimed must not stay running forever."""
    try:
        tasks = http_json("/api/tasks?status=running") or []
    except Exception:
        return
    for task in tasks:
        worker_id = task.get("workerId") or ""
        if not worker_id.startswith("cowrite"):
            continue
        try:
            http_json(
                f"/api/tasks/{task['id']}/fail",
                method="POST",
                body={"error": f"Worker 异常退出，任务已自动标记失败，可在任务中心重试。原因：{reason}"},
            )
        except Exception:
            pass


def write_status(payload: dict) -> None:
    COWRITE_HOME.mkdir(parents=True, exist_ok=True)
    STATUS_FILE.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def write_alert(error: str) -> None:
    COWRITE_HOME.mkdir(parents=True, exist_ok=True)
    ALERT_FILE.write_text(
        json.dumps({"error": error[:2000], "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, ensure_ascii=False),
        encoding="utf-8",
    )


def clear_alert() -> None:
    ALERT_FILE.unlink(missing_ok=True)


def run_agent_with_backoff(worker_id: str, env: dict) -> tuple[bool, str, float, int]:
    """Run hermes chat with exponential backoff on rate limits. Returns (ok, output, duration_sec, retries)."""
    for attempt in range(len(BACKOFF_DELAYS) + 1):
        started = time.monotonic()
        completed = subprocess.run(
            [HERMES, "chat", "-Q", "--yolo", "--source", "cowrite-worker", "--max-turns", "120", "-q", PROMPT],
            env=env,
            text=True,
            capture_output=True,
            timeout=1800,
        )
        duration = time.monotonic() - started
        output = f"{completed.stdout or ''}\n{completed.stderr or ''}".strip()
        if completed.returncode == 0:
            return True, output, duration, attempt
        if is_rate_limit(output) and attempt < len(BACKOFF_DELAYS):
            print(f"rate limited, backing off {BACKOFF_DELAYS[attempt]}s (attempt {attempt + 1})", file=sys.stderr)
            time.sleep(BACKOFF_DELAYS[attempt])
            continue
        return False, output, duration, attempt
    return False, "", 0.0, len(BACKOFF_DELAYS)


def main() -> int:
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    with LOCK.open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0

        recover_leases()

        if queued_count() == 0:
            write_status({"lastRunAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "lastResult": "no_tasks", "lastError": None, "lastErrorAt": None, "lastDurationSec": 0, "lastRetries": 0})
            return 0

        worker_id = f"cowrite-worker-{socket.gethostname()}-{os.getpid()}"
        env = os.environ.copy()
        env["COWRITE_WORKER_ID"] = worker_id

        ok, output, duration, retries = run_agent_with_backoff(worker_id, env)

        if ok:
            write_status({"lastRunAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "lastResult": "ok", "lastError": None, "lastErrorAt": None, "lastDurationSec": round(duration, 1), "lastRetries": retries})
            clear_alert()
            return 0

        error_tail = output[-2000:] if output else "hermes chat 异常退出，无输出"
        write_status({"lastRunAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "lastResult": "error", "lastError": error_tail, "lastErrorAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "lastDurationSec": round(duration, 1), "lastRetries": retries})
        write_alert(error_tail)
        fail_stale_running_tasks(error_tail)
        return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"cowrite worker failed before/after agent execution: {exc}", file=sys.stderr)
        write_status({"lastRunAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "lastResult": "error", "lastError": str(exc), "lastErrorAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "lastDurationSec": 0, "lastRetries": 0})
        write_alert(str(exc))
        raise
