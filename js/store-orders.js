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
        window.location.reload();
    } catch (error) {
        console.error('Error al actualizar el estado del pedido:', error);
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
        <h3>${order.clientName}</h3>
        
        <div class="order-section">
            <h4>Estado</h4>
            <p class="status-${order.status}">${order.status === 'Pendiente' ? 'Pendiente' : 'Enviado'}</p>
        </div>
        
        <div class="order-section">
            <h4>Fecha y Hora</h4>
            
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
                    
                    ${(() => {
                        const lat = order.shippingAddress.lat || order.shippingAddress.latitude;
                        const lng = order.shippingAddress.lng || order.shippingAddress.longitude;
                        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x300&maptype=roadmap&markers=color:red%7C${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
                        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                        
                        console.log('Generando mapa con URL:', mapUrl);
                        
                        return `
                            
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

    auth.onAuthStateChanged(async (user) => {
        if (user) {
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
                    // Usa la fecha programada si existe, si no, la fecha de creación (solo yyyy-mm-dd)
                    const deliveryDate = order.scheduledDate || (order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : 'Sin fecha');
                    if (!ordersByDay[deliveryDate]) ordersByDay[deliveryDate] = [];
                    ordersByDay[deliveryDate].push({ doc, order });
                }

                // Ordena los días de entrega DESCENDENTE (más reciente primero)
                const sortedDays = Object.keys(ordersByDay).sort((a, b) => {
                    if (a === 'Sin fecha') return 1;
                    if (b === 'Sin fecha') return -1;
                    return b.localeCompare(a); // <-- Cambiado, ya no usa new Date()
                });

                for (const day of sortedDays) {
                    const orders = ordersByDay[day];

                    // Ordena por hora de entrega descendente (más próxima abajo, más tarde arriba)
                    orders.sort((a, b) => {
                        // Si ambos tienen hora programada, compara descendente
                        if (a.order.scheduledTime && b.order.scheduledTime) {
                            return b.order.scheduledTime.localeCompare(a.order.scheduledTime);
                        }
                        // Si solo uno tiene hora, ese va primero
                        if (a.order.scheduledTime) return -1;
                        if (b.order.scheduledTime) return 1;
                        // Si ninguno tiene hora, compara por fecha de creación descendente
                        return (b.order.createdAt || '').localeCompare(a.order.createdAt || '');
                    });

                    // Título del grupo por día
                    let fechaFormateada = '';
                    if (day === 'Sin fecha') {
                        fechaFormateada = 'Órdenes sin fecha de entrega';
                    } else if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
                        // Formato YYYY-MM-DD
                        const [year, month, dayNum] = day.split('-');
                        fechaFormateada = `Entrega: ${dayNum}/${month}/${year}`;
                    } else {
                        // Fallback por si acaso
                        fechaFormateada = `Entrega: ${day}`;
                    }
                    const groupTitle = document.createElement('h3');
                    groupTitle.textContent = fechaFormateada;
                    groupTitle.className = 'orders-group-title';
                    ordersContainer.appendChild(groupTitle);

                    for (const { doc, order } of orders) {
                        // Obtener el nombre del cliente
                        const userRef = docRef(db, 'users', order.userId);
                        // eslint-disable-next-line no-await-in-loop
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
                        `;

                        // Determina el texto y el siguiente estado
                        let actionBtnText = '';
                        let nextStatus = '';
                        let showActionBtn = true;

                        switch (order.status) {
                            case 'Pendiente':
                                actionBtnText = 'Aceptar';
                                nextStatus = 'En preparación';
                                break;
                            case 'En preparación':
                                actionBtnText = 'En camino';
                                nextStatus = 'En camino';
                                break;
                            case 'En camino':
                                actionBtnText = 'Entregado';
                                nextStatus = 'Entregado';
                                break;
                            case 'Entregado':
                                showActionBtn = false;
                                break;
                            default:
                                showActionBtn = false;
                        }

                        orderCard.innerHTML += showActionBtn ? `
    <button class="action-btn" onclick="event.stopPropagation(); handleOrderStatus('${doc.id}', '${order.status}', '${nextStatus}')">
        ${actionBtnText}
    </button>
` : '';

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
        } else {
            alert('Debes iniciar sesión para ver los pedidos.');
            window.location.href = 'index.html';
        }
    });
});