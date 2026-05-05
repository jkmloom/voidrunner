# VOID RUNNER

**VOID RUNNER** is an infinite space shooter game with a dynamic machine learning backend. The game features real-time difficulty adaptation and diagnostic feedback via a side-mounted UI panel, ensuring a challenging and engaging experience scaled to your playstyle.

## 🚀 Features

*   **Infinite Space Shooter Action**: Navigate your ship, dodge obstacles, and destroy enemies in an endless vertical scrolling environment.
*   **Real-time Machine Learning Adaptation**: The Python FastAPI backend uses an adaptive AI model to analyze player behavior patterns and adjust game difficulty on the fly.
*   **Diagnostic Telemetry**: A side-mounted UI panel visualizes the real-time ML backend analytics and current difficulty scaling.
*   **WebSockets Communication**: Fast, low-latency, real-time communication between the game client and the backend AI engine.
*   **Modern Web Stack**: Built with Vite and plain Vanilla JS/CSS for the game engine, ensuring maximum performance and easy maintainability.

## 🛠️ Tech Stack

### Frontend (Game Client)
*   **Vite**: Next-generation frontend tooling for fast development and building.
*   **HTML5 Canvas & JavaScript**: Core game loop, rendering, and logic.
*   **CSS3**: UI styling and layout.

### Backend (AI Engine)
*   **Python**: Core language for the backend.
*   **FastAPI**: High-performance web framework for building APIs with Python.
*   **WebSockets**: Real-time bidirectional communication.
*   **NumPy**: Powerful N-dimensional array processing for behavioral pattern analysis.
*   **Uvicorn**: ASGI web server implementation for Python.

## 📂 Project Structure

```
voidrunner/
├── ml_backend/                # Python Machine Learning Backend
│   ├── adaptive_ai.py         # AI logic and difficulty scaling algorithms
│   ├── server.py              # FastAPI WebSocket server
│   └── requirements.txt       # Python dependencies
├── src/                       # Game Frontend Source Code
│   ├── game/                  # Game logic, entities, and scenes
│   ├── assets/                # Game graphics and sounds
│   ├── style.css              # Main styling (UI and HUD)
│   └── main.js                # Game initialization and WebSocket client
├── public/                    # Static assets
├── index.html                 # Main entry point for the game
├── package.json               # Node.js dependencies and scripts
└── vite.config.js             # Vite configuration (if available)
```

## ⚙️ Setup and Installation

To run this project locally, you will need to start both the frontend Vite server and the backend Python FastAPI server.

### Prerequisites
*   Node.js (v18 or higher)
*   Python (v3.10 or higher)

### 1. Starting the Machine Learning Backend

1. Navigate to the `ml_backend` directory:
   ```bash
   cd ml_backend
   ```
2. Create and activate a Python virtual environment (optional but recommended):
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the WebSocket server using Uvicorn:
   ```bash
   uvicorn server:app --host 0.0.0.0 --port 8000 --reload
   ```

### 2. Starting the Game Client

1. Open a new terminal window and navigate to the project root directory:
   ```bash
   cd voidrunner
   ```
2. Install the Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the local URL provided by Vite (usually `http://localhost:5173`) to play the game!

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
