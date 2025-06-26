import { auth, db, doc, getDoc, setDoc, storage, ref, uploadBytes, collection, query, where, getDocs } from './firebase-config.js';
import { getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js';
import { GOOGLE_MAPS_API_KEY } from './config.js';

// Al inicio del archivo, antes de cualquier función o bloque:
let deliveryZones = [];
const draft = localStorage.getItem('deliveryZonesDraft');
if (draft) {
    deliveryZones = JSON.parse(draft);
}
let map, drawingManager, currentPolygon = null;

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('editStoreForm');
    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('storeId');

    if (!storeId) {
        alert('No se proporcionó un ID de tienda válido.');
        window.location.href = 'index.html';
        return;
    }

    const bankAccountsContainer = document.getElementById('bankAccountsContainer');
    const addBankAccountButton = document.getElementById('addBankAccount');
    const bankAccountFormWrapper = document.getElementById('bankAccountFormWrapper');
    const saveBankAccountBtn = document.getElementById('saveBankAccount');
    const cancelBankAccountBtn = document.getElementById('cancelBankAccount');
    const newBankInput = document.getElementById('newBank');
    const newAccountNumberInput = document.getElementById('newAccountNumber');
    const newHolderInput = document.getElementById('newHolder');

    // Exponer storeId al scope global
    window.getStoreId = () => storeId;

    // Mostrar el formulario solo al presionar el botón
    addBankAccountButton.addEventListener('click', () => {
        bankAccountFormWrapper.style.display = 'block';
        newBankInput.value = '';
        newAccountNumberInput.value = '';
        newHolderInput.value = '';
        newBankInput.focus();
    });

    // Cancelar: ocultar y limpiar el formulario
    cancelBankAccountBtn.addEventListener('click', () => {
        bankAccountFormWrapper.style.display = 'none';
        newBankInput.value = '';
        newAccountNumberInput.value = '';
        newHolderInput.value = '';
    });

    // Guardar: validar, guardar en Firestore y mostrar como display
    saveBankAccountBtn.addEventListener('click', async () => {
        const bank = newBankInput.value.trim();
        const accountNumber = newAccountNumberInput.value.trim();
        const holder = newHolderInput.value.trim();

        if (!bank && !accountNumber && !holder) {
            alert('Por favor, completa al menos un campo para guardar la cuenta bancaria.');
            return;
        }

        try {
            // 1. Obtener las cuentas actuales
            const storeRef = doc(db, 'stores', getStoreId());
            const storeSnap = await getDoc(storeRef);
            let bankAccounts = [];
            if (storeSnap.exists() && Array.isArray(storeSnap.data().bankAccounts)) {
                bankAccounts = storeSnap.data().bankAccounts;
            }
            // 2. Agregar la nueva cuenta
            bankAccounts.push({ bank, accountNumber, holder });
            // 3. Guardar en Firestore
            await setDoc(storeRef, { bankAccounts }, { merge: true });

            // 4. Mostrar en la UI
            displayBankAccount(bank, accountNumber, holder);

            // 5. Limpiar y ocultar el formulario
            bankAccountFormWrapper.style.display = 'none';
            newBankInput.value = '';
            newAccountNumberInput.value = '';
            newHolderInput.value = '';

            alert('Cuenta bancaria guardada correctamente.');
        } catch (error) {
            alert('Error al guardar la cuenta bancaria: ' + error.message);
        }
    });

    // Función para mostrar una cuenta bancaria guardada como texto con botón de eliminar
    function displayBankAccount(bank = '', accountNumber = '', holder = '') {
        const entry = document.createElement('div');
        entry.className = 'bank-account-display';
        entry.innerHTML = `
            <div>
                <p><strong>Banco:</strong> ${bank || 'No especificado'}</p>
                <p><strong>Número de cuenta:</strong> ${accountNumber || 'No especificado'}</p>
                <p><strong>Titular:</strong> ${holder || 'No especificado'}</p>
            </div>
            <button type="button" class="delete-btn">Eliminar</button>
        `;
        bankAccountsContainer.appendChild(entry);

        // Evento para eliminar la entrada
        entry.querySelector('.delete-btn').addEventListener('click', async () => {
            await removeBankAccountFromFirestore(entry, { bank, accountNumber, holder });
            bankAccountsContainer.removeChild(entry);
        });
    }

    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            alert('Debes estar autenticado para editar una tienda.');
            window.location.href = 'index.html';
            return;
        }

        async function loadStoreData() {
            try {
                const storeRef = doc(db, 'stores', storeId);
                const storeDoc = await getDoc(storeRef);

                if (!storeDoc.exists()) {
                    alert('La tienda no existe.');
                    window.location.href = 'index.html';
                    return;
                }

                const storeData = storeDoc.data();

                if (storeData.owner !== user.uid) {
                    alert('No tienes permiso para editar esta tienda.');
                    window.location.href = 'index.html';
                    return;
                }

                document.getElementById('name').value = storeData.name || '';
                document.getElementById('username').value = storeData.username || '';
                document.getElementById('phone').value = storeData.phone || '';
                document.getElementById('description').value = storeData.description || '';
                

                // Cargar datos bancarios
                bankAccountsContainer.innerHTML = '';
                if (storeData.bankAccounts && storeData.bankAccounts.length > 0) {
                    storeData.bankAccounts.forEach(({ bank, accountNumber, holder }) => {
                        displayBankAccount(bank, accountNumber, holder);
                    });
                }

                const currentImage = document.getElementById('currentImage');
                const currentCoverImage = document.getElementById('currentCoverImage');

                if (storeData.imageUrl) {
                    currentImage.src = storeData.imageUrl;
                    currentImage.classList.remove('hidden');
                } else {
                    currentImage.classList.add('hidden');
                }

                if (storeData.coverUrl) {
                    currentCoverImage.src = storeData.coverUrl;
                    currentCoverImage.classList.remove('hidden');
                } else {
                    currentCoverImage.classList.add('hidden');
                }

                // Cargar zonas de entrega
                loadDeliveryZonesFromStore(storeData);

                // Cargar horarios de apertura
                const openingHours = storeData.openingHours || {};
                daysOfWeek.forEach(day => {
                    const openInput = openingHoursFields.querySelector(`input.open-time[data-day="${day.key}"]`);
                    const closeInput = openingHoursFields.querySelector(`input.close-time[data-day="${day.key}"]`);
                    const closedCheckbox = openingHoursFields.querySelector(`input.closed-checkbox[data-day="${day.key}"]`);
                    if (openingHours[day.key]) {
                        openInput.value = openingHours[day.key].open || '';
                        closeInput.value = openingHours[day.key].close || '';
                        closedCheckbox.checked = false;
                        openInput.disabled = false;
                        closeInput.disabled = false;
                    } else {
                        openInput.value = '';
                        closeInput.value = '';
                        closedCheckbox.checked = true;
                        openInput.disabled = true;
                        closeInput.disabled = true;
                    }
                    closedCheckbox.addEventListener('change', () => {
                        openInput.disabled = closedCheckbox.checked;
                        closeInput.disabled = closedCheckbox.checked;
                    });
                });

                // Cargar ubicación de la tienda
                document.getElementById('storeLat').value = storeData.lat || '';
                document.getElementById('storeLng').value = storeData.lng || '';
                document.getElementById('storeReference').value = storeData.reference || '';
                if (storeData.locationImageUrl) {
                    const img = document.getElementById('currentLocationImage');
                    img.src = storeData.locationImageUrl;
                    img.classList.remove('hidden');
                } else {
                    document.getElementById('currentLocationImage').classList.add('hidden');
                }

                // Inicializa el mapa de ubicación SOLO después de llenar los campos
                initStoreLocationMap();
            } catch (error) {
                alert('Error al cargar los datos de la tienda: ' + error.message);
                window.location.href = 'index.html';
            }
        }

        await loadStoreData();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const user = auth.currentUser;
        if (!user) {
            alert('Debes estar autenticado para actualizar la tienda.');
            window.location.href = 'index.html';
            return;
        }

        const name = document.getElementById('name').value;
        const username = document.getElementById('username').value;
        const phone = document.getElementById('phone').value;
        const description = document.getElementById('description').value;
        const imageUrlFile = document.getElementById('imageUrl').files[0];
        const coverImageFile = document.getElementById('coverImage').files[0];

        // Verificar si el username ya está en uso (excepto si es el mismo)
        if (username) {
            try {
                const storesRef = collection(db, 'stores');
                const q = query(storesRef, where('username', '==', username));
                const querySnapshot = await getDocs(q);
                
                // Verificar si hay algún documento que no sea el actual
                let found = false;
                querySnapshot.forEach((doc) => {
                    if (doc.id !== storeId) {
                        found = true;
                    }
                });
                
                if (found) {
                    alert('El nombre de usuario ya está en uso. Por favor, elija otro.');
                    return;
                }
            } catch (error) {
                console.error('Error al verificar el username:', error);
                alert('Error al verificar el nombre de usuario. Por favor, intenta de nuevo.');
                return;
            }
        }

        // Recolectar datos bancarios
        const bankAccounts = [];
        const displays = bankAccountsContainer.querySelectorAll('.bank-account-display');
        displays.forEach((entry) => {
            const bank = entry.querySelector('p:nth-child(1)').textContent.replace('Banco: ', '');
            const accountNumber = entry.querySelector('p:nth-child(2)').textContent.replace('Número de cuenta: ', '');
            const holder = entry.querySelector('p:nth-child(3)').textContent.replace('Titular: ', '');
            if (bank !== 'No especificado' || accountNumber !== 'No especificado' || holder !== 'No especificado') {
                bankAccounts.push({ bank, accountNumber, holder });
            }
        });

        const entries = bankAccountsContainer.querySelectorAll('.bank-account-entry');
        entries.forEach((entry) => {
            const bank = entry.querySelector('input[name="bank"]').value;
            const accountNumber = entry.querySelector('input[name="accountNumber"]').value;
            const holder = entry.querySelector('input[name="holder"]').value;
            if (bank || accountNumber || holder) {
                bankAccounts.push({ bank, accountNumber, holder });
            }
        });

        // Recolectar horario de atención
        const openingHours = {};
        daysOfWeek.forEach(day => {
            const openInput = openingHoursFields.querySelector(`input.open-time[data-day="${day.key}"]`);
            const closeInput = openingHoursFields.querySelector(`input.close-time[data-day="${day.key}"]`);
            const closedCheckbox = openingHoursFields.querySelector(`input.closed-checkbox[data-day="${day.key}"]`);
            if (!closedCheckbox.checked && openInput.value && closeInput.value) {
                openingHours[day.key] = {
                    open: openInput.value,
                    close: closeInput.value
                };
            } else {
                openingHours[day.key] = null;
            }
        });

        try {
            const lat = document.getElementById('storeLat').value;
const lng = document.getElementById('storeLng').value;
const reference = document.getElementById('storeReference').value;
const locationImageFile = document.getElementById('storeLocationImage').files[0];

const storeData = {
    name,
    username,
    phone,
    description,
    email: user.email,
    owner: user.uid,
    storeId,
    
    bankAccounts,
    updatedAt: new Date().toISOString(),
    openingHours, // <--- AGREGA ESTA LÍNEA
    lat,
    lng,
    reference,
};

            if (imageUrlFile) {
                const imageRef = ref(storage, `stores/${storeId}/profile_${Date.now()}`);
                await uploadBytes(imageRef, imageUrlFile);
                storeData.imageUrl = await getDownloadURL(imageRef);
            }

            if (coverImageFile) {
                const coverRef = ref(storage, `stores/${storeId}/cover_${Date.now()}`);
                await uploadBytes(coverRef, coverImageFile);
                storeData.coverUrl = await getDownloadURL(coverRef);
            }

            if (locationImageFile) {
                const locationImageRef = ref(storage, `stores/${storeId}/location_${Date.now()}`);
                await uploadBytes(locationImageRef, locationImageFile);
                storeData.locationImageUrl = await getDownloadURL(locationImageRef);
            }

            // Agregar zonas de entrega a los datos de la tienda
            storeData.deliveryZones = deliveryZones;
            console.log('Zonas a guardar:', deliveryZones); // <-- Agrega esto
            await setDoc(doc(db, 'stores', storeId), storeData, { merge: true });
            alert('¡Tienda actualizada exitosamente!');
            window.location.href = `store.html?storeId=${storeId}`;
        } catch (error) {
            alert('Error al actualizar la tienda: ' + error.message);
        }
    });

    const sidebar = document.querySelector('.edit-store-sidebar');
    const buttons = sidebar.querySelectorAll('button[data-section]');
    const sections = document.querySelectorAll('.edit-section');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Quitar activo de todos
            buttons.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            // Activar el seleccionado
            btn.classList.add('active');
            const section = document.getElementById('section-' + btn.dataset.section);
            if (section) section.classList.add('active');
        });
    });

    // --- DATOS GENERALES ---
