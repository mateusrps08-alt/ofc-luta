import { lerp, clamp, easeInCubic, easeOutCubic, Vec } from "../engine/math";
import { Pose, solve, Bones } from "./skeleton";
import { MoveDef, Kind } from "./moves";

export interface FighterStats {
  power: number;   // multiplica dano
  speed: number;   // multiplica velocidade da anim
  defense: number; // chance de bloquear (0..1)
  chin: number;    // resistência a stun/ko (mais alto = aguenta mais)
}

export interface Wound {
  part: "head" | "body";
  dx: number; dy: number; r: number;
  kind: "cut" | "bruise";
}

const STANCE = {
  torsoLean: 0.12, headLean: -0.05,
  frontArm: { j1: 0.25, j2: -1.7 },
  backArm: { j1: 0.5, j2: -1.9 },
  frontLeg: { j1: 1.3, j2: 0.25 },
  backLeg: { j1: 1.9, j2: 0.2 },
};

export const MAX_HP = 150;

export interface ImpactInfo {
  at: Vec;
  move: MoveDef;
}

export class Fighter {
  pos: Vec;
  baseX: number;
  dir: 1 | -1;
  hp = MAX_HP;
  stamina = 100;
  wounds: Wound[] = [];

  private t = 0;
  private move: MoveDef | null = null;
  private mt = 0;
  private impactFired = false;
  private bufferedMove: MoveDef | null = null;
  comboCount = 0;
  private comboTimer = 0;

  private hurtT = 0;
  private hurtMax = 0.25;
  private stunT = 0;
  private koT = 0;
  ko = false;

  // movimento (analógico: -1..1)
  walkX = 0;
  private vx = 0;          // velocidade de empurrão (decai)
  private walkSpeed: number;
  private walkAmt = 0;     // 0..1 quanto da anim de passo está ativa
  private walkPhase = 0;
  minX = -1e9;
  maxX = 1e9;

  constructor(pos: Vec, dir: 1 | -1, public stats: FighterStats, public name: string, public skinId: number) {
    this.pos = { ...pos };
    this.baseX = pos.x;
    this.dir = dir;
    this.walkSpeed = 250 * stats.speed;
  }

  setBounds(min: number, max: number) {
    this.minX = min;
    this.maxX = max;
  }

  canWalk() {
    return !this.ko && this.stunT <= 0 && this.hurtT <= 0 && (this.move === null || this.impactFired);
  }

  // avança só o relógio de animação (preview idle, sem lógica de luta)
  advance(dt: number) {
    this.t += dt;
  }

  private beginMove(m: MoveDef) {
    this.move = m;
    this.mt = 0;
    this.impactFired = false;
    this.stamina = clamp(this.stamina - 8 - m.power * 8, 0, 100);
  }

  canAct() {
    return !this.ko && this.stunT <= 0 && this.move === null && this.hurtT <= 0;
  }

  // recovery cancelável: já conectou o golpe e não está atordoado/machucado
  canCancel() {
    return this.move !== null && this.impactFired && !this.ko && this.stunT <= 0 && this.hurtT <= 0;
  }

  comboScale() {
    return Math.max(0.5, 1 - this.comboCount * 0.08);
  }

  registerComboHit() {
    if (this.comboTimer <= 0) this.comboCount = 0;
    this.comboCount++;
    this.comboTimer = 0.8;
  }

  attack(kind: Kind, tap: 1 | 2 | 3, table: Record<Kind, [MoveDef, MoveDef, MoveDef]>) {
    if (this.ko || this.stunT > 0 || this.hurtT > 0) return null;
    if (this.stamina < 8) return null;
    const m = table[kind][tap - 1];
    // idle ou cancelando recovery → começa já; durante windup/strike → bufferiza
    if (this.move === null || this.impactFired) {
      this.beginMove(m);
      return m;
    }
    this.bufferedMove = m;
    return null;
  }

