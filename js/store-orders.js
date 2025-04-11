import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, auth } from './firebase-config.js';

const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const ordersList = document.getElementById('orders-list');

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                // Recuperar el storeId desde el almacenamiento local
                const storeId = localStorage.getItem('storeId');

                if (!storeId) {
                    ordersList.innerHTML = '<p>No se encontró un ID de tienda. Por favor, inicia sesión nuevamente.</p>';
                    return;
                }

                // Consultar los pedidos realizados a la tienda
                const ordersRef = collection(db, 'orders');
                const q = query(ordersRef, where('storeId', '==', storeId));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    ordersList.innerHTML = '<p>No hay pedidos para esta tienda.</p>';
                    return;
                }

                querySnapshot.forEach((doc) => {
                    const order = doc.data();
                    const orderElement = document.createElement('div');
                    orderElement.classList.add('order-item');
                    orderElement.innerHTML = `
                        <h3>Pedido #${doc.id}</h3>
                        <p><strong>Cliente:</strong> ${order.userId}</p>
                        <p><strong>Fecha:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                        <p><strong>Total:</strong> $${isNaN(order.total) ? 'No disponible' : order.total.toFixed(2)}</p>
                        <p><strong>Método de Pago:</strong> ${order.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}</p>
                        <button class="view-details-btn" data-id="${doc.id}">Ver Detalles</button>
                    `;
                    ordersList.appendChild(orderElement);
                });

                document.querySelectorAll('.view-details-btn').forEach((btn) => {
                    btn.addEventListener('click', (e) => {
                        const orderId = e.target.dataset.id;
                        alert(`Detalles del pedido: ${orderId}`);
                    });
                });
            } catch (error) {
                console.error('Error al cargar los pedidos:', error);
                ordersList.innerHTML = '<p>Hubo un error al cargar los pedidos. Por favor, inténtalo de nuevo más tarde.</p>';
            }
        } else {
            alert('Por favor, inicia sesión para ver los pedidos.');
            window.location.href = '/login.html';
        }
    });
});