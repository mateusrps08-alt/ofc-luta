import { Fighter } from "../fighter/fighter";
import { Kind, MoveDef, MOVES } from "../fighter/moves";

const KINDS: Kind[] = ["soco", "chute", "cotovelada"];
const RANGE = 165;   // alcance ideal pra atacar
const CLOSE = 115;   // perto demais → recua às vezes

// CPU simples: aproxima, mantém distância, ataca no alcance.
export class AI {
  private cooldown = 0.9;
  private backoff = 0;

  constructor(private self: Fighter, private opp: Fighter, private difficulty = 0.5) {}

  update(dt: number, doAttack: (kind: Kind, tap: 1 | 2 | 3) => void) {
    if (this.self.ko || this.opp.ko) { this.self.walkX = 0; return; }
    const d = Math.abs(this.opp.pos.x - this.self.pos.x);
    const toward = (Math.sign(this.opp.pos.x - this.self.pos.x) || 1);

    // movimento
    if (this.backoff > 0) {
      this.backoff -= dt;
      this.self.walkX = -toward * 0.8;
    } else if (d > RANGE + 8) {
      this.self.walkX = toward;               // aproxima
    } else if (d < CLOSE && Math.random() < 0.01) {
      this.backoff = 0.4;                      // recua de vez em quando
    } else {
      this.self.walkX = 0;
    }

    // ataque (no alcance) — encadeia combos cancelando a recovery
    this.cooldown -= dt;
    if (this.cooldown <= 0 && d <= RANGE + 12 && (this.self.canAct() || this.self.canCancel())) {
      const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
      const r = Math.random();
      const tap: 1 | 2 | 3 = r < 0.5 ? 1 : r < 0.5 + this.difficulty * 0.4 ? 3 : 2;
      doAttack(kind, tap);
      const combo = Math.random() < 0.35 + this.difficulty * 0.3;
      this.cooldown = combo ? 0.14 : 0.85 - this.difficulty * 0.4 + Math.random() * 0.6;
    }
  }

  static table(): Record<Kind, [MoveDef, MoveDef, MoveDef]> {
    return MOVES;
  }
}
