// Written by Jatin Kumar Mehta | github id: jkmloom
/* ═══════════════════════════════════════════════════════════
   Bullet — Projectiles for player and enemies
   ═══════════════════════════════════════════════════════════ */

export class Bullet {
  constructor(x, y, vx, vy, isEnemy = false) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.isEnemy = isEnemy;
    this.alive = true;
    this.radius = isEnemy ? 3 : 2.5;
    this.age = 0;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.age += dt;
  }

  draw(ctx) {
    ctx.save();

    if (this.isEnemy) {
      // Enemy bullets — red/orange glow
      ctx.shadowColor = '#ff3355';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ff5566';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffaaaa';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Player bullets — cyan laser bolt
      const len = 10;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x, this.y + len);
      ctx.stroke();

      // Bright core
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#aaffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x, this.y + 6);
      ctx.stroke();
    }

    ctx.restore();
  }

  isOffScreen(w, h) {
    return this.x < -10 || this.x > w + 10 || this.y < -20 || this.y > h + 20;
  }
}
