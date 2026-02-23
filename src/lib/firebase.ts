import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyC3tQNcQKcx2Yx_KcXlM78tteHuk7B0kAM",
  authDomain: "mitalento-ia.firebaseapp.com",
  projectId: "mitalento-ia",
  storageBucket: "mitalento-ia.firebasestorage.app",
  messagingSenderId: "836679235433",
  appId: "1:836679235433:web:c96b5cf37ca43b4a6beff8",
  measurementId: "G-TVKZ25XF6P",
};

// Initialize App
// getApps() checks if firebase app is already initialized, useful for hot-reloading
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Services
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

// Secondary app instance used ONLY for creating new users
// This prevents createUserWithEmailAndPassword from switching the admin session
const secondaryAppName = 'secondary';
const existingSecondary = getApps().find(a => a.name === secondaryAppName);
const secondaryApp: FirebaseApp = existingSecondary || initializeApp(firebaseConfig, secondaryAppName);
const secondaryAuth: Auth = getAuth(secondaryApp);

export { app, auth, db, storage, secondaryAuth };
