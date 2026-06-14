import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User } from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, db, provider, firebaseReady } from "./firebase";

export interface AppUser {
  uid: string;
  name: string;
  photo: string;
}

export function onUser(cb: (u: AppUser | null) => void) {
  if (!firebaseReady || !auth) { cb(null); return; }
  onAuthStateChanged(auth, (u: User | null) => {
    if (!u) { cb(null); return; }
    const user: AppUser = { uid: u.uid, name: u.displayName ?? "Lutador", photo: u.photoURL ?? "" };
    // guarda o nome pro placar/sala
    if (db) set(ref(db, `users/${u.uid}/name`), user.name).catch(() => {});
    cb(user);
  });
}

export async function login() {
  if (!auth) return;
  await signInWithPopup(auth, provider);
}

export async function logout() {
  if (!auth) return;
  await fbSignOut(auth);
}
