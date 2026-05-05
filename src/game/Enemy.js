// Written by Jatin Kumar Mehta | github id: jkmloom
/* ═══════════════════════════════════════════════════════════
   Enemy Types — Various enemy ships with AI patterns
   ═══════════════════════════════════════════════════════════ */

const ENEMY_DEFS = {
  scout: {
    width: 20, height: 22, speed: 120, health: 1, score: 100,
    color: '#ff3355', accentColor: '#ff6688',
    fireRate: 2.5, bulletSpeed: 250, pattern: 'straight'
  },
  drone: {
    width: 24, height: 24, speed: 90, health: 2, score: 200,
    color: '#ff8800', accentColor: '#ffaa44',
    fireRate: 1.8, bulletSpeed: 220, pattern: 'zigzag'
  },
  cruiser: {
    width: 30, height: 30, speed: 60, health: 5, score: 500,
    color: '#a855f7', accentColor: '#c084fc',
    fireRate: 1.2, bulletSpeed: 200, pattern: 'straight'
  },
  speeder: {
    width: 18, height: 20, speed: 200, health: 1, score: 150,
    color: '#00ff88', accentColor: '#66ffbb',
    fireRate: 3.0, bulletSpeed: 300, pattern: 'sine'
  },
  bomber: {
    width: 34, height: 34, speed: 50, health: 8, score: 800,
    color: '#ffd700', accentColor: '#ffe555',
    fireRate: 0.8, bulletSpeed: 180, pattern: 'straight'
  },
  boss: {
    width: 60, height: 50, speed: 40, health: 50, score: 5000,
    color: '#ff0055', accentColor: '#ff3388',
    fireRate: 0.4, bulletSpeed: 200, pattern: 'boss'
  }
};

export class Enemy {
  constructor(type, x, y, canvasW) {
    const def = ENEMY_DEFS[type];
    Object.assign(this, def);
    this.type = type;
    this.x = x;
    this.y = y;
    this.canvasW = canvasW;
    this.maxHealth = def.health;
    this.alive = true;
    this.fireTimer = Math.random() * def.fireRate;
    this.age = 0;
    this.spawnX = x;
    this.hitFlash = 0;

    // Zigzag state
    this.zigDir = Math.random() > 0.5 ? 1 : -1;
    this.zigTimer = 0;

    // Sine state
    this.sineOffset = Math.random() * Math.PI * 2;

    // Boss state
    this.bossPhase = 0;
    this.bossDir = 1;
  }

  update(dt) {
    this.age += dt;
    this.fireTimer -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    switch (this.pattern) {
      case 'straight':
        this.y += this.speed * dt;
        break;
      case 'zigzag':
        this.y += this.speed * dt;
        this.zigTimer += dt;
        if (this.zigTimer > 1.0) {
          this.zigDir *= -1;
          this.zigTimer = 0;
        }
        this.x += this.zigDir * this.speed * 0.8 * dt;
        break;
      case 'sine':
        this.y += this.speed * dt;
        this.x = this.spawnX + Math.sin(this.age * 2.5 + this.sineOffset) * 80;
        break;
      case 'boss':
        // Boss hovers at top and moves side to side
        const targetY = 80;
        if (this.y < targetY) {
          this.y += this.speed * dt;
        } else {
          this.y = targetY + Math.sin(this.age * 0.5) * 10;
          this.x += this.bossDir * 60 * dt;
          if (this.x < 80 || this.x > this.canvasW - 80) {
            this.bossDir *= -1;
          }
        }
        break;
    }

    // Clamp x
    if (this.type !== 'boss') {
      this.x = Math.max(this.width / 2, Math.min(this.canvasW - this.width / 2, this.x));
    }
  }

  canFire() {
    return this.fireTimer <= 0 && this.y > 0 && this.y < this.canvasW;
  }

  fire(playerX, playerY) {
    this.fireTimer = this.fireRate * (0.8 + Math.random() * 0.4);
    const bullets = [];

    if (this.type === 'boss') {
      // Boss fires spread patterns
      const cx = this.x, cy = this.y + this.height / 2;
      for (let i = -2; i <= 2; i++) {
        const angle = Math.PI / 2 + i * 0.2;
        bullets.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * this.bulletSpeed,
          vy: Math.sin(angle) * this.bulletSpeed,
          enemy: true
        });
      }
    } else if (this.type === 'bomber') {
      // Bomber fires aimed shots
      const dx = playerX - this.x;
      const dy = playerY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      bullets.push({
        x: this.x, y: this.y + this.height / 2,
        vx: (dx / dist) * this.bulletSpeed,
        vy: (dy / dist) * this.bulletSpeed,
        enemy: true
      });
    } else {
      // Standard downward shot
      bullets.push({
        x: this.x, y: this.y + this.height / 2,
        vx: 0, vy: this.bulletSpeed,
        enemy: true
      });
    }

    return bullets;
  }

  takeDamage(amount) {
    this.health -= amount;
    this.hitFlash = 0.1;
    if (this.health <= 0) {
      this.alive = false;
    }
    return !this.alive;
  }

  draw(ctx) {
    if (!this.alive) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    const flashColor = this.hitFlash > 0 ? '#ffffff' : null;
    const mainColor = flashColor || this.color;
    const accent = flashColor || this.accentColor;

    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 8;

    if (this.type === 'boss') {
      this._drawBoss(ctx, mainColor, accent);
    } else {
      this._drawStandard(ctx, mainColor, accent);
    }

    // Health bar for enemies with health > 2
    if (this.maxHealth > 2) {
      const barW = this.width * 1.2;
      const barH = 3;
      const barY = -this.height / 2 - 8;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(-barW / 2, barY, barW, barH);
      ctx.fillStyle = this.color;
      ctx.fillRect(-barW / 2, barY, barW * (this.health / this.maxHealth), barH);
    }

    ctx.restore();
  }

  _drawStandard(ctx, color, accent) {
    const w = this.width / 2;
    const h = this.height / 2;

    // Body
    ctx.fillStyle = '#1a0a20';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, h);          // Bottom point (nose facing down)
    ctx.lineTo(-w, -h * 0.6);
    ctx.lineTo(-w * 0.4, -h);
    ctx.lineTo(w * 0.4, -h);
    ctx.lineTo(w, -h * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Center accent
    ctx.shadowBlur = 0;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, 0, this.width * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBoss(ctx, color, accent) {
    const w = this.width / 2;
    const h = this.height / 2;

    // Main hull
    ctx.fillStyle = '#200020';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(-w * 0.3, h * 0.7);
    ctx.lineTo(-w, 0);
    ctx.lineTo(-w * 0.8, -h * 0.6);
    ctx.lineTo(-w * 0.3, -h);
    ctx.lineTo(w * 0.3, -h);
    ctx.lineTo(w * 0.8, -h * 0.6);
    ctx.lineTo(w, 0);
    ctx.lineTo(w * 0.3, h * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wings
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.lineTo(-w * 1.3, -h * 0.3);
    ctx.lineTo(-w * 1.1, h * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w * 1.3, -h * 0.3);
    ctx.lineTo(w * 1.1, h * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Core
    ctx.shadowBlur = 15;
    ctx.shadowColor = accent;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, -h * 0.2, 6 + Math.sin(this.age * 5) * 2, 0, Math.PI * 2);
    ctx.fill();

    // Eye accents
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-w * 0.4, -h * 0.3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.4, -h * 0.3, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  isOffScreen(canvasH) {
    return this.y > canvasH + this.height;
  }
}

export { ENEMY_DEFS };
