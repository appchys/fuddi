document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const storeId = params.get('storeId');

    if (!storeId) {
        console.error("No se proporcionó un storeId en la URL.");
        return;
    }

    const cartKey = `cart_${storeId}`;
    const cart = JSON.parse(localStorage.getItem(cartKey)) || [];
    const cartDetails = document.getElementById('cart-details');

    if (cart.length === 0) {
        cartDetails.innerHTML = '<p>El carrito está vacío.</p>';
    } else {
        cart.forEach(item => {
            const cartItem = document.createElement('div');
            cartItem.classList.add('cart-item');
            cartItem.innerHTML = `
                <p>Producto ID: ${item.productId}</p>
                <p>Cantidad: ${item.quantity}</p>
            `;
            cartDetails.appendChild(cartItem);
        });
    }

    // Manejar el botón "Crear cuenta"
    const createAccountBtn = document.getElementById('create-account-btn');
    createAccountBtn.addEventListener('click', () => {
        window.location.href = '/register.html'; // Redirigir a la página de registro
    });
});