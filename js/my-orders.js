import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, auth } from './firebase-config.js'; // Asegúrate de que este archivo exporte la instancia de Firebase y auth

// Inicializa Firestore
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const ordersList = document.getElementById('orders-list');

    // Verificar si el usuario está autenticado
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                // Consultar los pedidos del usuario en Firestore
                const ordersRef = collection(db, 'orders');
                const q = query(ordersRef, where('userId', '==', user.uid));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    ordersList.innerHTML = '<p>No tienes pedidos realizados.</p>';
                    return;
                }

                // Mostrar los pedidos en la lista
                querySnapshot.forEach((doc) => {
                    const order = doc.data();
                    const orderElement = document.createElement('div');
                    orderElement.classList.add('order-item');
                    orderElement.innerHTML = `
                        <h3>Pedido #${doc.id}</h3>
                        <p><strong>Fecha:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                        <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
                        <p><strong>Método de Pago:</strong> ${order.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}</p>
                        <p><strong>Dirección:</strong> ${order.address.reference}</p>
                        <button class="view-details-btn" data-id="${doc.id}">Ver Detalles</button>
                    `;
                    ordersList.appendChild(orderElement);
                });

                // Manejar clic en "Ver Detalles"
                document.querySelectorAll('.view-details-btn').forEach((btn) => {
                    btn.addEventListener('click', (e) => {
                        const orderId = e.target.dataset.id;
                        alert(`Detalles del pedido: ${orderId}`);
                        // Aquí puedes redirigir a una página de detalles del pedido o mostrar un modal
                    });
                });
            } catch (error) {
                console.error('Error al cargar los pedidos:', error);
                ordersList.innerHTML = '<p>Hubo un error al cargar tus pedidos. Por favor, inténtalo de nuevo más tarde.</p>';
            }
        } else {
            // Redirigir al inicio de sesión si no está autenticado
            alert('Por favor, inicia sesión para ver tus pedidos.');
            window.location.href = '/login.html';
        }
    });
});