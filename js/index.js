import { app } from './firebase-config.js'; // Import nombrado
import { getFirestore, collection, getDocs, query } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Initialize Firestore
const db = getFirestore(app);

// Fetch and display stores
async function fetchStores() {
    const storesContainer = document.getElementById('stores-container');
    const storesSnapshot = await getDocs(collection(db, "stores"));
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
}

// Fetch and display products
async function fetchProducts() {
    const productsContainer = document.getElementById('products-container');
    const storesSnapshot = await getDocs(collection(db, "stores"));

    // Iterate over each store to fetch its products
    for (const storeDoc of storesSnapshot.docs) {
        const storeId = storeDoc.id; // Get the store ID
        const productsSnapshot = await getDocs(collection(db, `stores/${storeId}/products`));

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
}

// Load data on page load
fetchStores();
fetchProducts();