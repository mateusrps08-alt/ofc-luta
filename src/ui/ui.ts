import { MultiTap } from "../engine/input";
import { Kind, MOVES } from "../fighter/moves";
import { ROSTER, FighterData } from "../data/roster";

const $ = (id: string) => document.getElementById(id)!;

const ICON: Record<Kind, string> = { soco: "🥊", chute: "🦵", cotovelada: "💢" };
const CLS: Record<Kind, string> = { soco: "soco", chute: "chute", cotovelada: "cotovelo" };

export class UI {
  private menu = $("menu");
  private select = $("select");
  private hud = $("hud");
  private controls = $("controls");
  private ko = $("ko");
  private moves = $("moves");
  private info = $("btn-info");
  career = $("career");
  online = $("online");
  private roundcall = $("roundcall");
  private flL = $("fl-l");
  private flR = $("fl-r");

  constructor() {
    this.info.addEventListener("click", () => this.toggle(this.moves, !this.moves.classList.contains("on")));
    this.buildMoves();
  }

  buildMenu(onPlay: () => void, onOnline: () => void, onCareer: () => void) {
    this.menu.innerHTML = `
      <div class="authchip" id="authchip"></div>
      <div class="brand">
        <div class="logo">OFC</div>
        <div class="sub">LUTA</div>
      </div>
      <div class="menu-list">
        <button class="menu-btn" id="btn-play">JOGAR <span class="chev">▸</span></button>
        <button class="menu-btn" id="btn-online">ONLINE <span class="chev">🌐</span></button>
        <button class="menu-btn ghost" id="btn-career">CARREIRA <span class="chev">🏆</span></button>
      </div>
      <div class="ver">v0.5 · BETA</div>`;
    $("btn-play").addEventListener("click", onPlay);
    $("btn-online").addEventListener("click", onOnline);
    $("btn-career").addEventListener("click", onCareer);
  }

  setAuthChip(user: { name: string; photo: string } | null, onLogin: () => void, onLogout: () => void) {
    const chip = document.getElementById("authchip");
    if (!chip) return;
    if (user) {
      chip.innerHTML = `${user.photo ? `<img src="${user.photo}" alt="" />` : ""}
        <span class="who">${user.name}</span><button id="chip-out">SAIR</button>`;
      $("chip-out").addEventListener("click", onLogout);
    } else {
      chip.innerHTML = `<button class="login" id="chip-in">ENTRAR</button>`;
      $("chip-in").addEventListener("click", onLogin);
    }
  }

  buildSelect(onPick: (data: FighterData) => void, onBack: () => void) {
    const q = (lbl: string, v: number, color: string) =>
      `<div class="qs"><div class="ql">${lbl}</div><div class="qt">
        <div class="qf" style="width:${Math.round(Math.max(0.08, Math.min(1, v)) * 100)}%;background:${color}"></div>
      </div></div>`;
    const card = (f: FighterData) => {
      const s = f.stats;
      return `<div class="card" data-id="${f.id}" role="button" tabindex="0" aria-label="${f.name}">
        <img src="${f.photo}" alt="${f.name}" />
        <div class="strip">
          ${q("FOR", s.power / 1.4, "#ef2b3d")}${q("VEL", s.speed / 1.2, "#2b8fe0")}
          ${q("DEF", s.defense / 0.3, "#27ae60")}${q("QUE", s.chin / 0.85, "#f5a623")}
        </div>
      </div>`;
    };
    this.select.innerHTML = `
      <div class="sel-head"><h2>ESCOLHA SEU LUTADOR</h2><p>arraste pra ver · toque pra escolher</p></div>
      <div class="cards"><i class="csp"></i>${ROSTER.map(card).join("")}<i class="csp"></i></div>
      <button class="sel-back" id="sel-back">◂ VOLTAR</button>`;
    const choose = (el: HTMLElement) => {
      this.select.querySelectorAll(".card").forEach((c) => c.classList.remove("sel"));
      el.classList.add("sel");
      setTimeout(() => onPick(ROSTER.find((f) => f.id === Number(el.dataset.id))!), 200);
    };
    this.select.querySelectorAll<HTMLElement>(".card").forEach((el) => {
      el.addEventListener("click", () => choose(el));
      el.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Enter") choose(el); });
    });
    $("sel-back").addEventListener("click", onBack);
  }

  litAttack(k: Kind) {
    const el = document.getElementById(`atk-${CLS[k]}`);
    if (!el) return;
    el.classList.remove("lit"); void el.offsetWidth; el.classList.add("lit");
  }

  buildControls(onAttack: (kind: Kind, tap: 1 | 2 | 3) => void, onMove: (x: number) => void) {
    const atk = (k: Kind, name: string, legend: string) =>
      `<button class="atk ${CLS[k]}" id="atk-${CLS[k]}" aria-label="${name}">
        <span class="ring"></span><span class="ic">${ICON[k]}</span>
        <span class="nm">${name}</span><span class="legend">${legend}</span></button>`;
    this.controls.innerHTML = `
      <div class="joy" id="joy"><div class="knob" id="joy-knob"></div></div>
      <div class="atk-cluster">
        ${atk("soco", "SOCO", "1·2·3")}${atk("chute", "CHUTE", "1·2·3")}${atk("cotovelada", "COTOVELO", "1·2·3")}
      </div>`;

    const wire = (k: Kind) => {
      new MultiTap($(`atk-${CLS[k]}`), (c) => { this.litAttack(k); onAttack(k, c); });
    };
    wire("soco"); wire("chute"); wire("cotovelada");

    this.wireJoystick(onMove);
  }