document.getElementById('editStoreForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const storeId = window.getStoreId();
  const name = document.getElementById('name').value;
  const username = document.getElementById('username').value;
  const phone = document.getElementById('phone').value;
  const description = document.getElementById('description').value;

  // Validación básica
  if (!name || !username) {
    alert('Nombre y usuario son obligatorios.');
    return;
  }

  // Verificar si el username ya está en uso (excepto si es el mismo)
  try {
    const storesRef = collection(db, 'stores');
    const q = query(storesRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);
    let found = false;
    querySnapshot.forEach((docu) => {
      if (docu.id !== storeId) found = true;
    });
    if (found) {
      alert('El nombre de usuario ya está en uso. Por favor, elija otro.');
      return;
    }
  } catch (error) {
    alert('Error al verificar el nombre de usuario.');
    return;
  }

  try {
    await setDoc(doc(db, 'stores', storeId), {
      name,
      username,
      phone,
      description,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    alert('Datos generales guardados correctamente.');
  } catch (error) {
    alert('Error al guardar datos generales: ' + error.message);
  }
});

// --- IMÁGENES ---
document.getElementById('editImagesForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const storeId = window.getStoreId();
  const imageUrlFile = document.getElementById('imageUrl').files[0];
  const coverImageFile = document.getElementById('coverImage').files[0];
  let updates = {};

  if (imageUrlFile) {
    const imageRef = ref(storage, `stores/${storeId}/profile_${Date.now()}`);
    await uploadBytes(imageRef, imageUrlFile);
    updates.imageUrl = await getDownloadURL(imageRef);
  }
  if (coverImageFile) {
    const coverRef = ref(storage, `stores/${storeId}/cover_${Date.now()}`);
    await uploadBytes(coverRef, coverImageFile);
    updates.coverUrl = await getDownloadURL(coverRef);
  }
  if (Object.keys(updates).length > 0) {
    await setDoc(doc(db, 'stores', storeId), updates, { merge: true });
    alert('Imágenes actualizadas correctamente.');
  } else {
    alert('No seleccionaste ninguna imagen.');
  }
});

