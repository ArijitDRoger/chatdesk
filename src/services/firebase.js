// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBCt1FSBLZ0M3FGNvw4nns6wEO-oFAueKc",
  authDomain: "chatdesk-c2f14.firebaseapp.com",
  projectId: "chatdesk-c2f14",
  storageBucket: "chatdesk-c2f14.firebasestorage.app",
  messagingSenderId: "266025628365",
  appId: "1:266025628365:web:bd0351b23ae005bb80af84",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
