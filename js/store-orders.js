import { getFirestore, collection, query, where, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, auth } from './firebase-config.js';

// Inicializa Firestore
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const ordersContainer = document.getElementById('store-orders-container');

    // Mostrar indicador de carga
    ordersContainer.innerHTML = '<p class="text-center text-gray-500">Cargando pedidos...</p>';

    // Verificar si el usuario está autenticado
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('Usuario autenticado:', user.uid);
            try {
                // Buscar la tienda asociada al usuario autenticado
                const storeQuery = query(collection(db, 'stores'), where('owner', '==', user.uid));
                const storeSnapshot = await getDocs(storeQuery);

                if (storeSnapshot.empty) {
                    console.log('No se encontró una tienda asociada al usuario:', user.uid);
                    ordersContainer.innerHTML = '<p class="text-center text-gray-500">No tienes una tienda registrada.</p>';
                    return;
                }

                // Asumimos que el usuario tiene una sola tienda
                const storeDoc = storeSnapshot.docs[0];
                const storeDocId = storeDoc.id;
                console.log('Store Document ID obtenido:', storeDocId);

                // Consultar las órdenes de la tienda
                const ordersRef = collection(db, 'orders');
                const q = query(ordersRef, where('storeDocId', '==', storeDocId));
                console.log('Consulta de Firestore creada:', q);

                const querySnapshot = await getDocs(q);
                console.log('Resultados de la consulta:', querySnapshot);

                if (querySnapshot.empty) {
                    console.log('No se encontraron pedidos para la tienda con storeDocId:', storeDocId);
                    ordersContainer.innerHTML = '<p class="text-center text-gray-500">No hay pedidos para esta tienda.</p>';
                    return;
                }

                // Limpiar contenedor
                ordersContainer.innerHTML = '';

                // Renderizar las órdenes como tarjetas
                querySnapshot.forEach((doc) => {
                    const order = doc.data();
                    console.log('Pedido encontrado:', order);

                    // Validar datos
                    const clientName = order.clientName || 'Cliente no especificado';
                    const total = typeof order.total === 'number' ? order.total.toFixed(2) : 'No disponible';
                    const reference = order.address?.reference || 'Dirección no disponible';
                    const paymentMethod = order.paymentMethod || 'No especificado';
                    const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Fecha no disponible';
                    const items = Array.isArray(order.items) ? order.items : [];
                    const status = order.status || 'pendiente';

                    // Determinar texto y estado del botón según el estado
                    const buttonText = status === 'pendiente' ? 'Aceptar' : 'Enviado';
                    const buttonClass = status === 'pendiente' ? 'accept-btn' : 'ship-btn';
                    const isDisabled = status === 'enviado' ? 'disabled' : '';
                    const buttonDisabledClass = status === 'enviado' ? 'disabled-btn' : '';

                    // Crear la tarjeta del pedido
                    const orderCard = document.createElement('div');
                    orderCard.className = 'order-card';
                    orderCard.innerHTML = `
                        <h3 class="order-title">${clientName}</h3>
                        <h4 class="products-title">Productos:</h4>
                        <ul class="products-list">
                            ${items.length > 0
                                ? items
                                      .map(
                                          (item) => `
                                            <li class="product-item">
                                                ${item.quantity || 0} x ${item.name || 'Producto desconocido'} - 
                                                $${((item.quantity || 0) * (item.price || 0)).toFixed(2)}
                                            </li>
                                        `
                                      )
                                      .join('')
                                : '<li class="no-products">No hay productos en este pedido</li>'
                            }
                        </ul>
                        <p><strong>Dirección:</strong> ${reference}</p>
                        <p><strong>Total:</strong> $${total}</p>
                        <p><strong>Método de Pago:</strong> ${paymentMethod}</p>
                        <p><strong>Fecha:</strong> ${createdAt}</p>
                        <p><strong>Estado:</strong> <span class="status-text ${status}">${status}</span></p>
                        <div class="actions-container">
                            <button class="action-btn ${buttonClass} ${buttonDisabledClass}" 
                                    data-order-id="${doc.id}" ${isDisabled}>
                                ${buttonText}
                            </button>
                            <button class="action-btn delete-btn" data-order-id="${doc.id}">
                                Eliminar
                            </button>
                        </div>
                    `;
                    ordersContainer.appendChild(orderCard);
                });

                // Añadir event listeners para los botones
                document.querySelectorAll('.accept-btn, .ship-btn').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const orderId = e.target.dataset.orderId;
                        const currentStatus = e.target.classList.contains('accept-btn') ? 'pendiente' : 'en proceso';
                        
                        try {
                            const newStatus = currentStatus === 'pendiente' ? 'en proceso' : 'enviado';
                            await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
                            alert(`Orden actualizada a "${newStatus}" exitosamente.`);
                            // Recargar la página para reflejar el cambio
                            location.reload();
                        } catch (error) {
                            console.error('Error al actualizar la orden:', error);
                            alert('Hubo un error al actualizar la orden.');
                        }
                    });
                });

                document.querySelectorAll('.delete-btn').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const orderId = e.target.dataset.orderId;
                        if (confirm('¿Estás seguro de que quieres eliminar este pedido?')) {
                            try {
                                await deleteDoc(doc(db, 'orders', orderId));
                                alert('Orden eliminada exitosamente.');
                                // Recargar la página para reflejar el cambio
                                location.reload();
                            } catch (error) {
                                console.error('Error al eliminar la orden:', error);
                                alert('Hubo un error al eliminar la orden.');
                            }
                        }
                    });
                });

            } catch (error) {
                console.error('Error al cargar los pedidos de la tienda:', error);
                ordersContainer.innerHTML = '<p class="text-center text-red-500">Hubo un error al cargar los pedidos. Por favor, inténtalo de nuevo más tarde.</p>';
            }
        } else {
            console.warn('Usuario no autenticado');
            alert('Por favor, inicia sesión para ver los pedidos de tu tienda.');
            window.location.href = '/login.html';
        }
    });
});