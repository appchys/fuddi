import { auth, db, doc, getDoc, setDoc, storage, ref, uploadBytes } from './firebase-config.js';
import { getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js';

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
        entry.querySelector('.delete-btn').addEventListener('click', () => {
            bankAccountsContainer.removeChild(entry);
        });
    }

    // Función para añadir una entrada de cuenta bancaria editable
    function addBankAccountEntry(bank = '', accountNumber = '', holder = '') {
        const entry = document.createElement('div');
        entry.className = 'bank-account-entry';
        entry.innerHTML = `
            <div class="mb-2">
                <label class="block text-sm font-medium text-gray-700">Banco</label>
                <input type="text" name="bank" value="${bank}" 
                       class="mt-1 block w-full p-2 border border-gray-300 rounded-md">
            </div>
            <div class="mb-2">
                <label class="block text-sm font-medium text-gray-700">Número de cuenta</label>
                <input type="text" name="accountNumber" value="${accountNumber}" 
                       class="mt-1 block w-full p-2 border border-gray-300 rounded-md">
            </div>
            <div class="mb-2">
                <label class="block text-sm font-medium text-gray-700">Titular</label>
                <input type="text" name="holder" value="${holder}" 
                       class="mt-1 block w-full p-2 border border-gray-300 rounded-md">
            </div>
            <button type="button" class="delete-btn">Eliminar</button>
        `;
        bankAccountsContainer.appendChild(entry);

        // Evento para eliminar la entrada
        entry.querySelector('.delete-btn').addEventListener('click', () => {
            bankAccountsContainer.removeChild(entry);
        });
    }

    // Evento para añadir nueva cuenta editable
    addBankAccountButton.addEventListener('click', () => {
        addBankAccountEntry();
    });

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
                document.getElementById('shippingFee').value = storeData.shippingFee || '';

                // Cargar datos bancarios
                bankAccountsContainer.innerHTML = '';
                if (storeData.bankAccounts && storeData.bankAccounts.length > 0) {
                    storeData.bankAccounts.forEach(({ bank, accountNumber, holder }) => {
                        displayBankAccount(bank, accountNumber, holder);
                    });
                }
                addBankAccountEntry(); // Añadir una entrada editable vacía por defecto

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
        const shippingFee = document.getElementById('shippingFee').value;
        const imageUrlFile = document.getElementById('imageUrl').files[0];
        const coverImageFile = document.getElementById('coverImage').files[0];

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

        try {
            const storeData = {
                name,
                username,
                phone,
                description,
                email: user.email,
                owner: user.uid,
                storeId,
                shippingFee: shippingFee ? parseFloat(shippingFee) : null,
                bankAccounts,
                updatedAt: new Date().toISOString(),
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

            await setDoc(doc(db, 'stores', storeId), storeData, { merge: true });
            alert('¡Tienda actualizada exitosamente!');
            window.location.href = `store.html?storeId=${storeId}`;
        } catch (error) {
            alert('Error al actualizar la tienda: ' + error.message);
        }
    });
});