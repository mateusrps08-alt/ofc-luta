import { Loop } from "./engine/loop";
import { TapCounter } from "./engine/input";
import { GameFeel } from "./engine/gamefeel";
import { Particles } from "./fx/particles";
import { Fighter, MAX_HP, NetState } from "./fighter/fighter";
import { MOVES, Kind } from "./fighter/moves";
import { NetLink } from "./net/netlink";
import { resolveHit } from "./fighter/combat";
import { drawFighter, SKINS } from "./render/renderer";
import { drawArena } from "./arena/octagon";
import { AI } from "./ai/ai";
import { UI } from "./ui/ui";
import { ROSTER, FighterData } from "./data/roster";
import { firebaseReady } from "./net/firebase";
import { onUser, login, logout, AppUser } from "./net/auth";
import { getRecord, addResult } from "./net/career";
import * as Online from "./net/online";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const ui = new UI();
const feel = new GameFeel();
const fx = new Particles();

const ROUND_TIME = 90;

// mundo virtual FIXO: o gameplay roda nessas unidades em todo aparelho,
// então host e convidado batem nas mesmas posições (sync online).
const WORLD_W = 560; // largura virtual
const GROUND = 520;  // y virtual dos pés

let W = 0, H = 0, DPR = 1, groundY = 0;
function resize() {
  const vv = window.visualViewport;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.round(vv?.width ?? window.innerWidth);
  H = Math.round(vv?.height ?? window.innerHeight);
  // altura real (descontando a barra do navegador) pro container #app
  document.documentElement.style.setProperty("--app-h", H + "px");
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  groundY = H * 0.84; // chão da arena na tela (a arena é em px de tela)
  placeDemo();
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 120));
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resize);
  window.visualViewport.addEventListener("scroll", resize);
}

// atract mode: dois lutadores treinando atrás do menu
let demoA: Fighter | null = null, demoB: Fighter | null = null;
let demoTimer = 0.6;
function placeDemo() {
  if (!demoA) demoA = new Fighter({ x: 0, y: GROUND }, 1, ROSTER[0].stats, ROSTER[0].name, ROSTER[0].skinId);
  if (!demoB) demoB = new Fighter({ x: 0, y: GROUND }, -1, ROSTER[1].stats, ROSTER[1].name, ROSTER[1].skinId);
  demoA.pos = { x: WORLD_W / 2 - 75, y: GROUND };
  demoB.pos = { x: WORLD_W / 2 + 75, y: GROUND };
}
function attractUpdate(dt: number) {
  if (!demoA || !demoB) return;
  demoTimer -= dt;
  if (demoTimer <= 0) {
    const f = Math.random() < 0.5 ? demoA : demoB;
    const kinds: Kind[] = ["soco", "chute", "cotovelada"];
    f.attack(kinds[Math.floor(Math.random() * 3)], (1 + Math.floor(Math.random() * 3)) as 1 | 2 | 3, MOVES);
    demoTimer = 0.7 + Math.random() * 0.9;
  }
  demoA.update(dt, (info) => fx.impact(info.at, info.move.power * 0.5));
  demoB.update(dt, (info) => fx.impact(info.at, info.move.power * 0.5));
  fx.update(dt);
}

type Scene = "menu" | "select" | "career" | "online" | "fight" | "ko";
let scene: Scene = "menu";
let player: Fighter | null = null;
let cpu: Fighter | null = null;
let ai: AI | null = null;
let ready = false, over = false, overT = 0;
let timeLeft = ROUND_TIME;
let prevPHp = MAX_HP, prevCHp = MAX_HP;
let lastPlayerData: FighterData = ROSTER[0];

function placeFighters() {
  const gap = 170, cx = WORLD_W / 2;
  if (player) { player.baseX = cx - gap / 2; player.pos.x = player.baseX; player.pos.y = GROUND; }
  if (cpu) { cpu.baseX = cx + gap / 2; cpu.pos.x = cpu.baseX; cpu.pos.y = GROUND; }
}

