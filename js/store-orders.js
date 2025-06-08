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
window.handleOrderStatus = async (orderId, currentStatus) => {
    try {
        const orderRef = docRef(db, 'orders', orderId);
        const newStatus = currentStatus === 'Pendiente' ? 'enviado' : 'Pendiente';
        
        await updateDoc(orderRef, {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });

        // Actualizar la vista
        const orderCard = document.querySelector(`[data-order-id="${orderId}"]`);
        if (orderCard) {
            const statusElement = orderCard.querySelector('.status-text');
            if (statusElement) {
                statusElement.textContent = newStatus;
                statusElement.className = `status-text ${newStatus}`;
            }

            const button = orderCard.querySelector('.action-btn');
            if (button) {
                button.textContent = newStatus === 'Pendiente' ? 'Aceptar' : 'Enviado';
                button.className = `action-btn ${newStatus === 'Pendiente' ? 'accept-btn' : 'ship-btn'}`;
            }
        }

        alert(`El estado del pedido ha sido actualizado a: ${newStatus}`);
    } catch (error) {
        console.error('Error al actualizar el estado del pedido:', error);
        alert('Error al actualizar el estado del pedido. Por favor, inténtalo de nuevo.');
    }
};

// Función para manejar la eliminación de pedidos
window.handleDeleteOrder = async (orderId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este pedido?')) {
        return;
    }

    try {
        const orderRef = docRef(db, 'orders', orderId);
        await deleteDoc(orderRef);
        alert('Pedido eliminado correctamente');
        window.location.reload();
    } catch (error) {
        console.error('Error al eliminar el pedido:', error);
        alert('Error al eliminar el pedido. Por favor, inténtalo de nuevo.');
    }
};

