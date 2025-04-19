import { getFirestore, doc, getDoc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, auth } from './firebase-config.js';

const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const storeId = params.get('storeId');

    if (!storeId) {
        alert('No se proporcionó un ID de tienda válido.');
        return;
    }

    const cartKey = `cart_${storeId}`;
    const cart = JSON.parse(localStorage.getItem(cartKey)) || [];
    const cartDetails = document.getElementById('cart-details');
    const userInfoContainer = document.getElementById('user-info-container');
    const bankDetailsContainer = document.getElementById('bank-details');
    const bankAccountsList = document.getElementById('bank-accounts-list');

    cartDetails.innerHTML = '';

    // Cargar datos bancarios de la tienda
    async function loadBankAccounts() {
        try {
            const storeRef = doc(db, 'stores', storeId);
            const storeDoc = await getDoc(storeRef);

            if (storeDoc.exists()) {
                const storeData = storeDoc.data();
                const bankAccounts = storeData.bankAccounts || [];

                bankAccountsList.innerHTML = '';
                if (bankAccounts.length > 0) {
                    bankAccounts.forEach(({ bank, accountNumber, holder }) => {
                        const accountElement = document.createElement('div');
                        accountElement.className = 'border border-gray-200 p-4 rounded-md';
                        accountElement.innerHTML = `
                            <p><strong>Banco:</strong> ${bank || 'No especificado'}</p>
                            <p><strong>Número de cuenta:</strong> ${accountNumber || 'No especificado'}</p>
                            <p><strong>Titular:</strong> ${holder || 'No especificado'}</p>
                        `;
                        bankAccountsList.appendChild(accountElement);
                    });
                } else {
                    bankAccountsList.innerHTML = '<p>No hay datos bancarios disponibles.</p>';
                }
            } else {
                bankAccountsList.innerHTML = '<p>Tienda no encontrada.</p>';
            }
        } catch (error) {
            bankAccountsList.innerHTML = '<p>Error al cargar los datos bancarios.</p>';
        }
    }

    // Manejar cambio en método de pago
    document.querySelectorAll('input[name="payment"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            if (radio.value === 'transfer') {
                bankDetailsContainer.classList.remove('hidden');
                loadBankAccounts();
            } else {
                bankDetailsContainer.classList.add('hidden');
                bankAccountsList.innerHTML = '';
            }
        });
    });

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userDoc = doc(db, 'users', user.uid);
                const userSnapshot = await getDoc(userDoc);

                if (userSnapshot.exists()) {
                    const userData = userSnapshot.data();
                    userInfoContainer.innerHTML = `
                        <div class="client-info">
                            <h3>Perfil de Cliente</h3>
                            <p><strong>Nombre:</strong> ${userData.name || 'Sin nombre'}</p>
                            <p><strong>Teléfono:</strong> ${userData.phone || 'Sin teléfono'}</p>
                        </div>
                    `;
                } else {
                    userInfoContainer.innerHTML = `
                        <div class="register-client">
                            <h3>Completa tu perfil de cliente</h3>
                            <form id="registerClientForm">
                                <label for="name">Nombre:</label>
                                <input type="text" id="name" name="name" required>
                                <label for="phone">Teléfono:</label>
                                <input type="tel" id="phone" name="phone" required>
                                <button type="submit">Guardar Perfil</button>
                            </form>
                        </div>
                    `;

                    const registerClientForm = document.getElementById('registerClientForm');
                    registerClientForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const name = document.getElementById('name').value;
                        const phone = document.getElementById('phone').value;

                        try {
                            const userData = {
                                name,
                                phone,
                                createdAt: new Date().toISOString(),
                                email: user.email,
                            };
                            await setDoc(doc(db, 'users', user.uid), userData);
                            alert('¡Perfil de cliente creado exitosamente!');
                            window.location.reload();
                        } catch (error) {
                            alert('Error al guardar el perfil de cliente.');
                        }
                    });
                }
            } catch (error) {
                alert('Error al verificar el perfil de cliente.');
            }
        } else {
            alert('Por favor, inicia sesión para continuar.');
            window.location.href = '/login.html';
        }
    });

    // Cargar datos del carrito y sus productos
    async function loadCartProducts() {
        const productsData = [];
        for (const item of cart) {
            try {
                const productRef = doc(db, `stores/${storeId}/products`, item.productId);
                const productDoc = await getDoc(productRef);
                
                if (productDoc.exists()) {
                    const productData = productDoc.data();
                    productsData.push({
                        productId: item.productId,
                        name: productData.name,
                        price: productData.price,
                        quantity: item.quantity
                    });
                }
            } catch (error) {
                console.error('Error al cargar el producto:', error);
            }
        }
        return productsData;
    }

    // Mostrar los productos en el carrito
    async function displayCartProducts() {
        const productsData = await loadCartProducts();
        
        cartDetails.innerHTML = '';

        productsData.forEach(product => {
            const productElement = document.createElement('div');
            productElement.className = 'cart-item';
            productElement.innerHTML = `
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <p>Precio: $${product.price}</p>
                    <p>Cantidad: ${product.quantity}</p>
                </div>
                <div class="subtotal">
                    <p>Subtotal: $${(product.price * product.quantity).toFixed(2)}</p>
                </div>
            `;
            cartDetails.appendChild(productElement);
        });

        // Calcular y mostrar el total
        const total = productsData.reduce((sum, product) => 
            sum + (product.price * product.quantity), 0
        );
        
        const totalElement = document.createElement('div');
        totalElement.className = 'cart-total';
        totalElement.innerHTML = `
            <h3>Total: $${total.toFixed(2)}</h3>
        `;
        cartDetails.appendChild(totalElement);
    }

    // Inicializar la vista del carrito
    await displayCartProducts();

    const savedAddressesContainer = document.getElementById('saved-addresses');
    const addAddressBtn = document.getElementById('add-address-btn');
    const newAddressForm = document.getElementById('new-address-form');
    const addressForm = document.getElementById('addressForm');
    const getLocationBtn = document.getElementById('get-location-btn');
    const latitudeSpan = document.getElementById('latitude');
    const longitudeSpan = document.getElementById('longitude');

    let selectedAddress = null;
    let addresses = [];

    // Función para crear un elemento de dirección
    function createAddressElement(address, index) {
        const addressElement = document.createElement('div');
        addressElement.classList.add('address-item');
        addressElement.innerHTML = `
            <p><strong>Referencia:</strong> ${address.reference}</p>
            <p><strong>Coordenadas:</strong> ${address.latitude && address.longitude ? `${address.latitude}, ${address.longitude}` : 'No especificadas'}</p>
            <button class="select-address-btn" data-index="${index}">Seleccionar</button>
        `;
        return addressElement;
    }

    // Función para actualizar la vista de la dirección seleccionada
    function updateSelectedAddressView(address) {
        // Actualizar la vista de la dirección seleccionada
        const selectedAddressDiv = document.createElement('div');
        selectedAddressDiv.className = 'selected-address';
        selectedAddressDiv.innerHTML = `
            <p><strong>Dirección seleccionada:</strong></p>
            <p><strong>Referencia:</strong> ${address.reference}</p>
            <p><strong>Coordenadas:</strong> ${address.latitude && address.longitude ? `${address.latitude}, ${address.longitude}` : 'No especificadas'}</p>
            <button id="toggle-addresses-btn" class="btn">▼ Mostrar otras direcciones</button>
        `;
        
        // Crear contenedor para otras direcciones
        const otherAddressesDiv = document.createElement('div');
        otherAddressesDiv.id = 'other-addresses';
        otherAddressesDiv.style.display = 'none';

        // Limpiar y agregar nuevas direcciones
        otherAddressesDiv.innerHTML = '';
        addresses.forEach((addr, idx) => {
            if (addr !== address) {
                otherAddressesDiv.appendChild(createAddressElement(addr, idx));
            }
        });

        // Actualizar el contenedor principal
        savedAddressesContainer.innerHTML = '';
        savedAddressesContainer.appendChild(selectedAddressDiv);
        savedAddressesContainer.appendChild(otherAddressesDiv);

        // Configurar eventos
        setupAddressEvents();

        // Actualizar el botón de confirmar
        document.getElementById('confirm-btn').disabled = false;
    }

    // Configurar eventos de las direcciones
    function setupAddressEvents() {
        // Evento para el botón de toggle
        const toggleBtn = document.getElementById('toggle-addresses-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const otherAddressesDiv = document.getElementById('other-addresses');
                if (otherAddressesDiv.style.display === 'none') {
                    otherAddressesDiv.style.display = 'block';
                    toggleBtn.textContent = '▲ Ocultar otras direcciones';
                } else {
                    otherAddressesDiv.style.display = 'none';
                    toggleBtn.textContent = '▼ Mostrar otras direcciones';
                }
            });
        }

        // Evento delegado para los botones de selección
        savedAddressesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('select-address-btn')) {
                const index = parseInt(e.target.dataset.index);
                selectedAddress = addresses[index];
                updateSelectedAddressView(selectedAddress);
            }
        });
    }

    const loadSavedAddresses = async () => {
        try {
            const user = auth.currentUser;
            if (user) {
                const addressesRef = doc(db, 'users', user.uid);
                const userSnapshot = await getDoc(addressesRef);

                if (userSnapshot.exists()) {
                    const userData = userSnapshot.data();
                    addresses = userData.addresses || [];

                    if (addresses.length > 0) {
                        // Seleccionar la última dirección por defecto
                        selectedAddress = addresses[addresses.length - 1];
                        updateSelectedAddressView(selectedAddress);
                    } else {
                        savedAddressesContainer.innerHTML = '<p>No tienes direcciones guardadas.</p>';
                        document.getElementById('confirm-btn').disabled = true;
                    }
                }
            }
        } catch (error) {
            alert('Error al cargar las direcciones guardadas.');
            document.getElementById('confirm-btn').disabled = true;
        }
    };

    addAddressBtn.addEventListener('click', () => {
        newAddressForm.style.display = 'block';
    });

    getLocationBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                latitudeSpan.textContent = latitude.toFixed(6);
                longitudeSpan.textContent = longitude.toFixed(6);
            }, (error) => {
                alert('No se pudo obtener la ubicación. Por favor, verifica los permisos.');
            });
        } else {
            alert('La geolocalización no es compatible con este navegador.');
        }
    });

    addressForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const reference = document.getElementById('reference').value;
        const latitude = latitudeSpan.textContent;
        const longitude = longitudeSpan.textContent;

        try {
            const addressData = {
                reference,
                createdAt: new Date().toISOString(),
            };

            // Include latitude and longitude only if they are available
            if (latitude && longitude) {
                addressData.latitude = parseFloat(latitude);
                addressData.longitude = parseFloat(longitude);
            }

            const user = auth.currentUser;
            if (user) {
                const addressesRef = doc(db, 'users', user.uid);
                const userSnapshot = await getDoc(addressesRef);
                const userData = userSnapshot.exists() ? userSnapshot.data() : {};
                const addresses = userData.addresses || [];
                addresses.push(addressData);

                await setDoc(addressesRef, { ...userData, addresses }, { merge: true });
                alert('¡Dirección guardada exitosamente!');
                window.location.reload();
            }
        } catch (error) {
            alert('Error al guardar la dirección.');
        }
    });

    loadSavedAddresses();

    const confirmBtn = document.getElementById('confirm-btn');

    confirmBtn.addEventListener('click', async () => {
        if (!selectedAddress) {
            alert('Por favor, selecciona una dirección de entrega.');
            return;
        }

        const selectedPaymentMethod = document.querySelector('input[name="payment"]:checked');
        if (!selectedPaymentMethod) {
            alert('Por favor, selecciona un método de pago.');
            return;
        }

        if (cart.length === 0) {
            alert('El carrito está vacío. Agrega productos antes de confirmar el pedido.');
            return;
        }

        try {
            const userDoc = doc(db, 'users', auth.currentUser.uid);
            const userSnapshot = await getDoc(userDoc);

            if (!userSnapshot.exists()) {
                alert('No se pudo obtener la información del cliente. Por favor, completa tu perfil.');
                return;
            }

            const userData = userSnapshot.data();
            const clientName = userData.name || 'Sin nombre';

            const orderData = {
                userId: auth.currentUser.uid,
                storeDocId: storeId,
                items: cart,
                total: cart.reduce((sum, item) => sum + item.quantity * item.price, 0),
                address: selectedAddress,
                paymentMethod: selectedPaymentMethod.value,
                clientName: clientName,
                createdAt: new Date().toISOString(),
            };

            await addDoc(collection(db, 'orders'), orderData);

            alert('¡Pedido confirmado! Gracias por tu compra.');

            localStorage.removeItem(cartKey);
            window.location.href = '/my-orders.html';
        } catch (error) {
            alert('Hubo un error al confirmar tu pedido. Por favor, inténtalo de nuevo.');
        }
    });
});