let onlineMatch = false;
function startFight(pData: FighterData, cpuData?: FighterData, online = false) {
  lastPlayerData = pData;
  onlineMatch = online;
  const others = ROSTER.filter((f) => f.id !== pData.id);
  const cData = cpuData ?? others[Math.floor(Math.random() * others.length)];
  netCleanup();
  player = new Fighter({ x: 0, y: GROUND }, 1, pData.stats, pData.name, pData.skinId);
  cpu = new Fighter({ x: 0, y: GROUND }, -1, cData.stats, cData.name, cData.skinId);
  placeFighters();
  ai = new AI(cpu, player, 0.5);
  controlled = player;
  ready = false; over = false; overT = 0;
  timeLeft = ROUND_TIME;
  prevPHp = prevCHp = MAX_HP;
  ui.buildHud(pData, cData);
  ui.updateHud(100, 100, 100, 100);
  ui.setTimer(ROUND_TIME);
  ui.scene("fight");
  scene = "fight";
  ui.roundIntro(() => { ready = true; });
}

function endFight(title: string, winner: string, playerWon: boolean) {
  over = true; overT = 0;
  pendingEnd = { title, winner };
  if (user) addResult(user.uid, playerWon).catch(() => {});
}
let pendingEnd: { title: string; winner: string } | null = null;

// ---------- NET (online ao vivo) ----------
let net: NetLink | null = null;
let netMode: "off" | "host" | "guest" = "off";
let controlled: Fighter | null = null;
let netSync = 0, netInWalk = 0, lastAppliedAtk = -1;
let myAtkId = 0, myAtkKind: Kind = "soco", myAtkTap: 1 | 2 | 3 = 1;
let netWinSide = "", netTitle = "", netWinner = "";

const inputWalk = () => (joyWalk !== 0 ? joyWalk : keyWalk());

function netCleanup() {
  if (net) { net.destroy(); net = null; }
  netMode = "off"; controlled = null;
}

function startNetFight(isHost: boolean) {
  const h = roomData?.host, g = roomData?.guest;
  if (!h || !g) return;
  const hd = ROSTER[h.fighter], gd = ROSTER[g.fighter];
  player = new Fighter({ x: 0, y: GROUND }, 1, hd.stats, hd.name, hd.skinId);
  cpu = new Fighter({ x: 0, y: GROUND }, -1, gd.stats, gd.name, gd.skinId);
  placeFighters();
  ai = null;
  netMode = isHost ? "host" : "guest";
  controlled = isHost ? player : cpu;
  onlineMatch = true;
  ready = false; over = false; overT = 0; timeLeft = ROUND_TIME;
  prevPHp = prevCHp = MAX_HP;
  netSync = 0; netInWalk = 0; lastAppliedAtk = -1; myAtkId = 0;
  netWinSide = ""; netTitle = ""; netWinner = "";
  net = new NetLink(roomCode, isHost);
  if (isHost) {
    net.onInput = (i) => {
      netInWalk = Number(i.walk) || 0;
      const id = Number(i.atkId);
      if (id > lastAppliedAtk && cpu) {
        lastAppliedAtk = id;
        cpu.attack(i.kind as Kind, Number(i.tap) as 1 | 2 | 3, MOVES);
      }
    };
  } else {
    net.onState = applyHostState;
  }
  ui.buildHud(hd, gd);
  ui.updateHud(100, 100, 100, 100);
  ui.setTimer(ROUND_TIME);
  scene = "fight"; ui.scene("fight");
  ui.roundIntro(() => { ready = true; });
}

function applyHostState(s: Record<string, unknown>) {
  if (!player || !cpu) return;
  if (s.p) player.netApply(s.p as NetState);       // lutador do host (oponente)
  if (s.c) cpu.netApply(s.c as NetState, true);     // meu lutador: vida/ko do host, golpe local
  if (typeof s.t === "number") timeLeft = s.t;
  ui.updateHud((player.hp / MAX_HP) * 100, player.stamina, (cpu.hp / MAX_HP) * 100, cpu.stamina);
  if (s.over && !over) {
    over = true; overT = 0;
    pendingEnd = { title: String(s.title || "NOCAUTE!"), winner: String(s.winner || "") };
    if (user) addResult(user.uid, s.win === "R").catch(() => {}); // convidado = lado R
  }
}

