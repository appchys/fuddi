import { getFirestore, collection, query, where, onSnapshot, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, auth } from '../js/firebase-config.js';

// Variable para almacenar el listener de Firestore
let unsubscribeSnapshot = null;
let authInitialized = false;

// Función para obtener los datos de la tienda por storeId
const getStoreData = async (storeId) => {
    try {
        const db = getFirestore(app);
        const storeDoc = await getDoc(doc(db, 'stores', storeId));
        if (storeDoc.exists()) {
            return storeDoc.data();
        } else {
            return null;
        }
    } catch (error) {
        return null;
    }
};

// Función para obtener el nombre de la tienda por ID
const getStoreName = (storeId) => {
    const storeNames = {
        'tasty': 'Tasty',
        'chilis': 'Chili\'s',
        'burguer': 'Burger House',
        'pizza': 'Pizza Place',
    };
    return storeNames[storeId] || storeId || 'Tienda desconocida';
};

// Función para obtener el badge de estado
const getStatusBadge = (status) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
        case 'pendiente':
            return { class: 'bg-warning text-dark', text: 'Pendiente' };
        case 'en preparación':
            return { class: 'bg-info text-white', text: 'En preparación' };
        case 'en camino':
            return { class: 'bg-primary text-white', text: 'En camino' };
        case 'entregado':
            return { class: 'bg-success text-white', text: 'Entregado' };
        case 'cancelado':
            return { class: 'bg-danger text-white', text: 'Cancelado' };
        default:
            return { class: 'bg-secondary text-white', text: status };
    }
};

// Función para calcular el progreso basado en el estado del pedido
const getProgress = (status) => {
    switch (status.toLowerCase()) {
        case 'pendiente':
            return 25;
        case 'en preparación':
            return 50;
        case 'en camino':
            return 75;
        case 'entregado':
            return 100;
        default:
            return 0;
    }
};

// Función para configurar el listener de autenticación y pedidos
const setupAuthListener = (activeOrdersSpan) => {
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
    }

    auth.onAuthStateChanged((user) => {
        authInitialized = true;
        if (user) {
            const db = getFirestore(app);
            const ordersRef = collection(db, 'orders');
            const q = query(ordersRef, where('userId', '==', user.uid));
            const estadosActivos = ['pendiente', 'en preparación', 'en camino'];

            unsubscribeSnapshot = onSnapshot(q, async (querySnapshot) => {
                let activeOrders = [];
                for (const doc of querySnapshot.docs) {
                    const order = doc.data();
                    const status = (order.status || '').toLowerCase().trim();
                    if (estadosActivos.includes(status)) {
                        const storeData = await getStoreData(order.storeId);
                        const storeImage = storeData?.imageUrl || 'https://via.placeholder.com/50';
                        const storeName = storeData?.name || getStoreName(order.storeId);

                        activeOrders.push({
                            id: doc.id,
                            status: order.status || 'Desconocido',
                            storeId: order.storeId || '',
                            storeName: storeName,
                            total: order.total || 0,
                            createdAt: order.createdAt || new Date().toISOString(),
                            customerName: order.customerName || 'Cliente',
                            storeImage: storeImage
                        });
                    }
                }

                let ordersHtml = '';
                if (activeOrders.length > 0) {
                    activeOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    ordersHtml = `<ul class="dropdown-menu dropdown-menu-end" style="min-width: 320px; max-height: 80vh; overflow-y: auto;">`;

                    activeOrders.forEach((order, index) => {
                        const statusBadge = getStatusBadge(order.status);
                        const orderTime = new Date(order.createdAt).toLocaleString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit'
                        });
                        const progress = getProgress(order.status);
                        const progressClass = order.status.toLowerCase().replace(' ', '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                        ordersHtml += `
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
    </li>`;
                        if (index < activeOrders.length - 1) {
                            ordersHtml += `<li><hr class="dropdown-divider my-1"></li>`;
                        }
                    });

                    ordersHtml += `
                        <li><hr class="dropdown-divider"></li>
                        <li>
        <a class="dropdown-item text-primary" href="my-orders.html">
            <i class="bi bi-list-ul"></i> Ver todos los pedidos
        </a>
    </li>
</ul>`;
                } else {
                    ordersHtml = '<span class="text-muted"><i class="bi bi-bag"></i> No hay pedidos activos</span>';
                }

                activeOrdersSpan.innerHTML = ordersHtml;

                // Activar el dropdown de Bootstrap
                if (activeOrders.length > 0) {
                    activeOrdersSpan.classList.add('dropdown');
                    activeOrdersSpan.innerHTML = `
                        <span class="dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="bi bi-bag-check"></i> ${activeOrders.length} pedido${activeOrders.length === 1 ? '' : 's'} activo${activeOrders.length === 1 ? '' : 's'}
                        </span>
                        ${ordersHtml}
                    `;
                }
            }, (error) => {
                activeOrdersSpan.innerHTML = '<span class="text-danger"><i class="bi bi-exclamation-triangle"></i> Error al cargar pedidos</span>';
            });
        } else {
            activeOrdersSpan.innerHTML = '<span class="text-muted"><i class="bi bi-person"></i> Inicia sesión para ver pedidos</span>';
        }
    }, (error) => {
        activeOrdersSpan.innerHTML = '<span class="text-danger"><i class="bi bi-exclamation-triangle"></i> Error en autenticación</span>';
        authInitialized = true;
    });
};

// Función para inicializar la navbar
const initializeNavbar = () => {
    const activeOrdersSpan = document.getElementById('navbar-active-orders');
    if (!activeOrdersSpan) {
        return false;
    }

    setupAuthListener(activeOrdersSpan);
    return true;
};

// Intentar inicializar repetidamente hasta que el DOM y Auth estén listos
const maxAttempts = 10;
let attempts = 0;
const initInterval = setInterval(() => {
    attempts++;
    if (initializeNavbar() || authInitialized || attempts >= maxAttempts) {
        clearInterval(initInterval);
        if (attempts >= maxAttempts) {
            const span = document.getElementById('navbar-active-orders');
            if (span) span.innerHTML = '<span class="text-danger"><i class="bi bi-exclamation-triangle"></i> Error al cargar pedidos</span>';
        }
    }
}, 500);

// Manejar navegación en SPA o páginas
window.addEventListener('popstate', () => {
    initializeNavbar();
});

window.addEventListener('hashchange', () => {
    initializeNavbar();
});

// Limpiar listener al salir de la página
window.addEventListener('beforeunload', () => {
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
    }
});