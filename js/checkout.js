import { getFirestore, doc, getDoc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app } from './firebase-config.js';
import { GOOGLE_MAPS_API_KEY } from './config.js';

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

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
                        <label for="phone"><i class="bi bi-whatsapp"></i> Whatsapp</label>
                        <input type="tel" id="phone" name="phone" required placeholder="Ej: 091234567">
                        <small style="display:block;color:#666;font-size:0.92em;margin-top:4px;">
                            Importante, lo usaremos para coordinar la entrega
                        </small>
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
                    <p><strong>Whatsapp:</strong> ${userData.phone}</p>
                </div>
            `;
        }

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
                    const phoneRegex = /^\d{8,12}$/;
                    if (!phoneRegex.test(phone)) {
                        alert('Por favor, ingresa un número de teléfono válido (8-12 dígitos).');
                        submitButton.disabled = false;
                        submitButton.textContent = 'Guardar Perfil';
                        return;
                    }
                    const userData = {
                        name,
                        phone,
                        createdAt: new Date().toISOString(),
                        email: user.email,
                    };
                    await setDoc(doc(db, 'users', user.uid), userData);
                    Toastify({
                        text: '¡Perfil de cliente creado exitosamente!',
                        duration: 3000,
                        gravity: 'top',
                        position: 'right',
                        backgroundColor: '#16a34a',
                    }).showToast();
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

async function initialize() {
    try {
        const params = new URLSearchParams(window.location.search);
        const storeId = params.get('storeId');
        if (!storeId) {
            alert('No se proporcionó un ID de tienda válido.');
            return;
        }

        const user = auth.currentUser;
        if (user) {
            updateView(user);
        }

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                updateView(user);
                const googleLoginSection = document.querySelector('.google-login-section');
                if (googleLoginSection) {
                    googleLoginSection.classList.add('hidden');
                }
            } else {
                const userContainer = document.getElementById('user-info-container');
                if (userContainer) {
                    userContainer.innerHTML = '';
                }
                const googleLoginSection = document.querySelector('.google-login-section');
                if (googleLoginSection) {
                    googleLoginSection.classList.remove('hidden');
                }
            }
        });

        const cartKey = `cart_${storeId}`;
        const cart = JSON.parse(localStorage.getItem(cartKey)) || [];
        const cartDetails = document.getElementById('cart-details');
        const userInfoContainer = document.getElementById('user-info-container');
        const bankDetailsContainer = document.getElementById('bank-details');
        const bankAccountsList = document.getElementById('bank-accounts-list');
        let selectedFile = null;

        async function loadBankAccounts(selectedBank = null) {
            try {
                const storeRef = doc(db, 'stores', storeId);
                const storeDoc = await getDoc(storeRef);

                if (storeDoc.exists()) {
                    storeData = storeDoc.data();
                    const deliveryZones = Array.isArray(storeData.deliveryZones) ? storeData.deliveryZones : [];

                    if (!Array.isArray(storeData.bankAccounts)) {
                        console.error('Los datos bancarios no están en formato array');
                        bankAccountsList.innerHTML = '<p style="color: #b91c1c;">Formato de datos bancarios incorrecto.</p>';
                        document.getElementById('confirm-btn').disabled = true;
                        return;
                    }

                    const bankAccounts = storeData.bankAccounts;
                    bankAccountsList.innerHTML = '';

                    if (bankAccounts.length > 0) {
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

                            // Reutilizar el input estático #payment-proof
                            const fileInput = document.getElementById('payment-proof');
                            const fileStatus = document.createElement('p');
                            fileStatus.id = 'file-status';
                            fileStatus.style = 'margin-top: 8px; color: #374151;';
                            bankAccountsList.appendChild(fileStatus);

                            fileInput.addEventListener('change', (e) => {
                                console.log('Evento change en input de archivo detectado');
                                selectedFile = e.target.files[0];
                                if (selectedFile) {
                                    console.log('Archivo seleccionado:', {
                                        name: selectedFile.name,
                                        type: selectedFile.type,
                                        size: selectedFile.size,
                                        lastModified: selectedFile.lastModified
                                    });
                                    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
                                    const maxSize = 5 * 1024 * 1024; // 5MB
                                    
                                    if (!validTypes.includes(selectedFile.type)) {
                                        console.error('Tipo de archivo no válido:', selectedFile.type);
                                        fileStatus.textContent = 'Por favor, selecciona una imagen (JPEG/PNG) o un PDF.';
                                        selectedFile = null;
                                        document.getElementById('confirm-btn').disabled = true;
                                        return;
                                    }
                                    if (selectedFile.size > maxSize) {
                                        console.error('Archivo demasiado grande:', selectedFile.size, 'bytes');
                                        fileStatus.textContent = 'El archivo es demasiado grande. Máximo 5MB.';
                                        selectedFile = null;
                                        document.getElementById('confirm-btn').disabled = true;
                                        return;
                                    }
                                    console.log('Archivo válido seleccionado');
                                    fileStatus.textContent = `Archivo seleccionado: ${selectedFile.name}`;
                                    document.getElementById('confirm-btn').disabled = false;
                                } else {
                                    console.log('No se seleccionó ningún archivo');
                                    fileStatus.textContent = '';
                                }
                            });
                        }

                        select.addEventListener('change', async (e) => {
                            const selectedIndex = e.target.value;
                            if (selectedIndex) {
                                await loadBankAccounts(selectedIndex);
                            }
                        });
                    } else {
                        bankAccountsList.innerHTML = '<p style="color: #b91c1c;">No hay cuentas bancarias disponibles.</p>';
                        document.getElementById('confirm-btn').disabled = true;
                    }
                } else {
                    bankAccountsList.innerHTML = '<p style="color: #b91c1c;">Tienda no encontrada.</p>';
                    document.getElementById('confirm-btn').disabled = true;
                }
            } catch (error) {
                console.error('Error al cargar los datos bancarios:', error);
                bankAccountsList.innerHTML = '<p style="color: #b91c1c;">Error al cargar los datos bancarios.</p>';
                document.getElementById('confirm-btn').disabled = true;
            }
        }

        const paymentRadios = document.querySelectorAll('input[name="payment"]');
        paymentRadios.forEach((radio) => {
            radio.addEventListener('change', async () => {
                const selectedPaymentMethod = document.querySelector('input[name="payment"]:checked');
                if (selectedPaymentMethod.value.toLowerCase() === 'transferencia') {
                    bankDetailsContainer.classList.remove('hidden');
                    try {
                        await loadBankAccounts();
                    } catch (error) {
                        console.error('Error al cargar datos bancarios:', error);
                    }
                    document.getElementById('confirm-btn').disabled = true;
                } else {
                    bankDetailsContainer.classList.add('hidden');
                    bankAccountsList.innerHTML = '';
                    selectedFile = null;
                    document.getElementById('confirm-btn').disabled = false;
                }
            });
        });

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
            const serviceFee = 0.25; // Tarifa fija de servicio

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

            console.log('Subtotal calculado:', subtotalTotal);
            console.log('Envío:', shipping);
            console.log('Cargo por servicio:', serviceFee);

            const subtotalElement = document.getElementById('subtotal');
            if (subtotalElement) {
                subtotalElement.textContent = `$${subtotalTotal.toFixed(2)}`;
            }

            const shippingElement = document.getElementById('shipping');
            if (shippingElement) {
                shippingElement.textContent = `$${shipping.toFixed(2)}`;
            }

            const serviceFeeElement = document.getElementById('service-fee');
            if (serviceFeeElement) {
                serviceFeeElement.textContent = `$${serviceFee.toFixed(2)}`;
            }

            const totalElement = document.getElementById('total');
            if (totalElement) {
                const total = subtotalTotal + shipping + serviceFee;
                console.log('Total calculado:', total);
                totalElement.textContent = `$${total.toFixed(2)}`;
            }
        }

        await displayCartProducts();

        const savedAddressesContainer = document.getElementById('saved-addresses');
        const addAddressBtn = document.getElementById('add-address-btn');
        const addressForm = document.getElementById('addressForm');
        const getLocationBtn = document.getElementById('get-location-btn');
        const latitudeSpan = document.getElementById('latitude');
        const longitudeSpan = document.getElementById('longitude');
        const scheduledDateInput = document.getElementById('scheduled-date');
        const scheduledTimeInput = document.getElementById('scheduled-time');
        const scheduledWarning = document.getElementById('scheduled-warning');
        let selectedAddress = null;
        let addresses = [];
        let storeData = null;

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
                        selectedAddress = addresses[addresses.length - 1];
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

        // <--- AGREGA AQUÍ
        await loadSavedAddresses();

        
        function createAddressElement(address, index) {
            const addressElement = document.createElement('div');
            addressElement.classList.add('address-item');
            addressElement.style.display = 'flex';
            addressElement.style.alignItems = 'center';
            addressElement.style.gap = '14px';
            addressElement.style.marginBottom = '18px';

            const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${address.latitude},${address.longitude}&zoom=16&size=90x90&markers=color:red%7C${address.latitude},${address.longitude}&key=${GOOGLE_MAPS_API_KEY}`;
            const mapImg = document.createElement('img');
            mapImg.src = staticMapUrl;
            mapImg.alt = `Mapa de la dirección ${address.reference}`;
            mapImg.style.width = '90px';
            mapImg.style.height = '90px';
            mapImg.style.borderRadius = '8px';
            mapImg.style.cursor = 'pointer';
            mapImg.tabIndex = 0;

            const refDiv = document.createElement('div');
            refDiv.innerHTML = `<p style="margin:0;font-weight:500;cursor:pointer;" tabindex="0">${address.reference}</p>`;

            function selectThisAddress() {
                selectedAddress = address;
                updateSelectedAddressView(selectedAddress);
            }
            mapImg.addEventListener('click', selectThisAddress);
            mapImg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectThisAddress(); });
            refDiv.addEventListener('click', selectThisAddress);
            refDiv.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectThisAddress(); });

            addressElement.appendChild(mapImg);
            addressElement.appendChild(refDiv);
            return addressElement;
        }

        function updateSelectedAddressView(address) {
            const selectedAddressDiv = document.createElement('div');
            selectedAddressDiv.className = 'selected-address';
            const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${address.latitude},${address.longitude}&zoom=16&size=200x100&markers=color:red%7C${address.latitude},${address.longitude}&key=${GOOGLE_MAPS_API_KEY}`;

            const storeRef = doc(db, 'stores', storeId);
            getDoc(storeRef).then(storeDoc => {
                if (storeDoc.exists()) {
                    storeData = storeDoc.data();
                    const deliveryZones = Array.isArray(storeData.deliveryZones) ? storeData.deliveryZones : [];
                    if (deliveryZones.length > 0) {
                        loadGoogleMapsScript(() => {
                            const isCovered = isPointInDeliveryZones(address.latitude, address.longitude, deliveryZones);
                            let referenceHtml = `<strong>Referencia:</strong> ${address.reference}`;
                            if (isCovered) {
                                referenceHtml += `
                                    <span class="coverage-check" style="display:inline-block;vertical-align:middle;position:relative;cursor:pointer;margin-left:6px;">
                                        <i class="bi bi-check-circle-fill" style="color:#16a34a;font-size:1.1em;"></i>
                                        <span class="coverage-tooltip" style="display:none;position:absolute;left:120%;top:50%;transform:translateY(-50%);background:#fff;border:1px solid #16a34a;color:#222;padding:6px 12px;border-radius:6px;box-shadow:0 2px 8px #0002;white-space:nowrap;z-index:10;font-size:0.97em;">
                                            ¡Esta dirección está dentro de la zona de cobertura!
                                        </span>
                                    </span>
                                `;
                            }
                            selectedAddressDiv.innerHTML = `
                                <p><strong>Dirección seleccionada:</strong></p>
                                <p>${referenceHtml}</p>
                                <div id="coverage-message" style="margin:4px 0 8px 0;font-size:0.98em;"></div>
                                <img src="${staticMapUrl}" alt="Mapa de la dirección ${address.reference}" style="width:100%;max-width:200px;height:100px;margin:10px 0;border-radius:8px;object-fit:cover;">
                                <button id="show-other-addresses-btn" class="btn">Otras direcciones</button>
                            `;

                            const coverageCheck = selectedAddressDiv.querySelector('.coverage-check');
                            if (coverageCheck) {
                                const tooltip = coverageCheck.querySelector('.coverage-tooltip');
                                coverageCheck.addEventListener('mouseenter', () => {
                                    tooltip.style.display = 'block';
                                });
                                coverageCheck.addEventListener('mouseleave', () => {
                                    tooltip.style.display = 'none';
                                });
                            }

                            const msgDiv = selectedAddressDiv.querySelector('#coverage-message');
                            let shippingValue = 1;
                            let zone = null;
                            if (isCovered) {
                                zone = getZoneForAddress(address.latitude, address.longitude, deliveryZones);
                                if (zone && typeof zone.shipping === 'number') {
                                    shippingValue = zone.shipping;
                                }
                                msgDiv.innerHTML = `<a href="#" id="showCoverageZonesLink" style="color:#2563eb;text-decoration:underline;cursor:pointer;font-size:0.97em;">Ver zonas de cobertura</a>`;
                                document.getElementById('confirm-btn').disabled = false;
                            } else {
                                msgDiv.innerHTML = `<span style="color:#b91c1c;"><i class="bi bi-exclamation-triangle"></i> No tenemos cobertura en esta dirección.</span>
                                <br>
                                <a href="#" id="showCoverageZonesLink" style="color:#2563eb;text-decoration:underline;cursor:pointer;font-size:0.97em;">Ver zonas de cobertura</a>`;
                                document.getElementById('confirm-btn').disabled = true;
                            }

                            const shippingElement = document.getElementById('shipping');
                            if (shippingElement) {
                                shippingElement.textContent = `$${shippingValue.toFixed(2)}`;
                            }
                            const subtotalElement = document.getElementById('subtotal');
                            const totalElement = document.getElementById('total');
                            const serviceFeeElement = document.getElementById('service-fee');
                            const serviceFee = serviceFeeElement ? parseFloat(serviceFeeElement.textContent.replace('$', '')) || 0.25 : 0.25;
                            if (subtotalElement && totalElement) {
                                const subtotal = parseFloat(subtotalElement.textContent.replace('$', '')) || 0;
                                const total = subtotal + shippingValue + serviceFee;
                                console.log('Total recalculado (con cargo por servicio):', total);
                                totalElement.textContent = `$${total.toFixed(2)}`;
                            }

                            const showCoverageZonesLink = document.getElementById('showCoverageZonesLink');
                            if (showCoverageZonesLink) {
                                showCoverageZonesLink.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    openCoverageZonesModal(deliveryZones);
                                });
                            }
                        });
                    }
                }
            });

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
        }

        if (addAddressBtn) {
            addAddressBtn.addEventListener('click', () => {
                document.getElementById('newAddressModal').style.display = 'flex';
                const addressForm = document.getElementById('addressForm');
                if (addressForm) addressForm.reset();
                const mapDiv = document.getElementById('map');
                if (mapDiv) {
                    mapDiv.style.display = 'none';
                    mapDiv.innerHTML = '';
                }
                document.getElementById('latitude').value = '0.0000';
                document.getElementById('longitude').value = '0.0000';

                // --- NUEVO: Obtener ubicación actual automáticamente ---
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        document.getElementById('latitude').value = lat.toFixed(6);
                        document.getElementById('longitude').value = lng.toFixed(6);
                        // Mostrar y centrar el mapa en la ubicación actual
                        if (mapDiv) {
                            mapDiv.style.display = 'block';
                            initMap(lat, lng);
                        }
                    }, (error) => {
                        // Si el usuario no permite ubicación, solo muestra el mapa por defecto
                        if (mapDiv) {
                            mapDiv.style.display = 'block';
                            initMap();
                        }
                    });
                } else {
                    // Si no hay geolocalización, solo muestra el mapa por defecto
                    if (mapDiv) {
                        mapDiv.style.display = 'block';
                        initMap();
                    }
                }
            });
        }

        loadGoogleMapsScript(() => {
            if (getLocationBtn) {
                getLocationBtn.addEventListener('click', async () => {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition((position) => {
                            const lat = position.coords.latitude;
                            const lng = position.coords.longitude;
                            document.getElementById('latitude').value = lat.toFixed(6);
                            document.getElementById('longitude').value = lng.toFixed(6);
                            initMap(lat, lng);
                        });
                    }
                });
            }
        });

        if (addressForm) {
            addressForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const reference = document.getElementById('reference').value;
                const latitude = latitudeSpan.value || latitudeSpan.textContent;
                const longitude = longitudeSpan.value || longitudeSpan.textContent;

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
                        Toastify({
                            text: '¡Dirección guardada exitosamente!',
                            duration: 3000,
                            gravity: 'top',
                            position: 'right',
                            backgroundColor: '#16a34a',
                        }).showToast();
                    }
                } catch (error) {
                    console.error('Error al guardar la dirección:', error);
                    alert('Error al guardar la dirección. La dirección se guardará localmente.');
                }

                updateSelectedAddressView(selectedAddress);
                document.getElementById('newAddressModal').style.display = 'none';
                addressForm.reset();
                latitudeSpan.value = '0.000000';
                longitudeSpan.value = '0.000000';
            });
        }

        savedAddressesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('select-address-btn')) {
                const index = parseInt(e.target.dataset.index);
                selectedAddress = addresses[index];
                updateSelectedAddressView(selectedAddress);
            }
        });

        const confirmBtn = document.getElementById('confirm-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                console.log('Iniciando proceso de confirmación de pedido');
                
                // Obtener el método de pago seleccionado aquí
                const selectedPaymentMethod = document.querySelector('input[name="payment"]:checked');
                console.log('Método de pago seleccionado:', selectedPaymentMethod ? selectedPaymentMethod.value : 'Ninguno');
                
                console.log('Archivo seleccionado:', selectedFile ? 'Sí' : 'No');

                const tipoEntrega = document.querySelector('input[name="deliveryType"]:checked')?.value;
                const user = auth.currentUser;
                if (!user) {
                    alert('Debes iniciar sesión para continuar.');
                    return;
                }
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (!userDoc.exists()) {
                    alert('Debes completar tu perfil antes de generar la orden.');
                    return;
                }

                if (tipoEntrega === 'delivery') {
                    if (!selectedAddress) {
                        alert('Por favor, selecciona una dirección de entrega.');
                        return;
                    }
                }

                if (!selectedPaymentMethod) {
                    alert('Por favor, selecciona un método de pago.');
                    return;
                }

                if (selectedPaymentMethod.value === 'Transferencia' && !selectedFile) {
                    console.error('Error: Se requiere comprobante para transferencia');
                    alert('Por favor, sube un comprobante de pago para transferencia.');
                    const paymentProofInput = document.getElementById('payment-proof');
                    if (paymentProofInput) paymentProofInput.focus();
                    return;
                }

                const deliveryTimeType = document.querySelector('input[name="deliveryTime"]:checked').value;
                let scheduledDate = '';
                let scheduledTime = '';

                if (deliveryTimeType === 'asap') {
                    const now = new Date();
                    now.setMinutes(now.getMinutes() + 30);
                    scheduledDate = now.toISOString().slice(0, 10);
                    scheduledTime = now.toTimeString().slice(0, 5);
                } else {
                    scheduledDate = scheduledDateInput.value;
                    scheduledTime = scheduledTimeInput.value;
                    if (!scheduledDate || !scheduledTime) {
                        alert('Por favor, selecciona el día y la hora para la entrega programada.');
                        return;
                    }
                }

                try {
                    let paymentProofUrl = null;
                    if (selectedPaymentMethod.value === 'Transferencia' && selectedFile) {
                        console.log('Iniciando subida de comprobante...');
                        try {
                            console.log('Archivo seleccionado:', selectedFile);
                            const storagePath = `payment-proofs/${user.uid}/${Date.now()}_${selectedFile.name}`;                            console.log('Ruta de almacenamiento:', storagePath);
                            const storageRef = ref(storage, storagePath);
                            
                            console.log('Subiendo archivo a Firebase Storage...');
                            const uploadResult = await uploadBytes(storageRef, selectedFile);
                            console.log('Archivo subido exitosamente');
                            
                            console.log('Obteniendo URL de descarga...');
                            paymentProofUrl = await getDownloadURL(uploadResult.ref);
                            console.log('URL del comprobante obtenida:', paymentProofUrl);
                            
                        } catch (uploadError) {
                            console.error('Error al subir el comprobante:', {
                                name: uploadError.name,
                                message: uploadError.message,
                                stack: uploadError.stack
                            });
                            alert('Error al subir el comprobante de pago. Por favor, intenta de nuevo.');
                            return;
                        }
                    }

                    const orderData = {
                        storeId,
                        userId: auth.currentUser.uid,
                        products: cart,
                        total: parseFloat(document.getElementById('total').textContent.replace('$', '')),
                        shippingAddress: tipoEntrega === 'delivery' ? {
                            ...selectedAddress,
                            lat: selectedAddress.lat || null,
                            lng: selectedAddress.lng || null,
                            latitude: selectedAddress.lat ? parseFloat(selectedAddress.lat) : null,
                            longitude: selectedAddress.lng ? parseFloat(selectedAddress.lng) : null
                        } : null,
                        paymentMethod: selectedPaymentMethod.value,
                        paymentProofUrl: paymentProofUrl,
                        bankIndex: selectedPaymentMethod.value === 'Transferencia' ? parseInt(document.getElementById('bank-select').value) : null,
                        status: 'Pendiente',
                        createdAt: new Date().toISOString(),
                        deliveryType: deliveryTimeType,
                        scheduledDate,
                        scheduledTime,
                        customerName: userDoc.data()?.name || 'Cliente no especificado',
                        customerPhone: userDoc.data()?.phone || 'No especificado'
                    };

                    console.log('Datos del pedido a guardar:', {
                        ...orderData,
                        paymentProofUrl: paymentProofUrl ? 'URL_DE_COMPROBANTE_PRESENTE' : null,
                        products: `[${orderData.products.length} productos]`
                    });

                    console.log('Guardando pedido en Firestore...');
                    const orderRef = await addDoc(collection(db, 'orders'), orderData);
                    console.log('Pedido guardado exitosamente con ID:', orderRef.id);

                    Toastify({
                        text: '¡Pedido confirmado! Gracias por tu compra.',
                        duration: 3000,
                        gravity: 'top',
                        position: 'right',
                        backgroundColor: '#16a34a',
                    }).showToast();

                    // Mostrar modal de éxito
                    const orderSuccessModal = document.getElementById('orderSuccessModal');
                    console.log('Buscando modal de éxito:', orderSuccessModal);
                    if (orderSuccessModal) {
                        orderSuccessModal.classList.remove('hidden');
                        console.log('Modal de éxito mostrado');
                        // Datos para WhatsApp
                        let storePhone = storeData?.phone || '593XXXXXXXXX';
                        if (storePhone.startsWith('0')) {
                            storePhone = '593' + storePhone.substring(1);
                        }
                        const orderSummary = cart.map(item => `${item.quantity} x ${item.name}`).join(', ');
                        const customerName = userDoc.data()?.name || '';
                        const customerPhone = userDoc.data()?.phone || '';
                        const paymentMethod = selectedPaymentMethod.value;
                        const addressRef = selectedAddress?.reference || '';
                        const addressLat = selectedAddress?.latitude || selectedAddress?.lat || '';
                        const addressLng = selectedAddress?.longitude || selectedAddress?.lng || '';
                        const mapsUrl = (addressLat && addressLng) ? `https://www.google.com/maps/place/${addressLat},${addressLng}` : '';
                        const orderLines = cart.map(item => `${item.quantity} de ${item.name}`).join('\n');
                        const subtotal = document.getElementById('subtotal')?.textContent?.replace('$','') || '';
                        const shipping = document.getElementById('shipping')?.textContent?.replace('$','') || '';
                        const serviceFee = document.getElementById('service-fee')?.textContent?.replace('$','') || '';
                        const total = document.getElementById('total')?.textContent?.replace('$','') || '';

                        let comprobanteLine = '';
                        if (paymentMethod.toLowerCase() === 'transferencia' && paymentProofUrl) {
                            comprobanteLine = `\n\nComprobante de pago: ${paymentProofUrl}`;
                        }

                        const orderMsg = encodeURIComponent(
`*Datos del cliente*
Cliente: ${customerName}
Celular: ${customerPhone}

*Lugar de entrega*
Referencias: ${addressRef}
Ubicación: ${mapsUrl}

*Detalle del pedido*
${orderLines}

Valor del pedido: ${subtotal}
Envío: ${shipping}
Cargo: ${serviceFee}

Forma de pago: ${paymentMethod}
Total a cobrar: $${total}${comprobanteLine}`
                        );

                        const waLink = `https://wa.me/${storePhone}?text=${orderMsg}`;

                        // Botón WhatsApp
                        const waBtn = document.getElementById('whatsapp-receipt-btn');
                        if (waBtn) {
                            waBtn.onclick = () => {
                                window.open(waLink, '_blank');
                            };
                        }

                        // Botón cerrar
                        const closeBtn = document.getElementById('closeOrderSuccessModal');
                        if (closeBtn) {
                            closeBtn.onclick = () => {
                                orderSuccessModal.classList.add('hidden');
                                window.location.href = '/my-orders.html';
                            };
                        }
                    } else {
                        console.error('No se encontró el modal de éxito (orderSuccessModal)');
                    }

                    // Limpia el carrito
                    localStorage.removeItem(cartKey);
                    // NO redirigir aquí, solo mostrar el modal
                } catch (error) {
                    console.error('Error al confirmar el pedido:', error);
                    alert(`Hubo un error al confirmar tu pedido: ${error.message}`);
                }
            });
        }

        const deliveryTimeRadios = document.querySelectorAll('input[name="deliveryTime"]');
        const scheduledFields = document.getElementById('scheduled-delivery-fields');

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
            radio.addEventListener('change', updateEntregaInmediataTiempo);
        });
        updateScheduledFields();

        const scheduledInput = document.querySelector('input[name="deliveryTime"][value="scheduled"]');
        if (scheduledInput) {
            scheduledInput.checked = true;
        }

        function updateEntregaInmediataTiempo() {
            const entregaInmediataInput = document.querySelector('input[name="deliveryTime"][value="asap"]');
            const entregaInmediataLabel = entregaInmediataInput?.closest('label');
            const optionContent = entregaInmediataLabel?.querySelector('.option-content');
            const tipoEntrega = document.querySelector('input[name="deliveryType"]:checked')?.value;

            if (!entregaInmediataInput || !optionContent || !storeData || !storeData.openingHours) return;

            optionContent.querySelector('.entrega-tiempo')?.remove();

            let texto = '';
            const tiendaCerrada = !isNowInOpeningHours(storeData.openingHours);

            if (tiendaCerrada) {
                texto = 'Tienda cerrada';
                entregaInmediataInput.disabled = true;
                entregaInmediataInput.checked = false;
                if (scheduledInput && !scheduledInput.checked) {
                    scheduledInput.checked = true;
                    scheduledInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
                entregaInmediataInput.disabled = false;
                texto = tipoEntrega === 'delivery' ? 'Tiempo aproximado: 30 minutos' : tipoEntrega === 'pickup' ? 'Tiempo aproximado: 15 minutos' : '';
            }

            if (texto) {
                const small = document.createElement('small');
                small.className = 'entrega-tiempo';
                small.style.display = 'block';
                small.style.fontSize = '0.85em';
                small.style.color = texto === 'Tienda cerrada' ? '#b91c1c' : '#666';
                small.textContent = texto;
                optionContent.appendChild(small);
            }
        }

        const deliveryTypeRadios = document.querySelectorAll('input[name="deliveryType"]');
        deliveryTypeRadios.forEach(radio => {
            radio.addEventListener('change', updateEntregaInmediataTiempo);
        });

        const storeRef = doc(db, 'stores', storeId);
        const storeDoc = await getDoc(storeRef);

        if (storeDoc.exists()) {
            storeData = storeDoc.data();
            if (scheduledDateInput && scheduledTimeInput && storeData.openingHours) {
                const now = new Date();
                const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                let found = false;

                function formatDate(d) {
                    return d.toISOString().slice(0, 10);
                }

                for (let i = 0; i < 8; i++) {
                    const testDate = new Date(now);
                    testDate.setDate(now.getDate() + i);
                    const dayOfWeek = daysMap[testDate.getDay()];
                    const hours = storeData.openingHours[dayOfWeek];

                    if (!hours) {
                        continue;
                    }

                    if (i === 0 && isNowInOpeningHours(storeData.openingHours)) {
                        let target = new Date(now.getTime() + 60 * 60 * 1000);
                        let minTime = hours.open.split(':')[0] * 60 + hours.open.split(':')[1];
                        let maxTime = hours.close.split(':')[0] * 60 + hours.close.split(':')[1];
                        let targetMinutes = target.getHours() * 60 + target.getMinutes();
                        if (targetMinutes < minTime) targetMinutes = minTime;
                        if (targetMinutes > maxTime) targetMinutes = maxTime;
                        targetMinutes = Math.ceil(targetMinutes / 5) * 5;
                        let h = Math.floor(targetMinutes / 60);
                        let m = targetMinutes % 60;
                        scheduledDateInput.value = formatDate(now);
                        scheduledTimeInput.value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                        found = true;
                        break;
                    } else if (i > 0 && hours) {
                        scheduledDateInput.value = formatDate(testDate);
                        scheduledTimeInput.value = `${hours.open.split(':')[0].toString().padStart(2, '0')}:${hours.open.split(':')[1].toString().padStart(2, '0')}`;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    scheduledDateInput.value = '';
                    scheduledTimeInput.value = '';
                }
            }
            updateScheduledFields();
            updateEntregaInmediataTiempo();
        } else {
            alert('No se encontró la tienda.');
            return;
        }

        let map, marker;
        function initMap(lat = -1.843254, lng = -79.990611) {
            const mapDiv = document.getElementById('map');
            if (!mapDiv) return;
            mapDiv.style.display = 'block';
            const center = { lat: parseFloat(lat), lng: parseFloat(lng) };
            map = new google.maps.Map(mapDiv, {
                center,
                zoom: 16,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false
            });
            marker = new google.maps.Marker({
                position: center,
                map,
                draggable: true
            });
            marker.addListener('dragend', function () {
                const pos = marker.getPosition();
                document.getElementById('latitude').value = pos.lat().toFixed(6);
                document.getElementById('longitude').value = pos.lng().toFixed(6);
            });
            map.addListener('click', function (e) {
                marker.setPosition(e.latLng);
                document.getElementById('latitude').value = e.latLng.lat().toFixed(6);
                document.getElementById('longitude').value = e.latLng.lng().toFixed(6);
            });
        }

        function isPointInDeliveryZones(lat, lng, deliveryZones) {
            if (!window.google || !window.google.maps || !window.google.maps.geometry) return false;
            const point = new google.maps.LatLng(lat, lng);
            for (const zone of deliveryZones) {
                const polygon = new google.maps.Polygon({
                    paths: zone.polygon
                });
                if (google.maps.geometry.poly.containsLocation(point, polygon)) {
                    return true;
                }
            }
            return false;
        }

        function openCoverageZonesModal(deliveryZones) {
            const modal = document.getElementById('coverageZonesModal');
            const mapDiv = document.getElementById('coverageZonesMap');
            const listDiv = document.getElementById('coverageZonesList');
            modal.style.display = 'flex';
            mapDiv.innerHTML = '';
            loadGoogleMapsScript(() => {
                let center = { lat: -1.843254, lng: -79.990611 };
                if (deliveryZones.length > 0 && deliveryZones[0].polygon && deliveryZones[0].polygon.length > 0) {
                    center = deliveryZones[0].polygon[0];
                }
                const map = new google.maps.Map(mapDiv, {
                    center,
                    zoom: 13,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false
                });
                deliveryZones.forEach(zone => {
                    const polygon = new google.maps.Polygon({
                        paths: zone.polygon,
                        fillColor: '#2563eb',
                        fillOpacity: 0.18,
                        strokeColor: '#2563eb',
                        strokeWeight: 2,
                        map
                    });
                });
                if (listDiv) {
                    listDiv.innerHTML = deliveryZones.map(z =>
                        `<div style="margin-bottom:4px;"><b>${z.name || 'Zona'}</b> — Envío: $${z.shipping?.toFixed(2) ?? '0.00'}</div>`
                    ).join('');
                }
            });
            document.getElementById('closeCoverageZonesModal').onclick = () => {
                modal.style.display = 'none';
            };
            modal.onclick = (e) => {
                if (e.target === modal) modal.style.display = 'none';
            };
        }

        function getZoneForAddress(lat, lng, deliveryZones) {
            if (!window.google || !window.google.maps || !window.google.maps.geometry) return null;
            const point = new google.maps.LatLng(lat, lng);
            for (const zone of deliveryZones) {
                const polygon = new google.maps.Polygon({ paths: zone.polygon });
                if (google.maps.geometry.poly.containsLocation(point, polygon)) {
                    return zone;
                }
            }
            return null;
        }

        function validateScheduledDateTime() {
            if (!scheduledDateInput || !scheduledTimeInput || !scheduledWarning) return;
            const openingHours = storeData.openingHours || {};
            const dateStr = scheduledDateInput.value;
            const timeStr = scheduledTimeInput.value;
            scheduledWarning.textContent = '';
            if (!dateStr) return;
            const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const [year, month, day] = dateStr.split('-').map(Number);
            const jsDate = new Date(Date.UTC(year, month - 1, day));
            const dayOfWeek = daysMap[jsDate.getUTCDay()];
            const hours = openingHours[dayOfWeek];

            if (!hours) {
                scheduledWarning.textContent = 'La tienda no atiende el día seleccionado.';
                return;
            }

            if (timeStr) {
                const [h, m] = timeStr.split(':').map(Number);
                const [openH, openM] = hours.open.split(':').map(Number);
                const [closeH, closeM] = hours.close.split(':').map(Number);
                const selectedMinutes = h * 60 + m;
                const openMinutes = openH * 60 + openM;
                const closeMinutes = closeH * 60 + closeM;
                if (selectedMinutes < openMinutes || selectedMinutes > closeMinutes) {
                    scheduledWarning.textContent = `La tienda solo atiende de ${hours.open} a ${hours.close} ese día.`;
                    return;
                }
            }
        }

        if (scheduledDateInput) scheduledDateInput.addEventListener('change', validateScheduledDateTime);
        if (scheduledTimeInput) scheduledTimeInput.addEventListener('change', validateScheduledDateTime);

        document.addEventListener('click', function(e) {
            if (e.target && e.target.id === 'show-other-addresses-btn') {
                const modal = document.getElementById('otherAddressesModal');
                const listDiv = document.getElementById('otherAddressesList');
                listDiv.innerHTML = '';
                addresses.forEach((addr, idx) => {
                    if (addr !== selectedAddress) {
                        const el = createAddressElement(addr, idx);
                        el.addEventListener('click', () => {
                            selectedAddress = addr;
                            updateSelectedAddressView(selectedAddress);
                            modal.style.display = 'none';
                        });
                        listDiv.appendChild(el);
                    }
                });
                modal.style.display = 'flex';
            }
            if (e.target && e.target.id === 'closeOtherAddressesModal') {
                document.getElementById('otherAddressesModal').style.display = 'none';
            }
            if (e.target && e.target.id === 'otherAddressesModal') {
                document.getElementById('otherAddressesModal').style.display = 'none';
            }
        });

        const newAddressModal = document.getElementById('newAddressModal');
        if (newAddressModal) {
            const closeBtn = document.getElementById('closeNewAddressModal');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    newAddressModal.style.display = 'none';
                };
            }
            newAddressModal.addEventListener('mousedown', function(e) {
                if (e.target === newAddressModal) {
                    newAddressModal.style.display = 'none';
                }
            });
        }
    } catch (error) {
        console.error('Error al inicializar:', error);
        alert('Error al inicializar la página. Por favor, recarga la página.');
    }
}