// --- BANCOS ---
document.getElementById('editBanksForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const storeId = window.getStoreId();
  // Recolectar cuentas bancarias de los inputs
  const bankAccounts = [];
  document.querySelectorAll('.bank-account-entry').forEach(entry => {
    const bank = entry.querySelector('input[name="bank"]').value;
    const accountNumber = entry.querySelector('input[name="accountNumber"]').value;
    const holder = entry.querySelector('input[name="holder"]').value;
    if (bank || accountNumber || holder) {
      bankAccounts.push({ bank, accountNumber, holder });
    }
  });
  try {
    await setDoc(doc(db, 'stores', storeId), { bankAccounts }, { merge: true });
    alert('Cuentas bancarias guardadas correctamente.');
  } catch (error) {
    alert('Error al guardar bancos: ' + error.message);
  }
});

// --- ZONAS ---
document.getElementById('editZonesForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const storeId = window.getStoreId();
  // deliveryZones debe estar en memoria (ya lo tienes en tu código)
  try {
    await setDoc(doc(db, 'stores', storeId), { deliveryZones }, { merge: true });
    alert('Zonas de cobertura guardadas correctamente.');
  } catch (error) {
    alert('Error al guardar zonas: ' + error.message);
  }
});

// --- HORARIO ---
document.getElementById('editHoursForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const storeId = window.getStoreId();
  // Recolectar horario de atención
  const openingHours = {};
  daysOfWeek.forEach(day => {
    const openInput = openingHoursFields.querySelector(`input.open-time[data-day="${day.key}"]`);
    const closeInput = openingHoursFields.querySelector(`input.close-time[data-day="${day.key}"]`);
    const closedCheckbox = openingHoursFields.querySelector(`input.closed-checkbox[data-day="${day.key}"]`);
    if (!closedCheckbox.checked && openInput.value && closeInput.value) {
      openingHours[day.key] = {
        open: openInput.value,
        close: closeInput.value
      };
    } else {
      openingHours[day.key] = null;
    }
  });
  try {
    await setDoc(doc(db, 'stores', storeId), { openingHours }, { merge: true });
    alert('Horario guardado correctamente.');
  } catch (error) {
    alert('Error al guardar horario: ' + error.message);
  }
});

