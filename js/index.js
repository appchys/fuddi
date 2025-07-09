// index.js (SOLO frontend, NO Cloud Functions ni nodemailer aquí)
import { app } from './firebase-config.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getTotalPoints } from './rewards.js'; // Asegúrate de que la ruta sea correcta

// Initialize Firestore
const db = getFirestore(app);
const auth = getAuth(app);

// Función auxiliar para reintentar una promesa
async function withRetry(fn, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Fetch and display stores
async function fetchStores() {
    const storesContainer = document.getElementById('stores-container');
    try {
        const storesSnapshot = await withRetry(() => getDocs(collection(db, "stores")));
        const user = auth.currentUser;
        let followedIds = [];
        if (user) {
            const followsSnap = await getDocs(collection(db, `users/${user.uid}/follows`));
            followedIds = followsSnap.docs.map(doc => doc.id);
        }
        storesSnapshot.forEach(doc => {
            const store = doc.data();
            const storeId = doc.id;
            const storeElement = document.createElement('div');
            storeElement.classList.add('store');
            storeElement.innerHTML = `
                <a href="/${storeId}" style="text-decoration: none; color: inherit; display: block;">
                    <div class="store-container">
                        <div class="store-header">
                            <div class="store-cover" style="background-color: ${store.coverUrl ? 'transparent' : '#ccc'};">
                                ${store.coverUrl ? `<img src="${store.coverUrl}" alt="Portada de la tienda ${store.name}" class="store-cover-img" loading="lazy">` : ''}
                            </div>
                            <div class="store-profile-container">
                                <img src="${store.imageUrl || 'default-profile.png'}" alt="Imagen de perfil de la tienda ${store.name}" class="index-store-profile-img" loading="lazy">
                            </div>
                        </div>
                        <div class="store-details" style="position:relative;">
                            <button class="follow-btn${followedIds.includes(storeId) ? ' following' : ''}" data-store-id="${storeId}" style="position:absolute;top:0;right:0;min-width:90px;">
                                <i class="bi ${followedIds.includes(storeId) ? 'bi-check-circle-fill' : 'bi-person-plus'}"></i>
                                ${followedIds.includes(storeId) ? 'Siguiendo' : 'Seguir'}
                            </button>
                            <h3 class="store-name" style="margin-right:100px;">${store.name || 'Tienda sin nombre'}</h3>
                            <p class="store-description">${store.description || 'Sin descripción'}</p>
                        </div>
                    </div>
                </a>
            `;
            storesContainer.appendChild(storeElement);
        });

        // Lógica de seguir tienda
        document.querySelectorAll('.follow-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const storeId = btn.getAttribute('data-store-id');
                const user = auth.currentUser;
                if (!user) {
                    alert('Inicia sesión para seguir tiendas.');
                    return;
                }
                const followRef = doc(db, `users/${user.uid}/follows/${storeId}`);
                const storeFollowRef = doc(db, `stores/${storeId}/followers/${user.uid}`);
                const isFollowing = btn.textContent.trim().startsWith('Siguiendo');
                if (isFollowing) {
                    await deleteDoc(followRef);
                    await deleteDoc(storeFollowRef);
                    btn.classList.remove('following');
                    btn.innerHTML = `<i class="bi bi-person-plus"></i> Seguir`;
                } else {
                    await setDoc(followRef, {
                        storeId,
                        followedAt: new Date().toISOString()
                    });
                    await setDoc(storeFollowRef, {
                        uid: user.uid,
                        followedAt: new Date().toISOString()
                    });
                    btn.classList.add('following');
                    btn.innerHTML = `<i class="bi bi-check-circle-fill"></i> Siguiendo`;
                }
            });
        });
    } catch (error) {
        console.error("Error al cargar las tiendas:", error);
        storesContainer.innerHTML = '<p>Error al cargar las tiendas. Por favor, <a href="#" onclick="location.reload()">recarga la página</a>.</p>';
    }
}

// Fetch and display products
async function fetchProducts() {
    const productsContainer = document.getElementById('products-container');
    try {
        const storesSnapshot = await withRetry(() => getDocs(collection(db, "stores")));
        for (const storeDoc of storesSnapshot.docs) {
            const storeId = storeDoc.id;
            const storeData = storeDoc.data(); // <-- obtenemos los datos de la tienda aquí
            const productsSnapshot = await withRetry(() => getDocs(collection(db, `stores/${storeId}/products`)));
            productsSnapshot.forEach(productDoc => {
                const product = productDoc.data();
                // Mostrar solo productos que NO estén ocultos
                if (product.hidden) return;

                // Si el producto no tiene imagen, usa el logo de la tienda
                const imageSrc = product.imageUrl || storeData.imageUrl || 'img/placeholder.png';

                const productElement = document.createElement('div');
                productElement.classList.add('product');
                productElement.innerHTML = `
                    <a href="store.html?storeId=${storeId}" style="text-decoration: none; color: inherit; display: block;">
                        <img src="${imageSrc}" alt="${product.name || 'Producto sin nombre'}" style="width: 100%; height: auto; border-radius: 8px;" loading="lazy">
                        <h3>${product.name || 'Sin nombre'}</h3>
                        <p>${product.description || 'Sin descripción'}</p>
                        <p><strong>Precio:</strong> $${product.price || 'No disponible'}</p>
                    </a>
                `;
                productsContainer.appendChild(productElement);
            });
        }
    } catch (error) {
        console.error("Error al cargar los productos:", error);
        productsContainer.innerHTML = '<p>Error al cargar los productos. Por favor, <a href="#" onclick="location.reload()">recarga la página</a>.</p>';
    }
}

