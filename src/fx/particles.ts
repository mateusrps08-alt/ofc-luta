import { Vec } from "../engine/math";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
  size: number; color: string;
  grav: number;
}

interface Flash {
  x: number; y: number; life: number; max: number; size: number;
}

export class Particles {
  private ps: Particle[] = [];
  private flashes: Flash[] = [];

  impact(at: Vec, power: number) {
    // flash cartoon de impacto
    this.flashes.push({ x: at.x, y: at.y, life: 0.12, max: 0.12, size: 30 + power * 40 });
    // faíscas/sangue
    const n = Math.floor(8 + power * 16);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 260 * power;
      const blood = Math.random() < 0.6;
      this.ps.push({
        x: at.x, y: at.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: 0, max: 0.4 + Math.random() * 0.5,
        size: blood ? 3 + Math.random() * 4 : 2 + Math.random() * 2,
        color: blood ? "#c81e1e" : "#ffd23f",
        grav: blood ? 900 : 200,
      });
    }
  }

  block(at: Vec) {
    this.flashes.push({ x: at.x, y: at.y, life: 0.1, max: 0.1, size: 20 });
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 140;
      this.ps.push({
        x: at.x, y: at.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0, max: 0.25 + Math.random() * 0.2,
        size: 2 + Math.random() * 2, color: "#cfe8ff", grav: 300,
      });
    }
  }

  update(dt: number) {
    for (const p of this.ps) {
      p.life += dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.ps = this.ps.filter((p) => p.life < p.max);
    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter((f) => f.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.ps) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of this.flashes) {
      const k = f.life / f.max;
      drawStar(ctx, f.x, f.y, f.size * (0.6 + k * 0.6), "#fff7d6", k);
    }
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  const spikes = 8;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (i / (spikes * 2)) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}
