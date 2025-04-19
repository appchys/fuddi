// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc // Importar addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAAAFDJ_utlimCezUR-_i8Y2yUare9yZ1k",
  authDomain: "multitienda-69778.firebaseapp.com",
  projectId: "multitienda-69778",
  storageBucket: "multitienda-69778.firebasestorage.app",
  messagingSenderId: "939925630795",
  appId: "1:939925630795:web:713aca499392bfa36482ce"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Inicializa Authentication
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Inicializa Firestore
const db = getFirestore(app);

// Inicializa Storage
const storage = getStorage(app);

export { 
  app, 
  auth, 
  googleProvider, 
  signInWithPopup, 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, // Exportar addDoc
  storage, 
  ref, 
  uploadBytes 
};

// Función para verificar si el usuario existe en Firestore
async function checkUserExists(userId) {
  const userDoc = doc(db, 'users', userId);
  const userSnapshot = await getDoc(userDoc);
  if (userSnapshot.exists()) {
      return { exists: true, type: 'client', data: userSnapshot.data() };
  }

  const storeDoc = doc(db, 'stores', userId);
  const storeSnapshot = await getDoc(storeDoc);
  if (storeSnapshot.exists()) {
      return { exists: true, type: 'store', data: storeSnapshot.data() };
  }

  return { exists: false };
}

// Función para iniciar sesión con Google
window.loginWithGoogle = async function () {
  try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userCheck = await checkUserExists(user.uid);
      if (userCheck.exists) {
          alert(`¡Bienvenido, ${user.displayName}! Ya estás registrado como ${userCheck.type}.`);
          window.location.href = 'index.html'; // Redirigir a index.html si existe al menos un perfil
      } else {
          window.location.href = 'register.html'; // Redirigir a register.html si no hay ningún perfil
      }
  } catch (error) {
      console.error('Error al iniciar sesión con Google:', error.message);
      alert('Error al iniciar sesión: ' + error.message);
  }
};