function finishNet(title: string, hostWon: boolean) {
  if (over) return;
  over = true; overT = 0;
  netTitle = title;
  netWinSide = hostWon ? "L" : "R";
  netWinner = hostWon ? player!.name : cpu!.name;
  pendingEnd = { title, winner: netWinner };
  if (user) addResult(user.uid, hostWon).catch(() => {}); // host = lado L
}

function sendSnapshot() {
  if (!net || !player || !cpu) return;
  net.sendState({
    p: player.netExport(), c: cpu.netExport(),
    t: Math.round(timeLeft * 10) / 10,
    over: over ? 1 : 0, win: netWinSide, title: netTitle, winner: netWinner,
  });
}

function netFightUpdate(dt: number) {
  if (!player || !cpu) return;
  fx.update(dt);
  if (!ready) return;

  if (netMode === "host") {
    if (!feel.frozen()) {
      player.walkX = inputWalk();
      cpu.walkX = netInWalk;
      const arenaMin = WORLD_W * 0.1, arenaMax = WORLD_W * 0.9, minSep = 95;
      player.setBounds(arenaMin, cpu.pos.x - minSep);
      cpu.setBounds(player.pos.x + minSep, arenaMax);
      player.update(dt, (info) => resolveHit(player!, cpu!, info, feel, fx));
      cpu.update(dt, (info) => resolveHit(cpu!, player!, info, feel, fx));
      if (player.hp < prevPHp) ui.hitFlash("p");
      if (cpu.hp < prevCHp) ui.hitFlash("c");
      prevPHp = player.hp; prevCHp = cpu.hp;
      ui.updateHud((player.hp / MAX_HP) * 100, player.stamina, (cpu.hp / MAX_HP) * 100, cpu.stamina);
      if (!over) {
        timeLeft -= dt; ui.setTimer(timeLeft);
        if (player.ko || cpu.ko) finishNet("NOCAUTE!", !player.ko);
        else if (timeLeft <= 0) finishNet("TEMPO!", player.hp >= cpu.hp);
      }
    }
    netSync += dt;
    if (netSync > (net?.rtcOpen ? 0.033 : 0.05)) { netSync = 0; sendSnapshot(); }
  } else {
    cpu.walkX = inputWalk(); // prevê o próprio
    player.tickDisplay(dt); cpu.tickDisplay(dt);
    player.netInterp(dt, false); cpu.netInterp(dt, true);
    cpu.pos.x = Math.max(WORLD_W * 0.1, Math.min(WORLD_W * 0.9, cpu.pos.x)); // não foge da tela
    ui.setTimer(timeLeft);
    netSync += dt;
    if (netSync > (net?.rtcOpen ? 0.033 : 0.05)) {
      netSync = 0;
      net?.sendInput({ walk: inputWalk(), atkId: myAtkId, kind: myAtkKind, tap: myAtkTap });
    }
  }

  if (net) ui.setNet(net.rtcOpen ? "P2P" : net.connWarn() ? "SEM SINAL" : "ONLINE");

  if (over) {
    overT += dt;
    if (overT > 1.6 && pendingEnd) {
      const { title, winner } = pendingEnd; pendingEnd = null;
      scene = "ko";
      ui.showKO(title, winner, goOnline, goMenu);
      ui.scene("ko");
      netCleanup();
    }
  }
}

