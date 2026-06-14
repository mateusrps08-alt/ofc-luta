// Octógono + arquibancada com torcida + refletores. Canvas puro.
const SPONSORS = ["BRABO", "PUNCH+", "FÚRIA", "KO ENERGY", "OCTA", "REPTOR"];
const CROWD_COLORS = ["#2c3142", "#3a3f50", "#454b60", "#212433", "#4a4e63", "#5a4636", "#6b5847", "#caa074"];

interface Dot { x: number; y: number; r: number; c: string; }
let crowd: Dot[] = [];
let crowdKey = "";

// pseudo-random determinístico (torcida fixa, não fica tremendo)
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function buildCrowd(W: number, fenceTop: number) {
  const r = rng(1337);
  crowd = [];
  const top = 40, bottom = fenceTop - 8;
  const n = Math.floor(W * 0.9);
  for (let i = 0; i < n; i++) {
    const ry = r();
    const y = top + ry * (bottom - top);
    const depth = (y - top) / (bottom - top); // 0 fundo (cima) → 1 perto (baixo)
    crowd.push({
      x: r() * W,
      y,
      r: 1.4 + depth * 2.2,
      c: CROWD_COLORS[Math.floor(r() * CROWD_COLORS.length)],
    });
  }
}

export function drawArena(ctx: CanvasRenderingContext2D, W: number, H: number, groundY: number) {
  const fenceTop = groundY - 150;
  const key = `${W}x${H}`;
  if (key !== crowdKey) { buildCrowd(W, fenceTop); crowdKey = key; }

  // fundo escuro do ginásio
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#05060c");
  g.addColorStop(0.45, "#0d1120");
  g.addColorStop(1, "#070810");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // tiers da arquibancada (bowl) atrás
  ctx.fillStyle = "rgba(8,11,20,0.9)";
  for (let i = 0; i < 4; i++) {
    const y = 50 + i * ((fenceTop - 60) / 4);
    ctx.fillRect(0, y, W, 3);
  }

  // torcida
  for (const d of crowd) {
    ctx.fillStyle = d.c;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // escurece a torcida (luz só no octógono)
  const shade = ctx.createLinearGradient(0, 0, 0, fenceTop);
  shade.addColorStop(0, "rgba(5,6,12,0.65)");
  shade.addColorStop(1, "rgba(5,6,12,0.15)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, fenceTop);

  // flashes de câmera (cintilam na torcida)
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 3; i++) {
    if (Math.random() < 0.5 && crowd.length) {
      const d = crowd[Math.floor(Math.random() * crowd.length)];
      ctx.globalAlpha = 0.5 + Math.random() * 0.5;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // refletores: fixtures no topo + feixes de luz
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const beams = 6;
  for (let i = 0; i < beams; i++) {
    const x = (i + 0.5) * (W / beams);
    // glow da luminária
    const glow = ctx.createRadialGradient(x, 4, 0, x, 4, 90);
    glow.addColorStop(0, "rgba(180,205,255,0.5)");
    glow.addColorStop(1, "rgba(180,205,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 90, 0, 180, 120);
    // feixe descendo até o octógono
    const len = groundY - 20;
    const grad = ctx.createLinearGradient(x, 0, x, len);
    grad.addColorStop(0, "rgba(150,185,255,0.10)");
    grad.addColorStop(1, "rgba(150,185,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - 14, 0);
    ctx.lineTo(x + 14, 0);
    ctx.lineTo(x + 95, len);
    ctx.lineTo(x - 95, len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // grade do octógono (cerca na frente da torcida)
  ctx.strokeStyle = "rgba(190,200,220,0.18)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 22) {
    ctx.beginPath(); ctx.moveTo(x, fenceTop); ctx.lineTo(x + 30, groundY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 30, fenceTop); ctx.lineTo(x, groundY); ctx.stroke();
  }
  // postes da cerca
  ctx.strokeStyle = "rgba(20,24,34,0.9)";
  ctx.lineWidth = 5;
  for (let x = 0; x <= W; x += W / 8) {
    ctx.beginPath(); ctx.moveTo(x, fenceTop - 4); ctx.lineTo(x, groundY); ctx.stroke();
  }

  // faixa de patrocínio na cerca
  ctx.fillStyle = "#c8102e";
  ctx.fillRect(0, fenceTop - 26, W, 26);
  ctx.fillStyle = "#fff";
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 6; i++) {
    const x = 30 + i * (W / 5);
    ctx.fillText(SPONSORS[i % SPONSORS.length], x, fenceTop - 13);
  }

  // lona do octógono
  ctx.fillStyle = "#23304d";
  ctx.fillRect(0, groundY, W, H - groundY);
  // brilho dos refletores na lona
  const matLight = ctx.createRadialGradient(W / 2, groundY, 0, W / 2, groundY, W * 0.7);
  matLight.addColorStop(0, "rgba(150,180,240,0.18)");
  matLight.addColorStop(1, "rgba(150,180,240,0)");
  ctx.fillStyle = matLight;
  ctx.fillRect(0, groundY, W, H - groundY);
  // octógono pintado na lona
  ctx.strokeStyle = "#46598a";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(W / 2, groundY + (H - groundY) * 0.55, W * 0.46, (H - groundY) * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  // logo central da lona
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.font = "900 48px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("OFC", W / 2, groundY + (H - groundY) * 0.55);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}
