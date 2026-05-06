// Written by Jatin Kumar Mehta | github id: jkmloom

/* ═══════════════════════════════════════════════════════════
   Game — Main game controller
   Orchestrates all systems: rendering, physics, UI, audio, ML
   ═══════════════════════════════════════════════════════════ */

import { Player } from './Player.js';
import { Bullet } from './Bullet.js';
import { Starfield } from './Starfield.js';
import { ParticleSystem } from './Particles.js';
import { WaveManager } from './WaveManager.js';
import { PowerUp, POWERUP_TYPES } from './PowerUp.js';
import { AudioManager } from './AudioManager.js';
import { MLConnection } from './MLConnection.js';

// Backend API base URL (same as WebSocket server)
const API_BASE = 'http://localhost:8765';

export class Game {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;

    // Game objects
    this.player = null;
    this.bullets = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = new ParticleSystem();
    this.starfield = null;
    this.waveManager = new WaveManager();
    this.audio = new AudioManager();
    this.ml = null; // ML connection

    // State
    this.state = 'menu'; // 'menu', 'playing', 'paused', 'gameover'
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('voidrunner_highscore') || '0');
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.comboDecay = 2.0; // seconds before combo resets

    // Input
    this.keys = {};

    // Screen shake
    this.shakeTimer = 0;

    // Timing
    this.lastTime = 0;
    this.engineTrailTimer = 0;

    // UI Elements (cached)
    this.ui = {};

    // Leaderboard
    this.leaderboard = [];
    this.pendingLeaderboardScore = null;  // score waiting for name input
  }

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this._cacheUI();
    this._resize();
    this._bindEvents();

    this.starfield = new Starfield(this.width, this.height);
    this.audio.init();

    // Initialize ML connection
    this.ml = new MLConnection(this);
    this.ml.connect();

    // Update high score display
    this.ui.highscoreValue.textContent = this.highScore.toLocaleString();

    // Fetch global leaderboard
    this._fetchLeaderboard();

    // Start render loop (even on menu for starfield)
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  _cacheUI() {
    this.ui = {
      scoreValue: document.getElementById('score-value'),
      waveValue: document.getElementById('wave-value'),
      healthBar: document.getElementById('health-bar'),
      healthText: document.getElementById('health-text'),
      highscoreValue: document.getElementById('highscore-value'),
      comboDisplay: document.getElementById('combo-display'),
      comboValue: document.getElementById('combo-value'),
      comboBar: document.getElementById('combo-bar'),
      powerupIndicator: document.getElementById('powerup-indicator'),
      startScreen: document.getElementById('start-screen'),
      gameoverScreen: document.getElementById('gameover-screen'),
      pauseScreen: document.getElementById('pause-screen'),
      waveAnnounce: document.getElementById('wave-announce'),
      waveAnnounceText: document.getElementById('wave-announce-text'),
      waveAnnounceSub: document.getElementById('wave-announce-sub'),
      finalScore: document.getElementById('final-score'),
      finalWave: document.getElementById('final-wave'),
      finalKills: document.getElementById('final-kills'),
      finalCombo: document.getElementById('final-combo'),
      newHighscore: document.getElementById('new-highscore'),
      container: document.getElementById('game-container'),
      startBtn: document.getElementById('start-btn'),
      restartBtn: document.getElementById('restart-btn'),
      // Leaderboard
      lbBodyStart: document.getElementById('lb-body-start'),
      lbBodyGameover: document.getElementById('lb-body-gameover'),
      // Name modal
      nameModal: document.getElementById('name-modal'),
      nameInput: document.getElementById('player-name-input'),
      nameSubmitBtn: document.getElementById('name-submit-btn'),
    };
  }

  _resize() {
    // Game canvas fills the game-container, not the full window
    const container = document.getElementById('game-container');
    this.width = container.clientWidth;
    this.height = container.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    if (this.starfield) this.starfield.resize(this.width, this.height);
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._resize());

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'Enter' || e.code === 'Space') {
        // Block if name modal is open
        if (this.pendingLeaderboardScore !== null) return;

        if (this.state === 'menu') {
          e.preventDefault();
          this._startGame();
        } else if (this.state === 'gameover') {
          e.preventDefault();
          this._startGame();
        }
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'playing') {
          this._pause();
        } else if (this.state === 'paused') {
          this._resume();
        }
      }

      // Prevent scrolling
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    this.ui.startBtn.addEventListener('click', () => this._startGame());
    this.ui.restartBtn.addEventListener('click', () => this._startGame());

    // Name modal events
    this.ui.nameSubmitBtn.addEventListener('click', () => this._submitLeaderboardName());
    this.ui.nameInput.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this._submitLeaderboardName();
      }
      // Prevent game keys from firing while typing
      e.stopPropagation();
    });

    // Mobile controls setup
    const mobileBtns = document.querySelectorAll('.dpad-btn, .action-btn');
    mobileBtns.forEach(btn => {
      // Touch events
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling / double tap zoom
        const key = btn.getAttribute('data-key');
        if (key) {
          this.keys[key] = true;
          
          if (key === 'Space') {
            if (this.state === 'menu' || this.state === 'gameover') {
              this._startGame();
            }
          }
          if (key === 'KeyP') {
            if (this.state === 'playing') {
              this._pause();
            } else if (this.state === 'paused') {
              this._resume();
            }
          }
        }
        btn.classList.add('btn-active');
      });

      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        const key = btn.getAttribute('data-key');
        if (key) this.keys[key] = false;
        btn.classList.remove('btn-active');
      });

      // Mouse fallback for testing
      btn.addEventListener('mousedown', (e) => {
        const key = btn.getAttribute('data-key');
        if (key) {
          this.keys[key] = true;
          if (key === 'Space' && (this.state === 'menu' || this.state === 'gameover')) this._startGame();
          if (key === 'KeyP') {
            if (this.state === 'playing') this._pause();
            else if (this.state === 'paused') this._resume();
          }
        }
        btn.classList.add('btn-active');
      });
      btn.addEventListener('mouseup', (e) => {
        const key = btn.getAttribute('data-key');
        if (key) this.keys[key] = false;
        btn.classList.remove('btn-active');
      });
      btn.addEventListener('mouseleave', (e) => {
        const key = btn.getAttribute('data-key');
        if (key) this.keys[key] = false;
        btn.classList.remove('btn-active');
      });
    });
  }

  _startGame() {
    // Block if name modal is open
    if (this.pendingLeaderboardScore !== null) return;

    this.audio.resume();
    this.state = 'playing';
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.bullets = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = new ParticleSystem();
    this.waveManager.reset();
    this.player = new Player(this.width / 2, this.height - 80);

    this.ui.startScreen.classList.add('overlay-hidden');
    this.ui.gameoverScreen.classList.add('overlay-hidden');
    this.ui.pauseScreen.classList.add('overlay-hidden');

    // Notify ML backend
    if (this.ml) this.ml.sendReset();

    this._updateHUD();
  }

  _pause() {
    this.state = 'paused';
    this.ui.pauseScreen.classList.remove('overlay-hidden');
  }

  _resume() {
    this.state = 'playing';
    this.ui.pauseScreen.classList.add('overlay-hidden');
    this.lastTime = performance.now();
  }

  _gameOver() {
    this.state = 'gameover';
    this.audio.gameOver();

    // Big explosion on player
    this.particles.explosion(this.player.x, this.player.y, 2.5, ['#00f0ff', '#ff00aa', '#ffd700', '#ff3355', '#ffffff']);

    const isNewHigh = this.score > this.highScore;
    if (isNewHigh) {
      this.highScore = this.score;
      localStorage.setItem('voidrunner_highscore', this.highScore.toString());
      this.ui.highscoreValue.textContent = this.highScore.toLocaleString();
    }

    this.ui.finalScore.textContent = this.score.toLocaleString();
    this.ui.finalWave.textContent = this.waveManager.wave;
    this.ui.finalKills.textContent = this.waveManager.totalKills;
    this.ui.finalCombo.textContent = `x${this.maxCombo}`;

    if (isNewHigh) {
      this.ui.newHighscore.classList.remove('new-hs-hidden');
    } else {
      this.ui.newHighscore.classList.add('new-hs-hidden');
    }

    // Notify ML backend
    if (this.ml) this.ml.sendGameOver();

    // Check leaderboard qualification
    this._checkLeaderboardQualification();

    // Delay showing game over screen
    setTimeout(() => {
      if (this.state === 'gameover') {
        this.ui.gameoverScreen.classList.remove('overlay-hidden');
      }
    }, 800);
  }

  /* ─── Main Loop ─── */
  _loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05); // Cap dt
    this.lastTime = timestamp;

    this._update(dt);
    this._render();

    requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    // Always update starfield and particles
    this.starfield.update(dt);
    this.particles.update(dt);

    if (this.state !== 'playing') return;

    // Player
    this.player.update(dt, this.keys, this.width, this.height);

    // Auto-fire
    if (this.keys['Space'] && this.player.canFire()) {
      const newBullets = this.player.fire();
      for (const b of newBullets) {
        this.bullets.push(new Bullet(b.x, b.y, b.vx, b.vy, false));
      }
      this.audio.shoot();

      // Track for ML
      if (this.ml) this.ml.onShotFired();
    }

    // Engine trail
    this.engineTrailTimer += dt;
    if (this.engineTrailTimer > 0.03) {
      this.engineTrailTimer = 0;
      this.particles.trail(this.player.x, this.player.y + this.player.height / 2);
    }

    // Waves
    const waveResult = this.waveManager.update(dt, this.width, this.enemies);
    if (waveResult.newWave) {
      this._announceWave(waveResult.wave);
      this.audio.waveStart();
    }
    if (waveResult.spawned) {
      this.enemies.push(...waveResult.spawned);
    }

    // Enemies
    for (const enemy of this.enemies) {
      enemy.update(dt);

      // Enemy firing
      if (enemy.canFire()) {
        const eBullets = enemy.fire(this.player.x, this.player.y);
        for (const b of eBullets) {
          this.bullets.push(new Bullet(b.x, b.y, b.vx, b.vy, true));
          // Track for ML
          if (this.ml) this.ml.onEnemyBulletSpawned();
        }
      }
    }

    // Bullets
    for (const bullet of this.bullets) {
      bullet.update(dt);
    }

    // Power-ups
    for (const pu of this.powerups) {
      pu.update(dt);
    }

    // Combo decay
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    // Collisions
    this._checkCollisions();

    // Track dodged bullets (enemy bullets that go off screen without hitting)
    for (const b of this.bullets) {
      if (b.isEnemy && b.isOffScreen(this.width, this.height) && b.alive) {
        if (this.ml) this.ml.onEnemyBulletDodged();
      }
    }

    // Cleanup
    this.bullets = this.bullets.filter(b => b.alive && !b.isOffScreen(this.width, this.height));
    this.enemies = this.enemies.filter(e => e.alive && !e.isOffScreen(this.height));
    this.powerups = this.powerups.filter(p => p.alive && !p.isOffScreen(this.height));

    // Screen shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      if (this.shakeTimer <= 0) {
        this.ui.container.classList.remove('shake');
      }
    }

    // Update HUD
    this._updateHUD();

    // Check game over
    if (!this.player.alive) {
      this._gameOver();
    }
  }

  _checkCollisions() {
    // Player bullets vs enemies
    for (const bullet of this.bullets) {
      if (bullet.isEnemy || !bullet.alive) continue;

      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;

        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitDist = enemy.width / 2 + bullet.radius;

        if (dist < hitDist) {
          bullet.alive = false;
          const killed = enemy.takeDamage(1);

          // Track hit for ML accuracy
          if (this.ml) this.ml.onShotHit();

          if (killed) {
            this._onEnemyKilled(enemy);
          } else {
            this.audio.enemyHit();
            this.particles.burst(bullet.x, bullet.y, 4, [enemy.color, '#ffffff'], {
              speed: 100, life: 0.3, size: 2
            });
          }
          break;
        }
      }
    }

    // Enemy bullets vs player
    if (this.player.alive) {
      for (const bullet of this.bullets) {
        if (!bullet.isEnemy || !bullet.alive) continue;

        const dx = bullet.x - this.player.x;
        const dy = bullet.y - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.player.width / 2 + bullet.radius) {
          bullet.alive = false;
          const hurt = this.player.takeDamage(15);
          if (hurt) {
            this.audio.playerHit();
            this._shake();
            this.particles.burst(this.player.x, this.player.y, 8, ['#ff3355', '#ff8800'], {
              speed: 150, life: 0.4, size: 2
            });
          }
        }
      }

      // Enemy ships vs player (collision)
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;

        const dx = enemy.x - this.player.x;
        const dy = enemy.y - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitDist = (enemy.width + this.player.width) / 2 * 0.7;

        if (dist < hitDist) {
          const hurt = this.player.takeDamage(20);
          if (hurt) {
            this.audio.playerHit();
            this._shake();
          }

          // Kill small enemies on contact
          if (enemy.type !== 'boss' && enemy.type !== 'bomber') {
            enemy.alive = false;
            this.particles.explosion(enemy.x, enemy.y, 0.8, [enemy.color, '#ffffff']);
          }
        }
      }

      // Power-up collection
      for (const pu of this.powerups) {
        if (!pu.alive) continue;

        const dx = pu.x - this.player.x;
        const dy = pu.y - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < pu.radius + this.player.width / 2) {
          pu.apply(this.player);
          this.audio.powerup();
          this._showPowerupNotification(pu.def.label, pu.def.color);
          this.particles.burst(pu.x, pu.y, 12, [pu.def.color, '#ffffff'], {
            speed: 120, life: 0.5, size: 2
          });
          // Track for ML
          if (this.ml) this.ml.onPowerupCollected();
        }
      }
    }
  }

  _onEnemyKilled(enemy) {
    this.waveManager.onEnemyKilled();
    this.audio.enemyDie();

    // Track for ML
    if (this.ml) this.ml.onEnemyKilled();

    // Combo
    this.combo++;
    this.comboTimer = this.comboDecay;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    // Score with combo multiplier
    const multiplier = 1 + Math.floor(this.combo / 5) * 0.5;
    const points = Math.floor(enemy.score * multiplier);
    this.score += points;

    // Explosion
    const size = enemy.type === 'boss' ? 3 : (enemy.type === 'bomber' || enemy.type === 'cruiser') ? 1.5 : 1;
    this.particles.explosion(enemy.x, enemy.y, size, [enemy.color, enemy.accentColor, '#ffffff', '#ffd700']);

    if (enemy.type === 'boss') {
      this._shake(0.3);
    }

    // Score pop animation
    this.ui.scoreValue.classList.add('score-pop');
    setTimeout(() => this.ui.scoreValue.classList.remove('score-pop'), 100);

    // Drop power-up chance
    const dropChance = enemy.type === 'boss' ? 1.0 : (enemy.type === 'bomber' ? 0.5 : 0.12);
    if (Math.random() < dropChance) {
      this._spawnPowerup(enemy.x, enemy.y);
    }
  }

  _spawnPowerup(x, y) {
    const types = Object.keys(POWERUP_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    this.powerups.push(new PowerUp(x, y, type));
    // Track for ML
    if (this.ml) this.ml.onPowerupSpawned();
  }

  _shake(duration = 0.15) {
    this.shakeTimer = duration;
    this.ui.container.classList.add('shake');
  }

  _announceWave(wave) {
    const el = this.ui.waveAnnounce;
    const isBoss = wave % 5 === 0;

    this.ui.waveAnnounceText.textContent = isBoss ? `BOSS WAVE ${wave}` : `WAVE ${wave}`;
    this.ui.waveAnnounceSub.textContent = isBoss ? '⚠ DANGER ⚠' : 'INCOMING';

    if (isBoss) {
      this.ui.waveAnnounceText.style.color = '#ff3355';
      this.ui.waveAnnounceText.style.textShadow = '0 0 30px rgba(255,51,85,0.5), 0 0 60px rgba(255,51,85,0.3)';
    } else {
      this.ui.waveAnnounceText.style.color = '';
      this.ui.waveAnnounceText.style.textShadow = '';
    }

    el.classList.remove('wave-announce-hidden');
    // Force reflow for animation restart
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = '';

    setTimeout(() => el.classList.add('wave-announce-hidden'), 2000);
  }

  _showPowerupNotification(label, color) {
    const el = this.ui.powerupIndicator;
    el.textContent = label;
    el.style.color = color;
    el.style.borderColor = color + '44';
    el.classList.remove('powerup-hidden');
    setTimeout(() => el.classList.add('powerup-hidden'), 2000);
  }

  _updateHUD() {
    if (!this.player) return;

    this.ui.scoreValue.textContent = this.score.toLocaleString();
    this.ui.waveValue.textContent = this.waveManager.wave;

    // Health bar
    const hp = this.player.health / this.player.maxHealth;
    this.ui.healthBar.style.width = `${hp * 100}%`;
    this.ui.healthText.textContent = `${Math.ceil(this.player.health)}%`;

    // Health bar color
    if (hp < 0.3) {
      this.ui.healthBar.style.background = '#ff3355';
    } else if (hp < 0.6) {
      this.ui.healthBar.style.background = 'linear-gradient(90deg, #ff8800, #ffd700)';
    } else {
      this.ui.healthBar.style.background = 'linear-gradient(90deg, #00ff88, #00f0ff)';
    }

    // Combo
    if (this.combo > 1) {
      this.ui.comboDisplay.classList.remove('combo-hidden');
      this.ui.comboValue.textContent = `x${this.combo}`;
      this.ui.comboBar.style.width = `${(this.comboTimer / this.comboDecay) * 100}%`;

      // Color based on combo
      if (this.combo >= 20) {
        this.ui.comboValue.style.color = '#ffd700';
      } else if (this.combo >= 10) {
        this.ui.comboValue.style.color = '#ff8800';
      } else {
        this.ui.comboValue.style.color = '#ff00aa';
      }
    } else {
      this.ui.comboDisplay.classList.add('combo-hidden');
    }
  }

  /* ─── Rendering ─── */
  _render() {
    const ctx = this.ctx;

    // Clear
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, this.width, this.height);

    // Starfield
    this.starfield.draw(ctx);

    // Grid lines (subtle)
    this._drawGrid(ctx);

    // Game objects (only when playing or gameover for death animation)
    if (this.state === 'playing' || this.state === 'gameover' || this.state === 'paused') {
      // Power-ups
      for (const pu of this.powerups) pu.draw(ctx);

      // Bullets
      for (const bullet of this.bullets) bullet.draw(ctx);

      // Enemies
      for (const enemy of this.enemies) enemy.draw(ctx);

      // Player
      if (this.player && this.player.alive) this.player.draw(ctx);
    }

    // Particles (always render)
    this.particles.draw(ctx);
  }

  _drawGrid(ctx) {
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 0.5;

    const gridSize = 60;
    const offsetY = (Date.now() * 0.02) % gridSize;

    for (let x = 0; x < this.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = -gridSize + offsetY; y < this.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  /* ─── Leaderboard ─── */
  async _fetchLeaderboard() {
    try {
      const res = await fetch(`${API_BASE}/leaderboard`);
      const data = await res.json();
      this.leaderboard = data.leaderboard || [];
      this._renderLeaderboard();
    } catch (e) {
      // Backend offline — show empty state
      this.leaderboard = [];
      this._renderLeaderboard();
    }
  }

  _renderLeaderboard(highlightName = null) {
    const bodies = [this.ui.lbBodyStart, this.ui.lbBodyGameover];

    for (const tbody of bodies) {
      if (!tbody) continue;

      if (this.leaderboard.length === 0 || this.leaderboard.every(e => e.score === 0)) {
        tbody.innerHTML = '<tr><td colspan="4" class="lb-empty">NO SCORES YET — BE THE FIRST</td></tr>';
        continue;
      }

      tbody.innerHTML = this.leaderboard.map((entry, i) => {
        const isHighlight = highlightName && entry.name === highlightName;
        const cls = isHighlight ? ' class="lb-highlight"' : '';
        return `<tr${cls}>` +
          `<td class="lb-rank">${i + 1}</td>` +
          `<td class="lb-name">${entry.name}</td>` +
          `<td class="lb-score">${entry.score.toLocaleString()}</td>` +
          `<td class="lb-wave">${entry.wave}</td>` +
          `</tr>`;
      }).join('');
    }
  }

  _checkLeaderboardQualification() {
    const score = this.score;
    if (score <= 0) return;

    // Qualifies if less than 5 entries or beats the lowest score
    const qualifies = this.leaderboard.length < 5 ||
      this.leaderboard.some(e => score > e.score) ||
      this.leaderboard.every(e => e.score === 0);

    if (qualifies) {
      this.pendingLeaderboardScore = {
        score: score,
        wave: this.waveManager.wave,
      };
      // Show name modal after the game over screen appears
      setTimeout(() => {
        this.ui.nameModal.classList.remove('overlay-hidden');
        this.ui.nameInput.value = '';
        this.ui.nameInput.focus();
      }, 1200);
    }
  }

  async _submitLeaderboardName() {
    if (this.pendingLeaderboardScore === null) return;

    const name = this.ui.nameInput.value.trim() || 'PILOT';
    const payload = {
      name: name,
      score: this.pendingLeaderboardScore.score,
      wave: this.pendingLeaderboardScore.wave,
    };

    this.pendingLeaderboardScore = null;
    this._hideNameModal();

    try {
      const res = await fetch(`${API_BASE}/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.leaderboard) {
        this.leaderboard = data.leaderboard;
        this._renderLeaderboard(name.toUpperCase().slice(0, 12));
      }
    } catch (e) {
      // Backend offline — silent fail
      console.warn('Failed to submit leaderboard score:', e);
    }
  }

  _hideNameModal() {
    this.ui.nameModal.classList.add('overlay-hidden');
    this.ui.nameInput.blur();
  }
}
