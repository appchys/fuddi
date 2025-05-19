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
            console.log('Actualizando pedido con ID:', orderId);
            
            // Obtener la referencia al documento del pedido
            const orderRef = docRef(db, 'orders', orderId);
            
            // Obtener el estado actual del pedido
            const orderDoc = await getDoc(orderRef);
            if (!orderDoc.exists()) {
                console.error('Pedido no encontrado:', orderId);
                alert('Error: Pedido no encontrado');
                return;
            }

            const currentStatus = orderDoc.data().status;
            if (currentStatus === 'recibido') {
                console.log('El pedido ya está marcado como recibido');
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
            console.log('Estado del pedido actualizado a recibido en Firestore');
            
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
            console.error('Error al actualizar el estado del pedido:', error);
            alert('Error al marcar el pedido como recibido. Por favor, inténtalo de nuevo.');
        }
    };

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('Usuario autenticado:', user.uid);
            try {
                const ordersRef = collection(db, 'orders');
                const q = query(ordersRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
                console.log('Consulta de Firestore creada:', q);

                const querySnapshot = await getDocs(q);
                console.log('Resultados de la consulta:', querySnapshot);

                // Ocultar spinner
                loadingSpinner.style.display = 'none';

                if (querySnapshot.empty) {
                    console.log('No se encontraron pedidos para el usuario:', user.uid);
                    ordersContainer.innerHTML = '<p>No tienes pedidos realizados.</p>';
                    return;
                }

                querySnapshot.forEach(async (doc) => {
                    const order = doc.data();
                    console.log('Pedido encontrado:', order);

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

                    const orderElement = document.createElement('div');
                    orderElement.classList.add('order-item');
                    orderElement.dataset.orderId = doc.id;
                    orderElement.innerHTML = `
                        <div class="order-header">
                            <div class="order-title-container">
                                <h3 class="store-name">${storeName}</h3>
                                <p class="order-date">${createdAt}</p>
                            </div>
                            <div class="order-status-container">
                                <h4>Estado:</h4>
                                <p class="status-${status.toLowerCase()}">${status}</p>
                            </div>
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

                        <div class="order-actions">
                            <button class="mark-received-btn" ${status === 'recibido' ? 'disabled' : ''} onclick="updateOrderStatus('${doc.id}')">
                                ${status === 'recibido' ? 'Recibido' : 'Marcar como recibido'}
                            </button>
                        </div>
                    `;
                    ordersContainer.appendChild(orderElement);

                    // Añadir evento al botón de Recibido
                    const receivedBtn = orderElement.querySelector('.mark-received-btn');
                    if (receivedBtn && !receivedBtn.disabled) {
                        receivedBtn.addEventListener('click', () => {
                            updateOrderStatus(doc.id);
                        });
                    }
                });

            } catch (error) {
                console.error('Error al cargar los pedidos:', error);
                loadingSpinner.style.display = 'none';
                ordersContainer.innerHTML = '<p>Hubo un error al cargar tus pedidos. Por favor, inténtalo de nuevo más tarde.</p>';
            }
        } else {
            console.warn('Usuario no autenticado');
            loadingSpinner.style.display = 'none';
            alert('Por favor, inicia sesión para ver tus pedidos.');
            window.location.href = '/login.html';
        }
    });
});