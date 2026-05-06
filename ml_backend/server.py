# Written by Jatin Kumar Mehta | github id: jkmloom

"""
═══════════════════════════════════════════════════════════════
 PRECOG Server — FastAPI WebSocket backend for adaptive AI
═══════════════════════════════════════════════════════════════

Connects to the VOID RUNNER game frontend via WebSocket.
Receives player telemetry, processes through the AdaptiveAI engine,
and sends back difficulty adjustments + learning insights.

Usage:
  cd ml_backend
  pip install -r requirements.txt
  python server.py
"""

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Dict, List

from pydantic import BaseModel

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from adaptive_ai import AdaptiveAI

# ── Logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)s │ %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("precog")

# ── App ──
app = FastAPI(title="PRECOG Neural Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Track active AI sessions
sessions: Dict[str, AdaptiveAI] = {}

# ── Leaderboard ──
LEADERBOARD_FILE = Path(__file__).parent / "leaderboard.txt"
leaderboard_lock = asyncio.Lock()


class ScoreEntry(BaseModel):
    name: str
    score: int
    wave: int


def _read_leaderboard() -> List[dict]:
    """Read leaderboard from .txt file"""
    entries = []
    if LEADERBOARD_FILE.exists():
        with open(LEADERBOARD_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                parts = line.split("|")
                if len(parts) == 3:
                    entries.append({
                        "name": parts[0],
                        "score": int(parts[1]),
                        "wave": int(parts[2]),
                    })
    # Sort by score descending, keep top 5
    entries.sort(key=lambda x: x["score"], reverse=True)
    return entries[:5]


def _write_leaderboard(entries: List[dict]):
    """Write leaderboard to .txt file"""
    entries.sort(key=lambda x: x["score"], reverse=True)
    entries = entries[:5]
    with open(LEADERBOARD_FILE, "w") as f:
        for e in entries:
            f.write(f"{e['name']}|{e['score']}|{e['wave']}\n")


@app.get("/")
async def root():
    return {
        "service": "PRECOG Neural Engine",
        "status": "online",
        "active_sessions": len(sessions),
    }


@app.get("/leaderboard")
async def get_leaderboard():
    """Fetch the top 5 global scores"""
    entries = _read_leaderboard()
    return {"leaderboard": entries}


@app.post("/leaderboard")
async def submit_score(entry: ScoreEntry):
    """Submit a new score. Replaces lowest top-5 entry if it qualifies."""
    async with leaderboard_lock:
        entries = _read_leaderboard()
        # Sanitize name: max 12 chars, alphanumeric + spaces
        clean_name = "".join(c for c in entry.name if c.isalnum() or c == " ")[:12].strip()
        if not clean_name:
            clean_name = "PILOT"

        new_entry = {
            "name": clean_name.upper(),
            "score": entry.score,
            "wave": entry.wave,
        }

        # Check if it qualifies for top 5
        if len(entries) < 5 or entry.score > entries[-1]["score"]:
            entries.append(new_entry)
            entries.sort(key=lambda x: x["score"], reverse=True)
            entries = entries[:5]
            _write_leaderboard(entries)
            log.info(f"★ Leaderboard updated: {clean_name} — {entry.score} pts")
            return {"accepted": True, "rank": next(i + 1 for i, e in enumerate(entries) if e["score"] == entry.score and e["name"] == clean_name.upper()), "leaderboard": entries}

        return {"accepted": False, "leaderboard": entries}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = str(id(websocket))
    ai = AdaptiveAI()
    sessions[session_id] = ai

    log.info(f"⟨◈⟩ New session connected: {session_id}")

    # Send initial handshake
    await websocket.send_json({
        "type": "connected",
        "message": "PRECOG Neural Engine online",
        "sessionId": session_id,
    })

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type", "")

            if msg_type == "telemetry":
                # Process telemetry through ML pipeline
                payload = data.get("payload", {})
                response = ai.process_telemetry(payload)
                await websocket.send_json(response)

            elif msg_type == "reset":
                # Player started a new game
                ai.reset()
                log.info(f"⟳ Session {session_id} reset — new game")
                await websocket.send_json({
                    "type": "reset_ack",
                    "message": "Neural engine reset. Prior patterns preserved.",
                })

            elif msg_type == "game_over":
                # Player died — log final stats
                payload = data.get("payload", {})
                log.info(
                    f"✖ Session {session_id} game over — "
                    f"Score: {payload.get('score', 0)}, "
                    f"Wave: {payload.get('wave', 0)}, "
                    f"Skill: {ai.skill_score:.1f}"
                )
                await websocket.send_json({
                    "type": "game_over_ack",
                    "finalSkillScore": round(ai.skill_score, 2),
                    "totalTrainingSteps": ai.predictor.train_count,
                    "patternsDetected": ai.detected_patterns,
                })

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        log.info(f"⟨✕⟩ Session {session_id} disconnected")
    except Exception as e:
        log.error(f"Error in session {session_id}: {e}")
    finally:
        sessions.pop(session_id, None)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8765))
    log.info("═══════════════════════════════════════════")
    log.info("  PRECOG Neural Engine v1.0")
    log.info(f"  WebSocket: ws://0.0.0.0:{port}/ws")
    log.info("═══════════════════════════════════════════")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
    )
