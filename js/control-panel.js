import { auth, googleProvider, signInWithPopup, db, doc, getDoc, collection, query, where, getDocs } from './firebase-config.js';

// Hacer toggleControlPanel global
window.toggleControlPanel = function () {
    const panel = document.getElementById('controlPanel');
    if (panel) panel.classList.toggle('visible');
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
        } else {
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

                const userInfoContainer = document.getElementById('userInfo');
                const googleLoginButton = document.getElementById('googleLoginButton');

                if (!userInfoContainer) {
                    console.error('El contenedor userInfo no existe en el DOM.');
                    return;
                }

                auth.onAuthStateChanged(async (user) => {
                    if (user) {
                        // Ocultar el botón de Google
                        if (googleLoginButton) {
                            googleLoginButton.style.display = 'none';
                        }

                        let clientInfo = '';
                        let storeInfo = '';
                        let storeId = '';

                        try {
                            // Obtener datos del perfil de cliente
                            const userDoc = doc(db, 'users', user.uid);
                            const userSnapshot = await getDoc(userDoc);

                            if (userSnapshot.exists()) {
                                const userData = userSnapshot.data();
                                const profilePic = userData.profilePic || ''; // Asumimos que hay un campo profilePic
                                clientInfo = `
                                    <div class="client-info">
                                        <h3>Perfil</h3>
                                        <div class="profile-header">
                                            ${profilePic ? 
                                                `<img src="${profilePic}" alt="Foto de perfil">` : 
                                                `<div class="default-avatar"></div>`}
                                            <span class="name">${userData.name || 'Sin nombre'}</span>
                                        </div>
                                        <ul class="section-links">
                                            <li><a href="my-orders.html">Mis pedidos</a></li>
                                        </ul>
                                    </div>
                                `;
                            } else {
                                clientInfo = `
                                    <div class="client-info">
                                        <h3>Perfil</h3>
                                        <button class="create-btn" id="createClientProfileButton">Crear Perfil</button>
                                    </div>
                                `;
                            }

                            // Obtener datos de la tienda
                            const storeQuery = query(collection(db, 'stores'), where('owner', '==', user.uid));
                            const storeSnapshot = await getDocs(storeQuery);

                            if (!storeSnapshot.empty) {
                                const storeData = storeSnapshot.docs[0].data();
                                storeId = storeSnapshot.docs[0].id;
                                const storePic = storeData.imageUrl || '';
                                storeInfo = `
    <div class="store-info">
        <h3>Tienda</h3>
        <div class="profile-header">
            ${storePic ? `<img src="${storePic}" alt="Foto de tienda">` : `<div class="default-avatar"></div>`}
            <span class="name">${storeData.name || 'Sin nombre'}</span>
        </div>
        <ul class="section-links">
            <li><a href="store-orders.html">Pedidos recibidos</a></li>
            <li><a href="store-products.html?storeId=${storeId}">Mis productos</a></li>
            <li><a href="store-edit.html?storeId=${storeId}">Editar tienda</a></li>
        </ul>
    </div>
`;
                            } else {
                                storeInfo = `
                                    <div class="store-info">
                                        <h3>Tienda</h3>
                                        <button class="create-btn" id="createStoreButton">Crear Tienda</button>
                                    </div>
                                `;
                            }
                        } catch (error) {
                            console.error('Error al obtener datos del usuario o tienda:', error);
                        }

                        // Mostrar las secciones
                        userInfoContainer.innerHTML = `
                            ${storeInfo}    
                            ${clientInfo}
                            
                            <button class="logout-btn" id="logoutButton" title="Cerrar sesión">
                                <i class="bi bi-power"></i>
                            </button>
                        `;

                        // Evento para crear perfil
                        const createClientProfileButton = document.getElementById('createClientProfileButton');
                        if (createClientProfileButton) {
                            createClientProfileButton.addEventListener('click', () => {
                                window.location.href = 'register.html';
                            });
                        }

                        // Evento para crear tienda
                        const createStoreButton = document.getElementById('createStoreButton');
                        if (createStoreButton) {
                            createStoreButton.addEventListener('click', () => {
                                window.location.href = 'register.html';
                            });
                        }

                        // Evento para cerrar sesión
                        const logoutButton = document.getElementById('logoutButton');
                        if (logoutButton) {
                            logoutButton.addEventListener('click', () => {
                                auth.signOut()
                                    .then(() => {
                                        alert('Has cerrado sesión.');
                                        window.location.reload();
                                    })
                                    .catch((error) => {
                                        console.error('Error al cerrar sesión:', error.message);
                                    });
                            });
                        }
                    } else {
                        // Mostrar botón de Google si no hay usuario
                        if (googleLoginButton) {
                            googleLoginButton.style.display = 'block';
                        }
                        userInfoContainer.innerHTML = `
                            <p>No has iniciado sesión</p>
                        `;
                    }
                });
            })
            .catch(error => console.error('Error al cargar la sidebar:', error));
    }

    // Actualizar enlaces con storeId
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const storeQuery = query(collection(db, 'stores'), where('owner', '==', user.uid));
                const storeSnapshot = await getDocs(storeQuery);

                if (!storeSnapshot.empty) {
                    const storeId = storeSnapshot.docs[0].id;
                    localStorage.setItem('storeId', storeId);

                    document.querySelectorAll('a[href*="storeId=STORE_ID"]').forEach((link) => {
                        link.href = link.href.replace('storeId=STORE_ID', `storeId=${storeId}`);
                    });
                }
            } catch (error) {
                console.error('Error al obtener el storeId:', error);
            }
        }
    });
});