// --- UBICACIÓN ---
document.getElementById('editLocationForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const storeId = window.getStoreId();
  const lat = document.getElementById('storeLat').value;
  const lng = document.getElementById('storeLng').value;
  const reference = document.getElementById('storeReference').value;
  const locationImageFile = document.getElementById('storeLocationImage').files[0];
  let updates = { lat, lng, reference };

  if (locationImageFile) {
    const locationImageRef = ref(storage, `stores/${storeId}/location_${Date.now()}`);
    await uploadBytes(locationImageRef, locationImageFile);
    updates.locationImageUrl = await getDownloadURL(locationImageRef);
  }
  try {
    await setDoc(doc(db, 'stores', storeId), updates, { merge: true });
    alert('Ubicación guardada correctamente.');
  } catch (error) {
    alert('Error al guardar ubicación: ' + error.message);
  }
});
});

// Función para eliminar una cuenta bancaria de Firestore
async function removeBankAccountFromFirestore(entry, accountToRemove) {
    const storeRef = doc(db, 'stores', getStoreId());
    const storeSnap = await getDoc(storeRef);
    if (storeSnap.exists() && Array.isArray(storeSnap.data().bankAccounts)) {
        let bankAccounts = storeSnap.data().bankAccounts;
        // Si se pasa la cuenta a eliminar, filtrarla
        if (accountToRemove) {
            bankAccounts = bankAccounts.filter(acc =>
                acc.bank !== accountToRemove.bank ||
                acc.accountNumber !== accountToRemove.accountNumber ||
                acc.holder !== accountToRemove.holder
            );
        }
        await setDoc(storeRef, { bankAccounts }, { merge: true });
    }
}

