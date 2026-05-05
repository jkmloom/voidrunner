// Written by Jatin Kumar Mehta | github id: jkmloom
/* ═══════════════════════════════════════════════════════════
   Particle System — Explosions, trails, and effects
   ═══════════════════════════════════════════════════════════ */

export class Particle {
  constructor(x, y, vx, vy, life, size, color, type = 'circle') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.color = color;
    this.type = type; // 'circle', 'spark', 'ring'
    this.alive = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
    // Slow down
    this.vx *= 0.98;
    this.vy *= 0.98;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    const currentSize = this.size * (0.5 + alpha * 0.5);

    ctx.globalAlpha = alpha;

    if (this.type === 'spark') {
      const len = currentSize * 3;
      const angle = Math.atan2(this.vy, this.vx);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = currentSize * 0.5;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(this.x - Math.cos(angle) * len, this.y - Math.sin(angle) * len);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (this.type === 'ring') {
      const radius = this.size * (1 - alpha) * 3;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = currentSize * alpha;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
  }
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  add(particle) {
    this.particles.push(particle);
  }

  /** Burst of particles at a point */
  burst(x, y, count, colors, opts = {}) {
    const speed = opts.speed || 200;
    const life = opts.life || 0.6;
    const size = opts.size || 2;
    const type = opts.type || 'circle';

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const spd = speed * (0.3 + Math.random() * 0.7);
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.add(new Particle(
        x, y,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        life * (0.5 + Math.random() * 0.5),
        size * (0.5 + Math.random()),
        color,
        type
      ));
    }
  }

  /** Explosion effect — combo of ring + sparks + circles */
  explosion(x, y, size = 1, colors = ['#00f0ff', '#ff00aa', '#ffd700', '#ffffff']) {
    // Ring
    this.add(new Particle(x, y, 0, 0, 0.4 * size, 20 * size, colors[0], 'ring'));
    // Sparks
    this.burst(x, y, Math.floor(12 * size), colors, {
      speed: 300 * size, life: 0.5, size: 2, type: 'spark'
    });
    // Debris
    this.burst(x, y, Math.floor(8 * size), colors, {
      speed: 150 * size, life: 0.8, size: 3, type: 'circle'
    });
  }

  /** Engine trail */
  trail(x, y, color = '#00f0ff') {
    this.add(new Particle(
      x + (Math.random() - 0.5) * 4,
      y,
      (Math.random() - 0.5) * 20,
      40 + Math.random() * 30,
      0.3 + Math.random() * 0.2,
      1 + Math.random() * 2,
      color,
      'circle'
    ));
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (!this.particles[i].alive) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      p.draw(ctx);
    }
  }
}
