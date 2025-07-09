import { getFirestore, collection, query, where, onSnapshot, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, auth } from '../js/firebase-config.js';

// Estado global
let unsubscribeSnapshot = null;
let authInitialized = false;

// Obtiene datos de la tienda por ID
const fetchStoreData = async (storeId) => {
    try {
        const db = getFirestore(app);
        const storeDoc = await getDoc(doc(db, 'stores', storeId));
        return storeDoc.exists() ? storeDoc.data() : null;
    } catch (error) {
        console.error('Error fetching store data:', error);
        return null;
    }
};

// Mapea el ID de la tienda a su nombre
const mapStoreName = (storeId) => {
    const storeNames = {
        tasty: 'Tasty',
        chilis: "Chili's",
        burguer: 'Burger House',
        pizza: 'Pizza Place',
    };
    return storeNames[storeId] || storeId || 'Tienda desconocida';
};

// Genera el badge de estado según el estado del pedido
const getStatusBadge = (status) => {
    const statusLower = status.toLowerCase();
    const badgeMap = {
        pendiente: { class: 'bg-warning text-dark', text: 'Pendiente' },
        'en preparación': { class: 'bg-info text-white', text: 'En preparación' },
        'en camino': { class: 'bg-primary text-white', text: 'En camino' },
        entregado: { class: 'bg-success text-white', text: 'Entregado' },
        cancelado: { class: 'bg-danger text-white', text: 'Cancelado' },
    };
    return badgeMap[statusLower] || { class: 'bg-secondary text-white', text: status };
};

// Calcula el porcentaje de progreso del pedido
const calculateProgress = (status) => {
    const progressMap = {
        pendiente: 25,
        'en preparación': 50,
        'en camino': 75,
        entregado: 100,
    };
    return progressMap[status.toLowerCase()] || 0;
};

