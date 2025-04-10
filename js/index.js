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
            const storeId = doc.id; // Obtener el ID de la tienda
            const storeElement = document.createElement('div');
            storeElement.classList.add('store');
            storeElement.innerHTML = `
                <h3>
                    <a href="store.html?storeId=${storeId}" style="text-decoration: none; color: inherit;">
                        ${store.name}
                    </a>
                </h3>
                <p>${store.description}</p>
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
                    <img src="${product.imageUrl}" alt="${product.name}" style="width: 100%; height: auto; border-radius: 8px;">
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <p><strong>Precio:</strong> $${product.price}</p>
                `;
                productsContainer.appendChild(productElement);
            });
        }
    } catch (error) {
        console.error("Error al cargar los productos:", error);
        productsContainer.innerHTML = '<p>Error al cargar los productos. Por favor, <a href="#" onclick="location.reload()">recarga la página</a>.</p>';
    }
}

// Load data on page load
fetchStores();
fetchProducts();