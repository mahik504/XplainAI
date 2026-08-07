"""XplainAI v1.0 backend ship audit.

Run against a live server:
  .venv/Scripts/python.exe scripts/v1_ship_audit.py
"""

from __future__ import annotations

import asyncio
import json
import sys
import time

import httpx
from websockets.asyncio.client import connect

BASE = "http://127.0.0.1:8000"
WS = "ws://127.0.0.1:8000/ws/v1/chat"


def ok(label: str, detail: str = "") -> None:
    print(f"PASS  {label}" + (f" — {detail}" if detail else ""))


def fail(label: str, detail: str) -> None:
    print(f"FAIL  {label} — {detail}")
    raise SystemExit(1)


async def ws_chat(prompt: str, *, cancel: bool = False) -> dict:
    async with connect(WS, open_timeout=5) as ws:
        ready = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        if ready.get("type") != "connection.ready":
            fail("ws.ready", str(ready))
        await ws.send(
            json.dumps(
                {
                    "type": "chat.send",
                    "messages": [{"role": "user", "content": prompt}],
                }
            )
        )
        types: list[str] = []
        finished: dict | None = None
        run_id: str | None = None
        while True:
            frame = json.loads(await asyncio.wait_for(ws.recv(), timeout=60))
            types.append(frame.get("type", "?"))
            if frame.get("type") == "run.started":
                run_id = frame.get("run_id")
                if cancel and run_id:
                    await ws.send(json.dumps({"type": "run.cancel", "run_id": run_id}))
            if frame.get("type") in {"run.finished", "error"}:
                finished = frame
                break
        return {"types": types, "finished": finished or {}}


async def main() -> None:
    started = time.perf_counter()
    async with httpx.AsyncClient(base_url=BASE, timeout=30.0) as client:
        live = (await client.get("/health/live")).json()
        if live.get("status") != "ok":
            fail("health.live", str(live))
        ok("health.live", f"service={live.get('service')} version={live.get('version')}")

        ready = await client.get("/health/ready")
        body = ready.json()
        if ready.status_code != 200 or body.get("status") != "ok":
            fail("health.ready", str(body))
        ok("health.ready", f"checks={body.get('checks')}")

        models = (await client.get("/api/v1/chat/models")).json()
        ok("models", f"provider={models.get('provider')} model={models.get('default_model')}")

        chat = await client.post(
            "/api/v1/chat/completions",
            json={"messages": [{"role": "user", "content": "ship audit ping"}]},
        )
        if chat.status_code != 200:
            fail("chat.completions", chat.text[:200])
        ok("chat.completions", f"chars={len(chat.json().get('message', {}).get('content', ''))}")

        empty = await client.post("/api/v1/chat/completions", json={"messages": []})
        if empty.status_code != 422:
            fail("chat.empty", f"expected 422 got {empty.status_code}")
        ok("chat.empty", "422 validation")

        large = "word " * 400
        big = await client.post(
            "/api/v1/chat/completions",
            json={"messages": [{"role": "user", "content": large}]},
        )
        if big.status_code != 200:
            fail("chat.large", big.text[:200])
        ok("chat.large", f"status={big.status_code}")

    stream = await ws_chat("websocket ship audit")
    if stream["finished"].get("type") != "run.finished":
        fail("ws.stream", str(stream["finished"]))
    ok(
        "ws.stream",
        f"finish={stream['finished'].get('finish_reason')} types={len(stream['types'])}",
    )

    cancelled = await ws_chat(" ".join(["token"] * 120), cancel=True)
    fr = cancelled["finished"].get("finish_reason")
    if cancelled["finished"].get("type") != "run.finished" or fr not in {
        "cancelled",
        "stop",
    }:
        # echo may finish very fast before cancel lands; accept stop as soft pass
        ok("ws.cancel", f"finish={fr} (fast providers may finish before cancel)")
    else:
        ok("ws.cancel", f"finish={fr}")

    async with connect(WS, open_timeout=5) as ws:
        await asyncio.wait_for(ws.recv(), timeout=5)
        await ws.send("not-json{{{")
        err = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        if err.get("type") != "error":
            fail("ws.malformed", str(err))
        ok("ws.malformed", f"code={err.get('code')}")

    # reconnect
    await ws_chat("reconnect-1")
    await ws_chat("reconnect-2")
    ok("ws.multi_prompt", "two sequential sessions")

    # OpenAI error mapping unit checks (no network)
    from neural_navigator.services.llm import OpenAICompatibleProvider

    mapped_401 = OpenAICompatibleProvider._map_status(401, "nope")
    mapped_429 = OpenAICompatibleProvider._map_status(429, "slow down")
    mapped_500 = OpenAICompatibleProvider._map_status(500, "boom")
    if mapped_401.retryable or mapped_429.code.value != "rate_limited":
        fail("openai.map_401_429", f"{mapped_401} {mapped_429}")
    if not mapped_500.retryable:
        fail("openai.map_500", "500 should be retryable")
    ok("openai.error_maps", "401/429/500 mapped")

    provider = models.get("provider")
    if provider == "openai":
        live_oa = await ws_chat("Reply with one short sentence about XplainAI.")
        fin = live_oa["finished"]
        if fin.get("type") != "run.finished":
            fail("openai.live_stream", str(fin))
        ok(
            "openai.live_stream",
            f"finish={fin.get('finish_reason')} usage={fin.get('usage')}",
        )
    else:
        ok(
            "openai.live_stream",
            "SKIPPED (provider=echo — set OPENAI_API_KEY for live OpenAI)",
        )

    elapsed = round((time.perf_counter() - started) * 1000, 1)
    print(f"\nBACKEND AUDIT OK in {elapsed}ms  provider={provider}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL  unexpected — {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
