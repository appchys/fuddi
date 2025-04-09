import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAAAFDJ_utlimCezUR-_i8Y2yUare9yZ1k",
  authDomain: "multitienda-69778.firebaseapp.com",
  projectId: "multitienda-69778",
  storageBucket: "multitienda-69778.appspot.com",
  messagingSenderId: "939925630795",
  appId: "1:939925630795:web:713aca499392bfa36482ce"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Inicializa Authentication
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider, signInWithPopup };