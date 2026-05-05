// Written by Jatin Kumar Mehta | github id: jkmloom
/* ═══════════════════════════════════════════════════════════
   ML Connection — WebSocket client for PRECOG Neural Engine
   Collects telemetry, sends to Python backend, applies adaptations
   ═══════════════════════════════════════════════════════════ */

export class MLConnection {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.connected = false;
    this.reconnectTimer = null;
    this.telemetryInterval = null;

    // Telemetry tracking
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.enemyBulletsFaced = 0;
    this.enemyBulletsDodged = 0;
    this.enemiesKilledThisInterval = 0;
    this.powerupsCollected = 0;
    this.powerupsSpawned = 0;
    this.lastTelemetryTime = Date.now();

    // ML adjustments (received from backend)
    this.difficultyMult = 1.0;
    this.speedMult = 1.0;
    this.fireRateMult = 1.0;
    this.healthMult = 1.0;
    this.spawnBias = [0.33, 0.34, 0.33];
    this.skillScore = 5.0;
    this.metrics = {};
    this.heatmap = [];
    this.neuralState = {};
    this.patterns = {};

    // UI elements
    this.panelEl = document.getElementById('ml-panel');
    this.logEl = document.getElementById('ml-log-entries');
    this.statusEl = document.getElementById('ml-status-dot');
    this.statusTextEl = document.getElementById('ml-status-text');

    // Metric bar elements
    this.metricBars = {
      accuracy: document.getElementById('ml-bar-accuracy'),
      dodgeRate: document.getElementById('ml-bar-dodge'),
      aggression: document.getElementById('ml-bar-aggression'),
      movementEntropy: document.getElementById('ml-bar-entropy'),
    };
    this.metricValues = {
      accuracy: document.getElementById('ml-val-accuracy'),
      dodgeRate: document.getElementById('ml-val-dodge'),
      aggression: document.getElementById('ml-val-aggression'),
      movementEntropy: document.getElementById('ml-val-entropy'),
    };

    // Difficulty display elements
    this.difficultyEl = document.getElementById('ml-difficulty-value');
    this.speedEl = document.getElementById('ml-speed-value');
    this.fireRateEl = document.getElementById('ml-firerate-value');
    this.healthMultEl = document.getElementById('ml-health-value');
    this.skillEl = document.getElementById('ml-skill-value');
    this.skillBarEl = document.getElementById('ml-skill-bar');
    this.trainingEl = document.getElementById('ml-training-steps');
    this.predErrorEl = document.getElementById('ml-pred-error');

    // Heatmap canvas
    this.heatmapCanvas = document.getElementById('ml-heatmap');
    this.heatmapCtx = this.heatmapCanvas ? this.heatmapCanvas.getContext('2d') : null;

