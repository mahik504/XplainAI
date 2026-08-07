"""Final ship QA: OpenAI streaming for the 10 release prompts. Never prints secrets."""

from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

import httpx
from websockets.asyncio.client import connect

SCRIPT_DIR = Path(__file__).resolve().parent
QA_OUT = SCRIPT_DIR / "_ship_qa_last.json"

BASE = "http://127.0.0.1:8000"
WS = "ws://127.0.0.1:8000/ws/v1/chat"

PROMPTS = [
    "Explain quantum computing.",
    "Why is the sky blue?",
    "Should India invest in nuclear energy?",
    "Compare React vs Vue.",
    "Tell me a joke.",
    "Explain recursion.",
    "What causes inflation?",
    "How does Bitcoin work?",
    "Should I use PostgreSQL?",
    "What is Explainable AI?",
]


async def one(ws, prompt: str) -> dict:
    t0 = time.perf_counter()
    await ws.send(
        json.dumps(
            {"type": "chat.send", "messages": [{"role": "user", "content": prompt}]}
        )
    )
    parts: list[str] = []
    first: float | None = None
    fin: dict | None = None
    while True:
        frame = json.loads(await asyncio.wait_for(ws.recv(), timeout=120))
        if frame.get("type") == "run.token" and frame.get("delta"):
            if first is None:
                first = time.perf_counter() - t0
            parts.append(frame["delta"])
        if frame.get("type") in {"run.finished", "error"}:
            fin = frame
            break
    text = "".join(parts)
    return {
        "prompt": prompt,
        "ok": bool(fin and fin.get("type") == "run.finished"),
        "finish": (fin or {}).get("finish_reason"),
        "echo": text.strip().lower().startswith("you said:"),
        "ttft_ms": round((first or 0) * 1000),
        "total_ms": round((time.perf_counter() - t0) * 1000),
        "chars": len(text),
        "text": text,
        "usage": (fin or {}).get("usage"),
    }


async def main() -> None:
    async with httpx.AsyncClient(base_url=BASE, timeout=15.0) as client:
        live = (await client.get("/health/live")).json()
        ready = (await client.get("/health/ready")).json()
        models = (await client.get("/api/v1/chat/models")).json()
        print(
            "HEALTH",
            live.get("status"),
            live.get("service"),
            live.get("version"),
            "ready=",
            ready.get("status"),
        )
        print("PROVIDER", models.get("provider"), models.get("default_model"))
        if models.get("provider") != "openai":
            print("FAIL provider is not openai")
            raise SystemExit(2)

    rows: list[dict] = []
    async with connect(WS, open_timeout=8) as ws:
        ready_frame = json.loads(await asyncio.wait_for(ws.recv(), timeout=8))
        if ready_frame.get("type") != "connection.ready":
            print("FAIL ws ready", ready_frame)
            raise SystemExit(2)
        print("WS connection.ready")
        for prompt in PROMPTS:
            row = await one(ws, prompt)
            rows.append(row)
            status = "PASS" if row["ok"] and not row["echo"] else "FAIL"
            print(
                status,
                row["prompt"][:42],
                "ttft",
                row["ttft_ms"],
                "total",
                row["total_ms"],
                "chars",
                row["chars"],
                "finish",
                row["finish"],
            )

    bad = [r for r in rows if not r["ok"] or r["echo"]]
    # Write texts for frontend analyzer pass (local temp, not secrets)
    out = {
        "provider": "openai",
        "results": [
            {
                "prompt": r["prompt"],
                "ok": r["ok"] and not r["echo"],
                "ttft_ms": r["ttft_ms"],
                "total_ms": r["total_ms"],
                "chars": r["chars"],
                "finish": r["finish"],
                "text": r["text"],
            }
            for r in rows
        ],
    }
    with QA_OUT.open("w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False)
    print("WROTE", QA_OUT)
    print("SUMMARY", f"{len(rows) - len(bad)}/{len(rows)}")
    if bad:
        raise SystemExit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL unexpected {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
