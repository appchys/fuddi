import { app } from './firebase-config.js';
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const db = getFirestore(app);

// Obtener storeId y productId de la ruta amigable
const pathParts = window.location.pathname.split('/').filter(Boolean);
const storeId = pathParts[0]; // 'munchys'
const productId = pathParts[1]; // 'Ku3SQoPKdikbgnRudaVX'

const main = document.getElementById('product-main');

// Mostrar producto
async function loadProduct() {
    if (!storeId || !productId) {
        main.innerHTML = '<p>Producto no encontrado.</p>';
        return;
    }

    // Obtener datos del producto
    const productDoc = await getDoc(doc(db, `stores/${storeId}/products`, productId));
    if (!productDoc.exists()) {
        main.innerHTML = '<p>Producto no encontrado.</p>';
        return;
    }
    const product = productDoc.data();

    // Obtener datos de la tienda
    const storeDoc = await getDoc(doc(db, "stores", storeId));
    const store = storeDoc.exists() ? storeDoc.data() : {};

    main.innerHTML = `
        <div class="product-detail-page">
            <img src="${product.imageUrl || store.imageUrl || '/img/placeholder.png'}" alt="${product.name}" class="product-image" style="max-width:260px;display:block;margin:0 auto 18px auto;">
            <h1>${product.name}</h1>
            <p class="product-price" style="font-size:1.3em;color:#16a34a;font-weight:bold;">$${product.price ? product.price.toFixed(2) : 'No disponible'}</p>
            <p class="product-description" style="margin:18px 0;">${product.description || ''}</p>
            <div style="margin:18px 0;">
                <a href="/${storeId}" class="btn"><i class="bi bi-shop"></i> Ver tienda</a>
                <button class="btn" id="add-to-cart-btn"><i class="bi bi-cart-plus"></i> Añadir al carrito</button>
            </div>
            <hr style="margin:32px 0;">
            <div style="text-align:center;">
                <img src="${store.imageUrl || '/img/placeholder.png'}" alt="Logo tienda" style="width:60px;height:60px;border-radius:50%;margin-bottom:8px;">
                <div style="font-weight:bold;">${store.name || ''}</div>
                <div style="color:#666;">${store.description || ''}</div>
            </div>
        </div>
    `;

    // Botón añadir al carrito
    document.getElementById('add-to-cart-btn').addEventListener('click', () => {
        window.addToCart(productId);
    });
}

loadProduct();

// --- Carrito (sidebar) ---
async function showCart() {
    if (!storeId) return;
    const cartKey = `cart_${storeId}`;
    const cart = JSON.parse(localStorage.getItem(cartKey)) || [];
    const cartSidebar = document.getElementById('cart-sidebar');
    const cartDetails = document.getElementById('cart-details');
    cartDetails.innerHTML = '';

    if (cart.length === 0) {
        cartDetails.innerHTML = '<p>El carrito está vacío.</p>';
    } else {
        let totalGeneral = 0;
        for (const item of cart) {
            const productDoc = await getDoc(doc(db, `stores/${storeId}/products`, item.productId));
            let product = item;
            if (productDoc.exists()) {
                product = { ...productDoc.data(), ...item };
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
                    <p class="cart-item-quantity">Cantidad: ${item.quantity}</p>
                    <p class="cart-item-subtotal">Subtotal: $${subtotal.toFixed(2)}</p>
                </div>
            `;
            cartDetails.appendChild(cartItem);
        }
        const totalElement = document.createElement('div');
        totalElement.classList.add('cart-total');
        totalElement.innerHTML = `<p><strong>Total General:</strong> $${totalGeneral.toFixed(2)}</p>`;
        cartDetails.appendChild(totalElement);
    }
    cartSidebar.classList.remove('hidden');
    cartSidebar.classList.add('visible');
}

// Cerrar la sidebar del carrito
document.getElementById('close-cart-sidebar').addEventListener('click', () => {
    const cartSidebar = document.getElementById('cart-sidebar');
    cartSidebar.classList.remove('visible');
    cartSidebar.classList.add('hidden');
});

// Función para añadir al carrito
window.addToCart = async (productId) => {
    try {
        const productRef = doc(db, `stores/${storeId}/products`, productId);
        const productDoc = await getDoc(productRef);
        if (!productDoc.exists()) {
            alert('Producto no encontrado');
            return;
        }
        const product = productDoc.data();
        const cartKey = `cart_${storeId}`;
        const cart = JSON.parse(localStorage.getItem(cartKey)) || [];
        if (cart.some(item => item.productId === productId)) {
            cart.forEach(item => {
                if (item.productId === productId) item.quantity += 1;
            });
        } else {
            cart.push({
                productId,
                quantity: 1,
                name: product.name || 'Producto desconocido',
                price: product.price || 0
            });
        }
        localStorage.setItem(cartKey, JSON.stringify(cart));

        // Mostrar notificación
        const notification = document.createElement('div');
        notification.className = 'cart-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">✓</span>
                <span class="notification-text">${product.name} añadido al carrito</span>
            </div>
        `;
        document.body.appendChild(notification);
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-100px)';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 2000);

        // Mostrar el carrito
        showCart();
    } catch (error) {
        alert('Error al añadir al carrito. Por favor, inténtalo de nuevo.');
    }
};