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

    if (cart.length === 0) {
        cartDetails.innerHTML = '<p>El carrito está vacío.</p>';
    } else {
        let totalGeneral = 0;

        for (const item of cart) {
            try {
                const productDoc = await getDoc(doc(db, `stores/${storeId}/products`, item.productId));
                if (productDoc.exists()) {
                    const product = productDoc.data();
                    const subtotal = product.price * item.quantity;
                    totalGeneral += subtotal;

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
                alert('Error al obtener los datos del producto.');
            }
        }

        const totalElement = document.createElement('div');
        totalElement.classList.add('cart-total');
        totalElement.innerHTML = `
            <p><strong>Total General:</strong> $${totalGeneral.toFixed(2)}</p>
        `;
        cartDetails.appendChild(totalElement);
    }

    const savedAddressesContainer = document.getElementById('saved-addresses');
    const addAddressBtn = document.getElementById('add-address-btn');
    const newAddressForm = document.getElementById('new-address-form');
    const addressForm = document.getElementById('addressForm');
    const getLocationBtn = document.getElementById('get-location-btn');
    const latitudeSpan = document.getElementById('latitude');
    const longitudeSpan = document.getElementById('longitude');

    let selectedAddress = null;

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

        if (!latitude || !longitude) {
            alert('Por favor, obtén las coordenadas antes de guardar la dirección.');
            return;
        }

        try {
            const addressData = {
                reference,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                createdAt: new Date().toISOString(),
            };

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

    const loadSavedAddresses = async () => {
        try {
            const user = auth.currentUser;
            if (user) {
                const addressesRef = doc(db, 'users', user.uid);
                const userSnapshot = await getDoc(addressesRef);

                if (userSnapshot.exists()) {
                    const userData = userSnapshot.data();
                    const addresses = userData.addresses || [];

                    if (addresses.length > 0) {
                        const lastAddress = addresses[addresses.length - 1];
                        selectedAddress = lastAddress;

                        savedAddressesContainer.innerHTML = `
                            <div class="selected-address">
                                <p><strong>Dirección seleccionada:</strong></p>
                                <p><strong>Referencia:</strong> ${lastAddress.reference}</p>
                                <p><strong>Coordenadas:</strong> ${lastAddress.latitude}, ${lastAddress.longitude}</p>
                                <button id="toggle-addresses-btn" class="btn">▼ Mostrar otras direcciones</button>
                            </div>
                            <div id="other-addresses" style="display: none;">
                                <!-- Aquí se mostrarán las demás direcciones -->
                            </div>
                        `;

                        const toggleAddressesBtn = document.getElementById('toggle-addresses-btn');
                        const otherAddressesContainer = document.getElementById('other-addresses');

                        toggleAddressesBtn.addEventListener('click', () => {
                            if (otherAddressesContainer.style.display === 'none') {
                                otherAddressesContainer.style.display = 'block';
                                toggleAddressesBtn.textContent = '▲ Ocultar otras direcciones';
                            } else {
                                otherAddressesContainer.style.display = 'none';
                                toggleAddressesBtn.textContent = '▼ Mostrar otras direcciones';
                            }
                        });

                        addresses.slice(0, -1).forEach((address, index) => {
                            const addressElement = document.createElement('div');
                            addressElement.classList.add('address-item');
                            addressElement.innerHTML = `
                                <p><strong>Referencia:</strong> ${address.reference}</p>
                                <p><strong>Coordenadas:</strong> ${address.latitude}, ${address.longitude}</p>
                                <button class="select-address-btn" data-index="${index}">Seleccionar</button>
                            `;
                            otherAddressesContainer.appendChild(addressElement);
                        });

                        document.querySelectorAll('.select-address-btn').forEach((btn) => {
                            btn.addEventListener('click', (e) => {
                                const index = e.target.dataset.index;
                                selectedAddress = addresses[index];
                                window.location.reload();
                            });
                        });
                    } else {
                        savedAddressesContainer.innerHTML = '<p>No tienes direcciones guardadas.</p>';
                    }
                }
            }
        } catch (error) {
            alert('Error al cargar las direcciones guardadas.');
        }
    };

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