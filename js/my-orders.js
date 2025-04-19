import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, auth } from './firebase-config.js';

const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const ordersContainer = document.getElementById('orders-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const backBtn = document.getElementById('back-btn');
    const modal = document.getElementById('order-details-modal');
    const modalContent = document.getElementById('modal-content');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // Configurar el botón de volver
    backBtn.addEventListener('click', () => {
        window.history.back();
    });

    // Mostrar spinner mientras se cargan los pedidos
    loadingSpinner.style.display = 'flex';

    // Función para abrir el modal con detalles del pedido
    const openOrderDetails = (order, orderId, products) => {
        modalContent.innerHTML = `
            <h2>Detalles del Pedido #${orderId}</h2>
            <p><strong>Cliente:</strong> ${order.clientName || 'No disponible'}</p>
            <p><strong>Total:</strong> $${order.total ? order.total.toFixed(2) : 'No disponible'}</p>
            <p><strong>Dirección:</strong> ${order.address?.reference || 'No disponible'}</p>
            ${order.address?.latitude && order.address?.longitude ? `
                <p><strong>Coordenadas:</strong> ${order.address.latitude}, ${order.address.longitude}</p>
            ` : ''}
            <p><strong>Método de Pago:</strong> ${order.paymentMethod || 'No disponible'}</p>
            <p><strong>Fecha:</strong> ${order.createdAt ? new Date(order.createdAt).toLocaleString() : 'No disponible'}</p>
            <h3>Productos:</h3>
            <ul>
                ${products.map(item => `
                    <li>${item.quantity} x ${item.name || 'Producto desconocido'} - $${item.price ? (item.quantity * item.price).toFixed(2) : 'No disponible'}</li>
                `).join('') || '<li>No hay productos</li>'}
            </ul>
        `;
        modal.style.display = 'block';
    };

    // Cerrar el modal
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('Usuario autenticado:', user.uid);
            try {
                const ordersRef = collection(db, 'orders');
                const q = query(ordersRef, where('userId', '==', user.uid));
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
                    orderElement.innerHTML = `
                        <h3>Pedido #${doc.id}</h3>
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
                        <button class="view-details-btn" data-order-id="${doc.id}">Ver Detalles</button>
                    `;
                    ordersContainer.appendChild(orderElement);

                    // Añadir evento al botón de detalles
                    document.querySelectorAll('.view-details-btn').forEach(button => {
                        button.addEventListener('click', () => {
                            const orderId = button.getAttribute('data-order-id');
                            if (orderId === doc.id) {
                                openOrderDetails(order, orderId, products);
                            }
                        });
                    });
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