// Funciones para las zonas de entrega
// Inicializa el mapa y DrawingManager
function initDeliveryZonesMap(center = { lat: -1.843254, lng: -79.990611 }) {
    map = new google.maps.Map(document.getElementById('deliveryZonesMap'), {
        center,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
    });

    drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        polygonOptions: {
            fillColor: '#2196f3',
            fillOpacity: 0.2,
            strokeWeight: 2,
            clickable: true,
            editable: true,
            zIndex: 1
        }
    });
    drawingManager.setMap(map);

    // Al terminar de dibujar un polígono
    google.maps.event.addListener(drawingManager, 'polygoncomplete', function(polygon) {
        const path = polygon.getPath().getArray().map(latlng => ({
            lat: latlng.lat(),
            lng: latlng.lng()
        }));

        // Mostrar modal
        const modal = document.getElementById('zoneModal');
        const form = document.getElementById('zoneForm');
        const nameInput = document.getElementById('zoneName');
        const shippingInput = document.getElementById('zoneShipping');
        const cancelBtn = document.getElementById('cancelZoneBtn');

        nameInput.value = '';
        shippingInput.value = '';
        modal.style.display = 'flex';

        // Cancelar
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            polygon.setMap(null);
            drawingManager.setDrawingMode(null);
        };

        // Guardar zona
        form.onsubmit = (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            const shipping = parseFloat(shippingInput.value);
            if (name && !isNaN(shipping)) {
                deliveryZones.push({ name, shipping, polygon: path });
                localStorage.setItem('deliveryZonesDraft', JSON.stringify(deliveryZones));
                renderZonesList();
                drawAllZones();
            }
            modal.style.display = 'none';
            polygon.setMap(null);
            drawingManager.setDrawingMode(null);
        };
    });
}

