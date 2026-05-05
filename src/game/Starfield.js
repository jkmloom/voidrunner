// Written by Jatin Kumar Mehta | github id: jkmloom
/* ═══════════════════════════════════════════════════════════
   Starfield — Multi-layer parallax star background
   ═══════════════════════════════════════════════════════════ */

export class Starfield {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.layers = [
      { count: 80, speed: 0.3, size: 1, color: 'rgba(255,255,255,0.3)', stars: [] },
      { count: 50, speed: 0.8, size: 1.5, color: 'rgba(255,255,255,0.5)', stars: [] },
      { count: 30, speed: 1.5, size: 2, color: 'rgba(200,220,255,0.7)', stars: [] },
      { count: 8, speed: 2.5, size: 3, color: 'rgba(0,240,255,0.6)', stars: [] },
    ];
    this._populate();
  }

  _populate() {
    for (const layer of this.layers) {
      layer.stars = [];
      for (let i = 0; i < layer.count; i++) {
        layer.stars.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          twinkle: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this._populate();
  }

  update(dt) {
    for (const layer of this.layers) {
      for (const star of layer.stars) {
        star.y += layer.speed * dt * 60;
        star.twinkle += dt * 2;
        if (star.y > this.height) {
          star.y = -2;
          star.x = Math.random() * this.width;
        }
      }
    }
  }

  draw(ctx) {
    for (const layer of this.layers) {
      for (const star of layer.stars) {
        const alpha = 0.5 + Math.sin(star.twinkle) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = layer.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, layer.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
