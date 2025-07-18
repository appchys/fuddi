import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc as docRef, 
    updateDoc, 
    deleteDoc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, auth } from './firebase-config.js';
import { GOOGLE_MAPS_API_KEY } from './config.js';

// Inicializa Firestore
const db = getFirestore(app);

// Función para manejar el cambio de estado del pedido
window.handleOrderStatus = async (orderId, currentStatus, nextStatus) => {
    try {
        const orderRef = docRef(db, 'orders', orderId);
        await updateDoc(orderRef, {
            status: nextStatus,
            updatedAt: new Date().toISOString()
        });

        // Actualizar solo la tarjeta del pedido afectado
        const orderCard = document.querySelector(`[data-order-id="${orderId}"]`);
        if (orderCard) {
            // Obtener datos actualizados del pedido
            const orderDoc = await getDoc(orderRef);
            const order = orderDoc.data();
            const userRef = docRef(db, 'users', order.userId);
            const userDoc = await getDoc(userRef);
            const clientName = userDoc.data()?.name || 'Cliente no especificado';

            // Listado de productos
            const items = Array.isArray(order.products) ? order.products : [];
            const productsList = items.map(item => `<li>${item.quantity} x ${item.name}</li>`).join('');

            // Forma de pago
            const paymentMethod = order.paymentMethod || 'No especificado';

            // Hora de entrega (si existe)
            const horaEntrega = order.scheduledTime ? `<div class="order-hour"><strong>Hora:</strong> ${order.scheduledTime}</div>` : '';

            // Actualizar el contenido de la tarjeta
            orderCard.innerHTML = `
                <div class="order-header">
                    <h3 class="order-title">${clientName}</h3>
                    ${horaEntrega}
                </div>
                <div class="order-products">
                    <ul>${productsList}</ul>
                </div>
                <div class="order-payment">
                    <strong>Forma de pago:</strong> ${paymentMethod}
                </div>
                <div class="order-status" style="margin-top:1.2em; margin-bottom:0.3em; font-weight:bold; background:none; border:none;">
                    ${order.status}
                </div>
                <div class="order-progress-bar-with-btn">
                    <div class="order-progress-bar">
                        <div class="order-progress-fill" style="width: ${getProgress(order.status)}%; background: ${getProgressColor(order.status)};"></div>
                    </div>
                    ${nextStatus !== 'Entregado' ? `
                        <button type="button" class="action-btn order-action-btn" onclick="event.stopPropagation(); handleOrderStatus('${orderId}', '${nextStatus}', '${getNextStatus(nextStatus)}')">
                            ${getActionIcon(nextStatus)}
                        </button>
                    ` : ''}
                </div>
                
            `;

            // Reasignar el evento de clic para abrir el modal
            orderCard.addEventListener('click', () => {
                showOrderDetails({
                    id: orderId,
                    clientName,
                    status: nextStatus,
                    total: typeof order.total === 'number' ? order.total.toFixed(2) : 'No disponible',
                    shippingAddress: order.shippingAddress || {},
                    paymentMethod: order.paymentMethod,
                    products: items,
                    createdAt: order.createdAt,
                    deliveryType: order.deliveryType,
                    scheduledDate: order.scheduledDate,
                    scheduledTime: order.scheduledTime,
                    paymentProofUrl: order.paymentProofUrl
                });
            });
        }
    } catch (error) {
        console.error('Error al actualizar el estado del pedido:', error);
        alert('Error al actualizar el estado del pedido. Por favor, inténtalo de nuevo.');
    }
};

// Función auxiliar para obtener el texto del botón
function getButtonText(status) {
    switch (status) {
        case 'Pendiente': return 'Aceptar';
        case 'En preparación': return 'En camino';
        case 'En camino': return 'Entregado';
        default: return '';
    }
}

// Función auxiliar para obtener el siguiente estado
function getNextStatus(status) {
    switch (status) {
        case 'Pendiente': return 'En preparación';
        case 'En preparación': return 'En camino';
        case 'En camino': return 'Entregado';
        default: return '';
    }
}

// Función auxiliar para obtener el progreso
function getProgress(status) {
    switch (status) {
        case 'Pendiente': return 25;
        case 'En preparación': return 50;
        case 'En camino': return 75;
        case 'Entregado': return 100;
        default: return 0;
    }
}

// Función auxiliar para obtener el color del progreso
function getProgressColor(status) {
    switch (status) {
        case 'Pendiente': return '#e74c3c'; // rojo
        case 'En preparación': return '#f39c12'; // naranja
        case 'En camino': return '#27ae60'; // verde
        case 'Entregado': return '#8e44ad'; // morado
        default: return '#e74c3c';
    }
}

