import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getDatabase, ref, set, type Database } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigValid = Object.values(firebaseConfig).every(Boolean);

let appInstance: FirebaseApp | null = null;
let dbInstance: Database | null = null;

const getFirebaseApp = () => {
  if (!isConfigValid) return null;
  if (appInstance) return appInstance;
  if (getApps().length) {
    appInstance = getApps()[0];
  } else {
    appInstance = initializeApp(firebaseConfig);
  }
  return appInstance;
};

const getRealtimeDb = () => {
  if (!isConfigValid) return null;
  if (dbInstance) return dbInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  dbInstance = getDatabase(app);
  return dbInstance;
};

export const isFirebaseConfigured = isConfigValid;

export const syncStructureSnapshot = async (payload: { events: unknown; groups: unknown; criteria: unknown }) => {
  const db = getRealtimeDb();
  if (!db) return;
  const structureRef = ref(db, 'structure');
  await set(structureRef, {
    ...payload,
    updatedAt: Date.now(),
  });
};

export const syncEvaluationToFirebase = async (evaluation: any) => {
  const db = getRealtimeDb();
  if (!db) return;
  const evaluationRef = ref(db, `evaluations/${evaluation.eventId}/${evaluation.groupId}/${evaluation.id}`);
  await set(evaluationRef, {
    ...evaluation,
    syncedAt: Date.now(),
  });
};
