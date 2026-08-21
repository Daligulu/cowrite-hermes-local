#!/usr/bin/env python3
"""Cross-process, evenly-spaced rate limiter for the Byted Web Search API."""

from __future__ import annotations

import fcntl
import os
import time
from pathlib import Path
from typing import Callable, Union

PathLike = Union[str, os.PathLike[str]]


class FileRateLimiter:
    """Serialize callers through one file and enforce a maximum request rate.

    Holding the advisory lock while sleeping provides a small local FIFO-like queue.
    The state stores the wall-clock timestamp of the most recently released slot so
    independent Hermes/cron processes share the same four-QPS budget.
    """

    def __init__(
        self,
        state_path: PathLike,
        qps: float = 4.0,
        clock: Callable[[], float] = time.time,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        if qps <= 0:
            raise ValueError("qps must be greater than zero")
        self.state_path = Path(state_path).expanduser()
        self.interval = 1.0 / qps
        self.clock = clock
        self.sleeper = sleeper

    def acquire(self) -> float:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        with self.state_path.open("a+", encoding="utf-8") as handle:
            os.chmod(self.state_path, 0o600)
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            handle.seek(0)
            raw = handle.read().strip()
            try:
                last_slot = float(raw) if raw else 0.0
            except ValueError:
                last_slot = 0.0

            now = self.clock()
            wait_for = max(0.0, last_slot + self.interval - now)
            if wait_for:
                self.sleeper(wait_for)
                now = self.clock()

            slot = max(now, last_slot + self.interval)
            handle.seek(0)
            handle.truncate()
            handle.write(f"{slot:.9f}\n")
            handle.flush()
            os.fsync(handle.fileno())
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
            return slot


def default_state_path(version: str = "custom") -> Path:
    if version not in {"custom", "global"}:
        raise ValueError(f"unsupported search version: {version}")
    hermes_home = Path(os.environ.get("HERMES_HOME", "~/.hermes")).expanduser()
    return hermes_home / "state" / "byted-web-search" / f"rate-limit-{version}.state"
