import { Vec } from "../engine/math";
import { Bones } from "../fighter/skeleton";
import { Wound } from "../fighter/fighter";

export interface Skin {
  body: string;   // pele dos braços/pernas
  outline: string;
  glove: string;
  head: string;   // pele do rosto
  trunks: string;        // cor base do short
  shortsAccent: string;  // cor da estampa
  shortsPattern: "stripe" | "split" | "stars" | "flame" | "tribal";
  hair: string;
  hairStyle: "short" | "full" | "curly";
  hairVol?: number; // multiplicador de volume (default 1)
}

const O = "#0e0a07"; // contorno escuro padrão
export const SKINS: Skin[] = [
  // Silva — pele clara, curto escuro · short vermelho com chamas
  { body: "#cf9a6c", head: "#d9a87a", trunks: "#b3261f", shortsAccent: "#f1c40f", shortsPattern: "flame", glove: "#f1c40f", hair: "#241710", hairStyle: "short", outline: O },
  // Luan — pele média, cabelo cheio · short azul listrado
  { body: "#bd9266", head: "#caa074", trunks: "#1f3a8a", shortsAccent: "#ffffff", shortsPattern: "stripe", glove: "#e74c3c", hair: "#1d140d", hairStyle: "full", hairVol: 1.08, outline: O },
  // Zezeca — pele clara, raspadinho · short verde-água com estrelas
  { body: "#d09c70", head: "#dcab80", trunks: "#137a63", shortsAccent: "#eafff8", shortsPattern: "stars", glove: "#f39c12", hair: "#2a1d12", hairStyle: "short", outline: O },
  // Chagas — pele morena, cacheado · short roxo tribal
  { body: "#9e6f49", head: "#ab7a52", trunks: "#6b2f8a", shortsAccent: "#f1c40f", shortsPattern: "tribal", glove: "#f1c40f", hair: "#1a110a", hairStyle: "curly", hairVol: 1.15, outline: O },
  // Lipe — pele morena, raspadinho · short azul bicolor
  { body: "#a6764a", head: "#b3814f", trunks: "#1d6fa8", shortsAccent: "#ffffff", shortsPattern: "split", glove: "#ecf0f1", hair: "#1a120b", hairStyle: "short", outline: O },
  // Rigueira — pele clara, cabelo claro · short verde listrado
  { body: "#d8ab83", head: "#e4b78f", trunks: "#2f7d3f", shortsAccent: "#eafff0", shortsPattern: "stripe", glove: "#e67e22", hair: "#b59a6a", hairStyle: "full", hairVol: 1.14, outline: O },
  // Luiz — pele média, raspadinho · short laranja bicolor
  { body: "#b9875f", head: "#c5926a", trunks: "#c0561f", shortsAccent: "#14213a", shortsPattern: "split", glove: "#28407a", hair: "#221610", hairStyle: "short", outline: O },
  // Barbosa — pele morena, cacheado · short cinza com estrelas
  { body: "#a4744c", head: "#b07f55", trunks: "#34495e", shortsAccent: "#e74c3c", shortsPattern: "stars", glove: "#e74c3c", hair: "#19110a", hairStyle: "curly", hairVol: 1.45, outline: O },
];

