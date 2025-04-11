import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, auth } from './firebase-config.js'; // Asegúrate de que este archivo exporte la instancia de Firebase y auth

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
    const userInfoContainer = document.getElementById('user-info-container'); // Contenedor para mostrar datos del cliente o formulario

    cartDetails.innerHTML = ''; // Limpia el contenido previo

    // Verificar si el usuario está autenticado
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                // Verificar si el usuario tiene un perfil de cliente
                const userDoc = doc(db, 'users', user.uid);
                const userSnapshot = await getDoc(userDoc);

                if (userSnapshot.exists()) {
                    // Mostrar los datos del cliente
                    const userData = userSnapshot.data();
                    userInfoContainer.innerHTML = `
                        <div class="client-info">
                            <h3>Perfil de Cliente</h3>
                            <p><strong>Nombre:</strong> ${userData.name || 'Sin nombre'}</p>
                            <p><strong>Teléfono:</strong> ${userData.phone || 'Sin teléfono'}</p>
                        </div>
                    `;
                } else {
                    // Mostrar formulario de registro como cliente
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

                    // Manejar el envío del formulario
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
                            window.location.reload(); // Recargar la página para mostrar los datos del cliente
                        } catch (error) {
                            console.error('Error al guardar el perfil de cliente:', error);
                            alert('Error al guardar el perfil de cliente.');
                        }
                    });
                }
            } catch (error) {
                console.error('Error al verificar el perfil de cliente:', error);
            }
        } else {
            // Redirigir al inicio de sesión si no está autenticado
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

    const savedAddressesContainer = document.getElementById('saved-addresses');
    const addAddressBtn = document.getElementById('add-address-btn');
    const newAddressForm = document.getElementById('new-address-form');
    const addressForm = document.getElementById('addressForm');
    const getLocationBtn = document.getElementById('get-location-btn');
    const latitudeSpan = document.getElementById('latitude');
    const longitudeSpan = document.getElementById('longitude');

    let selectedAddress = null;

    // Mostrar formulario para agregar nueva dirección
    addAddressBtn.addEventListener('click', () => {
        newAddressForm.style.display = 'block';
    });

    // Obtener ubicación actual del usuario
    getLocationBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                latitudeSpan.textContent = latitude.toFixed(6);
                longitudeSpan.textContent = longitude.toFixed(6);
            }, (error) => {
                console.error('Error al obtener la ubicación:', error);
                alert('No se pudo obtener la ubicación. Por favor, verifica los permisos.');
            });
        } else {
            alert('La geolocalización no es compatible con este navegador.');
        }
    });

    // Guardar nueva dirección
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

            // Guardar dirección en Firestore
            const user = auth.currentUser;
            if (user) {
                const addressesRef = doc(db, 'users', user.uid);
                const userSnapshot = await getDoc(addressesRef);
                const userData = userSnapshot.exists() ? userSnapshot.data() : {};
                const addresses = userData.addresses || [];
                addresses.push(addressData);

                await setDoc(addressesRef, { ...userData, addresses }, { merge: true });
                alert('¡Dirección guardada exitosamente!');
                window.location.reload(); // Recargar para mostrar las direcciones actualizadas
            }
        } catch (error) {
            console.error('Error al guardar la dirección:', error);
            alert('Error al guardar la dirección.');
        }
    });

    // Cargar direcciones guardadas
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
                        // Mostrar la última dirección como seleccionada
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

                        // Mostrar otras direcciones al hacer clic en el botón
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

                        // Renderizar las demás direcciones
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

                        // Manejar selección de dirección
                        document.querySelectorAll('.select-address-btn').forEach((btn) => {
                            btn.addEventListener('click', (e) => {
                                const index = e.target.dataset.index;
                                selectedAddress = addresses[index];
                                alert(`Dirección seleccionada: ${selectedAddress.reference}`);
                                window.location.reload(); // Recargar para reflejar la dirección seleccionada
                            });
                        });
                    } else {
                        savedAddressesContainer.innerHTML = '<p>No tienes direcciones guardadas.</p>';
                    }
                }
            }
        } catch (error) {
            console.error('Error al cargar las direcciones guardadas:', error);
        }
    };

    // Llamar a la función para cargar direcciones
    loadSavedAddresses();
});