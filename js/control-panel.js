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

                // Ahora que el HTML está cargado, selecciona el contenedor userInfo y el botón de Google
                const userInfoContainer = document.getElementById('userInfo');
                const googleLoginButton = document.getElementById('googleLoginButton');

                if (!userInfoContainer) {
                    console.error('El contenedor userInfo no existe en el DOM.');
                    return;
                }

                // Escuchar cambios en el estado de autenticación
                auth.onAuthStateChanged((user) => {
                    console.log('Estado de autenticación:', user); // Depuración
                    if (user) {
                        const { displayName, email, photoURL } = user;

                        // Mostrar información del usuario
                        userInfoContainer.innerHTML = `
                            <img src="${photoURL || 'https://via.placeholder.com/60'}" alt="Foto de perfil">
                            <div class="user-details">
                                <div class="user-name">${displayName || 'Usuario'}</div>
                                <div class="user-email">${email || 'Correo no disponible'}</div>
                            </div>
                            <button class="logout-btn" id="logoutButton" title="Cerrar sesión">
                                <i class="bi bi-power"></i>
                            </button>
                        `;

                        // Ocultar el botón de "Iniciar sesión con Google"
                        if (googleLoginButton) {
                            googleLoginButton.style.display = 'none';
                        }

                        // Agregar funcionalidad al botón de cerrar sesión
                        const logoutButton = document.getElementById('logoutButton');
                        logoutButton.addEventListener('click', () => {
                            auth.signOut()
                                .then(() => {
                                    alert('Has cerrado sesión.');
                                    window.location.reload(); // Recargar la página después de cerrar sesión
                                })
                                .catch((error) => {
                                    console.error('Error al cerrar sesión:', error.message);
                                });
                        });
                    } else {
                        // Mostrar el botón de "Iniciar sesión con Google" si no hay usuario logueado
                        if (googleLoginButton) {
                            googleLoginButton.style.display = 'block';
                        }

                        // Mostrar mensaje de no autenticado
                        userInfoContainer.innerHTML = `
                            <p>No has iniciado sesión</p>
                        `;
                    }
                });
            })
            .catch(error => console.error('Error al cargar la sidebar:', error));
    }
});