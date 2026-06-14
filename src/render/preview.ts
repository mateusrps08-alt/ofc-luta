import { Fighter } from "../fighter/fighter";
import { FighterStats } from "../fighter/fighter";
import { drawFighter, SKINS } from "./renderer";

// Mini-render de um lutador parado (idle) num canvas pequeno — usado nos cards de seleção.
export class FighterPreview {
  private f: Fighter;
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);

  constructor(private canvas: HTMLCanvasElement, skinId: number, stats: FighterStats, seed = 0) {
    this.f = new Fighter({ x: 0, y: 0 }, 1, stats, "", skinId);
    // dessincroniza o idle entre os cards
    this.f.advance(seed);
    this.ctx = canvas.getContext("2d")!;
    this.fit();
  }

  fit() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, r.width * this.dpr);
    this.canvas.height = Math.max(1, r.height * this.dpr);
  }

  frame(dt: number) {
    this.f.advance(dt);
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = (h / this.dpr) / 285; // cabe na altura com folga
    ctx.setTransform(this.dpr * s, 0, 0, this.dpr * s, w / 2, h * 0.6);
    drawFighter(ctx, this.f.bones(), 105, SKINS[this.f.skinId]);
  }
}
