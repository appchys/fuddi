import { getFirestore, doc, getDoc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app } from './firebase-config.js';

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Función para verificar si el usuario existe en Firestore
async function checkUserExists(userId) {
    const userDoc = doc(db, 'users', userId);
    const userSnapshot = await getDoc(userDoc);
    if (userSnapshot.exists()) {
        return { exists: true, type: 'client', data: userSnapshot.data() };
    }

    const storeDoc = doc(db, 'stores', userId);
    const storeSnapshot = await getDoc(storeDoc);
    if (storeSnapshot.exists()) {
        return { exists: true, type: 'store', data: storeSnapshot.data() };
    }

    return { exists: false };
}

// Función para actualizar la vista según el estado de autenticación
async function updateView(user) {
    const userContainer = document.getElementById('user-info-container');
    if (!user || !userContainer) return;

    try {
        const userCheck = await checkUserExists(user.uid);
        if (!userCheck.exists) {
            userContainer.innerHTML = `
                <form id="userForm" class="profile-form">
                    <div class="form-group">
                        <label for="name"><i class="bi bi-person"></i> Nombre</label>
                        <input type="text" id="name" name="name" required placeholder="Tu nombre completo">
                    </div>
                    <div class="form-group">
                        <label for="phone"><i class="bi bi-telephone"></i> Celular</label>
                        <input type="tel" id="phone" name="phone" required placeholder="Ej: 091234567">
                    </div>
                    <button type="submit" class="btn primary" style="width:100%;margin-top:10px;">
                        <i class="bi bi-save2"></i> Guardar Perfil
                    </button>
                </form>
            `;
        } else {
            const userData = userCheck.data;
            userContainer.innerHTML = `
                <div class="user-data">
                    <p><strong>Nombre:</strong> ${userData.name}</p>
                    <p><strong>Teléfono:</strong> ${userData.phone}</p>
                    <p><strong>Email:</strong> ${userData.email}</p>
                </div>
            `;
        }

        // Agregar listener al formulario si existe
        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = e.target.querySelector('button[type="submit"]');
                
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = 'Guardando...';
                }

                try {
                    const name = document.getElementById('name').value;
                    const phone = document.getElementById('phone').value;
                    const userData = {
                        name,
                        phone,
                        createdAt: new Date().toISOString(),
                        email: user.email,
                    };
                    await setDoc(doc(db, 'users', user.uid), userData);
                    alert('¡Perfil de cliente creado exitosamente!');
                    
                    // Actualizar la vista con los datos guardados
                    if (userContainer) {
                        userContainer.innerHTML = `
                            <div class="user-data">
                                <p><strong>Nombre:</strong> ${name}</p>
                                <p><strong>Teléfono:</strong> ${phone}</p>
                                <p><strong>Email:</strong> ${user.email}</p>
                            </div>
                        `;
                    }
                } catch (error) {
                    console.error('Error al guardar el perfil de cliente:', error);
                    alert(`Error al guardar el perfil: ${error.message}`);
                } finally {
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'Guardar Perfil';
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error al actualizar la vista:', error);
    }
}

// Función para iniciar sesión con Google
window.loginWithGoogle = async function () {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        updateView(user);
    } catch (error) {
        console.error('Error al iniciar sesión con Google:', error.message);
        alert('Error al iniciar sesión: ' + error.message);
    }
};

