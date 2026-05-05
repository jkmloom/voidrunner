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
from typing import Dict

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


@app.get("/")
async def root():
    return {
        "service": "PRECOG Neural Engine",
        "status": "online",
        "active_sessions": len(sessions),
    }


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
    log.info("═══════════════════════════════════════════")
    log.info("  PRECOG Neural Engine v1.0")
    log.info("  WebSocket: ws://localhost:8765/ws")
    log.info("═══════════════════════════════════════════")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8765,
        log_level="info",
    )
