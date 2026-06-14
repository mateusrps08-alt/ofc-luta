import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";
import { getDatabase, Database } from "firebase/database";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// true só quando as variáveis de ambiente estão preenchidas
export const firebaseReady = Boolean(cfg.apiKey && cfg.databaseURL);

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Database | null = null;
export const provider = new GoogleAuthProvider();

if (firebaseReady) {
  app = initializeApp(cfg);
  _auth = getAuth(app);
  _db = getDatabase(app);
}

export const auth = _auth;
export const db = _db;
