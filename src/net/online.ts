import { ref, set, get, update, onValue, onDisconnect, remove } from "firebase/database";
import { db } from "./firebase";
import { AppUser } from "./auth";

export type Side = "host" | "guest";

export interface RoomPlayer {
  uid: string;
  name: string;
  fighter: number;
  ready: boolean;
}
export interface Room {
  host?: RoomPlayer;
  guest?: RoomPlayer;
  status: "waiting" | "ready" | "fighting";
}

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
  let c = "";
  for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return c;
}

export async function createRoom(user: AppUser, fighter: number): Promise<string | null> {
  if (!db) return null;
  const code = genCode();
  const player: RoomPlayer = { uid: user.uid, name: user.name, fighter, ready: false };
  await set(ref(db, `rooms/${code}`), { host: player, status: "waiting" });
  onDisconnect(ref(db, `rooms/${code}`)).remove();
  return code;
}

export async function joinRoom(code: string, user: AppUser, fighter: number): Promise<"ok" | "missing" | "full"> {
  if (!db) return "missing";
  const snap = await get(ref(db, `rooms/${code}`));
  if (!snap.exists()) return "missing";
  if (snap.val().guest) return "full";
  const player: RoomPlayer = { uid: user.uid, name: user.name, fighter, ready: false };
  await update(ref(db, `rooms/${code}`), { guest: player });
  onDisconnect(ref(db, `rooms/${code}/guest`)).remove();
  return "ok";
}

export function watchRoom(code: string, cb: (room: Room | null) => void) {
  if (!db) { cb(null); return () => {}; }
  return onValue(ref(db, `rooms/${code}`), (s) => cb(s.exists() ? (s.val() as Room) : null));
}

export async function setReady(code: string, side: Side, ready: boolean) {
  if (!db) return;
  await update(ref(db, `rooms/${code}/${side}`), { ready });
}

export async function setFighter(code: string, side: Side, fighter: number) {
  if (!db) return;
  await update(ref(db, `rooms/${code}/${side}`), { fighter });
}

export async function setStatus(code: string, status: Room["status"]) {
  if (!db) return;
  await update(ref(db, `rooms/${code}`), { status });
}

export async function leaveRoom(code: string, side: Side) {
  if (!db) return;
  if (side === "host") await remove(ref(db, `rooms/${code}`));
  else await remove(ref(db, `rooms/${code}/guest`));
}