    // Log entries storage
    this.logEntries = [];
    this.maxLogEntries = 50;
  }

  connect() {
    try {
      this.ws = new WebSocket('ws://localhost:8765/ws');

      this.ws.onopen = () => {
        this.connected = true;
        this._updateStatus(true);
        this._addLogEntry('system', 'Connected to PRECOG Neural Engine', 'cyan');
        this._startTelemetry();
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this._handleMessage(data);
      };

      this.ws.onclose = () => {
        this.connected = false;
        this._updateStatus(false);
        this._addLogEntry('system', 'Connection lost — reconnecting...', 'red');
        this._stopTelemetry();
        this._scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.connected = false;
        this._updateStatus(false);
      };
    } catch (e) {
      this._updateStatus(false);
      this._addLogEntry('system', 'Backend offline — running in standalone mode', 'yellow');
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  _startTelemetry() {
    this._stopTelemetry();
    // Send telemetry every 500ms
    this.telemetryInterval = setInterval(() => {
      if (this.game.state === 'playing' && this.connected) {
        this._sendTelemetry();
      }
    }, 500);
  }

  _stopTelemetry() {
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
    }
  }

  _sendTelemetry() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.game.player) return;

    const player = this.game.player;
    const now = Date.now();
    const dt = (now - this.lastTelemetryTime) / 1000;
    this.lastTelemetryTime = now;

    // Compute accuracy
    const accuracy = this.shotsFired > 0 ? this.shotsHit / this.shotsFired : 0.5;

    // Compute dodge rate
    const dodgeRate = this.enemyBulletsFaced > 0
      ? this.enemyBulletsDodged / this.enemyBulletsFaced
      : 0.5;

    // Kill speed (kills per second this interval)
    const killSpeed = dt > 0 ? this.enemiesKilledThisInterval / dt : 0;

    // Power-up collection rate
    const puRate = this.powerupsSpawned > 0
      ? this.powerupsCollected / this.powerupsSpawned
      : 0.5;

    const payload = {
      playerX: player.x / this.game.width,
      playerY: player.y / this.game.height,
      velocityX: (player.x - (player._lastX || player.x)) / this.game.width,
      velocityY: (player.y - (player._lastY || player.y)) / this.game.height,
      accuracy,
      dodgeRate,
      combo: this.game.combo,
      killSpeed,
      health: player.health,
      wave: this.game.waveManager.wave,
      score: this.game.score,
      enemiesAlive: this.game.enemies.length,
      powerupRate: puRate,
    };

    // Store last position for velocity
    player._lastX = player.x;
    player._lastY = player.y;

    this.ws.send(JSON.stringify({ type: 'telemetry', payload }));

    // Reset interval counters
    this.enemiesKilledThisInterval = 0;
  }

  sendReset() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'reset' }));
    }
    // Reset tracking
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.enemyBulletsFaced = 0;
    this.enemyBulletsDodged = 0;
    this.enemiesKilledThisInterval = 0;
    this.powerupsCollected = 0;
    this.powerupsSpawned = 0;
    this.difficultyMult = 1.0;
    this.speedMult = 1.0;
    this.fireRateMult = 1.0;
    this.healthMult = 1.0;
  }

  sendGameOver() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'game_over',
        payload: {
          score: this.game.score,
          wave: this.game.waveManager.wave,
          kills: this.game.waveManager.totalKills,
        }
      }));
    }
  }

  // ── Event tracking (called by Game.js) ──
  onShotFired() { this.shotsFired++; }
  onShotHit() { this.shotsHit++; }
  onEnemyBulletSpawned() { this.enemyBulletsFaced++; }
  onEnemyBulletDodged() { this.enemyBulletsDodged++; }
  onEnemyKilled() { this.enemiesKilledThisInterval++; }
  onPowerupSpawned() { this.powerupsSpawned++; }
  onPowerupCollected() { this.powerupsCollected++; }

  // ── Handle messages from backend ──
  _handleMessage(data) {
    switch (data.type) {
      case 'connected':
        this._addLogEntry('system', data.message, 'cyan');
        break;

      case 'adaptation':
        this.difficultyMult = data.difficultyMult;
        this.speedMult = data.speedMult;
        this.fireRateMult = data.fireRateMult;
        this.healthMult = data.healthMult;
        this.spawnBias = data.spawnBias;
        this.skillScore = data.skillScore;
        this.metrics = data.metrics || {};
        this.heatmap = data.heatmap || [];
        this.neuralState = data.neuralState || {};
        this.patterns = data.patterns || {};

        // Apply to game systems
        this._applyAdaptations();

        // Process insights
        if (data.insights) {
          for (const insight of data.insights) {
            this._addLogEntry(insight.category, insight.text, insight.color);
          }
        }

        // Update UI
        this._updatePanel();
        break;

      case 'reset_ack':
        this._addLogEntry('system', data.message, 'cyan');
        break;

      case 'game_over_ack':
        this._addLogEntry('system',
          `Final skill: ${data.finalSkillScore}/10 | Training: ${data.totalTrainingSteps} steps`,
          'yellow'
        );
        break;
    }
  }

  _applyAdaptations() {
    // Apply difficulty multipliers to the wave manager and enemy system
    const wm = this.game.waveManager;
    wm.mlDifficultyMult = this.difficultyMult;
    wm.mlSpeedMult = this.speedMult;
    wm.mlFireRateMult = this.fireRateMult;
    wm.mlHealthMult = this.healthMult;
    wm.mlSpawnBias = this.spawnBias;
  }

  // ── UI Updates ──
  _updateStatus(online) {
    if (this.statusEl) {
      this.statusEl.className = online ? 'status-dot online' : 'status-dot offline';
    }
    if (this.statusTextEl) {
      this.statusTextEl.textContent = online ? 'ONLINE' : 'OFFLINE';
    }
  }

  _updatePanel() {
    // Skill score
    if (this.skillEl) {
      this.skillEl.textContent = this.skillScore.toFixed(1);
    }
    if (this.skillBarEl) {
      this.skillBarEl.style.width = `${(this.skillScore / 10) * 100}%`;
      // Color based on skill
      if (this.skillScore >= 7) {
        this.skillBarEl.style.background = 'linear-gradient(90deg, #ffd700, #ff8800)';
      } else if (this.skillScore >= 4) {
        this.skillBarEl.style.background = 'linear-gradient(90deg, #00f0ff, #a855f7)';
      } else {
        this.skillBarEl.style.background = 'linear-gradient(90deg, #00ff88, #00f0ff)';
      }
    }

    // Metrics bars
    const m = this.metrics;
    this._setBar('accuracy', m.accuracy);
    this._setBar('dodgeRate', m.dodgeRate);
    this._setBar('aggression', m.aggression);
    this._setBar('movementEntropy', m.movementEntropy);

    // Difficulty values
    if (this.difficultyEl) {
      const pct = ((this.difficultyMult - 1) * 100);
      this.difficultyEl.textContent = pct >= 0 ? `+${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`;
      this.difficultyEl.style.color = pct > 20 ? '#ff3355' : pct > 0 ? '#ffd700' : '#00ff88';
    }
    if (this.speedEl) {
      const pct = ((this.speedMult - 1) * 100);
      this.speedEl.textContent = pct >= 0 ? `+${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`;
    }
    if (this.fireRateEl) {
      const pct = ((this.fireRateMult - 1) * 100);
      this.fireRateEl.textContent = pct >= 0 ? `+${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`;
    }
    if (this.healthMultEl) {
      const pct = ((this.healthMult - 1) * 100);
      this.healthMultEl.textContent = pct >= 0 ? `+${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`;
    }

    // Neural state
    if (this.trainingEl && this.neuralState.train_steps !== undefined) {
      this.trainingEl.textContent = this.neuralState.train_steps;
    }
    if (this.predErrorEl && this.neuralState.prediction_error !== undefined) {
      this.predErrorEl.textContent = this.neuralState.prediction_error.toFixed(4);
    }

    // Heatmap
    this._drawHeatmap();
  }

  _setBar(name, value) {
    const bar = this.metricBars[name];
    const val = this.metricValues[name];
    if (bar && value !== undefined) {
      bar.style.width = `${Math.min(100, value * 100)}%`;
    }
    if (val && value !== undefined) {
      val.textContent = `${Math.round(value * 100)}%`;
    }
  }

  _drawHeatmap() {
    if (!this.heatmapCtx || !this.heatmap.length) return;

    const ctx = this.heatmapCtx;
    const canvas = this.heatmapCanvas;
    const cols = this.heatmap.length;
    const rows = this.heatmap[0] ? this.heatmap[0].length : 0;
    if (rows === 0) return;

    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const intensity = this.heatmap[x][y];
        if (intensity > 0.01) {
          // Color: dark blue → cyan → magenta → white based on intensity
          let r, g, b;
          if (intensity < 0.3) {
            r = 0; g = Math.floor(intensity * 800); b = Math.floor(intensity * 850);
          } else if (intensity < 0.6) {
            const t = (intensity - 0.3) / 0.3;
            r = Math.floor(t * 255); g = Math.floor(240 - t * 240); b = 255;
          } else {
            const t = (intensity - 0.6) / 0.4;
            r = 255; g = Math.floor(t * 100); b = Math.floor(255 - t * 85);
          }
          ctx.fillStyle = `rgba(${r},${g},${b},${0.3 + intensity * 0.7})`;
          ctx.fillRect(x * cellW, y * cellH, cellW - 1, cellH - 1);
        }
      }
    }

    // Grid overlay
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellW, 0);
      ctx.lineTo(x * cellW, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellH);
      ctx.lineTo(canvas.width, y * cellH);
      ctx.stroke();
    }
  }

  _addLogEntry(category, text, color = 'cyan') {
    const colorMap = {
      cyan: '#00f0ff',
      magenta: '#ff00aa',
      green: '#00ff88',
      red: '#ff3355',
      yellow: '#ffd700',
      orange: '#ff8800',
      gold: '#ffd700',
      purple: '#a855f7',
    };

    const entry = {
      category,
      text,
      color: colorMap[color] || color,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    this.logEntries.push(entry);
    if (this.logEntries.length > this.maxLogEntries) {
      this.logEntries.shift();
    }

    this._renderLog();
  }

  _renderLog() {
    if (!this.logEl) return;

    // Only render last 20 entries for performance
    const visible = this.logEntries.slice(-20);
    this.logEl.innerHTML = visible.map(e =>
      `<div class="ml-log-entry" style="--entry-color: ${e.color}">` +
      `<span class="ml-log-time">${e.time}</span>` +
      `<span class="ml-log-text" style="color: ${e.color}">${e.text}</span>` +
      `</div>`
    ).join('');

    // Auto-scroll
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }
}