function loadGoogleMapsScript(callback) {
    if (window.google && window.google.maps && window.google.maps.geometry && window.google.maps.drawing) {
        callback();
        return;
    }
    if (document.getElementById('google-maps-script')) {
        const check = setInterval(() => {
            if (window.google && window.google.maps && window.google.maps.geometry && window.google.maps.drawing) {
                clearInterval(check);
                callback();
            }
        }, 50);
        return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry,drawing&loading=async`;
    script.async = true;
    script.onload = callback;
    document.head.appendChild(script);
}

function isNowInOpeningHours(openingHours) {
    const now = new Date();
    const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = daysMap[now.getDay()];
    const hours = openingHours[dayOfWeek];
    if (!hours) return false;
    const [openH, openM] = hours.open.split(':').map(Number);
    const [closeH, closeM] = hours.close.split(':').map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;
    return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
}

document.addEventListener('DOMContentLoaded', () => {
    initialize();

    const deliveryTypeRadios = document.querySelectorAll('input[name="deliveryType"]');
    const deliveryAddressSection = document.querySelector('.delivery-address');

    function toggleAddressSection() {
        const selected = document.querySelector('input[name="deliveryType"]:checked');
        const confirmBtn = document.getElementById('confirm-btn');
        const shippingElement = document.getElementById('shipping');
        const subtotalElement = document.getElementById('subtotal');
        const serviceFeeElement = document.getElementById('service-fee');
        const totalElement = document.getElementById('total');

        if (!selected || !deliveryAddressSection) return;

        if (selected.value === 'delivery') {
            deliveryAddressSection.classList.remove('hidden');
            // El envío se mantiene según zona
        } else {
            deliveryAddressSection.classList.add('hidden');
            // Envío es 0 para retiro en tienda
            if (shippingElement) shippingElement.textContent = '$0.00';

            // Recalcula el total sumando solo subtotal + cargo por servicio
            if (subtotalElement && serviceFeeElement && totalElement) {
                const subtotal = parseFloat(subtotalElement.textContent.replace('$', '')) || 0;
                const serviceFee = parseFloat(serviceFeeElement.textContent.replace('$', '')) || 0.25;
                const total = subtotal + serviceFee;
                totalElement.textContent = `$${total.toFixed(2)}`;
            }
            if (confirmBtn) {
                confirmBtn.disabled = false;
            }
        }
    }

    deliveryTypeRadios.forEach(radio => {
        radio.addEventListener('change', toggleAddressSection);
    });

    toggleAddressSection();

    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', loginWithGoogle);
    }
});