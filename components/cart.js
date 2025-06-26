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

    cartDetails.innerHTML = '';

    if (cart.length === 0) {
        cartDetails.innerHTML = '<p>El carrito está vacío.</p>';
    } else {
        let totalGeneral = 0;

        for (const item of cart) {
            const productDoc = await getDoc(doc(db, `stores/${window.storeId}/products`, item.productId));
            let product = item; // Usar datos del carrito por defecto
            if (productDoc.exists()) {
                product = { ...productDoc.data(), ...item }; // Combinar datos de Firestore y carrito
            }

            const subtotal = product.price * item.quantity;
            totalGeneral += subtotal;

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

        // Mostrar el total general
        const totalElement = document.createElement('div');
        totalElement.classList.add('cart-total');
        totalElement.innerHTML = `
            <p><strong>Total General:</strong> $${totalGeneral.toFixed(2)}</p>
        `;
        cartDetails.appendChild(totalElement);

        // Botón de checkout
        const checkoutButton = document.createElement('button');
        checkoutButton.textContent = 'Continuar';
        checkoutButton.classList.add('checkout-btn');
        checkoutButton.addEventListener('click', () => {
            window.location.href = `/checkout.html?storeId=${window.storeId}`;
        });
        cartDetails.appendChild(checkoutButton);

        // Agregar eventos a los botones de eliminar
        const removeButtons = document.querySelectorAll('.remove-from-cart');
        removeButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const productId = event.target.closest('button').getAttribute('data-product-id');
                removeFromCart(productId);
            });
        });

        // Agregar eventos a los botones de incrementar cantidad
        const incrementButtons = document.querySelectorAll('.increment-quantity');
        incrementButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const productId = event.target.closest('button').getAttribute('data-product-id');
                incrementQuantity(productId);
            });
        });
    }

    cartSidebar.classList.remove('hidden');
    cartSidebar.classList.add('visible');
}

// Cerrar la sidebar del carrito
export function setupCartSidebarClose() {
    const cartSidebar = document.getElementById('cart-sidebar');
    document.getElementById('close-cart-sidebar').addEventListener('click', () => {
        cartSidebar.classList.remove('visible');
        cartSidebar.classList.add('hidden');
    });
    // Cerrar al dar clic fuera de la sidebar
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

// Función para añadir al carrito (puedes llamarla desde cualquier página)
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

    // Unificar productos por productId antes de modificar
    const cartMap = {};
    for (const item of cart) {
        if (cartMap[item.productId]) {
            cartMap[item.productId].quantity += item.quantity;
        } else {
            cartMap[item.productId] = { ...item };
        }
    }
    cart = Object.values(cartMap);

    // Si el producto ya está en el carrito, incrementar la cantidad
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

    // Guardar el carrito actualizado (ya unificado)
    localStorage.setItem(cartKey, JSON.stringify(cart));
    updateCartCount();
    await showCart();
}