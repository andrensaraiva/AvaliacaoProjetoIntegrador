import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs,
  type Firestore 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Firestore only requires apiKey and projectId to work
const isConfigValid = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;

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

const getFirestoreDb = () => {
  if (!isConfigValid) return null;
  if (firestoreInstance) return firestoreInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  firestoreInstance = getFirestore(app);
  return firestoreInstance;
};

export const isFirebaseConfigured = isConfigValid;

export const syncStructureSnapshot = async (payload: { events: unknown; groups: unknown; criteria: unknown }) => {
  const db = getFirestoreDb();
  if (!db) return;
  const structureRef = doc(db, 'app', 'structure');
  await setDoc(structureRef, {
    ...payload,
    updatedAt: Date.now(),
  });
};

export const syncEvaluationToFirebase = async (evaluation: any) => {
  const db = getFirestoreDb();
  if (!db) return;
  const evaluationRef = doc(db, 'evaluations', `${evaluation.eventId}_${evaluation.groupId}_${evaluation.id}`);
  await setDoc(evaluationRef, {
    ...evaluation,
    syncedAt: Date.now(),
  });
};

export const fetchStructureSnapshot = async () => {
  const db = getFirestoreDb();
  if (!db) return null;
  const structureRef = doc(db, 'app', 'structure');
  const snapshot = await getDoc(structureRef);
  if (!snapshot.exists()) return null;
  return snapshot.data();
};

export const fetchEvaluationsSnapshot = async () => {
  const db = getFirestoreDb();
  if (!db) return null;
  const evaluationsCol = collection(db, 'evaluations');
  const snapshot = await getDocs(evaluationsCol);
  if (snapshot.empty) return null;
  
  // Reconstruct the tree structure expected by the app
  const tree: Record<string, Record<string, Record<string, any>>> = {};
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const { eventId, groupId, id } = data;
    if (!tree[eventId]) tree[eventId] = {};
    if (!tree[eventId][groupId]) tree[eventId][groupId] = {};
    tree[eventId][groupId][id] = data;
  });
  return tree;
};
