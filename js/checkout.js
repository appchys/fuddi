import { getFirestore, doc, getDoc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { app, auth } from './firebase-config.js';

const db = getFirestore(app);
const storage = getStorage(app);

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

    let selectedFile = null; // Almacenar el archivo seleccionado

    // Cargar datos bancarios de la tienda
    async function loadBankAccounts(selectedBank = null) {
        try {
            const storeRef = doc(db, 'stores', storeId);
            const storeDoc = await getDoc(storeRef);

            if (storeDoc.exists()) {
                const storeData = storeDoc.data();
                const bankAccounts = storeData.bankAccounts || [];

                bankAccountsList.innerHTML = '';

                if (bankAccounts.length > 0) {
                    // Crear un <select> con los bancos
                    const select = document.createElement('select');
                    select.id = 'bank-select';
                    select.style = 'width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 16px;';
                    select.innerHTML = '<option value="">Selecciona un banco</option>';

                    bankAccounts.forEach((account, index) => {
                        const option = document.createElement('option');
                        option.value = index;
                        option.textContent = account.bank || 'Banco no especificado';
                        if (selectedBank === index.toString()) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });

                    bankAccountsList.appendChild(select);

                    // Mostrar detalles del banco seleccionado (si hay uno)
                    if (selectedBank !== null && bankAccounts[selectedBank]) {
                        const account = bankAccounts[selectedBank];
                        const accountElement = document.createElement('div');
                        accountElement.style = 'border: 1px solid #e5e7eb; padding: 16px; border-radius: 6px; margin-bottom: 16px;';
                        accountElement.innerHTML = `
                            <p><strong>Banco:</strong> ${account.bank || 'No especificado'}</p>
                            <p><strong>Número de cuenta:</strong> ${account.accountNumber || 'No especificado'}</p>
                            <p><strong>Titular:</strong> ${account.holder || 'No especificado'}</p>
                        `;
                        bankAccountsList.appendChild(accountElement);
                    }

                    // Añadir input para subir comprobante
                    const fileInputContainer = document.createElement('div');
                    fileInputContainer.style = 'margin-top: 16px;';
                    fileInputContainer.innerHTML = `
                        <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 8px;">Subir comprobante de pago:</label>
                        <input type="file" id="payment-proof" accept="image/*,application/pdf" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
                        <p id="file-status" style="margin-top: 8px; color: #374151;"></p>
                    `;
                    bankAccountsList.appendChild(fileInputContainer);

                    // Añadir evento change al select
                    select.addEventListener('change', () => {
                        const selectedIndex = select.value;
                        loadBankAccounts(selectedIndex);
                    });

                    // Añadir evento change al input de archivo
                    const fileInput = document.getElementById('payment-proof');
                    fileInput.addEventListener('change', (e) => {
                        selectedFile = e.target.files[0];
                        const fileStatus = document.getElementById('file-status');
                        if (selectedFile) {
                            fileStatus.textContent = `Archivo seleccionado: ${selectedFile.name}`;
                            document.getElementById('confirm-btn').disabled = false;
                        } else {
                            fileStatus.textContent = 'No se ha seleccionado ningún archivo.';
                            document.getElementById('confirm-btn').disabled = true;
                        }
                    });
                } else {
                    bankAccountsList.innerHTML = '<p style="color: #374151;">No hay datos bancarios disponibles.</p>';
                    document.getElementById('confirm-btn').disabled = true;
                }
            } else {
                bankAccountsList.innerHTML = '<p style="color: #374151;">Tienda no encontrada.</p>';
                document.getElementById('confirm-btn').disabled = true;
            }
        } catch (error) {
            console.error('Error al cargar los datos bancarios:', error);
            bankAccountsList.innerHTML = '<p style="color: #b91c1c;">Error al cargar los datos bancarios.</p>';
            document.getElementById('confirm-btn').disabled = true;
        }
    }

    // Manejar cambio en método de pago
    document.querySelectorAll('input[name="payment"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            if (radio.value === 'transfer') {
                bankDetailsContainer.classList.remove('hidden');
                loadBankAccounts(); // Cargar bancos sin selección inicial
                document.getElementById('confirm-btn').disabled = true; // Deshabilitar hasta que se suba un archivo
            } else {
                bankDetailsContainer.classList.add('hidden');
                bankAccountsList.innerHTML = '';
                selectedFile = null; // Limpiar archivo seleccionado
                document.getElementById('confirm-btn').disabled = false; // Habilitar para otros métodos
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
                        <div style="padding: 16px;">
                            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 12px;">Perfil de Cliente</h3>
                            <p><strong>Nombre:</strong> ${userData.name || 'Sin nombre'}</p>
                            <p><strong>Teléfono:</strong> ${userData.phone || 'Sin teléfono'}</p>
                        </div>
                    `;
                } else {
                    userInfoContainer.innerHTML = `
                        <div style="background-color: #fff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 8px; padding: 24px;">
                            <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 16px;">Completa tu perfil de cliente</h3>
                            <form id="registerClientForm" style="display: flex; flex-direction: column; gap: 16px;">
                                <div>
                                    <label for="name" style="display: block; font-size: 0.875rem; font-weight: 500; color: #374151;">Nombre:</label>
                                    <input type="text" id="name" name="name" required 
                                           style="margin-top: 4px; width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); outline: none; transition: border-color 0.2s;">
                                </div>
                                <div>
                                    <label for="phone" style="display: block; font-size: 0.875rem; font-weight: 500; color: #374151;">Teléfono:</label>
                                    <input type="tel" id="phone" name="phone" required 
                                           style="margin-top: 4px; width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); outline: none; transition: border-color 0.2s;">
                                </div>
                                <button type="submit" 
                                        style="width: 200px; padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; transition: background-color 0.2s;">
                                    Guardar Perfil
                                </button>
                            </form>
                        </div>
                    `;

                    const registerClientForm = document.getElementById('registerClientForm');
                    registerClientForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const name = document.getElementById('name').value.trim();
                        const phone = document.getElementById('phone').value.trim();
                        const submitButton = registerClientForm.querySelector('button[type="submit"]');

                        if (!name || name.length < 2) {
                            alert('Por favor, ingresa un nombre válido (mínimo 2 caracteres).');
                            return;
                        }

                        const phoneRegex = /^\d{7,15}$/;
                        if (!phoneRegex.test(phone)) {
                            alert('Por favor, ingresa un número de teléfono válido (7-15 dígitos, solo números).');
                            return;
                        }

                        submitButton.disabled = true;
                        submitButton.textContent = 'Guardando...';

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
                            console.error('Error al guardar el perfil de cliente:', error);
                            alert(`Error al guardar el perfil: ${error.message}`);
                        } finally {
                            submitButton.disabled = false;
                            submitButton.textContent = 'Guardar Perfil';
                        }
                    });
                }
            } catch (error) {
                console.error('Error al verificar el perfil de cliente:', error);
                alert(`Error al verificar el perfil: ${error.message}`);
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
        const selectedAddressDiv = document.createElement('div');
        selectedAddressDiv.className = 'selected-address';
        selectedAddressDiv.innerHTML = `
            <p><strong>Dirección seleccionada:</strong></p>
            <p><strong>Referencia:</strong> ${address.reference}</p>
            <p><strong>Coordenadas:</strong> ${address.latitude && address.longitude ? `${address.latitude}, ${address.longitude}` : 'No especificadas'}</p>
            <button id="toggle-addresses-btn" class="btn">▼ Mostrar otras direcciones</button>
        `;

        const otherAddressesDiv = document.createElement('div');
        otherAddressesDiv.id = 'other-addresses';
        otherAddressesDiv.style.display = 'none';

        otherAddressesDiv.innerHTML = '';
        addresses.forEach((addr, idx) => {
            if (addr !== address) {
                otherAddressesDiv.appendChild(createAddressElement(addr, idx));
            }
        });

        savedAddressesContainer.innerHTML = '';
        savedAddressesContainer.appendChild(selectedAddressDiv);
        savedAddressesContainer.appendChild(otherAddressesDiv);

        setupAddressEvents();

        document.getElementById('confirm-btn').disabled = selectedFile === null && document.querySelector('input[name="payment"]:checked')?.value === 'transfer';
    }

    // Configurar eventos de las direcciones
    function setupAddressEvents() {
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
                        selectedAddress = addresses[addresses.length - 1];
                        updateSelectedAddressView(selectedAddress);
                    } else {
                        savedAddressesContainer.innerHTML = '<p style="color: #374151;">No tienes direcciones guardadas.</p>';
                        document.getElementById('confirm-btn').disabled = true;
                    }
                }
            }
        } catch (error) {
            console.error('Error al cargar las direcciones guardadas:', error);
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
            console.error('Error al guardar la dirección:', error);
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

        // Validar selección de banco y comprobante si el método es transferencia
        if (selectedPaymentMethod.value === 'transfer') {
            const bankSelect = document.getElementById('bank-select');
            if (!bankSelect || bankSelect.value === '') {
                alert('Por favor, selecciona un banco para la transferencia.');
                return;
            }
            if (!selectedFile) {
                alert('Por favor, sube un comprobante de pago para la transferencia.');
                return;
            }
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

            // Subir el comprobante a Firebase Storage si existe
            let paymentProofUrl = null;
            if (selectedPaymentMethod.value === 'transfer' && selectedFile) {
                const storageRef = ref(storage, `comprobantes/${auth.currentUser.uid}/${Date.now()}_${selectedFile.name}`);
                await uploadBytes(storageRef, selectedFile);
                paymentProofUrl = await getDownloadURL(storageRef);
            }

            const orderData = {
                userId: auth.currentUser.uid,
                storeDocId: storeId,
                items: cart,
                total: cart.reduce((sum, item) => sum + item.quantity * item.price, 0),
                address: selectedAddress,
                paymentMethod: selectedPaymentMethod.value,
                clientName: clientName,
                createdAt: new Date().toISOString(),
                status: 'pendiente',
                paymentProofUrl: paymentProofUrl, // Incluir la URL del comprobante
                bankIndex: selectedPaymentMethod.value === 'transfer' ? parseInt(document.getElementById('bank-select').value) : null,
            };

            await addDoc(collection(db, 'orders'), orderData);

            alert('¡Pedido confirmado! Gracias por tu compra.');

            localStorage.removeItem(cartKey);
            window.location.href = '/my-orders.html';
        } catch (error) {
            console.error('Error al confirmar el pedido:', error);
            alert(`Hubo un error al confirmar tu pedido: ${error.message}`);
        }
    });
});