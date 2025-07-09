import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Requiere que window.storeId esté definido
export async function showCart() {
    if (!window.storeId) {
        console.error("No se proporcionó un storeId en la URL.");
        return;
    }

    const db = getFirestore();
    const cartKey = `cart_${window.storeId}`;
    let cart = JSON.parse(localStorage.getItem(cartKey)) || [];
    const cartMap = {};
    for (const item of cart) {
        if (cartMap[item.productId]) {
            cartMap[item.productId].quantity += item.quantity;
        } else {
            cartMap[item.productId] = { ...item };
        }
    }
    cart = Object.values(cartMap);

    const cartSidebar = document.getElementById('cart-sidebar');
    const cartDetails = document.getElementById('cart-details');

    // Actualizar el contador del carrito
    updateCartCount();

    // Si el carrito está vacío, mostrar mensaje y salir
    if (cart.length === 0) {
        if (cartDetails.innerHTML !== '<p>El carrito está vacío.</p>') {
            cartDetails.innerHTML = '<p>El carrito está vacío.</p>';
        }
        cartSidebar.classList.remove('hidden');
        cartSidebar.classList.add('visible');
        return;
    }

    let totalGeneral = 0;
    const existingItems = new Map(
        Array.from(cartDetails.querySelectorAll('.cart-item')).map(item => [
            item.querySelector('.remove-from-cart').getAttribute('data-product-id'),
            item
        ])
    );

    // Procesar cada ítem del carrito
    for (const item of cart) {
        const productDoc = await getDoc(doc(db, `stores/${window.storeId}/products`, item.productId));
        let product = item;
        if (productDoc.exists()) {
            product = { ...productDoc.data(), ...item };
        }

        const subtotal = product.price * item.quantity;
        totalGeneral += subtotal;

        const existingItem = existingItems.get(item.productId);
        if (existingItem) {
            // Actualizar elemento existente
            const quantityElement = existingItem.querySelector('.cart-item-quantity');
            const subtotalElement = existingItem.querySelector('.cart-item-subtotal');
            quantityElement.childNodes[0].textContent = `Cantidad: ${item.quantity} `;
            subtotalElement.textContent = `Subtotal: $${subtotal.toFixed(2)}`;
            existingItems.delete(item.productId); // Marcar como procesado
        } else {
            // Crear nuevo elemento
            const cartItem = document.createElement('div');
            cartItem.classList.add('cart-item');
            cartItem.innerHTML = `
                <div class="cart-item-image">
                    <img src="${product.imageUrl || ''}" alt="${product.name}">
                </div>
                <div class="cart-item-details">
                    <p class="cart-item-name"><strong>${product.name}</strong></p>
                    <p class="cart-item-quantity">
                        Cantidad: ${item.quantity}
                        <button class="increment-quantity" data-product-id="${item.productId}" title="Incrementar cantidad">
                            <i class="bi bi-plus-circle"></i>
                        </button>
                    </p>
                    <p class="cart-item-subtotal">Subtotal: $${subtotal.toFixed(2)}</p>
                </div>
                <button class="remove-from-cart" data-product-id="${item.productId}" title="Eliminar del carrito">
                    <i class="bi bi-trash"></i>
                </button>
            `;
            cartDetails.appendChild(cartItem);
        }
    }

    // Eliminar ítems que ya no están en el carrito
    existingItems.forEach(item => item.remove());

    // Actualizar o crear el total general
    let totalElement = cartDetails.querySelector('.cart-total');
    if (!totalElement) {
        totalElement = document.createElement('div');
        totalElement.classList.add('cart-total');
        cartDetails.appendChild(totalElement);
    }
    totalElement.innerHTML = `<p><strong>Total General:</strong> $${totalGeneral.toFixed(2)}</p>`;

    // Actualizar o crear el botón de checkout
    let checkoutButton = cartDetails.querySelector('.checkout-btn');
    if (!checkoutButton) {
        checkoutButton = document.createElement('button');
        checkoutButton.textContent = 'Continuar';
        checkoutButton.classList.add('checkout-btn');
        checkoutButton.addEventListener('click', () => {
            window.location.href = `/checkout.html?storeId=${window.storeId}`;
        });
        cartDetails.appendChild(checkoutButton);
    }

    // Agregar eventos a los botones de eliminar e incrementar
    const removeButtons = cartDetails.querySelectorAll('.remove-from-cart');
    removeButtons.forEach(button => {
        button.removeEventListener('click', handleRemove); // Evitar múltiples listeners
        button.addEventListener('click', handleRemove);
    });

    const incrementButtons = cartDetails.querySelectorAll('.increment-quantity');
    incrementButtons.forEach(button => {
        button.removeEventListener('click', handleIncrement); // Evitar múltiples listeners
        button.addEventListener('click', handleIncrement);
    });

    cartSidebar.classList.remove('hidden');
    cartSidebar.classList.add('visible');
}

