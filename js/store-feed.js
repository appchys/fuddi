// This file handles the display and management of products within the store feed section.

document.addEventListener('DOMContentLoaded', () => {
    loadStores();
});

async function loadStores() {
    try {
        const response = await fetch('api/stores'); // Replace with your API endpoint
        const stores = await response.json();
        displayStores(stores);
    } catch (error) {
        console.error('Error loading stores:', error);
    }
}

function displayStores(stores) {
    const feedContainer = document.getElementById('feed-container');
    feedContainer.innerHTML = ''; // Clear existing content

    stores.forEach(store => {
        const storeElement = document.createElement('div');
        storeElement.classList.add('store-item');

        storeElement.innerHTML = `
            <h3>${store.name}</h3>
            <p>${store.description}</p>
            <p>${store.followers} seguidores</p>
            <img src="${store.image}" alt="${store.name}" class="store-image">
            <div class="products">
                ${store.products.map(product => `
                    <div class="product-item">
                        <img src="${product.image}" alt="${product.name}" class="product-image">
                        <h4>${product.name}</h4>
                        <p>${product.price} €</p>
                    </div>
                `).join('')}
            </div>
        `;

        feedContainer.appendChild(storeElement);
    });
}