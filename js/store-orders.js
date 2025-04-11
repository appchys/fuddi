import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, auth } from './firebase-config.js'; // Asegúrate de que este archivo exporte la instancia de Firebase y auth

// Inicializa Firestore
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const ordersContainer = document.getElementById('store-orders-container'); // Contenedor donde se mostrarán las órdenes

    // Verificar si el usuario está autenticado
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('Usuario autenticado:', user.uid); // Log para verificar el usuario autenticado
            try {
                // Buscar la tienda asociada al usuario autenticado
                const storeQuery = query(collection(db, 'stores'), where('owner', '==', user.uid));
                const storeSnapshot = await getDocs(storeQuery);

                if (storeSnapshot.empty) {
                    console.log('No se encontró una tienda asociada al usuario:', user.uid);
                    ordersContainer.innerHTML = '<p>No tienes una tienda registrada.</p>';
                    return;
                }

                // Asumimos que el usuario tiene una sola tienda
                const storeDoc = storeSnapshot.docs[0];
                const storeDocId = storeDoc.id; // Usar el ID del documento como identificador interno
                console.log('Store Document ID obtenido:', storeDocId);

                // Consultar las órdenes de la tienda
                const ordersRef = collection(db, 'orders');
                const q = query(ordersRef, where('storeDocId', '==', storeDocId));
                console.log('Consulta de Firestore creada:', q); // Log para verificar la consulta

                const querySnapshot = await getDocs(q);
                console.log('Resultados de la consulta:', querySnapshot); // Log para verificar los resultados de la consulta

                if (querySnapshot.empty) {
                    console.log('No se encontraron pedidos para la tienda con storeDocId:', storeDocId); // Log si no hay pedidos
                    ordersContainer.innerHTML = '<p>No hay pedidos para esta tienda.</p>';
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
                console.error('Error al cargar los pedidos de la tienda:', error); // Log para errores
                ordersContainer.innerHTML = '<p>Hubo un error al cargar los pedidos. Por favor, inténtalo de nuevo más tarde.</p>';
            }
        } else {
            console.warn('Usuario no autenticado'); // Log si no hay usuario autenticado
            // Redirigir al inicio de sesión si no está autenticado
            alert('Por favor, inicia sesión para ver los pedidos de tu tienda.');
            window.location.href = '/login.html';
        }
    });
});