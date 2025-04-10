// En store.js
import { app, auth, googleProvider, signInWithPopup } from './firebase-config.js';
import { getFirestore, doc, getDoc, collection, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// Initialize Firestore
const db = getFirestore(app);

// Obtener el storeId de la URL
const params = new URLSearchParams(window.location.search);
const storeId = params.get('storeId');

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

// Cargar los datos de la tienda
async function loadStore() {
    if (!storeId) {
        console.error("No se proporcionó un storeId en la URL.");
        return;
    }

    const storeDoc = await getDoc(doc(db, "stores", storeId));
    if (storeDoc.exists()) {
        const store = storeDoc.data();

        // Mostrar el nombre y descripción de la tienda
        document.getElementById('store-name').textContent = store.name;
        document.getElementById('store-description').textContent = store.description;

        // Mostrar la foto de perfil de la tienda
        if (store.imageUrl) {
            const profileImage = document.getElementById('store-profile-image');
            profileImage.src = store.imageUrl;
            profileImage.alt = `Foto de perfil de ${store.name}`;
        }

        // Mostrar la foto de portada de la tienda
        if (store.coverUrl) {
            const coverImage = document.getElementById('store-cover-image');
            coverImage.style.backgroundImage = `url(${store.coverUrl})`;
        }

        // Configurar el botón de WhatsApp con el número de teléfono
        if (store.phone) {
            const whatsappButton = document.getElementById('whatsapp-link');
            const formattedPhone = formatPhoneNumber(store.phone); // Formatear el número
            whatsappButton.addEventListener('click', () => {
                window.open(`https://wa.me/${formattedPhone}`, '_blank');
            });
        }
    } else {
        console.error("La tienda no existe.");
    }
}

// Función para formatear el número de teléfono
function formatPhoneNumber(phone) {
    // Eliminar espacios, guiones y otros caracteres no numéricos
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Si el número no comienza con +593 (código de Ecuador), asumimos que es un número local
    if (!cleanPhone.startsWith('593')) {
        // Si comienza con 0, quitarlo y agregar +593
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '593' + cleanPhone.slice(1);
        } else {
            cleanPhone = '593' + cleanPhone;
        }
    }
    return cleanPhone;
}

// Función para cargar los productos
async function loadProducts() {
    if (!storeId) {
        console.error("No se proporcionó un storeId en la URL.");
        return;
    }

    const productsContainer = document.createElement('div');
    productsContainer.classList.add('grid');
    document.querySelector('main').appendChild(productsContainer);

    const productsSnapshot = await getDocs(collection(db, `stores/${storeId}/products`));
    productsSnapshot.forEach(productDoc => {
        const product = productDoc.data();
        const productElement = document.createElement('div');
        productElement.classList.add('product');
        productElement.innerHTML = `
            <div class="product-image-container">
                <img src="${product.imageUrl}" alt="${product.name}" class="product-image" data-product-id="${productDoc.id}">
            </div>
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <p><strong>Precio:</strong> $${product.price}</p>
            <button class="add-to-cart" data-product-id="${productDoc.id}">Añadir al carrito</button>
        `;
        productsContainer.appendChild(productElement);
    });

    // Agregar eventos a las imágenes de los productos
    const productImages = document.querySelectorAll('.product-image');
    productImages.forEach(image => {
        image.addEventListener('click', (event) => {
            const productId = event.target.getAttribute('data-product-id');
            showProductDetails(productId);
        });
    });

    // Agregar eventos a los botones de "Añadir al carrito"
    const addToCartButtons = document.querySelectorAll('.add-to-cart');
    addToCartButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.getAttribute('data-product-id');
            addToCart(productId);
        });
    });
}

// Función para mostrar los detalles del producto en la sidebar
async function showProductDetails(productId) {
    const productDoc = await getDoc(doc(db, `stores/${storeId}/products`, productId));
    if (productDoc.exists()) {
        const product = productDoc.data();
        const sidebar = document.getElementById('product-sidebar');
        const productDetails = document.getElementById('product-details');

        // Agregar contenido a la sidebar
        productDetails.innerHTML = `
            <button id="view-cart" class="view-cart-btn" title="Ver Carrito">
                <i class="bi bi-cart"></i>
            </button>
            <img src="${product.imageUrl}" alt="${product.name}" style="width: 100%; height: auto; border-radius: 8px;">
            <h2>${product.name}</h2>
            <p>${product.description}</p>
            <p><strong>Precio:</strong> $${product.price}</p>
            <button class="add-to-cart-sidebar" data-product-id="${productId}">Añadir al carrito</button>
        `;

        // Agregar evento al botón de "Añadir al carrito" en la sidebar
        const addToCartSidebarButton = document.querySelector('.add-to-cart-sidebar');
        addToCartSidebarButton.addEventListener('click', () => {
            addToCart(productId);
        });

        // Agregar evento al botón "Ver Carrito"
        const viewCartButton = document.getElementById('view-cart');
        viewCartButton.addEventListener('click', () => {
            showCart();
        });

        // Mostrar la sidebar
        sidebar.classList.remove('hidden');
        sidebar.classList.add('visible');
    } else {
        console.error("El producto no existe.");
    }
}

