// Written by Jatin Kumar Mehta | github id: jkmloom
/* ═══════════════════════════════════════════════════════════
   Wave Manager — Procedural infinite wave generation
   Now with ML-driven adaptive difficulty
   ═══════════════════════════════════════════════════════════ */

import { Enemy } from './Enemy.js';

export class WaveManager {
  constructor() {
    this.wave = 0;
    this.enemiesRemaining = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveDelay = 3.0; // seconds between waves
    this.waveDelayTimer = 0;
    this.betweenWaves = true;
    this.totalKills = 0;

    // ML difficulty multipliers (set by MLConnection)
    this.mlDifficultyMult = 1.0;
    this.mlSpeedMult = 1.0;
    this.mlFireRateMult = 1.0;
    this.mlHealthMult = 1.0;
    this.mlSpawnBias = [0.33, 0.34, 0.33]; // left, center, right
  }

  reset() {
    this.wave = 0;
    this.enemiesRemaining = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveDelayTimer = 2.0;
    this.betweenWaves = true;
    this.totalKills = 0;

    // Reset ML multipliers
    this.mlDifficultyMult = 1.0;
    this.mlSpeedMult = 1.0;
    this.mlFireRateMult = 1.0;
    this.mlHealthMult = 1.0;
    this.mlSpawnBias = [0.33, 0.34, 0.33];
  }

  /** Generate the wave composition based on wave number + ML adjustments */
  _generateWave(waveNum, canvasW) {
    const queue = [];
    const difficulty = Math.floor(waveNum / 5); // Difficulty tier

    // Base count scales with wave, amplified by ML difficulty
    const baseCount = Math.floor((4 + Math.floor(waveNum * 1.3)) * this.mlDifficultyMult);
    const maxCount = Math.min(baseCount, 35);

    // Determine available enemy types based on wave
    const types = ['scout'];
    if (waveNum >= 2) types.push('drone');
    if (waveNum >= 4) types.push('speeder');
    if (waveNum >= 6) types.push('cruiser');
    if (waveNum >= 10) types.push('bomber');

    // Boss every 5 waves
    const isBossWave = waveNum % 5 === 0 && waveNum > 0;

    // Use ML spawn bias to determine X positions
    const [leftBias, centerBias, rightBias] = this.mlSpawnBias;

    for (let i = 0; i < maxCount; i++) {
      const type = types[Math.floor(Math.random() * types.length)];

      // Biased X position based on ML spawn bias
      const roll = Math.random();
      let x;
      if (roll < leftBias) {
        // Left third
        x = 40 + Math.random() * (canvasW / 3 - 60);
      } else if (roll < leftBias + centerBias) {
        // Center third
        x = canvasW / 3 + Math.random() * (canvasW / 3);
      } else {
        // Right third
        x = (2 * canvasW / 3) + Math.random() * (canvasW / 3 - 40);
      }

      const delay = i * (0.4 - Math.min(difficulty * 0.03, 0.25)); // Spawn faster as difficulty increases

      queue.push({ type, x, delay });
    }

    // Add boss
    if (isBossWave) {
      const bossHealth = Math.floor((30 + waveNum * 4) * this.mlHealthMult);
      queue.push({
        type: 'boss',
        x: canvasW / 2,
        delay: (maxCount + 1) * 0.3,
        overrideHealth: bossHealth
      });
    }

    return queue;
  }

  update(dt, canvasW, enemies) {
    if (this.betweenWaves) {
      this.waveDelayTimer -= dt;
      if (this.waveDelayTimer <= 0) {
        this.wave++;
        this.spawnQueue = this._generateWave(this.wave, canvasW);
        this.enemiesRemaining = this.spawnQueue.length;
        this.spawnTimer = 0;
        this.betweenWaves = false;
        return { newWave: true, wave: this.wave };
      }
      return { newWave: false };
    }

    // Spawn from queue
    this.spawnTimer += dt;
    const toSpawn = [];
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const entry = this.spawnQueue[i];
      if (this.spawnTimer >= entry.delay) {
        const enemy = new Enemy(entry.type, entry.x, -40, canvasW);

        // Apply ML multipliers to spawned enemies
        enemy.speed *= this.mlSpeedMult;
        enemy.fireRate /= this.mlFireRateMult; // lower = fires faster
        enemy.bulletSpeed *= this.mlSpeedMult * 0.8 + 0.2; // slight bullet speed increase

        if (entry.type !== 'boss') {
          enemy.health = Math.max(1, Math.round(enemy.health * this.mlHealthMult));
          enemy.maxHealth = enemy.health;
        }

        if (entry.overrideHealth) {
          enemy.health = entry.overrideHealth;
          enemy.maxHealth = entry.overrideHealth;
        }

        toSpawn.push(enemy);
        this.spawnQueue.splice(i, 1);
      }
    }

    // Check if wave is complete
    if (this.spawnQueue.length === 0 && enemies.length === 0) {
      this.betweenWaves = true;
      this.waveDelayTimer = this.waveDelay;
    }

    return { newWave: false, spawned: toSpawn };
  }

  onEnemyKilled() {
    this.totalKills++;
  }
}