// Set a random cover
async function setRandomCover() {
    try {
        const storesSnapshot = await withRetry(() => getDocs(collection(db, "stores")));
        const productImages = [];
        for (const storeDoc of storesSnapshot.docs) {
            const storeId = storeDoc.id;
            const productsSnapshot = await withRetry(() => getDocs(collection(db, `stores/${storeId}/products`)));
            productsSnapshot.forEach(productDoc => {
                const product = productDoc.data();
                if (product.imageUrl) {
                    productImages.push(product.imageUrl);
                }
            });
        }
        if (productImages.length > 0) {
            const randomImage = productImages[Math.floor(Math.random() * productImages.length)];
            const randomCoverElement = document.getElementById('random-cover');
            randomCoverElement.style.backgroundImage = `url(${randomImage})`;
        }
    } catch (error) {
        console.error("Error al cargar la portada aleatoria:", error);
    }
}

// Fetch and display followed stores
async function fetchFollowedStores() {
    const user = auth.currentUser;
    const container = document.getElementById('followed-stores-container');
    container.innerHTML = '';
    if (!user) {
        container.innerHTML = '<p>Inicia sesión para ver tus tiendas seguidas.</p>';
        return;
    }
    // Obtener los IDs de las tiendas seguidas
    const followsSnap = await getDocs(collection(db, `users/${user.uid}/follows`));
    if (followsSnap.empty) {
        container.innerHTML = '<p>No sigues ninguna tienda aún.</p>';
        return;
    }
    // Obtener los datos de cada tienda seguida
    for (const docSnap of followsSnap.docs) {
        const storeId = docSnap.id;
        const storeRef = doc(db, "stores", storeId);
        const storeDoc = await getDoc(storeRef);
        if (storeDoc.exists()) {
            const store = storeDoc.data();
            const storeElement = document.createElement('div');
            storeElement.classList.add('store');
            storeElement.innerHTML = `
                <a href="store.html?storeId=${storeId}" style="text-decoration: none; color: inherit; display: block;">
                    <div class="store-container">
                        <div class="store-header">
                            <div class="store-cover" style="background-color: ${store.coverUrl ? 'transparent' : '#ccc'};">
                                ${store.coverUrl ? `<img src="${store.coverUrl}" alt="Portada de la tienda ${store.name}" class="store-cover-img" loading="lazy">` : ''}
                            </div>
                            <div class="store-profile-container">
                                <img src="${store.imageUrl || 'default-profile.png'}" alt="Imagen de perfil de la tienda ${store.name}" class="followed-store-profile-img" loading="lazy">
                            </div>
                        </div>
                        <div class="store-details">
                            <h3 class="store-name">${store.name || 'Tienda sin nombre'}</h3>
                            <p class="store-description">${store.description || 'Sin descripción'}</p>
                        </div>
                    </div>
                </a>
            `;
            container.appendChild(storeElement);
        }
    }
}

// Función para mostrar/ocultar el botón de registro según el usuario
function toggleRegisterButton() {
    const registerBtn = document.querySelector('button[onclick*="register.html"]');
    if (!registerBtn) return;

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            registerBtn.style.display = "flex";
            return;
        }
        // Verifica si el usuario existe como tienda o cliente
        const userDoc = await getDoc(doc(db, `users/${user.uid}`));
        const storesSnap = await getDocs(collection(db, "stores"));
        let isStoreOwner = false;
        storesSnap.forEach(storeDoc => {
            const store = storeDoc.data();
            if (store.owner === user.uid) isStoreOwner = true;
        });

        if (userDoc.exists() || isStoreOwner) {
            registerBtn.style.display = "none";
        } else {
            registerBtn.style.display = "flex";
        }
    });
}

// Actualiza los puntos en la navbar
async function updateNavbarPoints() {
    const user = auth.currentUser;
    const pointsSpan = document.getElementById('navbar-points');
    if (!pointsSpan) return;
    if (user) {
        const totalPoints = await getTotalPoints(user.uid);
        pointsSpan.innerHTML = `<i class="bi bi-star-fill" style="color:#fbbf24"></i> ${totalPoints} puntos`;
    } else {
        pointsSpan.textContent = '';
    }
}

// Detectar login y mostrar seguidos
onAuthStateChanged(auth, () => {
    fetchFollowedStores();
    updateNavbarPoints();
});

// Load data on page load
fetchStores();
fetchProducts();

toggleRegisterButton();