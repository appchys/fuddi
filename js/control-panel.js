import { auth, googleProvider, signInWithPopup, db, doc, getDoc } from './firebase-config.js';

// Hacer toggleControlPanel global
window.toggleControlPanel = function () {
    const panel = document.getElementById('controlPanel');
    if (panel) panel.classList.toggle('visible');
};

// Función para verificar si el usuario existe en Firestore
async function checkUserExists(userId) {
    // Verificar en la colección 'users'
    const userDoc = doc(db, 'users', userId);
    const userSnapshot = await getDoc(userDoc);
    if (userSnapshot.exists()) {
        return { exists: true, type: 'client', data: userSnapshot.data() };
    }

    // Verificar en la colección 'stores'
    const storeDoc = doc(db, 'stores', userId);
    const storeSnapshot = await getDoc(storeDoc);
    if (storeSnapshot.exists()) {
        return { exists: true, type: 'store', data: storeSnapshot.data() };
    }

    return { exists: false };
}

// Función para mostrar un modal/prompt para elegir tipo de cuenta
function promptAccountType() {
    return new Promise((resolve) => {
        const choice = prompt("¿Deseas registrarte como Cliente o Tienda? Escribe 'Cliente' o 'Tienda'");
        resolve(choice ? choice.trim() : null);
    });
}

// Función para iniciar sesión con Google
window.loginWithGoogle = async function () {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // Verificar si el usuario ya existe
        const userCheck = await checkUserExists(user.uid);

        if (userCheck.exists) {
            // Si existe, mostrar bienvenida
            console.log('Usuario autenticado:', user.displayName, user.email);
            alert(`¡Bienvenido, ${user.displayName}! Ya estás registrado como ${userCheck.type}.`);
        } else {
            // Si no existe, redirigir a register.html
            alert('No estás registrado. Por favor, completa tu registro.');
            window.location.href = 'register.html';
        }
    } catch (error) {
        console.error('Error al iniciar sesión con Google:', error.message);
        alert('Error al iniciar sesión: ' + error.message);
    }
};

// Event listener para el scroll
let lastScrollTop = 0;

window.addEventListener('scroll', () => {
    const hamburgerBtn = document.getElementById('control-panel-toggle');
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

    if (hamburgerBtn) {
        if (currentScroll > lastScrollTop) {
            hamburgerBtn.style.opacity = '0';
            hamburgerBtn.style.pointerEvents = 'none';
        } else {
            hamburgerBtn.style.opacity = '1';
            hamburgerBtn.style.pointerEvents = 'auto';
        }
    }
    lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
});

// Cargar el panel de control dinámicamente
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('control-panel-container');
    if (container) {
        fetch('control-panel.html')
            .then(response => response.text())
            .then(html => {
                container.innerHTML = html;
            })
            .catch(error => console.error('Error al cargar la sidebar:', error));
    }
});