// Función auxiliar para obtener el ícono de acción
function getActionIcon(status) {
    switch (status) {
        case 'Pendiente': return '<i class="bi bi-check-circle"></i>';
        case 'En preparación': return '<i class="bi bi-truck"></i>';
        case 'En camino': return '<i class="bi bi-box-seam"></i>';
        case 'Entregado': return '';
        default: return '';
    }
}

// Función para manejar la eliminación de pedidos
window.handleDeleteOrder = async (orderId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este pedido?')) {
        return;
    }

    try {
        const orderRef = docRef(db, 'orders', orderId);
        await deleteDoc(orderRef);
        // Eliminar solo la tarjeta del pedido del DOM
        const orderCard = document.querySelector(`[data-order-id="${orderId}"]`);
        if (orderCard) {
            orderCard.remove();
        }
        // Verificar si hay pedidos restantes en el grupo
        const groupContainer = document.querySelector(`[data-order-id="${orderId}"]`)?.closest('.container');
        if (groupContainer && !groupContainer.querySelector('.order-card')) {
            const groupTitle = groupContainer.previousElementSibling;
            if (groupTitle && groupTitle.classList.contains('orders-group-title')) {
                groupTitle.remove();
            }
        }
    } catch (error) {
        console.error('Error al eliminar el pedido:', error);
        alert('Error al eliminar el pedido. Por favor, inténtalo de nuevo.');
    }
};

