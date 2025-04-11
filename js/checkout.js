import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app } from './firebase-config.js'; // Asegúrate de que este archivo exporte la instancia de Firebase

// Inicializa Firestore
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const storeId = params.get('storeId');

    if (!storeId) {
        console.error("No se proporcionó un storeId en la URL.");
        return;
    }

    const cartKey = `cart_${storeId}`;
    const cart = JSON.parse(localStorage.getItem(cartKey)) || [];
    const cartDetails = document.getElementById('cart-details');

    cartDetails.innerHTML = ''; // Limpia el contenido previo

    if (cart.length === 0) {
        cartDetails.innerHTML = '<p>El carrito está vacío.</p>';
    } else {
        let totalGeneral = 0;

        for (const item of cart) {
            try {
                // Obtén los datos del producto desde Firebase
                const productDoc = await getDoc(doc(db, `stores/${storeId}/products`, item.productId));
                if (productDoc.exists()) {
                    const product = productDoc.data();
                    const subtotal = product.price * item.quantity;
                    totalGeneral += subtotal;

                    // Crear el elemento del carrito
                    const cartItem = document.createElement('div');
                    cartItem.classList.add('cart-item');
                    cartItem.innerHTML = `
                        <p><strong>${product.name}</strong></p>
                        <p>Cantidad: ${item.quantity}</p>
                        <p>Subtotal: $${subtotal.toFixed(2)}</p>
                    `;
                    cartDetails.appendChild(cartItem);
                }
            } catch (error) {
                console.error("Error al obtener los datos del producto:", error);
            }
        }

        // Mostrar el total general
        const totalElement = document.createElement('div');
        totalElement.classList.add('cart-total');
        totalElement.innerHTML = `
            <p><strong>Total General:</strong> $${totalGeneral.toFixed(2)}</p>
        `;
        cartDetails.appendChild(totalElement);
    }

    // Manejar el botón "Crear cuenta"
    const createAccountBtn = document.getElementById('create-account-btn');
    createAccountBtn.addEventListener('click', () => {
        window.location.href = '/register.html'; // Redirigir a la página de registro
    });
});