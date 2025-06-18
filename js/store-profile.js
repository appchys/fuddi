import { app, auth, googleProvider, signInWithPopup } from './firebase-config.js';
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Initialize Firestore
const db = getFirestore(app);

// Obtener el storeId de la ruta amigable
const pathParts = window.location.pathname.split('/').filter(Boolean);
const storeId = pathParts[0]; // 'munchys' en /munchys

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

// Función para cargar los productos en formato lista
async function loadProducts() {
    if (!storeId) {
        console.error("No se proporcionó un storeId en la URL.");
        return;
    }

    // Elimina cualquier contenedor previo
    const prevContainer = document.getElementById('products-container');
    if (prevContainer) prevContainer.remove();

    // Crear el contenedor principal de productos
    const productsContainer = document.createElement('div');
    productsContainer.classList.add('grid');
    productsContainer.id = 'products-container';
    document.querySelector('main').appendChild(productsContainer);

    try {
        const productsSnapshot = await getDocs(collection(db, `stores/${storeId}/products`));
        let products = productsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Filtrar productos ocultos
        products = products.filter(product => !product.hidden);

        // Ordenar por 'order' si existe, si no por nombre
        products.sort((a, b) => {
            if (typeof a.order === 'number' && typeof b.order === 'number') {
                return a.order - b.order;
            }
            return a.name.localeCompare(b.name);
        });

        // Agrupar productos por colección
        const productsByCollection = {};
        products.forEach(product => {
            let collectionNames = [];
            if (Array.isArray(product.collection)) {
                collectionNames = product.collection;
            } else if (typeof product.collection === 'string') {
                collectionNames = [product.collection];
            } else {
                collectionNames = ['Sin colección'];
            }
            collectionNames.forEach(col => {
                if (!productsByCollection[col]) productsByCollection[col] = [];
                productsByCollection[col].push(product);
            });
        });

        // === NUEVO: Obtener y aplicar el orden de colecciones ===
        let collectionsOrder = [];
        const storeDocSnap = await getDoc(doc(db, 'stores', storeId));
        if (storeDocSnap.exists() && storeDocSnap.data().collectionsOrder) {
            collectionsOrder = storeDocSnap.data().collectionsOrder;
        }

        // ...después de obtener productsByCollection y collectionsOrder...
        const allCollectionNames = Object.keys(productsByCollection);
        collectionsOrder = collectionsOrder.filter(col => allCollectionNames.includes(col));
        allCollectionNames.forEach(col => {
            if (!collectionsOrder.includes(col)) collectionsOrder.push(col);
        });

        // Ahora sí, ordena
        let sortedCollections = Object.entries(productsByCollection);
        sortedCollections.sort(([a], [b]) => {
            const idxA = collectionsOrder.indexOf(a);
            const idxB = collectionsOrder.indexOf(b);
            if (idxA === -1 && idxB === -1) return a.localeCompare(b);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
        // === FIN NUEVO ===

        // Renderizar cada colección
        sortedCollections.forEach(([collectionName, products]) => {
            // Ordena los productos por el campo 'order' antes de renderizar
            products.sort((a, b) => {
                if (typeof a.order === 'number' && typeof b.order === 'number') {
                    return a.order - b.order;
                }
                return a.name.localeCompare(b.name);
            });

            // Título de la colección
            const collectionTitle = document.createElement('h2');
            collectionTitle.classList.add('collection-title');
            collectionTitle.textContent = collectionName;
            productsContainer.appendChild(collectionTitle);

            // Renderizar productos como lista
            products.forEach(product => {
                const productElement = document.createElement('div');
                productElement.classList.add('product');
                productElement.setAttribute('data-product-id', product.id);

                productElement.innerHTML = `
                    <div class="product-image-container">
                        ${product.imageUrl ? `
                            <img src="${product.imageUrl}" alt="${product.name}" class="product-image">
                        ` : `
                            <div class="placeholder-image">
                                <span>${product.name.charAt(0).toUpperCase()}</span>
                            </div>
                        `}
                    </div>
                    <div class="product-info">
                        <h3>${product.name}</h3>
                        <p class="description">${product.description || ''}</p>
                        <p class="price">$${product.price ? product.price.toFixed(2) : '0.00'}</p>
                    </div>
                    <div class="product-actions">
                        <div class="add-to-cart-container">
                            <button class="add-to-cart-btn" title="Añadir al carrito" onclick="window.addToCart('${product.id}')">
                                <i class="bi bi-cart-plus"></i>
                            </button>
                        </div>
                    </div>
                `;

                // Mostrar detalles al hacer click en el producto (excepto en el botón)
                productElement.addEventListener('click', (e) => {
                    if (!e.target.closest('.add-to-cart-btn')) {
                        showProductDetails(product.id);
                    }
                });

                productsContainer.appendChild(productElement);
            });
        });

    } catch (error) {
        console.error('Error al cargar los productos:', error);
        productsContainer.innerHTML = '<p class="error-message">Error al cargar los productos. Por favor, inténtalo de nuevo.</p>';
    }
}

// Función para mostrar los detalles del producto en la sidebar
async function showProductDetails(productId) {
    const productDoc = await getDoc(doc(db, `stores/${storeId}/products`, productId));
    if (productDoc.exists()) {
        const product = productDoc.data();
        const sidebar = document.getElementById('product-sidebar');
        const productDetails = document.getElementById('product-details');

        // Agregar contenido a la sidebar (sin el botón de carrito arriba)
        productDetails.innerHTML = `
            <img src="${product.imageUrl}" alt="${product.name}" style="width: 70%; max-width:180px; height: auto; border-radius: 8px; display:block; margin: 0 auto 12px auto;">
            <h2>${product.name}</h2>
            <p>${product.description}</p>
            <p><strong>Precio:</strong> $${product.price}</p>
            <button class="add-to-cart-sidebar" data-product-id="${productId}">Añadir al carrito</button>
            <div style="margin-top:10px; text-align:center;">
                <a href="product.html?storeId=${storeId}&productId=${productId}" style="color:#2563eb;font-size:0.98em;text-decoration:underline;opacity:0.85;">
                    Ver más detalles
                </a>
            </div>
        `;

        // Agregar evento al botón de "Añadir al carrito" en la sidebar
        const addToCartSidebarButton = document.querySelector('.add-to-cart-sidebar');
        addToCartSidebarButton.addEventListener('click', () => {
            window.addToCart(productId);
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
    sidebar.classList.add('hidden');
});

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

// Cerrar la sidebar del carrito
document.getElementById('close-cart-sidebar').addEventListener('click', () => {
    const cartSidebar = document.getElementById('cart-sidebar');
    cartSidebar.classList.remove('visible');
    cartSidebar.classList.add('hidden');
});

// Cerrar la sidebar del carrito al dar clic fuera de ella
document.addEventListener('mousedown', (event) => {
    const cartSidebar = document.getElementById('cart-sidebar');
    if (
        cartSidebar.classList.contains('visible') &&
        !cartSidebar.contains(event.target) &&
        event.target.id !== 'cart-button'
    ) {
        cartSidebar.classList.remove('visible');
        cartSidebar.classList.add('hidden');
    }
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

// Función para añadir al carrito
window.addToCart = async (productId) => {
    try {
        const productRef = doc(db, `stores/${storeId}/products`, productId);
        const productDoc = await getDoc(productRef);
        if (!productDoc.exists()) {
            console.error('Producto no encontrado:', productId);
            alert('Producto no encontrado');
            return;
        }

        const product = productDoc.data();
        const cartKey = `cart_${storeId}`;
        const cart = JSON.parse(localStorage.getItem(cartKey)) || [];

        // Si el producto ya está en el carrito, incrementar la cantidad
        if (cart.some(item => item.productId === productId)) {
            cart.forEach(item => {
                if (item.productId === productId) {
                    item.quantity += 1;
                }
            });
        } else {
            cart.push({
                productId,
                quantity: 1,
                name: product.name || 'Producto desconocido',
                price: product.price || 0
            });
        }

        // Guardar el carrito actualizado
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

        // Animación de entrada
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';

        // Eliminar después de 2 segundos
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-100px)';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 2000);

        // Actualizar el contador del carrito
        updateCartCount();

        // Mostrar el carrito
        showCart();
    } catch (error) {
        console.error('Error al añadir al carrito:', error);
        alert('Error al añadir al carrito. Por favor, inténtalo de nuevo.');
    }
};

// Función para actualizar el contador del carrito
const updateCartCount = () => {
    const cartKey = `cart_${storeId}`;
    const cart = JSON.parse(localStorage.getItem(cartKey)) || [];
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.textContent = totalItems > 0 ? totalItems : '';
    }
};

const followBtn = document.getElementById('follow-store');

function updateFollowButton(isFollowing) {
    if (!followBtn) return;
    if (isFollowing) {
        followBtn.innerHTML = `<i class="bi bi-person-check"></i> Siguiendo`;
        followBtn.classList.add("following");
    } else {
        followBtn.innerHTML = `<i class="bi bi-person-plus"></i> Seguir`;
        followBtn.classList.remove("following");
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!followBtn) return;
    if (!user) {
        followBtn.onclick = () => alert("Inicia sesión para seguir tiendas.");
        updateFollowButton(false);
        return;
    }
    const followerRef = doc(db, `stores/${storeId}/followers`, user.uid);
    const docSnap = await getDoc(followerRef);
    updateFollowButton(docSnap.exists());

    followBtn.onclick = async () => {
        const isFollowing = (await getDoc(followerRef)).exists();
        if (isFollowing) {
            await deleteDoc(followerRef);
            await deleteDoc(doc(db, `stores/${storeId}/followers/${user.uid}`));
            await deleteDoc(doc(db, `users/${user.uid}/follows/${storeId}`));
            updateFollowButton(false);
        } else {
            await setDoc(followerRef, {
                uid: user.uid,
                followedAt: new Date().toISOString()
            });
            await setDoc(doc(db, `users/${user.uid}/follows/${storeId}`), {
                storeId,
                followedAt: new Date().toISOString()
            });
            updateFollowButton(true);
        }
    };
});

// ...después de cargar storeData y onAuthStateChanged...
onAuthStateChanged(auth, async (user) => {
    const visitorActions = document.getElementById('visitor-actions');
    const ownerActions = document.getElementById('owner-actions');
    if (!storeId) return;
    const storeDoc = await getDoc(doc(db, "stores", storeId));
    if (!storeDoc.exists()) return;
    const store = storeDoc.data();

    if (user && store.owner === user.uid) {
        // Es el dueño
        if (ownerActions) ownerActions.style.display = "flex";
        if (visitorActions) visitorActions.style.display = "none";
    } else {
        // Es visitante
        if (ownerActions) ownerActions.style.display = "none";
        if (visitorActions) visitorActions.style.display = "flex";
    }
});

// Cargar los datos de la tienda y sus productos
loadStore();
loadProducts();
