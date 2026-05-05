# Written by Jatin Kumar Mehta | github id: jkmloom

"""
═══════════════════════════════════════════════════════════════
 PRECOG ADAPTIVE AI — Machine Learning Engine
 Learns player patterns in real-time and adapts game difficulty
═══════════════════════════════════════════════════════════════

Architecture:
  1. Statistical Tracker — EMA-based metrics for smooth adaptation
  2. Position Predictor — Simple neural net to predict player movement
  3. Pattern Detector — Identifies behavioral patterns (camping, dodging, etc.)
  4. Difficulty Adapter — Translates skill assessment into game parameters
  5. Insight Generator — Produces human-readable explanations of AI decisions
"""

import numpy as np
from collections import deque
import time
import math


class NeuralPredictor:
    """
    Tiny 2-layer neural network trained online to predict
    the player's next position based on recent movement.
    Input:  [x, y, vx, vy] (last 3 frames flattened = 12 features)
    Output: [predicted_x, predicted_y]
    """

    def __init__(self, input_size=12, hidden_size=16, output_size=2, lr=0.005):
        self.lr = lr
        # Xavier initialization
        self.W1 = np.random.randn(input_size, hidden_size) * np.sqrt(2.0 / input_size)
        self.b1 = np.zeros(hidden_size)
        self.W2 = np.random.randn(hidden_size, output_size) * np.sqrt(2.0 / hidden_size)
        self.b2 = np.zeros(output_size)
        self.prediction_error = 1.0
        self.error_history = deque(maxlen=50)
        self.train_count = 0

    def _relu(self, x):
        return np.maximum(0, x)

    def _relu_deriv(self, x):
        return (x > 0).astype(float)

    def predict(self, x):
        """Forward pass"""
        self.last_input = np.array(x, dtype=np.float64)
        self.z1 = self.last_input @ self.W1 + self.b1
        self.a1 = self._relu(self.z1)
        self.z2 = self.a1 @ self.W2 + self.b2
        return self.z2

    def train(self, x, target):
        """Single step of online learning (backprop)"""
        pred = self.predict(x)
        target = np.array(target, dtype=np.float64)

        # Loss
        error = pred - target
        loss = np.mean(error ** 2)
        self.error_history.append(loss)
        self.prediction_error = np.mean(list(self.error_history))
        self.train_count += 1

        # Backprop
        d_z2 = error  # MSE derivative
        d_W2 = self.a1.reshape(-1, 1) @ d_z2.reshape(1, -1)
        d_b2 = d_z2
        d_a1 = d_z2 @ self.W2.T
        d_z1 = d_a1 * self._relu_deriv(self.z1)
        d_W1 = self.last_input.reshape(-1, 1) @ d_z1.reshape(1, -1)
        d_b1 = d_z1

        # Gradient clipping
        for grad in [d_W1, d_b1, d_W2, d_b2]:
            np.clip(grad, -1.0, 1.0, out=grad)

        # Update
        self.W1 -= self.lr * d_W1
        self.b1 -= self.lr * d_b1
        self.W2 -= self.lr * d_W2
        self.b2 -= self.lr * d_b2

        return loss

    def get_weights_snapshot(self):
        """Return a compact representation for visualization"""
        return {
            "layer1_mean": float(np.mean(np.abs(self.W1))),
            "layer1_std": float(np.std(self.W1)),
            "layer2_mean": float(np.mean(np.abs(self.W2))),
            "layer2_std": float(np.std(self.W2)),
            "prediction_error": float(self.prediction_error),
            "train_steps": self.train_count,
        }


