// index.js
import { app } from './firebase-config.js'; // Import nombrado
import { getFirestore, collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Initialize Firestore
const db = getFirestore(app);

// Función auxiliar para reintentar una promesa
async function withRetry(fn, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) {
                console.error("Todos los intentos fallaron:", error);
                throw error;
            }
            console.warn(`Intento ${i + 1} falló, reintentando en ${delay}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Fetch and display stores

async function fetchStores() {
    const storesContainer = document.getElementById('stores-container');
    
    try {
        const storesSnapshot = await withRetry(() => getDocs(collection(db, "stores")));
        storesSnapshot.forEach(doc => {
            const store = doc.data();
            const storeId = doc.id;
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
                                <img src="${store.imageUrl || 'default-profile.png'}" alt="Imagen de perfil de la tienda ${store.name}" class="store-profile-img" loading="lazy">
                            </div>
                        </div>
                        <div class="store-details">
                            <h3 class="store-name">${store.name || 'Tienda sin nombre'}</h3>
                            <p class="store-description">${store.description || 'Sin descripción'}</p>
                        </div>
                    </div>
                </a>
            `;
            storesContainer.appendChild(storeElement);
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

        // Iterate over each store to fetch its products
        for (const storeDoc of storesSnapshot.docs) {
            const storeId = storeDoc.id; // Get the store ID
            const productsSnapshot = await withRetry(() => getDocs(collection(db, `stores/${storeId}/products`)));

            productsSnapshot.forEach(productDoc => {
                const product = productDoc.data();
                const productElement = document.createElement('div');
                productElement.classList.add('product');
                productElement.innerHTML = `
                    <a href="store.html?storeId=${storeId}" style="text-decoration: none; color: inherit; display: block;">
                        <img src="${product.imageUrl || 'https://via.placeholder.com/150'}" alt="${product.name || 'Producto sin nombre'}" style="width: 100%; height: auto; border-radius: 8px;" loading="lazy">
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

        // Itera sobre cada tienda para obtener las imágenes de los productos
        for (const storeDoc of storesSnapshot.docs) {
            const storeId = storeDoc.id;
            const productsSnapshot = await withRetry(() => getDocs(collection(db, `stores/${storeId}/products`)));

            productsSnapshot.forEach(productDoc => {
                const product = productDoc.data();
                if (product.imageUrl) {
                    productImages.push(product.imageUrl); // Agrega la URL de la imagen del producto
                }
            });
        }

        if (productImages.length > 0) {
            const randomImage = productImages[Math.floor(Math.random() * productImages.length)]; // Selecciona una imagen aleatoria
            const randomCoverElement = document.getElementById('random-cover');
            randomCoverElement.style.backgroundImage = `url(${randomImage})`; // Establece la imagen de fondo
        }
    } catch (error) {
        console.error("Error al cargar la portada aleatoria:", error);
    }
}

// Load data on page load
fetchStores();
fetchProducts();
setRandomCover();