function update(dt: number) {
  feel.update(dt);
  if (scene === "menu") { attractUpdate(dt); return; }
  if (scene === "select" || scene === "career" || scene === "online") return;
  if (scene !== "fight" || !player || !cpu) return;
  if (netMode !== "off") { netFightUpdate(dt); return; }
  if (!ai) return;
  fx.update(dt);
  if (!ready || feel.frozen()) return;

  // input de movimento: joystick tem prioridade, senão teclado
  player.walkX = joyWalk !== 0 ? joyWalk : keyWalk();

  // limites do octógono + não atravessar o oponente
  const arenaMin = WORLD_W * 0.1, arenaMax = WORLD_W * 0.9, minSep = 95;
  player.setBounds(arenaMin, cpu.pos.x - minSep);
  cpu.setBounds(player.pos.x + minSep, arenaMax);

  player.update(dt, (info) => resolveHit(player!, cpu!, info, feel, fx));
  cpu.update(dt, (info) => resolveHit(cpu!, player!, info, feel, fx));
  ai.update(dt, (k, t) => cpu!.attack(k, t, MOVES));

  // flash de dano
  if (player.hp < prevPHp) ui.hitFlash("p");
  if (cpu.hp < prevCHp) ui.hitFlash("c");
  prevPHp = player.hp; prevCHp = cpu.hp;

  ui.updateHud(
    (player.hp / MAX_HP) * 100, player.stamina,
    (cpu.hp / MAX_HP) * 100, cpu.stamina,
  );

  if (!over) {
    timeLeft -= dt;
    ui.setTimer(timeLeft);
    if (player.ko || cpu.ko) {
      endFight("NOCAUTE!", player.ko ? cpu.name : player.name, !player.ko);
    } else if (timeLeft <= 0) {
      const pWon = player.hp >= cpu.hp;
      endFight("TEMPO!", pWon ? player.name : cpu.name, pWon);
    }
  } else {
    overT += dt;
    if (overT > 1.6 && pendingEnd) {
      const { title, winner } = pendingEnd;
      pendingEnd = null;
      scene = "ko";
      const again = onlineMatch ? goOnline : () => startFight(lastPlayerData);
      ui.showKO(title, winner, again, goMenu);
      ui.scene("ko");
    }
  }
}

// câmera mundo-virtual → tela: tamanho dos lutadores ~ proporcional à altura
// (mesmo em qualquer tela), centrado no chão da arena. Posições são virtuais
// (idênticas no host e convidado) → online sincroniza.
function camScale() {
  // limita pela altura (tamanho do lutador) e pela largura (cabe a área jogável)
  return Math.min((H * 0.84) / GROUND, W / 520);
}

function render() {
  if (scene === "select" || scene === "career" || scene === "online") return; // overlay opaco cobre o canvas
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = "#05060c";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(feel.shakeX, feel.shakeY);
  drawArena(ctx, W, H, groundY);

  // câmera dos lutadores
  const s = camScale();
  ctx.translate(W / 2 - (WORLD_W / 2) * s, groundY - GROUND * s);
  ctx.scale(s, s);
  if (scene === "menu") {
    if (demoB) drawFighter(ctx, demoB.bones(), GROUND, SKINS[demoB.skinId], demoB.wounds);
    if (demoA) drawFighter(ctx, demoA.bones(), GROUND, SKINS[demoA.skinId], demoA.wounds);
    fx.draw(ctx);
  } else if (player && cpu) {
    drawFighter(ctx, cpu.bones(), GROUND, SKINS[cpu.skinId], cpu.wounds);
    drawFighter(ctx, player.bones(), GROUND, SKINS[player.skinId], player.wounds);
    fx.draw(ctx);
  }
  ctx.restore();
}

function goMenu() { onlineCleanup(); scene = "menu"; ui.scene("menu"); }
function goSelect() { scene = "select"; ui.scene("select"); }

// ---------- AUTH ----------
let user: AppUser | null = null;
function doLogin() {
  if (!firebaseReady) { alert("Firebase ainda não configurado (.env)."); return; }
  login().catch((e) => alert("Falha no login: " + e.message));
}
function doLogout() { logout(); }

ui.buildMenu(goSelect, goOnline, goCareer);
ui.buildSelect((data) => startFight(data), goMenu);
ui.setAuthChip(null, doLogin, doLogout);
onUser((u) => {
  user = u;
  ui.setAuthChip(u, doLogin, doLogout);
  if (scene === "career") renderCareer();
  if (scene === "online") renderOnline();
});

