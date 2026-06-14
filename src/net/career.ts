import { ref, get, runTransaction, onValue } from "firebase/database";
import { db } from "./firebase";

export interface Record {
  wins: number;
  losses: number;
}

const EMPTY: Record = { wins: 0, losses: 0 };

export async function getRecord(uid: string): Promise<Record> {
  if (!db) return { ...EMPTY };
  const snap = await get(ref(db, `users/${uid}/record`));
  return snap.exists() ? { ...EMPTY, ...snap.val() } : { ...EMPTY };
}

export async function addResult(uid: string, win: boolean) {
  if (!db) return;
  const key = win ? "wins" : "losses";
  await runTransaction(ref(db, `users/${uid}/record/${key}`), (v) => (v || 0) + 1);
}

export function watchRecord(uid: string, cb: (r: Record) => void) {
  if (!db) { cb({ ...EMPTY }); return () => {}; }
  return onValue(ref(db, `users/${uid}/record`), (s) => cb(s.exists() ? { ...EMPTY, ...s.val() } : { ...EMPTY }));
}
