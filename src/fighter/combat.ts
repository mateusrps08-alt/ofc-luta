import { Vec } from "../engine/math";
import { Fighter, ImpactInfo } from "./fighter";
import { GameFeel } from "../engine/gamefeel";
import { Particles } from "../fx/particles";

const HEAD_R = 42;
const BODY_R = 55;

function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export type HitResult = "hit" | "block" | "miss";

// Resolve o impacto de `attacker` contra `defender`. Aplica dano/fx.
export function resolveHit(
  attacker: Fighter,
  defender: Fighter,
  info: ImpactInfo,
  feel: GameFeel,
  fx: Particles,
): HitResult {
  if (defender.ko) return "miss";
  if (defender.dodgeT > 0) return "miss"; // esquivou: i-frames, golpe passa direto
  const target = info.move.height === "cabeca" ? defender.headPos() : defender.bodyPos();
  const r = info.move.height === "cabeca" ? HEAD_R : BODY_R;
  // O golpe é uma VARREDURA do corpo do atacante até o ponto de contato (a ponta),
  // não só a ponta. Mede a distância do alvo ao SEGMENTO: assim soco/chute conecta
  // mesmo coladinho (antes passava por cima por overshoot) e erra de verdade só
  // quando o alvo está fora do alcance.
  const lo = Math.min(attacker.pos.x, info.at.x);
  const hi = Math.max(attacker.pos.x, info.at.x);
  const sweep: Vec = { x: Math.max(lo, Math.min(hi, target.x)), y: info.at.y };
  if (dist(sweep, target) > r) {
    return "miss"; // errou (whiff) — sem fx
  }

  // dano = base * força do atacante * escala de combo
  const damage = info.move.damage * attacker.stats.power * attacker.comboScale();

  // bloqueio: guarda ativa (segurar pra trás) bloqueia sempre; senão, chance passiva
  // pela defesa do lutador. Guarda reduz muito o dano e corta o atordoamento.
  const blocked = defender.guarding || Math.random() < defender.stats.defense * 0.25;
  defender.takeHit(info.move, attacker.dir, blocked, damage);

  if (blocked) {
    fx.block(target);
    feel.freeze(0.03);
    feel.shake(5, 0.12);
    return "block";
  }

  attacker.registerComboHit();
  fx.impact(target, info.move.power);
  feel.freeze(0.045 + info.move.power * 0.07);
  feel.shake(8 + info.move.power * 20, 0.28);
  return "hit";
}
