// Written by Jatin Kumar Mehta | github id: jkmloom
/* ═══════════════════════════════════════════════════════════
   Player Ship — The void runner itself
   ═══════════════════════════════════════════════════════════ */

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 28;
    this.height = 36;
    this.speed = 320;
    this.health = 100;
    this.maxHealth = 100;
    this.alive = true;
    this.invincible = false;
    this.invincibleTimer = 0;

    // Weapon
    this.fireRate = 0.15; // seconds between shots
    this.fireTimer = 0;
    this.weaponType = 'single'; // 'single', 'double', 'triple', 'spread'
    this.weaponTimer = 0; // power-up duration

    // Rapid fire
    this.rapidFire = false;
    this.rapidTimer = 0;

    // Shield
    this.shield = false;
    this.shieldTimer = 0;
    this.shieldHits = 0;

    // Visual
    this.tilt = 0; // ship tilt for banking effect
    this.engineGlow = 0;
  }

  update(dt, keys, canvasW, canvasH) {
    // Movement
    let dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
    if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) dy += 1;

    // Normalize diagonal
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }

    this.x += dx * this.speed * dt;
    this.y += dy * this.speed * dt;

    // Clamp to screen
    const margin = 10;
    this.x = Math.max(this.width / 2 + margin, Math.min(canvasW - this.width / 2 - margin, this.x));
    this.y = Math.max(this.height / 2 + margin, Math.min(canvasH - this.height / 2 - margin, this.y));

    // Tilt
    this.tilt += (dx * 0.35 - this.tilt) * 8 * dt;

    // Engine glow
    this.engineGlow = 0.6 + Math.sin(Date.now() * 0.01) * 0.4;

    // Timers
    this.fireTimer -= dt;
    if (this.fireTimer < 0) this.fireTimer = 0;

    // Invincibility
    if (this.invincible) {
      this.invincibleTimer -= dt;
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
      }
    }

    // Weapon power-up timer
    if (this.weaponTimer > 0) {
      this.weaponTimer -= dt;
      if (this.weaponTimer <= 0) {
        this.weaponType = 'single';
      }
    }

    // Rapid fire timer
    if (this.rapidFire) {
      this.rapidTimer -= dt;
      if (this.rapidTimer <= 0) {
        this.rapidFire = false;
        this.fireRate = 0.15;
      }
    }

    // Shield timer
    if (this.shield) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shield = false;
      }
    }
  }

  canFire() {
    return this.fireTimer <= 0;
  }

  fire() {
    this.fireTimer = this.rapidFire ? 0.06 : this.fireRate;
    const bullets = [];
    const bulletSpeed = -600;

    switch (this.weaponType) {
      case 'double':
        bullets.push(
          { x: this.x - 8, y: this.y - this.height / 2, vx: 0, vy: bulletSpeed },
          { x: this.x + 8, y: this.y - this.height / 2, vx: 0, vy: bulletSpeed }
        );
        break;
      case 'triple':
        bullets.push(
          { x: this.x, y: this.y - this.height / 2, vx: 0, vy: bulletSpeed },
          { x: this.x - 6, y: this.y - this.height / 2 + 4, vx: -60, vy: bulletSpeed },
          { x: this.x + 6, y: this.y - this.height / 2 + 4, vx: 60, vy: bulletSpeed }
        );
        break;
      case 'spread':
        for (let i = -2; i <= 2; i++) {
          const angle = -Math.PI / 2 + i * 0.15;
          bullets.push({
            x: this.x,
            y: this.y - this.height / 2,
            vx: Math.cos(angle) * -bulletSpeed,
            vy: Math.sin(angle) * -bulletSpeed * -1
          });
        }
        break;
      default: // single
        bullets.push({ x: this.x, y: this.y - this.height / 2, vx: 0, vy: bulletSpeed });
    }

    return bullets;
  }

  takeDamage(amount) {
    if (this.invincible) return false;

    if (this.shield) {
      this.shieldHits--;
      if (this.shieldHits <= 0) {
        this.shield = false;
      }
      return false;
    }

    this.health -= amount;
    this.invincible = true;
    this.invincibleTimer = 1.0;

    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
    return true;
  }

  draw(ctx) {
    if (!this.alive) return;

    // Blink when invincible
    if (this.invincible && Math.floor(this.invincibleTimer * 10) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);

    // Engine exhaust glow
    const gradient = ctx.createRadialGradient(0, this.height / 2 + 4, 0, 0, this.height / 2 + 4, 16);
    gradient.addColorStop(0, `rgba(0, 240, 255, ${0.8 * this.engineGlow})`);
    gradient.addColorStop(0.4, `rgba(0, 150, 255, ${0.4 * this.engineGlow})`);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, this.height / 2 + 6, 8, 14 + Math.random() * 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ship body
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;

    // Main hull
    ctx.fillStyle = '#0d1b2a';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -this.height / 2);           // Nose
    ctx.lineTo(-this.width / 2, this.height / 3);  // Left wing
    ctx.lineTo(-this.width / 4, this.height / 2);  // Left exhaust
    ctx.lineTo(this.width / 4, this.height / 2);   // Right exhaust
    ctx.lineTo(this.width / 2, this.height / 3);   // Right wing
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cockpit
    ctx.shadowBlur = 0;
    const cockpitGrad = ctx.createLinearGradient(0, -8, 0, 6);
    cockpitGrad.addColorStop(0, '#00f0ff');
    cockpitGrad.addColorStop(1, '#0055aa');
    ctx.fillStyle = cockpitGrad;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-5, 2);
    ctx.lineTo(0, 6);
    ctx.lineTo(5, 2);
    ctx.closePath();
    ctx.fill();

    // Wing accents
    ctx.strokeStyle = '#ff00aa';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#ff00aa';
    ctx.shadowBlur = 4;
    // Left wing line
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-this.width / 2 + 4, this.height / 3 - 4);
    ctx.stroke();
    // Right wing line
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(this.width / 2 - 4, this.height / 3 - 4);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Shield visual
    if (this.shield) {
      const shieldAlpha = 0.3 + Math.sin(Date.now() * 0.008) * 0.15;
      ctx.strokeStyle = `rgba(0, 255, 136, ${shieldAlpha})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, this.width * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}