// Dibuja todos los polígonos guardados
function drawAllZones() {
    if (!map) return;
    // Limpia los overlays previos
    if (window._zonePolygons) {
        window._zonePolygons.forEach(p => p.setMap(null));
    }
    window._zonePolygons = [];
    deliveryZones.forEach(zone => {
        const poly = new google.maps.Polygon({
            paths: zone.polygon,
            fillColor: '#2196f3',
            fillOpacity: 0.2,
            strokeWeight: 2,
            editable: false,
            map
        });
        window._zonePolygons.push(poly);
    });
}

// Renderiza la lista de zonas
function renderZonesList() {
    const list = document.getElementById('zonesList');
    list.innerHTML = '';
    deliveryZones.forEach((zone, idx) => {
        const div = document.createElement('div');
        div.className = 'mb-1 flex items-center gap-2';
        div.innerHTML = `<span class="font-semibold">${zone.name}</span>
            <span class="text-gray-600 ml-2">($${zone.shipping?.toFixed(2) ?? '0.00'})</span>
            <button type="button" class="bg-red-500 text-white px-2 py-0.5 rounded delete-zone-btn" data-idx="${idx}">Eliminar</button>`;
        list.appendChild(div);
    });
    // Eliminar zona
    list.querySelectorAll('.delete-zone-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const idx = parseInt(btn.dataset.idx);
            deliveryZones.splice(idx, 1);
            renderZonesList();
            drawAllZones();
            // Al agregar o eliminar zonas:
            localStorage.setItem('deliveryZonesDraft', JSON.stringify(deliveryZones));
        });
    });
}

// Botón para agregar zona
document.getElementById('addZoneBtn').addEventListener('click', () => {
    drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
});

// Inicializa el mapa cuando Google Maps esté listo
window.initDeliveryZonesMap = initDeliveryZonesMap;

// 2. Inicializa el mapa después de cargar el draft
loadGoogleMapsScript(() => {
    initDeliveryZonesMap();
});

// Cargar zonas existentes al editar
async function loadDeliveryZonesFromStore(storeData) {
    deliveryZones = Array.isArray(storeData.deliveryZones) ? storeData.deliveryZones : [];
    drawAllZones();
    renderZonesList();
}