  private wireJoystick(onMove: (x: number) => void) {
    const base = $("joy");
    const knob = $("joy-knob");
    let active = false, cx = 0, cy = 0, R = 1;

    const start = (e: PointerEvent) => {
      active = true;
      base.classList.add("active");
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      R = r.width * 0.32;
      base.setPointerCapture(e.pointerId);
      move(e);
    };
    const move = (e: PointerEvent) => {
      if (!active) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      onMove(Math.max(-1, Math.min(1, dx / R)));
    };
    const end = () => {
      active = false;
      base.classList.remove("active");
      knob.style.transform = "translate(-50%, -50%)";
      onMove(0);
    };
    base.addEventListener("pointerdown", (e) => { e.preventDefault(); start(e); });
    base.addEventListener("pointermove", move);
    base.addEventListener("pointerup", end);
    base.addEventListener("pointercancel", end);
  }

  buildHud(player: FighterData, cpu: FighterData) {
    const side = (cls: string, f: FighterData, id: string) => `
      <div class="bar ${cls}">
        <div class="row"><span class="nm">${f.name}</span><span class="tag">"${f.nick}"</span></div>
        <div class="hpwrap"><div class="hp-ghost" id="hg-${id}"></div><div class="hp" id="hp-${id}"></div></div>
        <div class="stwrap"><div class="stf" id="st-${id}"></div></div>
      </div>`;
    this.hud.innerHTML =
      side("left", player, "p") +
      `<div class="center-col"><div class="timer" id="timer">90</div><div class="round-ind">ROUND 1</div></div>` +
      side("right", cpu, "c");
  }

  updateHud(pHp: number, pSt: number, cHp: number, cSt: number) {
    this.setHp("p", pHp); this.setHp("c", cHp);
    ($("st-p") as HTMLElement).style.width = pSt + "%";
    ($("st-c") as HTMLElement).style.width = cSt + "%";
  }

  private setHp(id: string, pct: number) {
    const hp = $(`hp-${id}`) as HTMLElement;
    const ghost = $(`hg-${id}`) as HTMLElement;
    hp.style.width = pct + "%";
    ghost.style.width = pct + "%";
    hp.style.background = pct > 50
      ? "linear-gradient(180deg,#ff6b6b,#ef2b3d)"
      : pct > 25
      ? "linear-gradient(180deg,#ffd36b,#f5a623)"
      : "linear-gradient(180deg,#ff7a6b,#c01616)";
  }

  setTimer(sec: number) {
    const t = $("timer");
    t.textContent = String(Math.max(0, Math.ceil(sec)));
    t.classList.toggle("low", sec <= 10);
  }

  hitFlash(side: "p" | "c") {
    const el = side === "p" ? this.flL : this.flR;
    el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit");
  }

  roundIntro(onDone: () => void) {
    const show = (txt: string) => { this.roundcall.innerHTML = `<div class="rc">${txt}</div>`; };
    this.toggle(this.roundcall, true);
    show("ROUND 1");
    setTimeout(() => show("LUTAR!"), 800);
    setTimeout(() => { this.toggle(this.roundcall, false); onDone(); }, 1500);
  }

  showKO(title: string, winner: string, onAgain: () => void, onMenu: () => void) {
    this.ko.innerHTML = `
      <div class="big">${title}</div>
      <div class="winner"><div class="lbl">VENCEDOR</div><div class="nm">${winner}</div></div>
      <div class="actions">
        <button class="menu-btn" id="btn-again">REVANCHE <span class="chev">↺</span></button>
        <button class="menu-btn ghost" id="btn-menu">MENU</button>
      </div>`;
    $("btn-again").addEventListener("click", onAgain);
    $("btn-menu").addEventListener("click", onMenu);
  }

  private buildMoves() {
    const groups = (Object.keys(MOVES) as Kind[]).map((k) => {
      const rows = MOVES[k].map((m, i) =>
        `<div class="mrow"><span class="taps">${i + 1}×</span><span class="mn">${m.label}</span>
         <span class="mh">${m.height === "cabeca" ? "cabeça" : "corpo"} · ${m.damage}</span></div>`).join("");
      return `<div class="mgroup"><div class="gh"><span class="dot ${CLS[k]}"></span>${k.toUpperCase()}</div>${rows}</div>`;
    }).join("");
    this.moves.innerHTML = `<div class="sheet">
      <h3>GOLPES</h3><div class="desc">toque 1, 2 ou 3 vezes seguidas no botão</div>
      ${groups}
      <button class="menu-btn close" id="moves-close">ENTENDI</button></div>`;
    $("moves-close").addEventListener("click", () => this.toggle(this.moves, false));
  }

  scene(s: "menu" | "select" | "career" | "online" | "fight" | "ko") {
    this.toggle(this.menu, s === "menu");
    this.toggle(this.select, s === "select");
    this.toggle(this.career, s === "career");
    this.toggle(this.online, s === "online");
    this.toggle(this.ko, s === "ko");
    this.toggle(this.moves, false);
    const fighting = s === "fight";
    this.hud.classList.toggle("on", fighting);
    this.controls.classList.toggle("on", fighting);
    this.info.classList.toggle("on", fighting);
  }

  private toggle(el: HTMLElement, on: boolean) {
    el.classList.toggle("on", on);
  }
}
