// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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

// Configurar el proveedor de Google con opciones adicionales
const providerConfig = {
    client_id: "939925630795-465139776876784716441.apps.googleusercontent.com", // Tu client_id de Google
    hosted_domain: "gmail.com", // Forzar a usar Gmail
    request_visible_actions: "http://schemas.google.com/AddActivity",
    scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' '),
    prompt: 'select_account'
};

// Aplicar la configuración al proveedor
Object.keys(providerConfig).forEach(key => {
    googleProvider.setCustomParameters({
        [key]: providerConfig[key]
    });
});

// Inicializa Firestore
const db = getFirestore(app);

// Inicializa Storage
const storage = getStorage(app);

export { 
    app, 
    auth, 
    googleProvider, 
    signInWithPopup, 
    signInWithRedirect,
    getRedirectResult,
    db, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc,
    storage, 
    ref, 
    uploadBytes,
    getDownloadURL
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