// Función para cargar el script de Google Maps
function loadGoogleMapsScript(callback) {
    // Si ya está cargado, solo llama al callback
    if (window.google && window.google.maps && window.google.maps.drawing) {
        callback();
        return;
    }
    // Si ya existe un <script> con Google Maps, espera a que cargue
    if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
        // Espera hasta que google.maps esté disponible
        const waitForGoogleMaps = () => {
            if (window.google && window.google.maps && window.google.maps.drawing) {
                callback();
            } else {
                setTimeout(waitForGoogleMaps, 50);
            }
        };
        waitForGoogleMaps();
        return;
    }
    // Si no existe, agrégalo
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=drawing&loading=async`;
    script.async = true;
    script.onload = () => {
        const waitForGoogleMaps = () => {
            if (window.google && window.google.maps && window.google.maps.drawing) {
                callback();
            } else {
                setTimeout(waitForGoogleMaps, 50);
            }
        };
        waitForGoogleMaps();
    };
    document.head.appendChild(script);
}

localStorage.removeItem('deliveryZonesDraft');

const daysOfWeek = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
];

const openingHoursFields = document.getElementById('openingHoursFields');
if (openingHoursFields) {
    daysOfWeek.forEach(day => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2';
        row.innerHTML = `
            <label class="w-24">${day.label}</label>
            <input type="time" class="open-time border rounded p-1" data-day="${day.key}" data-type="open">
            <span>a</span>
            <input type="time" class="close-time border rounded p-1" data-day="${day.key}" data-type="close">
            <label class="ml-2">
                <input type="checkbox" class="closed-checkbox" data-day="${day.key}"> Cerrado
            </label>
        `;
        openingHoursFields.appendChild(row);
    });
}

// --- Ubicación de la tienda ---
let storeMarker = null;

function initStoreLocationMap(center = { lat: -1.843254, lng: -79.990611 }) {
    const mapDiv = document.getElementById('storeLocationMap');
    if (!mapDiv) return;
    const latInput = document.getElementById('storeLat');
    const lngInput = document.getElementById('storeLng');
    let lat = parseFloat(latInput.value);
    let lng = parseFloat(lngInput.value);

    // Si hay lat/lng válidos, usa esos como centro
    if (!isNaN(lat) && !isNaN(lng)) {
        center = { lat, lng };
    }

    const map = new google.maps.Map(mapDiv, {
        center,
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
    });

    storeMarker = new google.maps.Marker({
        position: center,
        map,
        draggable: true,
        title: "Ubicación de la tienda"
    });

    // Actualiza inputs al mover el marcador
    storeMarker.addListener('dragend', function (e) {
        latInput.value = e.latLng.lat().toFixed(6);
        lngInput.value = e.latLng.lng().toFixed(6);
    });

    // Al hacer click en el mapa, mueve el marcador
    map.addListener('click', function (e) {
        storeMarker.setPosition(e.latLng);
        latInput.value = e.latLng.lat().toFixed(6);
        lngInput.value = e.latLng.lng().toFixed(6);
    });

    // Si no hay coordenadas, intenta obtener la ubicación actual
    if (isNaN(lat) || isNaN(lng)) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                map.setCenter(pos);
                storeMarker.setPosition(pos);
                latInput.value = pos.lat.toFixed(6);
                lngInput.value = pos.lng.toFixed(6);
            });
        }
    }
}

// Cargar el script de Google Maps y luego inicializar el mapa de ubicación
loadGoogleMapsScript(() => {
    initDeliveryZonesMap();
    initStoreLocationMap();
});

document.getElementById('getCurrentLocationBtn').addEventListener('click', function () {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            document.getElementById('storeLat').value = lat.toFixed(6);
            document.getElementById('storeLng').value = lng.toFixed(6);
            if (storeMarker && storeMarker.setPosition) {
                storeMarker.setPosition({ lat, lng });
            }
            // Centrar el mapa si existe
            const mapDiv = document.getElementById('storeLocationMap');
            if (mapDiv && mapDiv.__gm && mapDiv.__gm.map) {
                mapDiv.__gm.map.setCenter({ lat, lng });
            }
        }, () => {
            alert('No se pudo obtener la ubicación actual.');
        });
    } else {
        alert('La geolocalización no está soportada en este navegador.');
    }
});