import { getFirestore, collection, query, where, getDocs, doc, getDoc, orderBy, updateDoc, doc as docRef } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, auth } from './firebase-config.js';

const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const ordersContainer = document.getElementById('orders-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const backBtn = document.getElementById('back-btn');

    // Configurar el botón de volver
    backBtn.addEventListener('click', () => {
        window.location.href = '/index.html';
    });

    // Mostrar spinner mientras se cargan los pedidos
    loadingSpinner.style.display = 'flex';

    // Función para actualizar el estado del pedido
    const updateOrderStatus = async (orderId) => {
        try {
            // Obtener la referencia al documento del pedido
            const orderRef = docRef(db, 'orders', orderId);

            // Obtener el estado actual del pedido
            const orderDoc = await getDoc(orderRef);
            if (!orderDoc.exists()) {
                alert('Error: Pedido no encontrado');
                return;
            }

            const currentStatus = orderDoc.data().status;
            if (currentStatus === 'recibido') {
                alert('Este pedido ya está marcado como recibido');
                return;
            }

            if (!confirm('¿Estás seguro de que quieres marcar este pedido como recibido?')) {
                return;
            }

            // Actualizar el estado del pedido
            await updateDoc(orderRef, {
                status: 'recibido',
                updatedAt: new Date().toISOString()
            });

            // Actualizar la interfaz
            const orderItem = document.querySelector(`.order-item[data-order-id="${orderId}"]`);
            if (orderItem) {
                const statusElement = orderItem.querySelector('.order-status p');
                if (statusElement) {
                    statusElement.textContent = 'recibido';
                    statusElement.className = 'status-recibido';
                }

                const receivedBtn = orderItem.querySelector('.mark-received-btn');
                if (receivedBtn) {
                    receivedBtn.textContent = 'Recibido';
                    receivedBtn.disabled = true;
                    receivedBtn.classList.add('disabled-btn');
                }

                alert('Pedido marcado como recibido exitosamente');
            }
        } catch (error) {
            alert('Error al marcar el pedido como recibido. Por favor, inténtalo de nuevo.');
        }
    };

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const ordersRef = collection(db, 'orders');
                const q = query(ordersRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));

                const querySnapshot = await getDocs(q);

                // Ocultar spinner
                loadingSpinner.style.display = 'none';

                if (querySnapshot.empty) {
                    ordersContainer.innerHTML = '<p>No tienes pedidos realizados.</p>';
                    return;
                }

                querySnapshot.forEach(async (doc) => {
                    const order = doc.data();

                    // Obtener el nombre del cliente
                    const userRef = docRef(db, 'users', order.userId);
                    const userDoc = await getDoc(userRef);
                    const clientName = userDoc.data()?.name || 'Cliente no especificado';

                    // Obtener el nombre de la tienda
                    const storeRef = docRef(db, 'stores', order.storeId);
                    const storeDoc = await getDoc(storeRef);
                    const storeName = storeDoc.data()?.name || 'Tienda no especificada';

                    // Validar datos
                    const total = typeof order.total === 'number' ? order.total.toFixed(2) : 'No disponible';
                    const shippingAddress = order.shippingAddress || {};
                    const reference = shippingAddress.reference || 'Dirección no disponible';
                    const paymentMethod = order.paymentMethod || 'No especificado';
                    const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Fecha no disponible';
                    const items = Array.isArray(order.products) ? order.products : [];
                    const status = order.status || 'pendiente';

                    // Mapea el estado a progreso y color
                    const progressMap = {
                        'pendiente': { percent: 25, color: '#e74c3c' },
                        'en preparación': { percent: 50, color: '#f39c12' },
                        'en camino': { percent: 75, color: '#27ae60' },
                        'entregado': { percent: 100, color: '#8e44ad' },
                        'recibido': { percent: 100, color: '#8e44ad' }
                    };
                    const progress = progressMap[status.toLowerCase()] || progressMap['pendiente'];

                    const orderElement = document.createElement('div');
                    orderElement.classList.add('order-card', 'order-item');
                    orderElement.dataset.orderId = doc.id;
                    orderElement.innerHTML = `
                        <div class="order-header">
                            <div class="order-title-container">
                                <h3 class="store-name">${storeName}</h3>
                            </div>
                        </div>
                        ${order.scheduledDate ? `
                            <div class="order-scheduled">
                                <strong>Entrega:</strong> ${getFechaFormateada(order.scheduledDate)}${order.scheduledTime ? `, ${order.scheduledTime}` : ''}
                            </div>
                        ` : ''}
                        <div class="order-address">
                            <strong>Dirección de entrega:</strong> ${reference}
                        </div>
                        <div class="order-products">
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
                            <strong>Total:</strong> $${total}
                        </div>
                        <div class="order-payment">
                            <strong>Forma de pago:</strong> ${paymentMethod}
                        </div>
                        <div class="order-status" style="margin-top:1.2em; margin-bottom:0.3em; font-weight:bold; background:none; border:none;">
                            ${status.charAt(0).toUpperCase() + status.slice(1)}
                        </div>
                        <div class="order-progress-bar-with-btn">
                            <div class="order-progress-bar">
                                <div class="order-progress-fill" style="width: ${progress.percent}%; background: ${progress.color};"></div>
                            </div>
                        </div>
                    `;
                    ordersContainer.appendChild(orderElement);

                    
                });

            } catch (error) {
                loadingSpinner.style.display = 'none';
                ordersContainer.innerHTML = '<p>Hubo un error al cargar tus pedidos. Por favor, inténtalo de nuevo más tarde.</p>';
            }
        } else {
            loadingSpinner.style.display = 'none';
            alert('Por favor, inicia sesión para ver tus pedidos.');
            window.location.href = '/login.html';
        }
    });
});

function getFechaFormateada(fechaISO) {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const hoy = new Date();
    const fecha = new Date(fechaISO);

    hoy.setHours(0,0,0,0);
    fecha.setHours(0,0,0,0);

    const diffDias = Math.round((fecha - hoy) / (1000 * 60 * 60 * 24));

    if (diffDias === 0) return 'Hoy';
    if (diffDias === -1) return 'Ayer';
    if (diffDias === 1) return 'Mañana';

    return `${fecha.getDate()}/${meses[fecha.getMonth()]}/${fecha.getFullYear()}`;
}