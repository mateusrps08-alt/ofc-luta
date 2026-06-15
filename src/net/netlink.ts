import { ref, set, onValue, off } from "firebase/database";
import { db } from "./firebase";

// Incrementar quando o formato do pacote mudar — os dois lados precisam bater.
export const NET_VERSION = 2;

type Msg = Record<string, unknown> & { seq?: number };

// Transporte agnóstico de jogo: host manda "state", guest manda "input".
// Tenta WebRTC P2P (rápido); cai pro Firebase RTDB se o P2P não abrir.
// Baseado no netcode host-autoritativo do jogo-da-copa (testado).
export class NetLink {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  rtcOpen = false;
  private refs: ReturnType<typeof ref>[] = [];
  private stateRef!: ReturnType<typeof ref>;
  private inputRef!: ReturnType<typeof ref>;
  private sendSeq = 0;
  private recvSeq = -1;
  lastData = 0;

  onState: (s: Msg) => void = () => {};
  onInput: (i: Msg) => void = () => {};

  constructor(public roomCode: string, public isHost: boolean) {
    if (!db) return;
    this.stateRef = ref(db, `rooms/${roomCode}/game/state`);
    this.inputRef = ref(db, `rooms/${roomCode}/game/guestInput`);
    this.refs.push(this.stateRef, this.inputRef);

    if (isHost) {
      onValue(this.inputRef, (s) => { if (s.exists()) this.recv(s.val(), true); });
    } else {
      onValue(this.stateRef, (s) => { if (s.exists()) this.recv(s.val(), false); });
    }
    this.initRtc();
  }

  private recv(msg: Msg, isInput: boolean) {
    if (typeof msg.seq === "number") {
      if (msg.seq <= this.recvSeq) return; // pacote atrasado: descarta
      this.recvSeq = msg.seq;
    }
    this.lastData = performance.now();
    if (isInput) this.onInput(msg); else this.onState(msg);
  }

  private transmit(obj: Msg, fallback: ReturnType<typeof ref>) {
    obj.seq = this.sendSeq++;
    if (this.rtcOpen && this.dc?.readyState === "open") {
      try { this.dc.send(JSON.stringify(obj)); } catch { this.rtcOpen = false; }
    }
    // Sempre manda TAMBÉM pelo Firebase (canal confiável). O P2P pode reportar
    // "open" de um lado e não entregar do outro (NAT da operadora / 5G), o que
    // dava "SEM SINAL". O receptor deduplica por seq → nunca aplica em dobro.
    set(fallback, obj).catch(() => {});
  }

  sendState(obj: Msg) { this.transmit(obj, this.stateRef); }   // host
  sendInput(obj: Msg) { this.transmit(obj, this.inputRef); }   // guest

  connWarn() { return this.lastData > 0 && performance.now() - this.lastData > 4000; }

  private setupChannel(dc: RTCDataChannel) {
    this.dc = dc;
    dc.onopen = () => { this.rtcOpen = true; };
    const drop = () => { this.rtcOpen = false; };
    dc.onclose = drop;
    dc.onerror = drop;
    dc.onmessage = (e) => {
      try { this.recv(JSON.parse(e.data), this.isHost); } catch { /* pacote inválido */ }
    };
  }

  private initRtc() {
    if (!db || typeof RTCPeerConnection === "undefined") return;
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      this.pc = pc;
      const base = `rooms/${this.roomCode}/rtc`;
      const offerRef = ref(db, `${base}/offer`);
      const answerRef = ref(db, `${base}/answer`);
      const theirCand = ref(db, `${base}/${this.isHost ? "guest" : "host"}Cand`);
      this.refs.push(offerRef, answerRef, theirCand);

      let candN = 0;
      pc.onicecandidate = (e) => {
        if (e.candidate && db)
          set(ref(db, `${base}/${this.isHost ? "host" : "guest"}Cand/c${candN++}`), JSON.stringify(e.candidate.toJSON())).catch(() => {});
      };
      const pending: RTCIceCandidateInit[] = [];
      const seen = new Set<string>();
      const flush = () => {
        if (!pc.remoteDescription) return;
        while (pending.length) pc.addIceCandidate(new RTCIceCandidate(pending.shift()!)).catch(() => {});
      };
      onValue(theirCand, (snap) => {
        const v = snap.val();
        if (!v) return;
        for (const k of Object.keys(v)) {
          if (seen.has(k)) continue;
          seen.add(k);
          try { pending.push(JSON.parse(v[k])); } catch { /* ignora */ }
        }
        flush();
      });

      if (this.isHost) {
        this.setupChannel(pc.createDataChannel("game", { ordered: false, maxRetransmits: 0 }));
        onValue(answerRef, (snap) => {
          const v = snap.val();
          if (v && !pc.remoteDescription) pc.setRemoteDescription(JSON.parse(v)).then(flush).catch(() => {});
        });
        pc.createOffer()
          .then((o) => pc.setLocalDescription(o))
          .then(() => db && set(offerRef, JSON.stringify(pc.localDescription)))
          .catch(() => {});
      } else {
        pc.ondatachannel = (e) => this.setupChannel(e.channel);
        onValue(offerRef, (snap) => {
          const v = snap.val();
          if (v && !pc.remoteDescription) {
            pc.setRemoteDescription(JSON.parse(v))
              .then(() => { flush(); return pc.createAnswer(); })
              .then((a) => pc.setLocalDescription(a))
              .then(() => db && set(answerRef, JSON.stringify(pc.localDescription)))
              .catch(() => {});
          }
        });
      }
    } catch { /* sem WebRTC: segue só pelo Firebase */ }
  }

  destroy() {
    for (const r of this.refs) off(r);
    try { this.dc?.close(); this.pc?.close(); } catch { /* já fechado */ }
  }
}