  // aplica golpe recebido (damage já calculado com força/combo do atacante)
  takeHit(move: MoveDef, attackerDir: 1 | -1, blocked: boolean, damage: number) {
    const dmg = blocked ? damage * 0.2 : damage;
    this.hp = clamp(this.hp - dmg, 0, MAX_HP);
    // empurrão (impulso na direção do ataque, decai com atrito)
    this.vx += move.knockback * attackerDir * (blocked ? 0.3 : 1) * 11;
    // apanhar quebra seu golpe e seu combo
    this.move = null;
    this.bufferedMove = null;
    this.impactFired = false;
    this.comboCount = 0;

    if (blocked) return;

    this.hurtT = this.hurtMax;
    // chance de atordoamento por golpes fortes / chin baixo (mais raro perto da vida cheia)
    const hpFrac = this.hp / MAX_HP;
    const stunChance = move.power * (1.0 - this.stats.chin) * (1.1 - hpFrac * 0.5);
    if (move.power >= 0.7 && Math.random() < stunChance) {
      this.stunT = 0.45 + move.power * 0.5;
    }
    // ferida acumula
    if (Math.random() < 0.4 + move.power * 0.4) {
      this.addWound(move.height === "cabeca" ? "head" : "body", move.power);
    }
    // nocaute: só por vida zerada, ou golpe pesado com a vida já baixa e atordoado
    const flashKO = this.stunT > 0 && move.power >= 0.9 && hpFrac < 0.3 && Math.random() < move.power * 0.5;
    if (this.hp <= 0 || flashKO) {
      this.knockOut();
    }
  }

  private addWound(part: "head" | "body", power: number) {
    const spread = part === "head" ? 22 : 34;
    this.wounds.push({
      part,
      dx: this.dir * (4 + Math.random() * 10),
      dy: (Math.random() * 2 - 1) * spread,
      r: 3 + power * 5,
      kind: Math.random() < 0.5 ? "cut" : "bruise",
    });
    if (this.wounds.length > 12) this.wounds.shift();
  }

  knockOut() {
    if (this.ko) return;
    this.ko = true;
    this.koT = 0;
    this.move = null;
    this.stunT = 0;
  }

  headPos(): Vec { return this.bones().head; }
  bodyPos(): Vec {
    const b = this.bones();
    return { x: (b.hip.x + b.chest.x) / 2, y: (b.hip.y + b.chest.y) / 2 };
  }

  update(dt: number, onImpact: (info: ImpactInfo) => void) {
    const sp = this.stats.speed;
    this.t += dt;

    // empurrão decai com atrito
    this.pos.x += this.vx * dt;
    this.vx -= this.vx * Math.min(1, dt * 9);

    // andar (analógico), bloqueado durante golpe/atordoado/ko
    const wx = this.canWalk() ? clamp(this.walkX, -1, 1) : 0;
    const walking = Math.abs(wx) > 0.05;
    if (walking) {
      this.pos.x += wx * this.walkSpeed * dt;
      this.walkPhase += dt * (9 + Math.abs(wx) * 9);
    }
    this.walkAmt = lerp(this.walkAmt, walking ? Math.min(1, Math.abs(wx) + 0.3) : 0, Math.min(1, dt * 14));

    // limites do octógono / não atravessar o oponente
    this.pos.x = clamp(this.pos.x, this.minX, this.maxX);

    if (this.ko) { this.koT += dt; return; }
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.stunT > 0) this.stunT -= dt;
    if (this.comboTimer > 0) this.comboTimer -= dt; else this.comboCount = 0;
    this.stamina = clamp(this.stamina + dt * 12, 0, 100);

