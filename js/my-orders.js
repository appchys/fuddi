import { getFirestore, collection, query, where, getDocs, doc, getDoc, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
            const orderRef = doc(db, 'orders', orderId);
            await updateDoc(orderRef, {
                status: 'Recibido'
            });
            console.log('Estado del pedido actualizado a Recibido en Firestore');
            
            // Actualizar la interfaz
            const orderItem = document.querySelector(`.order-item[data-order-id="${orderId}"]`);
            if (orderItem) {
                const statusElement = orderItem.querySelector('h3');
                if (statusElement) {
                    statusElement.textContent = 'Estado: Recibido';
                    console.log('Interfaz actualizada para pedido:', orderId);
                } else {
                    console.error('No se encontró el elemento <h3> para el estado');
                }
            } else {
                console.error('No se encontró el elemento .order-item para el ID:', orderId);
            }
        } catch (error) {
            console.error('Error al actualizar el estado del pedido:', error);
            alert('Error al marcar el pedido como recibido: ' + error.message);
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

                    // Obtener detalles de los productos
                    const products = [];
                    let calculatedTotal = 0;

                    for (const item of order.items || []) {
                        let productData = {
                            quantity: item.quantity,
                            name: item.name || 'Producto desconocido',
                            price: item.price || 0
                        };

                        // Si no hay name o price, obtenerlos desde la colección de productos
                        if (!item.name || !item.price) {
                            try {
                                const productDoc = await getDoc(doc(db, `stores/${order.storeDocId}/products`, item.productId));
                                if (productDoc.exists()) {
                                    const product = productDoc.data();
                                    productData.name = product.name || 'Producto desconocido';
                                    productData.price = product.price || 0;
                                }
                            } catch (error) {
                                console.error(`Error al obtener producto ${item.productId}:`, error);
                            }
                        }

                        products.push(productData);
                        calculatedTotal += productData.price * productData.quantity;
                    }

                    // Usar el total calculado si order.total es NaN o no existe
                    const displayTotal = isNaN(order.total) || !order.total ? calculatedTotal : order.total;

                    const orderElement = document.createElement('div');
                    orderElement.classList.add('order-item');
                    orderElement.dataset.orderId = doc.id;
                    orderElement.innerHTML = `
                        <h3>Estado: ${order.status || 'No disponible'}</h3>
                        <p><strong>Cliente:</strong> ${order.clientName || 'No disponible'}</p>
                        <p><strong>Total:</strong> $${displayTotal.toFixed(2)}</p>
                        <p><strong>Dirección:</strong> ${order.address?.reference || 'No disponible'}</p>
                        <p><strong>Método de Pago:</strong> ${order.paymentMethod || 'No disponible'}</p>
                        <p><strong>Fecha:</strong> ${order.createdAt ? new Date(order.createdAt).toLocaleString() : 'No disponible'}</p>
                        <h4>Productos:</h4>
                        <ul>
                            ${products.map(item => `
                                <li>${item.quantity} x ${item.name} - $${(item.quantity * item.price).toFixed(2)}</li>
                            `).join('') || '<li>No hay productos</li>'}
                        </ul>
                        <button class="mark-received-btn" data-order-id="${doc.id}">Recibido</button>
                    `;
                    ordersContainer.appendChild(orderElement);

                    // Añadir evento al botón de Recibido
                    const receivedBtn = orderElement.querySelector('.mark-received-btn');
                    if (receivedBtn) {
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