// Funciones para manejar eventos (para evitar múltiples listeners)
function handleRemove(event) {
    const productId = event.target.closest('button').getAttribute('data-product-id');
    removeFromCart(productId);
}

function handleIncrement(event) {
    const productId = event.target.closest('button').getAttribute('data-product-id');
    incrementQuantity(productId);
}

// Cerrar la sidebar del carrito
export function setupCartSidebarClose() {
    const cartSidebar = document.getElementById('cart-sidebar');
    document.getElementById('close-cart-sidebar').addEventListener('click', () => {
        cartSidebar.classList.remove('visible');
        cartSidebar.classList.add('hidden');
    });
    document.addEventListener('mousedown', (event) => {
        if (
            cartSidebar.classList.contains('visible') &&
            !cartSidebar.contains(event.target) &&
            event.target.id !== 'cart-button'
        ) {
            cartSidebar.classList.remove('visible');
            cartSidebar.classList.add('hidden');
        }
    });
}

// Función para incrementar la cantidad de un producto en el carrito
function incrementQuantity(productId) {
    const cartKey = `cart_${window.storeId}`;
    let cart = JSON.parse(localStorage.getItem(cartKey)) || [];

    cart = cart.map(item => {
        if (item.productId === productId) {
            item.quantity += 1;
        }
        return item;
    });

    localStorage.setItem(cartKey, JSON.stringify(cart));
    showCart();
}

// Función para eliminar un producto del carrito
function removeFromCart(productId) {
    const cartKey = `cart_${window.storeId}`;
    let cart = JSON.parse(localStorage.getItem(cartKey)) || [];

    cart = cart.filter(item => item.productId !== productId);

    localStorage.setItem(cartKey, JSON.stringify(cart));
    showCart();
}

// Función para actualizar el contador del carrito
export function updateCartCount() {
    const cartKey = `cart_${window.storeId}`;
    const cart = JSON.parse(localStorage.getItem(cartKey)) || [];
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.textContent = totalItems > 0 ? totalItems : '';
    }
}

// Función para añadir al carrito
export async function addToCart(productId) {
    const db = getFirestore();
    const productRef = doc(db, `stores/${window.storeId}/products`, productId);
    const productDoc = await getDoc(productRef);
    if (!productDoc.exists()) {
        alert('Producto no encontrado');
        return;
    }

    const product = productDoc.data();
    const cartKey = `cart_${window.storeId}`;
    let cart = JSON.parse(localStorage.getItem(cartKey)) || [];

    const cartMap = {};
    for (const item of cart) {
        if (cartMap[item.productId]) {
            cartMap[item.productId].quantity += item.quantity;
        } else {
            cartMap[item.productId] = { ...item };
        }
    }
    cart = Object.values(cartMap);

    let found = false;
    cart.forEach(item => {
        if (item.productId === productId) {
            item.quantity += 1;
            found = true;
        }
    });
    if (!found) {
        cart.push({
            productId,
            quantity: 1,
            name: product.name || 'Producto desconocido',
            price: product.price || 0
        });
    }

    localStorage.setItem(cartKey, JSON.stringify(cart));
    updateCartCount();

    const cartSidebar = document.getElementById('cart-sidebar');
    cartSidebar.classList.remove('visible');
    cartSidebar.classList.add('hidden');
    setTimeout(() => {
        showCart();
    }, 10);
}