import { polar, Vec } from "../engine/math";

// Comprimentos dos ossos (px, escala base). Ajustáveis = tunar boneco fácil.
export const BONE = {
  torso: 70,
  neck: 26,
  upperArm: 40,
  foreArm: 42,
  thigh: 52,
  shin: 50,
};

// Pose = ângulos das juntas (rad). dir = +1 olha direita, -1 esquerda.
// Ângulos no referencial do lutador (antes de espelhar por dir).
export interface Pose {
  dir: 1 | -1;
  hip: Vec; // raiz no mundo
  torsoLean: number; // inclinação do tronco
  headLean: number;
  // braço da frente (jab) e de trás (cruzado)
  frontShoulder: number;
  frontElbow: number;
  backShoulder: number;
  backElbow: number;
  // pernas
  frontHip: number;
  frontKnee: number;
  backHip: number;
  backKnee: number;
  squash: number; // 1 = normal, <1 achata, >1 estica
}

// Segmentos resolvidos no mundo, prontos pra desenhar.
export interface Bones {
  hip: Vec;
  chest: Vec;
  head: Vec;
  frontElbow: Vec;
  frontHand: Vec;
  backElbow: Vec;
  backHand: Vec;
  frontKnee: Vec;
  frontFoot: Vec;
  backKnee: Vec;
  backFoot: Vec;
  squash: number;
  dir: 1 | -1;
}

const UP = -Math.PI / 2;

// Forward kinematics: Pose -> world Bones.
export function solve(p: Pose): Bones {
  const d = p.dir;
  // flip horizontal: dir -1 espelha o componente x do ângulo
  const ang = (a: number) => (d === 1 ? a : Math.PI - a);

  const sq = p.squash;
  const chest = polar(p.hip, ang(UP + p.torsoLean), BONE.torso * sq);
  const head = polar(chest, ang(UP + p.headLean), BONE.neck * sq);

  const fElbow = polar(chest, ang(p.frontShoulder), BONE.upperArm);
  const fHand = polar(fElbow, ang(p.frontShoulder + p.frontElbow), BONE.foreArm);
  const bElbow = polar(chest, ang(p.backShoulder), BONE.upperArm);
  const bHand = polar(bElbow, ang(p.backShoulder + p.backElbow), BONE.foreArm);

  const fKnee = polar(p.hip, ang(p.frontHip), BONE.thigh);
  const fFoot = polar(fKnee, ang(p.frontHip + p.frontKnee), BONE.shin);
  const bKnee = polar(p.hip, ang(p.backHip), BONE.thigh);
  const bFoot = polar(bKnee, ang(p.backHip + p.backKnee), BONE.shin);

  return {
    hip: p.hip, chest, head,
    frontElbow: fElbow, frontHand: fHand,
    backElbow: bElbow, backHand: bHand,
    frontKnee: fKnee, frontFoot: fFoot,
    backKnee: bKnee, backFoot: bFoot,
    squash: sq, dir: d,
  };
}