// Función para mostrar los detalles del pedido en el modal
function showOrderDetails(order) {
    const modal = document.getElementById('orderDetailsModal');
    const orderDetails = document.getElementById('orderDetails');
    
    // Crear el contenido del modal
    orderDetails.innerHTML = `
        <h3>${order.clientName}</h3>
        
        <div class="order-section">
            <h4>Estado</h4>
            <p class="status-${order.status}">${order.status}</p>
        </div>
        
        ${order.deliveryType === 'scheduled' ? `
        <div class="order-section">
            <h4>Entrega Programada</h4>
            <p><strong>Programado para:</strong> ${order.scheduledDate} a las ${order.scheduledTime}</p>
        </div>
        ` : ''}

        <div class="order-section">
            <h4>Dirección de Entrega</h4>
            <p>${order.shippingAddress.reference || 'No especificada'}</p>
            ${order.shippingAddress.notes ? `<p><em>Notas: ${order.shippingAddress.notes}</em></p>` : ''}
            ${
                order.shippingAddress && 
                (order.shippingAddress.lat || order.shippingAddress.latitude) && 
                (order.shippingAddress.lng || order.shippingAddress.longitude) ? (() => {
                    const lat = order.shippingAddress.lat ?? order.shippingAddress.latitude;
                    const lng = order.shippingAddress.lng ?? order.shippingAddress.longitude;
                    const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x300&maptype=roadmap&markers=color:red%7C${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
                    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                    return `
                        <div class="map-container">
                            <a href="${mapsUrl}" target="_blank" style="display: block; margin-bottom: 10px;">
                                <img 
                                    src="${mapUrl}" 
                                    alt="Ubicación de entrega"
                                    class="map-image"
                                    onerror="console.error('Error al cargar el mapa:', this.src)"
                                >
                            </a>
                            <a href="${mapsUrl}" target="_blank" style="color: #3366cc; text-decoration: none;">
                                Ver en Google Maps
                            </a>
                        </div>
                    `;
                })() : `
                <div class="no-map">
                    <p>No hay coordenadas de ubicación disponibles</p>
                    ${order.shippingAddress ? `
                        <p>Datos de dirección disponibles:</p>
                        <pre>${JSON.stringify(order.shippingAddress, null, 2)}</pre>
                    ` : '<p>No hay datos de dirección disponibles</p>'}
                </div>
            `}
        </div>
        
        <div class="order-section">
            <h4>Productos</h4>
            <ul class="products-list">
                ${order.products.map(item => `
                    <li>
                        <span>${item.quantity}x ${item.name}</span>
                        <span>$${(item.price * item.quantity).toFixed(2)}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
        
        <div class="order-section">
            <h4>Total</h4>
            <p><strong>$${parseFloat(order.total).toFixed(2)}</strong></p>
        </div>
        
        <div class="order-section">
            <h4>Método de Pago</h4>
            <p>${order.paymentMethod || 'No especificado'}</p>
            
            ${order.paymentProofUrl ? `
                <div class="payment-proof-container">
                    <h4>Comprobante de Pago</h4>
                    <a href="${order.paymentProofUrl}" target="_blank" class="payment-proof-link">
                        <img 
                            src="${order.paymentProofUrl}" 
                            alt="Comprobante de pago"
                            class="payment-proof-image"
                        >
                        <span>Ver comprobante completo</span>
                    </a>
                </div>
            ` : ''}
        </div>

        <div class="order-actions">
            ${order.status !== 'Entregado' ? `
                <button class="action-btn" onclick="handleOrderStatus('${order.id}', '${order.status}', '${getNextStatus(order.status)}'); closeModal();">
                    ${getButtonText(order.status)}
                </button>
            ` : ''}
            <button class="action-btn delete-btn" onclick="handleDeleteOrder('${order.id}'); closeModal();">
                Eliminar Pedido
            </button>
        </div>
    `;
    
    // Mostrar el modal
    modal.style.display = 'block';
    
    // Cerrar el modal al hacer clic en la X
    document.querySelector('.close-modal').onclick = closeModal;
    
    // Cerrar el modal al hacer clic fuera del contenido
    window.onclick = function(event) {
        if (event.target === modal) {
            closeModal();
        }
    };
}

// Función para cerrar el modal
function closeModal() {
    const modal = document.getElementById('orderDetailsModal');
    modal.style.display = 'none';
}
window.closeModal = closeModal;

// Función para cargar y renderizar los pedidos
async function loadOrders() {
    const ordersContainer = document.getElementById('store-orders-container');

    // Obtener storeId del URL
    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('storeId');

    if (!storeId) {
        const storedStoreId = localStorage.getItem('storeId');
        if (storedStoreId) {
            window.location.href = `store-orders.html?storeId=${storedStoreId}`;
            return;
        }
        alert('No se encontró un ID de tienda válido. Por favor, inicia sesión nuevamente.');
        window.location.href = 'index.html';
        return;
    }

    localStorage.setItem('storeId', storeId);
    window.getStoreId = () => storeId;

    ordersContainer.innerHTML = '<p class="text-center text-gray-500">Cargando pedidos...</p>';

    const user = auth.currentUser;
    if (!user) {
        alert('Debes iniciar sesión para ver los pedidos.');
        window.location.href = 'index.html';
        return;
    }

    try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('storeId', '==', storeId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            ordersContainer.innerHTML = '<p class="text-center text-gray-500">No hay pedidos para esta tienda.</p>';
            return;
        }

        ordersContainer.innerHTML = '';

        // Agrupar por fecha de entrega (scheduledDate o fecha de creación)
        const ordersByDay = {};

        for (const doc of querySnapshot.docs) {
            const order = doc.data();
            // Solo incluir pedidos que NO están entregados
            if (order.status === 'Entregado') continue;

            const deliveryDate = order.scheduledDate || (order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : 'Sin fecha');
            if (!ordersByDay[deliveryDate]) ordersByDay[deliveryDate] = [];
            ordersByDay[deliveryDate].push({ doc, order });
        }

        // Ordena los días de entrega DESCENDENTE
        const sortedDays = Object.keys(ordersByDay).sort((a, b) => {
            if (a === 'Sin fecha') return 1;
            if (b === 'Sin fecha') return -1;
            return b.localeCompare(a);
        });

        // Función para formatear la fecha
        function getFechaFormateada(fechaISO) {
            const meses = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ];
            const hoy = new Date();
            const fecha = new Date(fechaISO);

            // Normaliza a solo fecha (sin hora)
            hoy.setHours(0,0,0,0);
            fecha.setHours(0,0,0,0);

            const diffDias = Math.round((fecha - hoy) / (1000 * 60 * 60 * 24));

            if (diffDias === 0) return 'Hoy';
            if (diffDias === -1) return 'Ayer';
            if (diffDias === 1) return 'Mañana';

            // Si no es hoy, ayer o mañana, muestra 8/Julio/2025
            return `${fecha.getDate()}/${meses[fecha.getMonth()]}/${fecha.getFullYear()}`;
        }

        for (const day of sortedDays) {
            let fechaFormateada = '';
            if (day === 'Sin fecha') {
                fechaFormateada = 'Órdenes sin fecha de entrega';
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
                fechaFormateada = getFechaFormateada(day);
            } else {
                fechaFormateada = day;
            }
            // Título del grupo por día
            const groupTitle = document.createElement('h3');
            groupTitle.textContent = fechaFormateada;
            groupTitle.className = 'orders-group-title';
            ordersContainer.appendChild(groupTitle);

            const orders = ordersByDay[day];

            // Ordena por hora de entrega descendente
            orders.sort((a, b) => {
                if (a.order.scheduledTime && b.order.scheduledTime) {
                    return b.order.scheduledTime.localeCompare(a.order.scheduledTime);
                }
                if (a.order.scheduledTime) return -1;
                if (b.order.scheduledTime) return 1;
                return (b.order.createdAt || '').localeCompare(a.order.createdAt || '');
            });

            for (const { doc, order } of orders) {
                // Obtener el nombre del cliente
                const userRef = docRef(db, 'users', order.userId);
                const userDoc = await getDoc(userRef);
                const clientName = userDoc.data()?.name || 'Cliente no especificado';

                // Listado de productos
                const items = Array.isArray(order.products) ? order.products : [];
                const productsList = items.map(item => `<li>${item.quantity} x ${item.name}</li>`).join('');

                // Forma de pago
                const paymentMethod = order.paymentMethod || 'No especificado';

                // Hora de entrega (si existe)
                const horaEntrega = order.scheduledTime ? `<div class="order-hour"><strong>Hora:</strong> ${order.scheduledTime}</div>` : '';

                // Crear la tarjeta del pedido
                const orderCard = document.createElement('div');
                orderCard.className = 'order-card';
                orderCard.setAttribute('data-order-id', doc.id);
                
                // Determina el texto y el siguiente estado
                let showActionBtn = true;
                let nextStatus = '';
                let actionIcon = '';

                switch (order.status) {
                    case 'Pendiente':
                        showActionBtn = true;
                        nextStatus = 'En preparación';
                        actionIcon = '<i class="bi bi-check-circle"></i>';
                        break;
                    case 'En preparación':
                        showActionBtn = true;
                        nextStatus = 'En camino';
                        actionIcon = '<i class="bi bi-truck"></i>';
                        break;
                    case 'En camino':
                        showActionBtn = true;
                        nextStatus = 'Entregado';
                        actionIcon = '<i class="bi bi-box-seam"></i>';
                        break;
                    case 'Entregado':
                        showActionBtn = false;
                        actionIcon = '';
                        break;
                    default:
                        showActionBtn = false;
                        actionIcon = '';
                }

                orderCard.innerHTML = `
                    <div class="order-header">
                        <h3 class="order-title">${clientName}</h3>
                        ${horaEntrega}
                    </div>
                    <div class="order-products">
                        <ul>${productsList}</ul>
                    </div>
                    <div class="order-payment">
                        <strong>Forma de pago:</strong> ${paymentMethod}
                    </div>
                    <div class="order-status" style="margin-top:1.2em; margin-bottom:0.3em; font-weight:bold; background:none; border:none;">
                        ${order.status}
                    </div>
                    <div class="order-progress-bar-with-btn">
                        <div class="order-progress-bar">
                            <div class="order-progress-fill" style="width: ${getProgress(order.status)}%; background: ${getProgressColor(order.status)};"></div>
                        </div>
                        ${showActionBtn ? `
                            <button type="button" class="action-btn order-action-btn" onclick="event.stopPropagation(); handleOrderStatus('${doc.id}', '${order.status}', '${nextStatus}')">
                                ${actionIcon}
                            </button>
                        ` : ''}
                    </div>
                `;

                // Evento para mostrar detalles
                orderCard.addEventListener('click', () => {
                    showOrderDetails({
                        id: doc.id,
                        clientName,
                        status: order.status || 'Pendiente',
                        total: typeof order.total === 'number' ? order.total.toFixed(2) : 'No disponible',
                        shippingAddress: order.shippingAddress || {},
                        paymentMethod: order.paymentMethod,
                        products: items,
                        createdAt: order.createdAt,
                        deliveryType: order.deliveryType,
                        scheduledDate: order.scheduledDate,
                        scheduledTime: order.scheduledTime,
                        paymentProofUrl: order.paymentProofUrl
                    });
                });

                ordersContainer.appendChild(orderCard);
            }
        }

    } catch (error) {
        console.error('Error al cargar los pedidos de la tienda:', error);
        ordersContainer.innerHTML = '<p class="text-center text-red-500">Error al cargar los pedidos. Por favor, inténtalo de nuevo.</p>';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            await loadOrders();
        } else {
            alert('Debes iniciar sesión para ver los pedidos.');
            window.location.href = 'index.html';
        }
    });
});