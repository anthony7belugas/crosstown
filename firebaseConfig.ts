// firebaseConfig.ts
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCYs97PnmzvUZ12LzPStIcJjRgUT8XOYKc",
  authDomain: "crosstown-4476c.firebaseapp.com",
  projectId: "crosstown-4476c",
  storageBucket: "crosstown-4476c.firebasestorage.app",
  messagingSenderId: "649176148044",
  appId: "1:649176148044:web:61a87d93e94ff524a86ce9",
  measurementId: "G-168JZEZCZV",
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (error) {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);
export const storage = getStorage(app);