// ---------- CARREIRA ----------
function goCareer() { scene = "career"; ui.scene("career"); renderCareer(); }
function loginGate(el: HTMLElement, lead: string) {
  el.innerHTML = `<div class="panel"><h2>${scene === "career" ? "CARREIRA" : "ONLINE"}</h2>
    <p class="lead">${lead}</p>
    ${firebaseReady ? `<button class="menu-btn" id="g-login">ENTRAR COM GOOGLE</button>`
      : `<div class="note">Configure o Firebase no arquivo .env pra ativar login e dados online.</div>`}
    <button class="sel-back" id="g-back">◂ VOLTAR</button></div>`;
  el.querySelector<HTMLElement>("#g-back")!.addEventListener("click", goMenu);
  const lg = el.querySelector<HTMLElement>("#g-login");
  if (lg) lg.addEventListener("click", doLogin);
}
function renderCareer() {
  const el = ui.career;
  if (!user) { loginGate(el, "Entre pra salvar suas vitórias e derrotas."); return; }
  el.innerHTML = `<div class="panel"><h2>CARREIRA</h2><p class="lead">${user.name}</p>
    <div class="record">
      <div class="rec-card win"><div class="big" id="c-w">–</div><div class="lbl">VITÓRIAS</div></div>
      <div class="rec-card loss"><div class="big" id="c-l">–</div><div class="lbl">DERROTAS</div></div>
    </div>
    <div class="winrate" id="c-rate">carregando…</div>
    <button class="sel-back" id="c-back">◂ VOLTAR</button></div>`;
  el.querySelector<HTMLElement>("#c-back")!.addEventListener("click", goMenu);
  getRecord(user.uid).then((r) => {
    const total = r.wins + r.losses;
    const rate = total ? Math.round((r.wins / total) * 100) : 0;
    (el.querySelector("#c-w") as HTMLElement).textContent = String(r.wins);
    (el.querySelector("#c-l") as HTMLElement).textContent = String(r.losses);
    (el.querySelector("#c-rate") as HTMLElement).innerHTML =
      total ? `Aproveitamento: <b>${rate}%</b> em ${total} lutas` : "Sem lutas ainda. Bora!";
  });
}

// ---------- ONLINE (sala por convite) ----------
let onScene: "home" | "room" = "home";
let roomCode = "", mySide: Online.Side = "host", roomUnsub: () => void = () => {};
let roomData: Online.Room | null = null, myFighter = 0;

function onlineCleanup() {
  netCleanup();
  roomUnsub(); roomUnsub = () => {};
  if (roomCode) Online.leaveRoom(roomCode, mySide).catch(() => {});
  roomCode = ""; roomData = null; onScene = "home";
}