class AdaptiveAI:
    """
    Main AI controller that tracks player behavior, learns patterns,
    and generates adaptive difficulty + real-time insights.
    """

    def __init__(self):
        # ── Position tracking ──
        self.position_history = deque(maxlen=300)
        self.velocity_history = deque(maxlen=100)
        self.heatmap = np.zeros((10, 8))  # 10 cols x 8 rows grid
        self.heatmap_decay = 0.998  # slow decay for long-term pattern

        # ── Metrics (EMA smoothed) ──
        self.ema_alpha = 0.08
        self.accuracy = 0.5
        self.dodge_rate = 0.5
        self.avg_combo = 1.0
        self.kill_speed = 0.0
        self.health_avg = 1.0
        self.powerup_rate = 0.5
        self.movement_entropy = 0.5
        self.aggression = 0.5  # how close to enemies

        # ── Composite skill score ──
        self.skill_score = 5.0
        self.skill_history = deque(maxlen=100)

        # ── Difficulty outputs ──
        self.difficulty_mult = 1.0
        self.speed_mult = 1.0
        self.fire_rate_mult = 1.0
        self.spawn_bias = [0.33, 0.34, 0.33]  # left, center, right
        self.health_mult = 1.0

        # ── Neural position predictor ──
        self.predictor = NeuralPredictor()
        self.pred_input_buffer = deque(maxlen=4)  # last 3 frames + current

        # ── Pattern detection ──
        self.detected_patterns = {}
        self.pattern_confidence = {}

        # ── Insight system ──
        self.insights = []
        self.insight_cooldowns = {}
        self.all_insights_log = []  # full history

        # ── Timing ──
        self.tick = 0
        self.start_time = time.time()
        self.last_telemetry_time = time.time()

        # ── Tracking counters ──
        self.total_shots_fired = 0
        self.total_shots_hit = 0
        self.total_damage_taken = 0
        self.total_dodges = 0
        self.total_enemy_bullets_faced = 0
        self.sessions_played = 0

    def reset(self):
        """Reset for a new game session while preserving learned weights"""
        self.position_history.clear()
        self.velocity_history.clear()
        # Don't fully reset heatmap — carry learning across sessions
        self.heatmap *= 0.5  # half-decay on reset
        self.insights = []
        self.detected_patterns = {}
        self.tick = 0
        self.start_time = time.time()
        self.sessions_played += 1
        self.health_avg = 1.0

        # Reset difficulty to base
        self.difficulty_mult = 1.0
        self.speed_mult = 1.0
        self.fire_rate_mult = 1.0
        self.spawn_bias = [0.33, 0.34, 0.33]
        self.health_mult = 1.0

        self._add_insight("system", "Neural engine reset. Prior learning retained.", "cyan")
        self._add_insight("system", f"Session #{self.sessions_played} initialized.", "cyan")

    def process_telemetry(self, data: dict) -> dict:
        """
        Main processing pipeline. Called every ~500ms with player telemetry.
        Returns difficulty adjustments + insights for the frontend.
        """
        self.tick += 1
        self.insights = []  # fresh insights for this tick
        now = time.time()
        dt = now - self.last_telemetry_time
        self.last_telemetry_time = now

        # ── 1. Update position tracking ──
        px = data.get("playerX", 0.5)
        py = data.get("playerY", 0.5)
        vx = data.get("velocityX", 0.0)
        vy = data.get("velocityY", 0.0)

        self.position_history.append((px, py))
        self.velocity_history.append((vx, vy))

        # Update heatmap
        self.heatmap *= self.heatmap_decay
        gx = min(9, max(0, int(px * 10)))
        gy = min(7, max(0, int(py * 8)))
        self.heatmap[gx][gy] += 1.0

        # ── 2. Update metrics with EMA ──
        self._update_metrics(data)

        # ── 3. Train neural predictor ──
        self._update_predictor(px, py, vx, vy)

        # ── 4. Detect patterns ──
        self._detect_patterns(data)

        # ── 5. Compute skill score ──
        self._compute_skill()

        # ── 6. Adapt difficulty ──
        self._adapt_difficulty(data)

        # ── 7. Generate insights ──
        self._generate_insights(data)

        # ── Build response ──
        # Normalize heatmap for frontend
        heatmap_max = np.max(self.heatmap) if np.max(self.heatmap) > 0 else 1
        heatmap_normalized = (self.heatmap / heatmap_max).tolist()

        return {
            "type": "adaptation",
            "tick": self.tick,
            "difficultyMult": round(self.difficulty_mult, 3),
            "speedMult": round(self.speed_mult, 3),
            "fireRateMult": round(self.fire_rate_mult, 3),
            "healthMult": round(self.health_mult, 3),
            "spawnBias": [round(b, 3) for b in self.spawn_bias],
            "skillScore": round(self.skill_score, 2),
            "metrics": {
                "accuracy": round(self.accuracy, 3),
                "dodgeRate": round(self.dodge_rate, 3),
                "aggression": round(self.aggression, 3),
                "movementEntropy": round(self.movement_entropy, 3),
                "killSpeed": round(self.kill_speed, 3),
                "healthManagement": round(self.health_avg, 3),
            },
            "heatmap": heatmap_normalized,
            "insights": self.insights,
            "patterns": self.detected_patterns,
            "neuralState": self.predictor.get_weights_snapshot(),
        }

    # ─────────────────────────────────────────────
    # Internal Processing Methods
    # ─────────────────────────────────────────────

    def _ema(self, current: float, new_val: float) -> float:
        """Exponential moving average"""
        return current * (1 - self.ema_alpha) + new_val * self.ema_alpha

    def _update_metrics(self, data: dict):
        """Update all tracked metrics using EMA smoothing"""
        if "accuracy" in data:
            self.accuracy = self._ema(self.accuracy, data["accuracy"])

        if "dodgeRate" in data:
            self.dodge_rate = self._ema(self.dodge_rate, data["dodgeRate"])

        if "combo" in data:
            self.avg_combo = self._ema(self.avg_combo, data["combo"])

        if "killSpeed" in data:
            self.kill_speed = self._ema(self.kill_speed, data["killSpeed"])

        if "health" in data:
            hp_normalized = data["health"] / 100.0
            self.health_avg = self._ema(self.health_avg, hp_normalized)

        if "powerupRate" in data:
            self.powerup_rate = self._ema(self.powerup_rate, data["powerupRate"])

        # Movement entropy — how spread out is the player's movement
        if len(self.position_history) >= 20:
            recent = list(self.position_history)[-20:]
            xs = [p[0] for p in recent]
            ys = [p[1] for p in recent]
            spread = np.std(xs) + np.std(ys)
            self.movement_entropy = self._ema(self.movement_entropy, min(1.0, spread * 3))

        # Aggression — how high up the screen the player goes (lower y = more aggressive)
        if "playerY" in data:
            # y is normalized 0-1 where 0 is top
            agg = max(0, 1.0 - data["playerY"])  # closer to top = more aggressive
            self.aggression = self._ema(self.aggression, agg)

    def _update_predictor(self, px, py, vx, vy):
        """Train the neural network to predict next position"""
        frame = [px, py, vx, vy]
        self.pred_input_buffer.append(frame)

        if len(self.pred_input_buffer) >= 4:
            # Use frames 0-2 as input, frame 3 position as target
            inp = []
            for i in range(3):
                inp.extend(self.pred_input_buffer[i])
            target = [self.pred_input_buffer[3][0], self.pred_input_buffer[3][1]]

            loss = self.predictor.train(inp, target)

            # Log training progress periodically
            if self.tick % 20 == 0 and self.predictor.train_count > 10:
                err = self.predictor.prediction_error
                if err < 0.01:
                    self._add_insight("neural", f"Prediction convergence: error={err:.4f} — HIGH confidence", "green")
                elif err < 0.05:
                    self._add_insight("neural", f"Neural learning: error={err:.4f} — training step {self.predictor.train_count}", "cyan")
                else:
                    self._add_insight("neural", f"Pattern complex — error={err:.4f}, adjusting weights...", "yellow")

    def _detect_patterns(self, data: dict):
        """Identify specific behavioral patterns"""
        patterns = {}

        # 1. Position bias (left/center/right)
        if len(self.position_history) >= 30:
            recent = list(self.position_history)[-30:]
            avg_x = np.mean([p[0] for p in recent])
            if avg_x < 0.35:
                patterns["position_bias"] = "LEFT_HUGGING"
            elif avg_x > 0.65:
                patterns["position_bias"] = "RIGHT_HUGGING"
            else:
                patterns["position_bias"] = "CENTER_LANE"

        # 2. Movement style
        if self.movement_entropy > 0.6:
            patterns["movement_style"] = "ERRATIC"
        elif self.movement_entropy < 0.25:
            patterns["movement_style"] = "STATIC_CAMPER"
        else:
            patterns["movement_style"] = "BALANCED"

        # 3. Play style
        if self.aggression > 0.5:
            patterns["play_style"] = "AGGRESSIVE"
        elif self.aggression < 0.25:
            patterns["play_style"] = "DEFENSIVE"
        else:
            patterns["play_style"] = "BALANCED"

        # 4. Accuracy class
        if self.accuracy > 0.7:
            patterns["accuracy_class"] = "SHARPSHOOTER"
        elif self.accuracy < 0.3:
            patterns["accuracy_class"] = "SPRAY_AND_PRAY"
        else:
            patterns["accuracy_class"] = "AVERAGE"

        # 5. Dodge capability
        if self.dodge_rate > 0.8:
            patterns["dodge_class"] = "UNTOUCHABLE"
        elif self.dodge_rate < 0.4:
            patterns["dodge_class"] = "TANK_BUILD"
        else:
            patterns["dodge_class"] = "STANDARD"

        # 6. Bottom camping detection
        if len(self.position_history) >= 50:
            recent_y = [p[1] for p in list(self.position_history)[-50:]]
            if np.mean(recent_y) > 0.8:
                patterns["camping"] = "BOTTOM_CAMPER"

        self.detected_patterns = patterns

        # Build confidence for patterns seen over time
        for key, val in patterns.items():
            ckey = f"{key}:{val}"
            self.pattern_confidence[ckey] = self.pattern_confidence.get(ckey, 0) + 1

    def _compute_skill(self):
        """Compute composite skill score (0-10)"""
        # Weighted components
        accuracy_score = self.accuracy * 10
        dodge_score = self.dodge_rate * 10
        entropy_score = self.movement_entropy * 6  # some entropy is good
        combo_score = min(10, self.avg_combo * 1.5)
        kill_score = min(10, self.kill_speed * 8)
        health_score = self.health_avg * 8

        self.skill_score = (
            accuracy_score * 0.25 +
            dodge_score * 0.25 +
            entropy_score * 0.10 +
            combo_score * 0.15 +
            kill_score * 0.10 +
            health_score * 0.15
        )

        self.skill_score = max(0, min(10, self.skill_score))
        self.skill_history.append(self.skill_score)

    def _adapt_difficulty(self, data: dict):
        """
        Core adaptive difficulty algorithm.
        Target: keep the player challenged but not overwhelmed.
        Uses skill score to drive difficulty parameters.
        """
        wave = data.get("wave", 1)
        base_wave_diff = 1.0 + wave * 0.05  # natural wave progression

        # Skill-based scaling
        # Skill 5 = neutral, <5 = easier, >5 = harder
        skill_factor = (self.skill_score - 5.0) / 5.0  # range -1 to 1

        # Difficulty multiplier
        target_diff = base_wave_diff + skill_factor * 0.5
        # Smooth transition
        self.difficulty_mult += (target_diff - self.difficulty_mult) * 0.05
        self.difficulty_mult = max(0.5, min(3.0, self.difficulty_mult))

        # Speed multiplier — fast players get faster enemies
        if self.dodge_rate > 0.7:
            target_speed = 1.0 + (self.dodge_rate - 0.5) * 0.8
        else:
            target_speed = 0.8 + self.dodge_rate * 0.4
        self.speed_mult += (target_speed - self.speed_mult) * 0.03
        self.speed_mult = max(0.6, min(2.0, self.speed_mult))

        # Fire rate — accurate dodgers get more bullets
        if self.dodge_rate > 0.6:
            target_fire = 1.0 + (self.dodge_rate - 0.5) * 1.0
        else:
            target_fire = 0.7 + self.dodge_rate * 0.5
        self.fire_rate_mult += (target_fire - self.fire_rate_mult) * 0.03
        self.fire_rate_mult = max(0.5, min(2.5, self.fire_rate_mult))

        # Enemy health scaling
        if self.accuracy > 0.6:
            target_hp = 1.0 + (self.accuracy - 0.5) * 1.0
        else:
            target_hp = 0.8 + self.accuracy * 0.4
        self.health_mult += (target_hp - self.health_mult) * 0.03
        self.health_mult = max(0.5, min(2.0, self.health_mult))

        # Spawn bias — spawn more enemies where player is weak
        patterns = self.detected_patterns
        if patterns.get("position_bias") == "LEFT_HUGGING":
            target_bias = [0.2, 0.35, 0.45]  # more enemies on right
        elif patterns.get("position_bias") == "RIGHT_HUGGING":
            target_bias = [0.45, 0.35, 0.2]  # more enemies on left
        else:
            target_bias = [0.33, 0.34, 0.33]

        for i in range(3):
            self.spawn_bias[i] += (target_bias[i] - self.spawn_bias[i]) * 0.02

    def _generate_insights(self, data: dict):
        """Generate human-readable insights about what the AI is learning"""
        wave = data.get("wave", 1)

        # ── Periodic skill assessment ──
        if self.tick % 15 == 0:
            trend = ""
            if len(self.skill_history) >= 10:
                recent = list(self.skill_history)[-10:]
                older = list(self.skill_history)[-20:-10] if len(self.skill_history) >= 20 else recent
                diff = np.mean(recent) - np.mean(older)
                if diff > 0.3:
                    trend = " ↑ IMPROVING"
                elif diff < -0.3:
                    trend = " ↓ DECLINING"
                else:
                    trend = " → STABLE"
            self._add_insight("skill", f"Skill assessment: {self.skill_score:.1f}/10{trend}", "cyan")

        # ── Pattern detection insights ──
        if self.tick % 12 == 0:
            p = self.detected_patterns

            if p.get("position_bias") == "LEFT_HUGGING":
                self._add_insight("pattern", "Pattern: Player hugging left side → Shifting spawn weights right", "magenta")
            elif p.get("position_bias") == "RIGHT_HUGGING":
                self._add_insight("pattern", "Pattern: Player hugging right side → Shifting spawn weights left", "magenta")

            if p.get("movement_style") == "STATIC_CAMPER":
                self._add_insight("pattern", "⚠ Camping detected — Deploying flanking enemies", "red")
            elif p.get("movement_style") == "ERRATIC":
                self._add_insight("pattern", "Erratic movement detected — Reducing predictive targeting", "yellow")

            if p.get("play_style") == "AGGRESSIVE":
                self._add_insight("pattern", "Aggressive playstyle — Increasing defensive enemy count", "orange")
            elif p.get("play_style") == "DEFENSIVE":
                self._add_insight("pattern", "Defensive playstyle — Deploying faster pursuers", "orange")

            if p.get("dodge_class") == "UNTOUCHABLE":
                self._add_insight("adaptation", "High evasion detected → Increasing bullet density", "red")
            elif p.get("dodge_class") == "TANK_BUILD":
                self._add_insight("adaptation", "Low evasion — Reducing fire rate slightly", "green")

            if p.get("accuracy_class") == "SHARPSHOOTER":
                self._add_insight("adaptation", "High accuracy → Increasing enemy health pools", "yellow")
            elif p.get("accuracy_class") == "SPRAY_AND_PRAY":
                self._add_insight("adaptation", "Low accuracy detected — Maintaining base enemy HP", "green")

        # ── Difficulty change announcements ──
        if self.tick % 20 == 0:
            diff_pct = (self.difficulty_mult - 1.0) * 100
            if diff_pct > 0:
                self._add_insight("difficulty", f"Difficulty scaling: +{diff_pct:.0f}% from baseline", "yellow")
            elif diff_pct < -5:
                self._add_insight("difficulty", f"Difficulty eased: {diff_pct:.0f}% from baseline", "green")

        # ── Health monitoring ──
        if self.tick % 10 == 0:
            hp = data.get("health", 100)
            if hp < 30:
                self._add_insight("monitor", "⚠ Player hull critical — Considering difficulty reduction", "red")
            elif hp > 90 and wave > 3:
                self._add_insight("monitor", "Player dominant — Escalating threat level", "yellow")

        # ── Learning milestones ──
        if self.predictor.train_count == 50:
            self._add_insight("milestone", "★ Neural network: 50 training iterations complete", "gold")
        elif self.predictor.train_count == 200:
            self._add_insight("milestone", "★ Neural network: 200 iterations — Movement model stabilizing", "gold")
        elif self.predictor.train_count == 500:
            self._add_insight("milestone", "★ Neural network: 500 iterations — High confidence movement prediction", "gold")

    def _add_insight(self, category: str, text: str, color: str = "cyan"):
        """Add an insight with cooldown to prevent spam"""
        # Simple cooldown: don't repeat the same message within 10 ticks
        cooldown_key = f"{category}:{text[:30]}"
        current_tick = self.tick
        if cooldown_key in self.insight_cooldowns:
            if current_tick - self.insight_cooldowns[cooldown_key] < 10:
                return
        self.insight_cooldowns[cooldown_key] = current_tick

        insight = {
            "category": category,
            "text": text,
            "color": color,
            "tick": current_tick,
            "timestamp": time.time() - self.start_time,
        }
        self.insights.append(insight)
        self.all_insights_log.append(insight)