// Función para mostrar los detalles del pedido en el modal
function showOrderDetails(order) {
    const modal = document.getElementById('orderDetailsModal');
    const orderDetails = document.getElementById('orderDetails');
    
    // Formatear la fecha
    const formattedDate = order.createdAt ? new Date(order.createdAt).toLocaleString() : 'No disponible';
    
    // Crear el contenido del modal
    orderDetails.innerHTML = `
        <h3>Detalles del Pedido #${order.id}</h3>
        
        <div class="order-section">
            <h4>Cliente</h4>
            <p>${order.clientName}</p>
        </div>
        
        <div class="order-section">
            <h4>Estado</h4>
            <p class="status-${order.status}">${order.status === 'Pendiente' ? 'Pendiente' : 'Enviado'}</p>
        </div>
        
        <div class="order-section">
            <h4>Fecha y Hora</h4>
            <p>${formattedDate}</p>
            ${order.deliveryType === 'scheduled' ? `
                <p><strong>Programado para:</strong> ${order.scheduledDate} a las ${order.scheduledTime}</p>
            ` : ''}
        </div>
        
        <div class="order-section">
            <h4>Dirección de Entrega</h4>
            <p>${order.shippingAddress.reference || 'No especificada'}</p>
            ${order.shippingAddress.notes ? `<p><em>Notas: ${order.shippingAddress.notes}</em></p>` : ''}
            
            <!-- Mapa de ubicación -->
            ${order.shippingAddress && (order.shippingAddress.lat || order.shippingAddress.latitude) && (order.shippingAddress.lng || order.shippingAddress.longitude) ? `
                <div class="map-container">
                    <h4>Ubicación en el mapa</h4>
                    ${(() => {
                        const lat = order.shippingAddress.lat || order.shippingAddress.latitude;
                        const lng = order.shippingAddress.lng || order.shippingAddress.longitude;
                        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x300&maptype=roadmap&markers=color:red%7C${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
                        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                        
                        console.log('Generando mapa con URL:', mapUrl);
                        
                        return `
                            <p>Coordenadas: ${lat}, ${lng}</p>
                            <a href="${mapsUrl}" target="_blank" style="display: block; margin-bottom: 10px;">
                                <img 
                                    src="${mapUrl}" 
                                    alt="Ubicación de entrega"
                                    class="map-image"
                                    onerror="console.error('Error al cargar el mapa:', this.src)"
                                    onload="console.log('Mapa cargado correctamente')"
                                >
                            </a>
                            <a href="${mapsUrl}" target="_blank" style="color: #3366cc; text-decoration: none;">
                                Ver en Google Maps
                            </a>
                        `;
                    })()}
                </div>
            ` : `
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
            
            <!-- Comprobante de pago -->
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
            <button class="action-btn ${order.status === 'Pendiente' ? 'accept-btn' : 'ship-btn'}" 
                    onclick="handleOrderStatus('${order.id}', '${order.status}'); closeModal();">
                ${order.status === 'Pendiente' ? 'Marcar como Enviado' : 'Marcar como Pendiente'}
            </button>
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

// Hacer la función closeModal accesible globalmente
window.closeModal = closeModal;

document.addEventListener('DOMContentLoaded', async () => {
    const ordersContainer = document.getElementById('store-orders-container');

    // Obtener storeId del URL
    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('storeId');

    if (!storeId) {
        // Intentar obtener el storeId del localStorage
        const storedStoreId = localStorage.getItem('storeId');
        if (storedStoreId) {
            // Redirigir con el storeId almacenado
            window.location.href = `store-orders.html?storeId=${storedStoreId}`;
            return;
        }
        
        // Si no hay storeId, redirigir al inicio
        alert('No se encontró un ID de tienda válido. Por favor, inicia sesión nuevamente.');
        window.location.href = 'index.html';
        return;
    }

    // Almacenar el storeId en localStorage para futuras referencias
    localStorage.setItem('storeId', storeId);

    // Exponer storeId al scope global
    window.getStoreId = () => storeId;

    // Mostrar indicador de carga
    ordersContainer.innerHTML = '<p class="text-center text-gray-500">Cargando pedidos...</p>';

    // Verificar si el usuario está autenticado
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('Usuario autenticado:', user.uid);
            try {
                // Consultar las órdenes de la tienda
                const ordersRef = collection(db, 'orders');
                const q = query(ordersRef, where('storeId', '==', storeId));
                console.log('Consulta de Firestore creada:', q);

                const querySnapshot = await getDocs(q);
                console.log('Resultados de la consulta:', querySnapshot);

                if (querySnapshot.empty) {
                    console.log('No se encontraron pedidos para la tienda con storeId:', storeId);
                    ordersContainer.innerHTML = '<p class="text-center text-gray-500">No hay pedidos para esta tienda.</p>';
                    return;
                }

                // Limpiar contenedor
                ordersContainer.innerHTML = '';


                /* Agrupación de órdenes por estado */
                const groupedOrders = {
                    Pendiente: [],
                    Enviado: []
                };

                for (const doc of querySnapshot.docs) {
                    const order = doc.data();
                    const status = (order.status || 'Pendiente').toLowerCase() === 'enviado' ? 'Enviado' : 'Pendiente';
                    groupedOrders[status].push({ doc, order });
                }

                // Renderizar las órdenes como tarjetas
                for (const status of ['Pendiente', 'Enviado']) {
                    const orders = groupedOrders[status];
                    if (orders.length > 0) {
                        // Título de grupo
                        const groupTitle = document.createElement('h3');
                        groupTitle.textContent = status === 'Pendiente' ? 'Órdenes Pendientes' : 'Órdenes Enviadas';
                        groupTitle.className = 'orders-group-title';
                        ordersContainer.appendChild(groupTitle);
                    }
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

                        // Crear la tarjeta del pedido
                        const orderCard = document.createElement('div');
                        orderCard.className = 'order-card';
                        orderCard.setAttribute('data-order-id', doc.id);
                        orderCard.innerHTML = `
                            <div class="order-header">
                                <h3 class="order-title">${clientName}</h3>
                                <p class="status-text ${status}">${status}</p>
                            </div>
                            <div class="order-products">
                                <ul>${productsList}</ul>
                            </div>
                            <div class="order-payment">
                                <strong>Forma de pago:</strong> ${paymentMethod}
                            </div>
                        `;

                        // Evento para mostrar detalles
                        orderCard.addEventListener('click', () => {
                            showOrderDetails({
                                id: doc.id,
                                clientName,
                                status,
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
        } else {
            // Si no hay usuario autenticado, redirigir al inicio
            alert('Debes iniciar sesión para ver los pedidos.');
            window.location.href = 'index.html';
        }
    });
});