// Genera el HTML para un pedido individual
const generateOrderHtml = (order, index, totalOrders) => {
    const statusBadge = getStatusBadge(order.status);
    const orderTime = new Date(order.createdAt).toLocaleString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
    });
    const progress = calculateProgress(order.status);
    const progressClass = order.status.toLowerCase().replace(' ', '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return `
        <li class="dropdown-item-text order-card">
            <img src="${order.storeImage}" alt="${order.storeName}" class="navbar-store-profile-img">
            <div class="order-details">
                <div class="fw-bold text-dark">${order.storeName}</div>
                <small class="text-muted">Total: $${order.total.toFixed(2)}</small>
                <small class="text-muted">Hora: ${orderTime}</small>
                <div class="order-status text-center mt-2">
                    <span class="badge ${statusBadge.class}">${statusBadge.text}</span>
                </div>
                <div class="order-progress-bar">
                    <div class="order-progress-fill ${progressClass}" style="width: ${progress}%;"></div>
                </div>
            </div>
        </li>
        ${index < totalOrders - 1 ? '<li><hr class="dropdown-divider my-1"></li>' : ''}
    `;
};

// Genera el HTML para el dropdown de pedidos
const generateOrdersDropdown = (activeOrders) => {
    if (!activeOrders.length) {
        return '<span class="text-muted"><i class="bi bi-bag"></i> No hay pedidos activos</span>';
    }

    let ordersHtml = `<ul class="dropdown-menu dropdown-menu-end" style="min-width: 320px; max-height: 80vh; overflow-y: auto;">`;
    activeOrders.forEach((order, index) => {
        ordersHtml += generateOrderHtml(order, index, activeOrders.length);
    });
    ordersHtml += `</ul>`;
    return ordersHtml;
};

// Función para actualizar la imagen de perfil de la tienda
const updateStoreProfileImage = (activeOrders) => {
    const storeProfileImg = document.getElementById('store-profile-img');
    if (!storeProfileImg) return;

    // Obtén la primera tienda con pedidos activos
    if (activeOrders.length > 0) {
        const firstOrder = activeOrders[0];
        storeProfileImg.src = firstOrder.storeImage || 'https://via.placeholder.com/40';
        storeProfileImg.alt = firstOrder.storeName || 'Tienda';
        storeProfileImg.title = firstOrder.storeName || 'Tienda';
    } else {
        // Imagen predeterminada si no hay pedidos activos
        storeProfileImg.src = 'https://via.placeholder.com/40';
        storeProfileImg.alt = 'Sin pedidos activos';
        storeProfileImg.title = 'Sin pedidos activos';
    }
};

// Función para actualizar las imágenes de las tiendas con pedidos activos
const updateActiveStoreImages = (activeOrders) => {
    const activeStoreImagesContainer = document.getElementById('active-store-images');
    if (!activeStoreImagesContainer) return;

    // Limpia el contenedor antes de agregar nuevas imágenes
    activeStoreImagesContainer.innerHTML = '';

    // Agrega una imagen por cada tienda con pedidos activos
    const storeImages = new Set(); // Usamos un Set para evitar duplicados
    activeOrders.forEach((order) => {
        if (order.storeImage && !storeImages.has(order.storeImage)) {
            storeImages.add(order.storeImage);
            const imgElement = document.createElement('img');
            imgElement.src = order.storeImage;
            imgElement.alt = order.storeName;
            imgElement.title = order.storeName; // Muestra el nombre de la tienda al pasar el mouse
            imgElement.classList.add('store-image'); // Clase para estilos adicionales

            // Agrega un evento onclick para mostrar el contenedor de pedidos activos
            imgElement.addEventListener('click', () => showActiveOrder(order));

            activeStoreImagesContainer.appendChild(imgElement);
        }
    });
};

// Función para mostrar/ocultar el contenedor de pedidos activos con los datos del pedido
const showActiveOrder = (order) => {
    const activeOrdersContainer = document.getElementById('navbar-active-orders');
    if (!activeOrdersContainer) return;

    // Si el contenedor ya está visible y muestra el mismo pedido, ocúltalo
    if (activeOrdersContainer.classList.contains('show') && activeOrdersContainer.dataset.orderId === order.id) {
        activeOrdersContainer.classList.remove('show');
        activeOrdersContainer.style.display = 'none';
        return;
    }

    // Genera el contenido del pedido
    const orderTime = new Date(order.createdAt).toLocaleString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
    });
    const statusBadge = getStatusBadge(order.status);
    const progress = calculateProgress(order.status);
    const progressClass = order.status.toLowerCase().replace(' ', '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    activeOrdersContainer.innerHTML = `
        <div class="order-card">
            <h3>${order.storeName}</h3>
            <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
            <p><strong>Hora:</strong> ${orderTime}</p>
            <div class="order-status text-center mt-2">
                <span class="badge ${statusBadge.class}">${statusBadge.text}</span>
            </div>
            <div class="order-progress-bar">
                <div class="order-progress-fill ${progressClass}" style="width: ${progress}%;"></div>
            </div>
        </div>
    `;

    // Muestra el contenedor y guarda el ID del pedido actual
    activeOrdersContainer.dataset.orderId = order.id;
    activeOrdersContainer.classList.add('show');
    activeOrdersContainer.style.display = 'block';
};

// Función para actualizar la tarjeta del pedido
const updateOrderCard = (order) => {
    const orderCard = document.querySelector('.order-card'); // Selecciona la tarjeta del pedido existente
    if (!orderCard) return;

    // Actualiza el contenido de la tarjeta con los datos del pedido
    const orderTime = new Date(order.createdAt).toLocaleString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
    });
    const statusBadge = getStatusBadge(order.status);
    const progress = calculateProgress(order.status);
    const progressClass = order.status.toLowerCase().replace(' ', '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    orderCard.innerHTML = `
        <img src="${order.storeImage}" alt="${order.storeName}" class="navbar-store-profile-img">
        <div class="order-details">
            <div class="fw-bold text-dark">${order.storeName}</div>
            <small class="text-muted">Total: $${order.total.toFixed(2)}</small>
            <small class="text-muted">Hora: ${orderTime}</small>
            <div class="order-status text-center mt-2">
                <span class="badge ${statusBadge.class}">${statusBadge.text}</span>
            </div>
            <div class="order-progress-bar">
                <div class="order-progress-fill ${progressClass}" style="width: ${progress}%;"></div>
            </div>
        </div>
    `;
};

// Configura el listener de autenticación y pedidos
const setupAuthListener = (activeOrdersSpan) => {
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
    }

    auth.onAuthStateChanged(async (user) => {
        authInitialized = true;
        if (!user) {
            activeOrdersSpan.innerHTML = '<span class="text-muted"><i class="bi bi-person"></i> Inicia sesión para ver pedidos</span>';
            return;
        }

        const db = getFirestore(app);
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('userId', '==', user.uid));
        const activeStatuses = ['pendiente', 'en preparación', 'en camino'];

        unsubscribeSnapshot = onSnapshot(q, async (querySnapshot) => {
            const activeOrders = [];
            for (const doc of querySnapshot.docs) {
                const order = doc.data();
                const status = (order.status || '').toLowerCase().trim();
                if (activeStatuses.includes(status)) {
                    const storeData = await fetchStoreData(order.storeId);
                    activeOrders.push({
                        id: doc.id,
                        status: order.status || 'Desconocido',
                        storeId: order.storeId || '',
                        storeName: storeData?.name || mapStoreName(order.storeId),
                        total: order.total || 0,
                        createdAt: order.createdAt || new Date().toISOString(),
                        customerName: order.customerName || 'Cliente',
                        storeImage: storeData?.imageUrl || 'https://via.placeholder.com/40',
                    });
                }
            }

            activeOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const ordersHtml = generateOrdersDropdown(activeOrders);
            activeOrdersSpan.innerHTML = ordersHtml;

            if (activeOrders.length > 0) {
                activeOrdersSpan.classList.add('dropdown');
                activeOrdersSpan.innerHTML = ordersHtml;
            }

            // Actualiza las imágenes de las tiendas con pedidos activos
            updateActiveStoreImages(activeOrders);
        }, (error) => {
            console.error('Error in orders snapshot:', error);
            activeOrdersSpan.innerHTML = '<span class="text-danger"><i class="bi bi-exclamation-triangle"></i> Error al cargar pedidos</span>';
        });
    }, (error) => {
        console.error('Error in auth state change:', error);
        activeOrdersSpan.innerHTML = '<span class="text-danger"><i class="bi bi-exclamation-triangle"></i> Error en autenticación</span>';
        authInitialized = true;
    });
};

// Inicializa la barra de navegación
const initializeNavbar = () => {
    const activeOrdersSpan = document.getElementById('navbar-active-orders');
    if (!activeOrdersSpan) {
        console.warn('Navbar active orders span not found');
        return false;
    }
    setupAuthListener(activeOrdersSpan);
    return true;
};

// Intenta inicializar la navbar hasta que el DOM y auth estén listos
const initializeWithRetry = () => {
    const maxAttempts = 10;
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if (initializeNavbar() || authInitialized || attempts >= maxAttempts) {
            clearInterval(interval);
            if (attempts >= maxAttempts) {
                console.error('Error: No se pudo inicializar la barra de navegación.');
            }
        }
    }, 500);
};

// Maneja eventos de navegación
const handleNavigation = () => {
    initializeNavbar();
};

// Limpia listeners al salir de la página
const cleanupListeners = () => {
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
    }
};

// Función para alternar la visibilidad de los detalles del pedido
const toggleOrderDetails = (imageElement) => {
    const details = imageElement.nextElementSibling;
    if (details.style.display === 'none' || details.style.display === '') {
        details.style.display = 'block';
    } else {
        details.style.display = 'none';
    }
};

// Inicialización y eventos
initializeWithRetry();
window.addEventListener('popstate', handleNavigation);
window.addEventListener('hashchange', handleNavigation);
window.addEventListener('beforeunload', cleanupListeners);

// Exportar la función para uso externo
window.toggleOrderDetails = toggleOrderDetails;