// Función para cargar los datos del carrito
async function initialize() {
    try {
        // Obtener el ID de la tienda de la URL
        const params = new URLSearchParams(window.location.search);
        const storeId = params.get('storeId');
        console.log('ID de tienda obtenido:', storeId);

        if (!storeId) {
            console.error('No se proporcionó un ID de tienda válido');
            alert('No se proporcionó un ID de tienda válido.');
            return;
        }

        // Verificar si hay un usuario actualmente logueado
        const user = auth.currentUser;
        if (user) {
            updateView(user);
        }

        // Agregar listener para cambios de autenticación
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                updateView(user);
                // Ocultar el botón de Google cuando el usuario está logueado
                const googleLoginSection = document.querySelector('.google-login-section');
                if (googleLoginSection) {
                    googleLoginSection.classList.add('hidden');
                }
            } else {
                // Si no hay usuario, mostrar solo el botón de Google
                const userContainer = document.getElementById('user-info-container');
                if (userContainer) {
                    userContainer.innerHTML = '';
                }
                // Mostrar el botón de Google cuando no hay usuario
                const googleLoginSection = document.querySelector('.google-login-section');
                if (googleLoginSection) {
                    googleLoginSection.classList.remove('hidden');
                }
            }
        });

        // Cargar datos del carrito y sus productos
        const cartKey = `cart_${storeId}`;
        const cart = JSON.parse(localStorage.getItem(cartKey)) || [];
        const cartDetails = document.getElementById('cart-details');
        const userInfoContainer = document.getElementById('user-info-container');
        const bankDetailsContainer = document.getElementById('bank-details');
        const bankAccountsList = document.getElementById('bank-accounts-list');

        cartDetails.innerHTML = '';
        let selectedFile = null;

        // Función para cargar datos bancarios
        async function loadBankAccounts(selectedBank = null) {
            try {
                console.log('Intentando cargar datos bancarios...');
                console.log('ID de tienda:', storeId);
        
                const storeRef = doc(db, 'stores', storeId);
                console.log('Referencia a la tienda:', storeRef.path);
        
                const storeDoc = await getDoc(storeRef);
                console.log('Resultado de getDoc:', storeDoc.exists());
        
                if (storeDoc.exists()) {
                    const storeData = storeDoc.data();
                    console.log('Datos de la tienda:', JSON.stringify(storeData));
                    
                    if (!Array.isArray(storeData.bankAccounts)) {
                        console.error('Los datos bancarios no están en formato array');
                        bankAccountsList.innerHTML = '<p style="color: #b91c1c;">Formato de datos bancarios incorrecto.</p>';
                        document.getElementById('confirm-btn').disabled = true;
                        return;
                    }
        
                    const bankAccounts = storeData.bankAccounts;
                    console.log('Cuentas bancarias:', bankAccounts);
        
                    bankAccountsList.innerHTML = '';
        
                    if (bankAccounts.length > 0) {
                        console.log('Encontradas', bankAccounts.length, 'cuentas bancarias');
                        
                        // Crear select con los bancos
                        const select = document.createElement('select');
                        select.id = 'bank-select';
                        select.style = 'width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 16px;';
                        select.innerHTML = '<option value="">Selecciona un banco</option>';
        
                        bankAccounts.forEach((account, index) => {
                            console.log('Agregando cuenta:', account);
                            const option = document.createElement('option');
                            option.value = index;
                            option.textContent = account.bank || 'Banco no especificado';
                            if (selectedBank === index.toString()) {
                                option.selected = true;
                            }
                            select.appendChild(option);
                        });
        
                        bankAccountsList.appendChild(select);
        
                        // Mostrar detalles del banco seleccionado
                        if (selectedBank !== null && bankAccounts[selectedBank]) {
                            const account = bankAccounts[selectedBank];
                            console.log('Mostrando detalles del banco:', account);
                            
                            const accountElement = document.createElement('div');
                            accountElement.style = 'border: 1px solid #e5e7eb; padding: 16px; border-radius: 6px; margin-bottom: 16px;';
                            accountElement.innerHTML = `
                                <p><strong>Banco:</strong> ${account.bank || 'No especificado'}</p>
                                <p><strong>Número de cuenta:</strong> ${account.accountNumber || 'No especificado'}</p>
                                <p><strong>Titular:</strong> ${account.holder || 'No especificado'}</p>
                            `;
                            bankAccountsList.appendChild(accountElement);
        
                            // Añadir input para subir comprobante
                            const fileInputContainer = document.createElement('div');
                            fileInputContainer.style = 'margin-top: 16px;';
                            fileInputContainer.innerHTML = `
                                <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 8px;">Subir comprobante de pago:</label>
                                <input type="file" id="payment-proof" accept="image/*,application/pdf" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
                                <p id="file-status" style="margin-top: 8px; color: #374151;"></p>
                            `;
                            bankAccountsList.appendChild(fileInputContainer);
        
                            // Event listener para el input de archivo
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
                        }
        
                        // Event listener para el select
                        select.addEventListener('change', async (e) => {
                            const selectedIndex = e.target.value;
                            if (selectedIndex) {
                                await loadBankAccounts(selectedIndex);
                            }
                        });
                    } else {
                        console.log('No se encontraron cuentas bancarias');
                        bankAccountsList.innerHTML = '<p style="color: #b91c1c;">No hay cuentas bancarias disponibles.</p>';
                        document.getElementById('confirm-btn').disabled = true;
                    }
                } else {
                    console.error('No se encontró la tienda con ID:', storeId);
                    bankAccountsList.innerHTML = '<p style="color: #b91c1c;">Tienda no encontrada.</p>';
                    document.getElementById('confirm-btn').disabled = true;
                }
            } catch (error) {
                console.error('Error al cargar los datos bancarios:', error);
                bankAccountsList.innerHTML = '<p style="color: #b91c1c;">Error al cargar los datos bancarios.</p>';
                document.getElementById('confirm-btn').disabled = true;
            }
        }

        // Manejar cambio en método de pago
        const paymentRadios = document.querySelectorAll('input[name="payment"]');
        console.log('Radios de pago encontrados:', paymentRadios.length);
        
        paymentRadios.forEach((radio) => {
            console.log('Agregando listener a:', radio.value);
            radio.addEventListener('change', async () => {
                console.log('Cambio en método de pago detectado');
                const selectedPaymentMethod = document.querySelector('input[name="payment"]:checked');
                if (selectedPaymentMethod.value.toLowerCase() === 'transferencia') {
                    console.log('Método de pago transferencia seleccionado');
                    bankDetailsContainer.classList.remove('hidden');
                    console.log('Cargando datos bancarios...');
                    try {
                        await loadBankAccounts();
                        console.log('Datos bancarios cargados exitosamente');
                    } catch (error) {
                        console.error('Error al cargar datos bancarios:', error);
                    }
                    document.getElementById('confirm-btn').disabled = true;
                } else {
                    console.log('Método de pago transferencia deseleccionado');
                    bankDetailsContainer.classList.add('hidden');
                    bankAccountsList.innerHTML = '';
                    selectedFile = null;
                    document.getElementById('confirm-btn').disabled = false;
                }
            });
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

            const storeRef = doc(db, 'stores', storeId);
            const storeDoc = await getDoc(storeRef);
            
            if (!storeDoc.exists()) {
                console.error('No se encontró la tienda:', storeId);
                return;
            }

            const storeData = storeDoc.data();
            const shipping = storeData.shippingFee || 0;

            let subtotalTotal = 0;
            productsData.forEach(product => {
                const productSubtotal = product.price * product.quantity;
                subtotalTotal += productSubtotal;

                const productElement = document.createElement('div');
                productElement.className = 'cart-item';
                productElement.innerHTML = `
                    <div class="product-info">
                        <h3>${product.name}</h3>
                        <p>Precio: $${product.price}</p>
                        <p>Cantidad: ${product.quantity}</p>
                    </div>
                    <div class="subtotal">
                        <p>$${productSubtotal.toFixed(2)}</p>
                    </div>
                `;
                cartDetails.appendChild(productElement);
            });

            const subtotalElement = document.getElementById('subtotal');
            if (subtotalElement) {
                subtotalElement.textContent = `$${subtotalTotal.toFixed(2)}`;
            }

            const shippingElement = document.getElementById('shipping');
            if (shippingElement) {
                shippingElement.textContent = `$${shipping.toFixed(2)}`;
            }

            const totalElement = document.getElementById('total');
            if (totalElement) {
                const total = subtotalTotal + shipping;
                totalElement.textContent = `$${total.toFixed(2)}`;
            }
        }

        // Inicializar la vista del carrito
        await displayCartProducts();

        // Direcciones
        const savedAddressesContainer = document.getElementById('saved-addresses');
        const addAddressBtn = document.getElementById('add-address-btn');
        const newAddressForm = document.getElementById('new-address-form');
        const addressForm = document.getElementById('addressForm');
        const getLocationBtn = document.getElementById('get-location-btn');
        const latitudeSpan = document.getElementById('latitude');
        const longitudeSpan = document.getElementById('longitude');

        let selectedAddress = null;
        let addresses = [];

        // Función para cargar direcciones guardadas del usuario
        async function loadSavedAddresses() {
            try {
                const user = auth.currentUser;
                if (!user) return;

                const userDoc = doc(db, 'users', user.uid);
                const userSnapshot = await getDoc(userDoc);
                
                if (userSnapshot.exists()) {
                    const userData = userSnapshot.data();
                    addresses = userData.addresses || [];
                    
                    if (addresses.length > 0) {
                        selectedAddress = addresses[addresses.length - 1]; // Seleccionar la última dirección por defecto
                        updateSelectedAddressView(selectedAddress);
                    } else {
                        savedAddressesContainer.innerHTML = '<p style="color: #374151;">No tienes direcciones guardadas.</p>';
                    }
                }
            } catch (error) {
                console.error('Error al cargar las direcciones guardadas:', error);
                savedAddressesContainer.innerHTML = '<p style="color: #b91c1c;">Error al cargar las direcciones guardadas.</p>';
            }
        }

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

            const toggleBtn = document.getElementById('toggle-addresses-btn');
            toggleBtn.addEventListener('click', () => {
                const otherAddresses = document.getElementById('other-addresses');
                otherAddresses.style.display = otherAddresses.style.display === 'none' ? 'block' : 'none';
                toggleBtn.textContent = otherAddresses.style.display === 'none' ? '▼ Mostrar otras direcciones' : '▲ Ocultar otras direcciones';
            });
        }

        // Event listeners
        if (addAddressBtn) {
            addAddressBtn.addEventListener('click', () => {
                newAddressForm.classList.remove('hidden');
            });
        }

        if (getLocationBtn) {
            getLocationBtn.addEventListener('click', async () => {
                try {
                    const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject);
                    });
                    latitudeSpan.textContent = position.coords.latitude.toFixed(6);
                    longitudeSpan.textContent = position.coords.longitude.toFixed(6);
                } catch (error) {
                    console.error('Error al obtener la ubicación:', error);
                    alert('No se pudo obtener tu ubicación. Por favor, ingresa las coordenadas manualmente.');
                }
            });
        }

        if (addressForm) {
            addressForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const reference = document.getElementById('reference').value;
                const latitude = latitudeSpan.textContent;
                const longitude = longitudeSpan.textContent;

                if (!reference) {
                    alert('Por favor, ingresa una referencia para la dirección.');
                    return;
                }

                if (!latitude || !longitude) {
                    alert('Por favor, ingresa las coordenadas (latitud y longitud).');
                    return;
                }

                const newAddress = {
                    reference,
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    createdAt: new Date().toISOString()
                };

                addresses.push(newAddress);
                selectedAddress = newAddress;

                try {
                    const user = auth.currentUser;
                    if (user) {
                        const userDoc = doc(db, 'users', user.uid);
                        await setDoc(userDoc, { addresses }, { merge: true });
                        alert('¡Dirección guardada exitosamente!');
                    }
                } catch (error) {
                    console.error('Error al guardar la dirección:', error);
                    alert('Error al guardar la dirección. La dirección se guardará localmente.');
                }

                updateSelectedAddressView(selectedAddress);
                newAddressForm.classList.add('hidden');
                addressForm.reset();
                latitudeSpan.textContent = '0.000000';
                longitudeSpan.textContent = '0.000000';
            });
        }

        // Event listener para seleccionar una dirección existente
        savedAddressesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('select-address-btn')) {
                const index = parseInt(e.target.dataset.index);
                selectedAddress = addresses[index];
                updateSelectedAddressView(selectedAddress);
            }
        });

        // Cargar direcciones guardadas al inicio
        await loadSavedAddresses();

        // Confirmar pedido
        const confirmBtn = document.getElementById('confirm-btn');
        if (confirmBtn) {
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

                if (selectedPaymentMethod.value === 'transferencia' && !selectedFile) {
                    alert('Por favor, sube un comprobante de pago para transferencia.');
                    return;
                }

                // Obtener tipo de entrega y calcular fecha/hora
                const deliveryType = document.querySelector('input[name="deliveryTime"]:checked').value;
                let scheduledDate = '';
                let scheduledTime = '';

                if (deliveryType === 'asap') {
                    // Entrega inmediata: sumar 30 minutos a la hora actual
                    const now = new Date();
                    now.setMinutes(now.getMinutes() + 30);
                    scheduledDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
                    scheduledTime = now.toTimeString().slice(0, 5); // HH:mm
                } else {
                    // Programada: tomar los valores del formulario
                    scheduledDate = scheduledDateInput.value;
                    scheduledTime = scheduledTimeInput.value;
                    if (!scheduledDate || !scheduledTime) {
                        alert('Por favor, selecciona el día y la hora para la entrega programada.');
                        return;
                    }
                }

                try {
                    // Subir comprobante si es transferencia
                    let paymentProofUrl = null;
                    if (selectedPaymentMethod.value === 'transferencia' && selectedFile) {
                        const storageRef = ref(storage, `payment-proofs/${Date.now()}_${selectedFile.name}`);
                        await uploadBytes(storageRef, selectedFile);
                        paymentProofUrl = await getDownloadURL(storageRef);
                    }

                    // Crear el pedido
                    const orderData = {
                        storeId,
                        userId: auth.currentUser.uid,
                        products: cart,
                        total: parseFloat(document.getElementById('total').textContent.replace('$', '')),
                        shippingAddress: selectedAddress,
                        paymentMethod: selectedPaymentMethod.value,
                        paymentProofUrl,
                        bankIndex: selectedPaymentMethod.value === 'transferencia' ? parseInt(document.getElementById('bank-select').value) : null,
                        status: 'pending',
                        createdAt: new Date().toISOString(),
                        deliveryType,         // "asap" o "scheduled"
                        scheduledDate,        // YYYY-MM-DD
                        scheduledTime         // HH:mm
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
        }

        // Mostrar/ocultar campos de entrega programada
        const deliveryTimeRadios = document.querySelectorAll('input[name="deliveryTime"]');
        const scheduledFields = document.getElementById('scheduled-delivery-fields');
        const scheduledDateInput = document.getElementById('scheduled-date');
        const scheduledTimeInput = document.getElementById('scheduled-time');

        // Setear fecha mínima (hoy) para el input de fecha
        if (scheduledDateInput) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            scheduledDateInput.min = `${yyyy}-${mm}-${dd}`;
        }

        function updateScheduledFields() {
            const selected = document.querySelector('input[name="deliveryTime"]:checked');
            if (selected && selected.value === 'scheduled') {
                scheduledFields.classList.remove('hidden');
            } else {
                scheduledFields.classList.add('hidden');
            }
        }

        deliveryTimeRadios.forEach(radio => {
            radio.addEventListener('change', updateScheduledFields);
        });
        updateScheduledFields();
    } catch (error) {
        console.error('Error al inicializar:', error);
        alert('Error al inicializar la página. Por favor, recarga la página.');
    }
}

// Inicializar la página
document.addEventListener('DOMContentLoaded', initialize);