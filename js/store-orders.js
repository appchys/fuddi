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

// Inicializa Firestore
const db = getFirestore(app);

// Función para manejar el cambio de estado del pedido
window.handleOrderStatus = async (orderId, currentStatus) => {
    try {
        const orderRef = docRef(db, 'orders', orderId);
        const newStatus = currentStatus === 'pendiente' ? 'enviado' : 'pendiente';
        
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
                button.textContent = newStatus === 'pendiente' ? 'Aceptar' : 'Enviado';
                button.className = `action-btn ${newStatus === 'pendiente' ? 'accept-btn' : 'ship-btn'}`;
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

                // Renderizar las órdenes como tarjetas
                for (const doc of querySnapshot.docs) {
                    const order = doc.data();
                    console.log('Pedido encontrado:', order);

                    // Obtener el nombre del cliente
                    const userRef = docRef(db, 'users', order.userId);
                    const userDoc = await getDoc(userRef);
                    const clientName = userDoc.data()?.name || 'Cliente no especificado';

                    // Validar datos
                    const total = typeof order.total === 'number' ? order.total.toFixed(2) : 'No disponible';
                    const shippingAddress = order.shippingAddress || {};
                    const reference = shippingAddress.reference || 'Dirección no disponible';
                    const paymentMethod = order.paymentMethod || 'No especificado';
                    const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Fecha no disponible';
                    const items = Array.isArray(order.products) ? order.products : [];
                    const status = order.status || 'pendiente';

                    // Determinar texto y estado del botón según el estado
                    const buttonText = status === 'pendiente' ? 'Aceptar' : 'Enviado';
                    const buttonClass = status === 'pendiente' ? 'accept-btn' : 'ship-btn';
                    const isDisabled = status === 'enviado' ? 'disabled' : '';
                    const buttonDisabledClass = status === 'enviado' ? 'disabled-btn' : '';

                    // Crear la tarjeta del pedido
                    const orderCard = document.createElement('div');
                    orderCard.className = 'order-card';
                    orderCard.setAttribute('data-order-id', doc.id);
                    orderCard.innerHTML = `
                        <div class="order-header">
                            <h3 class="order-title">Pedido #${doc.id}</h3>
                            <p class="order-date">${createdAt}</p>
                        </div>
                        
                        <div class="order-client">
                            <h4>Cliente:</h4>
                            <p>${clientName}</p>
                        </div>

                        <div class="order-address">
                            <h4>Dirección de entrega:</h4>
                            <p>${reference}</p>
                        </div>

                        <div class="order-products">
                            <h4>Productos:</h4>
                            <ul class="products-list">
                                ${items.map(item => `
                                    <li>
                                        <span class="product-name">${item.name}</span>
                                        <span class="product-quantity">x${item.quantity}</span>
                                        <span class="product-price">$${item.price.toFixed(2)}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>

                        <div class="order-total">
                            <h4>Total:</h4>
                            <p>$${total}</p>
                        </div>

                        <div class="order-payment">
                            <h4>Método de pago:</h4>
                            <p>${paymentMethod}</p>
                        </div>

                        <div class="order-status">
                            <h4>Estado:</h4>
                            <p class="status-${status.toLowerCase()}">${status}</p>
                        </div>

                        <div class="order-actions">
                            <button class="${buttonClass} ${buttonDisabledClass}" ${isDisabled} onclick="handleOrderStatus('${doc.id}', '${status}')">
                                ${buttonText}
                            </button>
                            <button class="action-btn delete-btn" ${isDisabled} onclick="handleDeleteOrder('${doc.id}')">
                                Eliminar
                            </button>
                        </div>
                    `;

                    ordersContainer.appendChild(orderCard);
                }

                // Añadir event listeners para los botones
                document.querySelectorAll('.accept-btn, .ship-btn').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const orderId = e.target.closest('.order-card').dataset.orderId;
                        const currentStatus = button.classList.contains('accept-btn') ? 'pendiente' : 'enviado';
                        await window.handleOrderStatus(orderId, currentStatus);
                    });
                });

                document.querySelectorAll('.delete-btn').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const orderId = e.target.closest('.order-card').dataset.orderId;
                        await window.handleDeleteOrder(orderId);
                    });
                });

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