// desenha segmento como capsula grossa com contorno (estilo cartoon)
function limb(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, w: number, fill: string, outline: string) {
  ctx.lineCap = "round";
  ctx.strokeStyle = outline;
  ctx.lineWidth = w + 6;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function glove(ctx: CanvasRenderingContext2D, at: Vec, r: number, skin: Skin) {
  ctx.fillStyle = skin.outline;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin.glove;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawWounds(ctx: CanvasRenderingContext2D, center: Vec, dir: 1 | -1, wounds: Wound[], part: "head" | "body") {
  for (const w of wounds) {
    if (w.part !== part) continue;
    const px = center.x + (dir === 1 ? w.dx : -w.dx);
    const py = center.y + w.dy;
    if (w.kind === "bruise") {
      ctx.fillStyle = "rgba(90,30,90,0.55)";
      ctx.beginPath();
      ctx.arc(px, py, w.r + 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#7a0d0d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px - w.r, py - w.r);
      ctx.lineTo(px + w.r, py + w.r);
      ctx.stroke();
      ctx.fillStyle = "#c81e1e";
      ctx.beginPath();
      ctx.arc(px, py, w.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHair(ctx: CanvasRenderingContext2D, c: Vec, r: number, skin: Skin) {
  const style = skin.hairStyle;
  const vol = skin.hairVol ?? 1;
  ctx.fillStyle = skin.hair;

  // 1) volume saindo do crânio (cabelo cheio / cacheado)
  if (style === "curly") {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 1.04 + (i / (n - 1)) * Math.PI * 0.92;
      const x = c.x + Math.cos(a) * r * 0.95;
      const y = c.y + Math.sin(a) * r * 0.95;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.3 * vol, 0, Math.PI * 2);
      ctx.fill();
    }
    // miolo do topo
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - r * 0.5, r * 0.85 * vol, r * 0.7 * vol, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === "full") {
    // domo liso acima do topo
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - r * 0.22, r * 0.98 * vol, r * 0.9 * vol, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  // 2) touca recortada na cabeça (frente/lados limpos)
  const hairline = style === "curly" ? c.y - r * 0.02
    : style === "full" ? c.y - r * 0.12
    : c.y - r * 0.4; // raspadinho: faixa fina no topo
  ctx.save();
  ctx.beginPath();
  ctx.arc(c.x, c.y, r + 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = skin.hair;
  ctx.fillRect(c.x - r - 2, c.y - r - 2, (r + 2) * 2, hairline - (c.y - r - 2));
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

const mid = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function drawShorts(ctx: CanvasRenderingContext2D, b: Bones, skin: Skin) {
  const base = skin.trunks, acc = skin.shortsAccent, out = skin.outline;
  const fMid = mid(b.hip, b.frontKnee, 0.5);
  const bMid = mid(b.hip, b.backKnee, 0.5);

  // coxa de trás
  limb(ctx, b.hip, bMid, 22, base, out);
  // pelve (cós + bunda)
  const px = b.hip.x - 22, py = b.hip.y - 12, pw = 44, ph = 34, rr = 11;
  ctx.fillStyle = out; roundRect(ctx, px - 2, py - 2, pw + 4, ph + 4, rr + 2); ctx.fill();
  ctx.fillStyle = base; roundRect(ctx, px, py, pw, ph, rr); ctx.fill();
  // coxa da frente por cima
  limb(ctx, b.hip, fMid, 24, base, out);

  // estampa
  switch (skin.shortsPattern) {
    case "stripe":
      ctx.fillStyle = acc; roundRect(ctx, px, py, pw, 7, 4); ctx.fill();
      limb(ctx, b.hip, fMid, 7, acc, acc);
      break;
    case "split": {
      ctx.save(); roundRect(ctx, px, py, pw, ph, rr); ctx.clip();
      ctx.fillStyle = acc;
      if (b.dir === 1) ctx.fillRect(b.hip.x, py, pw, ph);
      else ctx.fillRect(px, py, b.hip.x - px, ph);
      ctx.restore();
      limb(ctx, b.hip, fMid, 24, acc, out);
      ctx.fillStyle = "rgba(0,0,0,.35)"; roundRect(ctx, px, py, pw, 6, 3); ctx.fill();
      break;
    }
    case "stars": {
      ctx.fillStyle = acc; roundRect(ctx, px, py, pw, 6, 3); ctx.fill();
      const pts: [number, number][] = [[px + 10, py + 17], [px + 23, py + 13], [px + 35, py + 19], [px + 16, py + 26], [px + 30, py + 27]];
      for (const [sx, sy] of pts) star(ctx, sx, sy, 3.6, acc);
      break;
    }
    case "flame": {
      ctx.fillStyle = acc; roundRect(ctx, px, py, pw, 6, 3); ctx.fill();
      const baseY = py + ph;
      for (let i = 0; i < 4; i++) {
        const fx = px + 7 + i * ((pw - 14) / 3);
        ctx.beginPath();
        ctx.moveTo(fx - 5, baseY); ctx.lineTo(fx, baseY - 15); ctx.lineTo(fx + 5, baseY);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case "tribal": {
      ctx.fillStyle = acc; roundRect(ctx, px, py, pw, 5, 3); ctx.fill();
      ctx.strokeStyle = acc; ctx.lineWidth = 3; ctx.lineJoin = "round";
      const my = py + ph * 0.58;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const xx = px + (i / 6) * pw;
        const yy = my + (i % 2 ? -6 : 6);
        if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
      }
      ctx.stroke();
      break;
    }
  }
}

export function drawFighter(ctx: CanvasRenderingContext2D, b: Bones, groundY: number, skin: Skin, wounds: Wound[] = []) {
  const sq = b.squash;

  // sombra no chão
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(b.hip.x, groundY, 60, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // perna de trás primeiro (profundidade)
  limb(ctx, b.hip, b.backKnee, 18, skin.body, skin.outline);
  limb(ctx, b.backKnee, b.backFoot, 15, skin.body, skin.outline);
  // braço de trás
  limb(ctx, b.chest, b.backElbow, 16, skin.body, skin.outline);
  limb(ctx, b.backElbow, b.backHand, 14, skin.body, skin.outline);
  glove(ctx, b.backHand, 13, skin);

  // tronco (sem camisa = cor de pele)
  limb(ctx, b.hip, b.chest, 30 * sq, skin.body, skin.outline);
  drawWounds(ctx, { x: (b.hip.x + b.chest.x) / 2, y: (b.hip.y + b.chest.y) / 2 }, b.dir, wounds, "body");

  // perna da frente
  limb(ctx, b.hip, b.frontKnee, 19, skin.body, skin.outline);
  limb(ctx, b.frontKnee, b.frontFoot, 16, skin.body, skin.outline);

  // short de UFC (cobre pelve + topo das coxas)
  drawShorts(ctx, b, skin);

  // cabeça
  const r = 26;
  ctx.fillStyle = skin.outline;
  ctx.beginPath();
  ctx.arc(b.head.x, b.head.y, r + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin.head;
  ctx.beginPath();
  ctx.arc(b.head.x, b.head.y, r, 0, Math.PI * 2);
  ctx.fill();
  // cabelo
  drawHair(ctx, b.head, r, skin);
  // olho (cartoon, olha pra direção)
  ctx.fillStyle = skin.outline;
  ctx.beginPath();
  ctx.arc(b.head.x + b.dir * 10, b.head.y - 2, 4, 0, Math.PI * 2);
  ctx.fill();
  drawWounds(ctx, b.head, b.dir, wounds, "head");

  // braço da frente (na frente de tudo)
  limb(ctx, b.chest, b.frontElbow, 17, skin.body, skin.outline);
  limb(ctx, b.frontElbow, b.frontHand, 15, skin.body, skin.outline);
  glove(ctx, b.frontHand, 14, skin);
}
