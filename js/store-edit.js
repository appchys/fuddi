import { auth, db, doc, getDoc, setDoc, storage, ref, uploadBytes, collection, query, where, getDocs } from './firebase-config.js';
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
                document.getElementById('shippingFee').value = storeData.shippingFee || '';

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