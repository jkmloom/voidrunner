// Written by Jatin Kumar Mehta | github id: jkmloom
/* ═══════════════════════════════════════════════════════════
   Power-Ups — Collectible upgrades
   ═══════════════════════════════════════════════════════════ */

const POWERUP_TYPES = {
  health: {
    color: '#00ff88', label: 'REPAIR', icon: '+', duration: 0,
    apply: (player) => { player.health = Math.min(player.maxHealth, player.health + 30); }
  },
  double: {
    color: '#00f0ff', label: 'DUAL LASER', icon: '‖', duration: 10,
    apply: (player) => { player.weaponType = 'double'; player.weaponTimer = 10; }
  },
  triple: {
    color: '#a855f7', label: 'TRI-SHOT', icon: '⋮', duration: 10,
    apply: (player) => { player.weaponType = 'triple'; player.weaponTimer = 10; }
  },
  spread: {
    color: '#ffd700', label: 'SPREAD FIRE', icon: '⁂', duration: 8,
    apply: (player) => { player.weaponType = 'spread'; player.weaponTimer = 8; }
  },
  rapid: {
    color: '#ff8800', label: 'RAPID FIRE', icon: '»', duration: 6,
    apply: (player) => { player.rapidFire = true; player.rapidTimer = 6; }
  },
  shield: {
    color: '#00ff88', label: 'SHIELD', icon: '◊', duration: 8,
    apply: (player) => { player.shield = true; player.shieldTimer = 8; player.shieldHits = 3; }
  }
};

export class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.def = POWERUP_TYPES[type];
    this.radius = 12;
    this.speed = 70;
    this.alive = true;
    this.age = 0;
  }

  update(dt) {
    this.y += this.speed * dt;
    this.age += dt;
  }

  apply(player) {
    this.def.apply(player);
    this.alive = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const pulse = Math.sin(this.age * 4) * 0.2 + 0.8;

    // Outer glow
    ctx.shadowColor = this.def.color;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = this.def.color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = pulse;

    // Diamond shape
    const r = this.radius;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.stroke();

    // Fill
    ctx.fillStyle = this.def.color + '22';
    ctx.fill();

    // Icon
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.def.color;
    ctx.font = '10px "Share Tech Mono"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.def.icon, 0, 0);

    // Rotating ring
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, this.age * 2, this.age * 2 + Math.PI * 1.2);
    ctx.stroke();

    ctx.restore();
  }

  isOffScreen(canvasH) {
    return this.y > canvasH + this.radius;
  }
}

export { POWERUP_TYPES };