// Cerrar la sidebar
document.getElementById('close-sidebar').addEventListener('click', () => {
    const sidebar = document.getElementById('product-sidebar');
    sidebar.classList.remove('visible');
    sidebar.classList.add('hidden'); // Agregar esta línea
});

// Función para manejar la acción de añadir al carrito
function addToCart(productId) {
    if (!storeId) {
        console.error("No se proporcionó un storeId en la URL.");
        return;
    }

    const cartKey = `cart_${storeId}`;
    const cart = JSON.parse(localStorage.getItem(cartKey)) || [];

    const productExists = cart.some(item => item.productId === productId);
    if (!productExists) {
        cart.push({ productId, quantity: 1 });
    } else {
        cart.forEach(item => {
            if (item.productId === productId) {
                item.quantity += 1;
            }
        });
    }

    localStorage.setItem(cartKey, JSON.stringify(cart));
    console.log(`Producto añadido al carrito de la tienda ${storeId}:`, productId);
}

// Función para mostrar el carrito
async function showCart() {
    if (!storeId) {
        console.error("No se proporcionó un storeId en la URL.");
        return;
    }

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
            if (productDoc.exists()) {
                const product = productDoc.data();
                const subtotal = product.price * item.quantity;
                totalGeneral += subtotal;

                const cartItem = document.createElement('div');
                cartItem.classList.add('cart-item');
                cartItem.innerHTML = `
                    <div class="cart-item-image">
                        <img src="${product.imageUrl}" alt="${product.name}">
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

        // Mostrar el total general
        const totalElement = document.createElement('div');
        totalElement.classList.add('cart-total');
        totalElement.innerHTML = `
            <p><strong>Total General:</strong> $${totalGeneral.toFixed(2)}</p>
        `;
        cartDetails.appendChild(totalElement);

        // Botón de checkout
        const checkoutButton = document.createElement('button');
        checkoutButton.textContent = 'Checkout';
        checkoutButton.classList.add('checkout-btn');
        checkoutButton.addEventListener('click', checkout);
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

// Función para incrementar la cantidad de un producto en el carrito
function incrementQuantity(productId) {
    const cartKey = `cart_${storeId}`;
    let cart = JSON.parse(localStorage.getItem(cartKey)) || [];

    cart = cart.map(item => {
        if (item.productId === productId) {
            item.quantity += 1;
        }
        return item;
    });

    // Guardar el carrito actualizado
    localStorage.setItem(cartKey, JSON.stringify(cart));

    // Actualizar la vista del carrito
    showCart();
}

// Función para eliminar un producto del carrito
function removeFromCart(productId) {
    const cartKey = `cart_${storeId}`;
    let cart = JSON.parse(localStorage.getItem(cartKey)) || [];

    // Filtrar el producto a eliminar
    cart = cart.filter(item => item.productId !== productId);

    // Guardar el carrito actualizado
    localStorage.setItem(cartKey, JSON.stringify(cart));

    // Actualizar la vista del carrito
    showCart();
}

// Cerrar la sidebar del carrito
document.getElementById('close-cart-sidebar').addEventListener('click', () => {
    const cartSidebar = document.getElementById('cart-sidebar');
    cartSidebar.classList.remove('visible');
    cartSidebar.classList.add('hidden');
});

// Función para manejar el checkout
function checkout() {
    if (!storeId) {
        console.error("No se proporcionó un storeId en la URL.");
        return;
    }

    const cartKey = `cart_${storeId}`;
    const cart = JSON.parse(localStorage.getItem(cartKey)) || [];

    if (cart.length === 0) {
        alert('El carrito está vacío. Agrega productos antes de proceder al checkout.');
        return;
    }

    console.log('Procesando checkout para la tienda:', storeId);
    console.log('Carrito:', cart);
    window.location.href = `/checkout.html?storeId=${storeId}`;
}

// Configurar el botón de carrito en store-actions
document.getElementById('cart-button').addEventListener('click', () => {
    showCart();
});

// Cargar los datos de la tienda y sus productos
loadStore();
loadProducts();