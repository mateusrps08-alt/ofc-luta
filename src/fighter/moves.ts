export type Limb = "frontArm" | "backArm" | "frontLeg" | "backLeg";
export type Kind = "soco" | "chute" | "cotovelada";
export type Height = "cabeca" | "corpo";

export interface MoveDef {
  id: string;
  label: string;
  kind: Kind;
  limb: Limb;
  // ângulos das 2 juntas da limb (rad, absolutos): braço=ombro/cotovelo, perna=quadril/joelho
  j1Windup: number; j2Windup: number;
  j1Strike: number; j2Strike: number;
  dur: number;       // duração total (s)
  impactT: number;   // 0..1 momento do impacto
  reach: number;     // px do quadril até o ponto de contato
  height: Height;    // onde acerta
  damage: number;
  power: number;     // 0..1 → hitstop, shake, chance de stun
  knockback: number; // px de empurrão
  lunge: number;     // avanço do tronco no golpe
}

// SOCO: 1 jab · 2 direto · 3 overhand
// CHUTE: 1 low · 2 teep · 3 head
// COTOVELADA: 1 12-6 · 2 baixo-cima · 3 rodada
export const MOVES: Record<Kind, [MoveDef, MoveDef, MoveDef]> = {
  soco: [
    { id: "jab", label: "Jab", kind: "soco", limb: "frontArm",
      j1Windup: 0.35, j2Windup: -1.7, j1Strike: 0.0, j2Strike: -0.15,
      dur: 0.26, impactT: 0.45, reach: 150, height: "cabeca",
      damage: 6, power: 0.45, knockback: 8, lunge: 0.08 },
    { id: "direto", label: "Direto", kind: "soco", limb: "backArm",
      j1Windup: 0.7, j2Windup: -1.9, j1Strike: 0.05, j2Strike: -0.1,
      dur: 0.34, impactT: 0.5, reach: 162, height: "cabeca",
      damage: 11, power: 0.75, knockback: 18, lunge: 0.16 },
    { id: "overhand", label: "Overhand", kind: "soco", limb: "frontArm",
      j1Windup: -0.9, j2Windup: -1.4, j1Strike: 0.2, j2Strike: -0.1,
      dur: 0.44, impactT: 0.55, reach: 158, height: "cabeca",
      damage: 16, power: 1.0, knockback: 26, lunge: 0.2 },
  ],
  chute: [
    { id: "lowkick", label: "Low Kick", kind: "chute", limb: "backLeg",
      j1Windup: 1.7, j2Windup: -0.6, j1Strike: 0.7, j2Strike: 0.0,
      dur: 0.38, impactT: 0.55, reach: 168, height: "corpo",
      damage: 9, power: 0.7, knockback: 10, lunge: 0.1 },
    { id: "teep", label: "Teep", kind: "chute", limb: "frontLeg",
      j1Windup: 1.0, j2Windup: -0.8, j1Strike: 0.05, j2Strike: 0.0,
      dur: 0.34, impactT: 0.5, reach: 185, height: "corpo",
      damage: 8, power: 0.65, knockback: 30, lunge: 0.06 },
    { id: "headkick", label: "Head Kick", kind: "chute", limb: "backLeg",
      j1Windup: 1.6, j2Windup: -0.9, j1Strike: -0.35, j2Strike: 0.05,
      dur: 0.5, impactT: 0.58, reach: 175, height: "cabeca",
      damage: 18, power: 1.0, knockback: 28, lunge: 0.14 },
  ],
  cotovelada: [
    { id: "elbow126", label: "Cotovelo 12-6", kind: "cotovelada", limb: "frontArm",
      j1Windup: -1.1, j2Windup: -2.2, j1Strike: 0.4, j2Strike: -2.4,
      dur: 0.3, impactT: 0.5, reach: 120, height: "cabeca",
      damage: 12, power: 0.8, knockback: 10, lunge: 0.1 },
    { id: "elbowup", label: "Cotovelo de Baixo", kind: "cotovelada", limb: "frontArm",
      j1Windup: 0.9, j2Windup: -2.3, j1Strike: -0.4, j2Strike: -2.3,
      dur: 0.32, impactT: 0.5, reach: 118, height: "cabeca",
      damage: 13, power: 0.85, knockback: 12, lunge: 0.12 },
    { id: "elbowspin", label: "Cotovelo Rodado", kind: "cotovelada", limb: "backArm",
      j1Windup: -1.4, j2Windup: -2.0, j1Strike: -0.1, j2Strike: -2.3,
      dur: 0.46, impactT: 0.6, reach: 130, height: "cabeca",
      damage: 17, power: 1.0, knockback: 16, lunge: 0.18 },
  ],
};

export const pick = (kind: Kind, tap: 1 | 2 | 3): MoveDef => MOVES[kind][tap - 1];
