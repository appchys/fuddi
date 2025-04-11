import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, auth } from './firebase-config.js'; // Asegúrate de que este archivo exporte la instancia de Firebase y auth

// Inicializa Firestore
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const ordersContainer = document.getElementById('orders-container'); // Contenedor donde se mostrarán los pedidos

    // Verificar si el usuario está autenticado
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('Usuario autenticado:', user.uid); // Log para verificar el usuario autenticado
            try {
                // Consultar las órdenes del usuario
                const ordersRef = collection(db, 'orders');
                const q = query(ordersRef, where('userId', '==', user.uid));
                console.log('Consulta de Firestore creada:', q); // Log para verificar la consulta

                const querySnapshot = await getDocs(q);
                console.log('Resultados de la consulta:', querySnapshot); // Log para verificar los resultados de la consulta

                if (querySnapshot.empty) {
                    console.log('No se encontraron pedidos para el usuario:', user.uid); // Log si no hay pedidos
                    ordersContainer.innerHTML = '<p>No tienes pedidos realizados.</p>';
                    return;
                }

                // Renderizar las órdenes
                querySnapshot.forEach((doc) => {
                    const order = doc.data();
                    console.log('Pedido encontrado:', order); // Log para verificar cada pedido

                    const orderElement = document.createElement('div');
                    orderElement.classList.add('order-item');
                    orderElement.innerHTML = `
                        <h3>Pedido #${doc.id}</h3>
                        <p><strong>Cliente:</strong> ${order.clientName}</p>
                        <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
                        <p><strong>Dirección:</strong> ${order.address.reference}</p>
                        <p><strong>Método de Pago:</strong> ${order.paymentMethod}</p>
                        <p><strong>Fecha:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                        <h4>Productos:</h4>
                        <ul>
                            ${order.items.map(item => `
                                <li>${item.quantity} x ${item.name} - $${(item.quantity * item.price).toFixed(2)}</li>
                            `).join('')}
                        </ul>
                    `;
                    ordersContainer.appendChild(orderElement);
                });
            } catch (error) {
                console.error('Error al cargar los pedidos:', error); // Log para errores
                ordersContainer.innerHTML = '<p>Hubo un error al cargar tus pedidos. Por favor, inténtalo de nuevo más tarde.</p>';
            }
        } else {
            console.warn('Usuario no autenticado'); // Log si no hay usuario autenticado
            // Redirigir al inicio de sesión si no está autenticado
            alert('Por favor, inicia sesión para ver tus pedidos.');
            window.location.href = '/login.html';
        }
    });
});