    if (this.move) {
      this.mt += dt * sp;
      const m = this.move;
      const prog = this.mt / m.dur;
      if (!this.impactFired && prog >= m.impactT) {
        this.impactFired = true;
        onImpact({ at: this.contactPoint(m), move: m });
      }
      // emenda golpe bufferizado assim que o atual conecta (combo)
      if (this.impactFired && this.bufferedMove) {
        const next = this.bufferedMove;
        this.bufferedMove = null;
        this.beginMove(next);
      } else if (prog >= 1) {
        this.move = null;
      }
    }
  }

  private contactPoint(m: MoveDef): Vec {
    const y = m.height === "cabeca" ? -95 : -55;
    return { x: this.pos.x + this.dir * m.reach, y: this.pos.y + y };
  }

  private limbJoints(): { name: string; j1: number; j2: number } {
    const m = this.move!;
    const prog = clamp(this.mt / m.dur, 0, 1);
    const base = (STANCE as any)[m.limb] as { j1: number; j2: number };
    const wEnd = m.impactT * 0.6;
    let j1: number, j2: number;
    if (prog < wEnd) {
      const k = easeInCubic(prog / wEnd);
      j1 = lerp(base.j1, m.j1Windup, k);
      j2 = lerp(base.j2, m.j2Windup, k);
    } else if (prog < m.impactT) {
      const k = easeOutCubic((prog - wEnd) / (m.impactT - wEnd));
      j1 = lerp(m.j1Windup, m.j1Strike, k);
      j2 = lerp(m.j2Windup, m.j2Strike, k);
    } else {
      const k = easeOutCubic((prog - m.impactT) / (1 - m.impactT));
      j1 = lerp(m.j1Strike, base.j1, k);
      j2 = lerp(m.j2Strike, base.j2, k);
    }
    return { name: m.limb, j1, j2 };
  }

  pose(): Pose {
    const idle = this.ko || this.stunT > 0 ? 0 : 1;
    // idle vivo: balança o corpo tipo lutador em guarda
    const bob = (Math.sin(this.t * 4.2) * 5 + Math.abs(Math.sin(this.t * 2.1)) * 3) * idle;
    const sway = Math.sin(this.t * 2.0) * 0.06 * idle;
    const hip: Vec = { x: this.pos.x + Math.sin(this.t * 2.0) * 3 * idle, y: this.pos.y + bob };

    const p: Pose = {
      dir: this.dir, hip,
      torsoLean: STANCE.torsoLean + sway,
      headLean: STANCE.headLean,
      frontShoulder: STANCE.frontArm.j1, frontElbow: STANCE.frontArm.j2,
      backShoulder: STANCE.backArm.j1, backElbow: STANCE.backArm.j2,
      frontHip: STANCE.frontLeg.j1, frontKnee: STANCE.frontLeg.j2,
      backHip: STANCE.backLeg.j1, backKnee: STANCE.backLeg.j2,
      squash: 1,
    };

    // passo: balança as pernas e inclina pro lado do movimento
    if (this.walkAmt > 0.01) {
      const swing = Math.sin(this.walkPhase) * 0.35 * this.walkAmt;
      p.frontHip += swing;
      p.backHip -= swing;
      p.frontKnee += Math.max(0, Math.sin(this.walkPhase)) * 0.2 * this.walkAmt;
      p.backKnee += Math.max(0, -Math.sin(this.walkPhase)) * 0.2 * this.walkAmt;
      // avança (forward) = inclina pra frente; recua = pra trás
      p.torsoLean += Math.sign(this.walkX) * this.dir * 0.12 * this.walkAmt;
    }

    // reação: recuo ao apanhar
    if (this.hurtT > 0) {
      const k = this.hurtT / this.hurtMax;
      p.torsoLean -= 0.4 * k; // joga tronco pra trás
      p.headLean -= 0.6 * k;
    }
    // atordoado: cambaleia
    if (this.stunT > 0) {
      const w = Math.sin(this.t * 12) * 0.18;
      p.torsoLean += w;
      p.headLean += w * 1.5;
      p.squash = 0.97;
    }
    // nocaute: desaba
    if (this.ko) {
      const k = Math.min(this.koT / 0.6, 1);
      const e = easeOutCubic(k);
      p.torsoLean = lerp(STANCE.torsoLean, 1.5, e);
      p.headLean = lerp(STANCE.headLean, 0.4, e);
      p.frontHip = lerp(STANCE.frontLeg.j1, 2.4, e);
      p.backHip = lerp(STANCE.backLeg.j1, 2.6, e);
      p.frontShoulder = lerp(STANCE.frontArm.j1, 1.4, e);
      p.backShoulder = lerp(STANCE.backArm.j1, 1.6, e);
      p.squash = lerp(1, 0.85, e);
      hip.y = this.pos.y - 6 + 30 * e;
      return p;
    }

    // golpe ativo
    if (this.move) {
      const m = this.move;
      const prog = clamp(this.mt / m.dur, 0, 1);
      const { name, j1, j2 } = this.limbJoints();
      // squash/stretch + avanço
      let squash = 1, lunge = 0;
      const wEnd = m.impactT * 0.6;
      if (prog < wEnd) squash = lerp(1, 0.94, prog / wEnd);
      else if (prog < m.impactT) {
        const k = (prog - wEnd) / (m.impactT - wEnd);
        squash = lerp(0.94, 1.1, k); lunge = m.lunge * k;
      } else {
        const k = (prog - m.impactT) / (1 - m.impactT);
        squash = lerp(1.1, 1, k); lunge = m.lunge * (1 - k);
      }
      p.squash = squash;
      p.torsoLean += lunge;
      if (name === "frontArm") { p.frontShoulder = j1; p.frontElbow = j2; }
      else if (name === "backArm") { p.backShoulder = j1; p.backElbow = j2; }
      else if (name === "frontLeg") { p.frontHip = j1; p.frontKnee = j2; }
      else { p.backHip = j1; p.backKnee = j2; }
    }

    return p;
  }

  bones(): Bones { return solve(this.pose()); }
}