// convidado entra na luta quando o host inicia
function handleRoom(r: Online.Room | null) {
  if (!r) { goOnline(); return; }
  roomData = r;
  if (r.status === "fighting" && scene === "online" && netMode === "off") {
    startNetFight(false);
    return;
  }
  if (scene === "online") renderOnline();
}
function goOnline() {
  onlineCleanup();
  scene = "online"; ui.scene("online"); renderOnline();
}
function renderOnline() {
  const el = ui.online;
  if (!user) { loginGate(el, "Entre pra criar ou entrar numa sala."); return; }
  if (onScene === "home") {
    const opts = ROSTER.map((f) => `<option value="${f.id}" ${f.id === myFighter ? "selected" : ""}>${f.name}</option>`).join("");
    el.innerHTML = `<div class="panel"><h2>ONLINE</h2>
      <div class="field"><label>SEU LUTADOR</label><select id="o-fighter">${opts}</select></div>
      <button class="menu-btn" id="o-create">CRIAR SALA <span class="chev">＋</span></button>
      <div class="field"><label>ENTRAR COM CÓDIGO</label><input id="o-code" maxlength="4" placeholder="ABCD" /></div>
      <button class="menu-btn ghost" id="o-join">ENTRAR NA SALA</button>
      <button class="sel-back" id="o-back">◂ VOLTAR</button></div>`;
    el.querySelector<HTMLSelectElement>("#o-fighter")!.addEventListener("change", (e) => {
      myFighter = Number((e.target as HTMLSelectElement).value);
    });
    el.querySelector<HTMLElement>("#o-create")!.addEventListener("click", doCreate);
    el.querySelector<HTMLElement>("#o-join")!.addEventListener("click", () => {
      const c = (el.querySelector("#o-code") as HTMLInputElement).value.trim().toUpperCase();
      if (c.length === 4) doJoin(c);
    });
    el.querySelector<HTMLElement>("#o-back")!.addEventListener("click", goMenu);
  } else {
    const me = mySide === "host" ? roomData?.host : roomData?.guest;
    const opp = mySide === "host" ? roomData?.guest : roomData?.host;
    const slot = (p: Online.RoomPlayer | undefined) => `
      <div class="pslot ${p?.ready ? "ready" : ""}">
        <div class="pn">${p ? p.name : "aguardando…"}</div>
        <div class="ps ${p?.ready ? "on" : "off"}">${p ? (p.ready ? "PRONTO" : "escolhendo") : "—"}</div>
        <div class="ps off">${p ? ROSTER[p.fighter]?.name : ""}</div>
      </div>`;
    const bothReady = !!(roomData?.host?.ready && roomData?.guest?.ready);
    el.innerHTML = `<div class="panel"><h2>SALA</h2>
      <div class="roomcode">${roomCode}</div>
      <p class="lead">compartilhe o código com seu amigo</p>
      <div class="players">${slot(me)}<div class="vs" style="color:var(--gold)">VS</div>${slot(opp)}</div>
      <button class="menu-btn" id="o-ready">${me?.ready ? "CANCELAR PRONTO" : "ESTOU PRONTO"}</button>
      ${bothReady ? (mySide === "host"
        ? `<button class="menu-btn" id="o-start" style="background:linear-gradient(180deg,#1f9d4f,#0f6e33);box-shadow:0 6px 0 #0a4a22">LUTAR! <span class="chev">▸</span></button>`
        : `<div class="note">Os dois prontos! O host vai iniciar a luta.</div>`) : ""}
      <div class="note">Beta: conexão ao vivo (P2P/Firebase). Host roda a luta, convidado controla seu lutador. Pode ter delay no celular.</div>
      <button class="sel-back" id="o-leave">◂ SAIR DA SALA</button></div>`;
    el.querySelector<HTMLElement>("#o-ready")!.addEventListener("click", () => {
      Online.setReady(roomCode, mySide, !me?.ready);
    });
    const st = el.querySelector<HTMLElement>("#o-start");
    if (st) st.addEventListener("click", startOnlineFight);
    el.querySelector<HTMLElement>("#o-leave")!.addEventListener("click", goOnline);
  }
}
async function doCreate() {
  const code = await Online.createRoom(user!, myFighter);
  if (!code) { alert("Não foi possível criar a sala."); return; }
  roomCode = code; mySide = "host"; onScene = "room";
  roomUnsub = Online.watchRoom(code, handleRoom);
  renderOnline();
}
async function doJoin(code: string) {
  const res = await Online.joinRoom(code, user!, myFighter);
  if (res === "missing") { alert("Sala não encontrada."); return; }
  if (res === "full") { alert("Sala cheia."); return; }
  roomCode = code; mySide = "guest"; onScene = "room";
  roomUnsub = Online.watchRoom(code, handleRoom);
  renderOnline();
}
function startOnlineFight() {
  if (mySide !== "host") return;
  Online.setStatus(roomCode, "fighting");
  startNetFight(true);
}
function tryAttack(kind: Kind, tap: 1 | 2 | 3) {
  if (scene !== "fight" || !ready) return;
  ui.litAttack(kind);
  if (netMode === "guest") {
    controlled?.attack(kind, tap, MOVES);   // previsão local (golpe sai na hora)
    myAtkId++; myAtkKind = kind; myAtkTap = tap;
    net?.sendInput({ walk: inputWalk(), atkId: myAtkId, kind, tap }); // manda já, sem esperar o tick
    return;
  }
  controlled?.attack(kind, tap, MOVES);
}

let joyWalk = 0;
ui.buildControls(
  (kind: Kind, tap) => tryAttack(kind, tap),
  (x) => { joyWalk = x; },
);

// teclado: A/D ou setas = andar · J soco · K chute · L cotovelo
const keys = new Set<string>();
const keyWalk = () => (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
const taps: Record<string, TapCounter> = {
  j: new TapCounter((c) => tryAttack("soco", c)),
  k: new TapCounter((c) => tryAttack("chute", c)),
  l: new TapCounter((c) => tryAttack("cotovelada", c)),
};
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (["a", "d", "arrowleft", "arrowright"].includes(k)) { keys.add(k); return; }
  if (!e.repeat && taps[k]) taps[k].hit();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

resize();
ui.scene("menu");

new Loop(update, render).start();
