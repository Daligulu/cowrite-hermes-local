#!/usr/bin/env python3
"""Render deterministic HTML/GSAP frames through window.seekTo(t)."""
from __future__ import annotations
import argparse
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright


async def render() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--duration", type=float)
    ap.add_argument("--snapshots", default="")
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--quality", type=int, default=91)
    ap.add_argument("--chrome", default="/usr/bin/google-chrome")
    args = ap.parse_args()

    if not args.html.exists():
        raise SystemExit(f"html not found: {args.html}")
    args.out.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            executable_path=args.chrome,
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
        )
        page = await browser.new_page(
            viewport={"width": args.width, "height": args.height},
            device_scale_factor=1,
        )
        await page.goto(args.html.resolve().as_uri(), wait_until="load")
        await page.evaluate(
            "Promise.all([document.fonts.ready, ...Array.from(document.images).map(i => i.complete ? Promise.resolve() : new Promise(r => {i.onload=r;i.onerror=r}))])"
        )
        contract = await page.evaluate(
            "({duration: Number(window.totalDuration), seekType: typeof window.seekTo})"
        )
        if contract["seekType"] != "function":
            raise SystemExit("HTML must expose window.seekTo(t)")
        duration = args.duration if args.duration is not None else contract["duration"]
        if not duration or duration <= 0:
            raise SystemExit("duration must be positive or exposed as window.totalDuration")

        snapshots = [float(x) for x in args.snapshots.split(",") if x.strip()]
        times = snapshots or [i / args.fps for i in range(int(round(duration * args.fps)))]
        rendered: list[str] = []
        for index, time_value in enumerate(times):
            await page.evaluate("t => window.seekTo(t)", time_value)
            await page.wait_for_timeout(8)
            filename = (
                f"snapshot_{time_value:05.2f}.jpg"
                if snapshots
                else f"frame_{index:05d}.jpg"
            )
            output = args.out / filename
            await page.screenshot(
                path=str(output), type="jpeg", quality=args.quality, full_page=False
            )
            rendered.append(str(output))
        await browser.close()

    print(
        json.dumps(
            {
                "ok": True,
                "frames": len(rendered),
                "duration": duration,
                "first": rendered[0] if rendered else None,
                "last": rendered[-1] if rendered else None,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(render()))
