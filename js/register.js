// register.js
import { 
    auth, 
    db, 
    doc, 
    setDoc, 
    storage, 
    ref, 
    uploadBytes, 
    getDoc 
} from './firebase-config.js';
import { getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerForm');
    const accountTypeSelect = document.getElementById('accountType');
    const storeFields = document.getElementById('storeFields');

    // Mostrar/ocultar campos de tienda según selección
    accountTypeSelect.addEventListener('change', (e) => {
        storeFields.style.display = e.target.value === 'store' ? 'block' : 'none';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const user = auth.currentUser;
        if (!user) {
            alert('No estás autenticado. Por favor, inicia sesión.');
            window.location.href = 'index.html';
            return;
        }

        const accountType = accountTypeSelect.value;
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const description = document.getElementById('description').value;

        try {
            if (accountType === 'client') {
                const userData = {
                    name,
                    phone,
                    description,
                    createdAt: new Date().toISOString(),
                    email: user.email,
                };
                await setDoc(doc(db, 'users', user.uid), userData);
                alert('¡Registro como cliente exitoso!');
                window.location.href = 'dashboard-client.html'; // Dashboard de cliente
            } else if (accountType === 'store') {
                const storeId = document.getElementById('storeId').value.trim(); // Captura el storeId ingresado por el usuario
                if (!storeId) {
                    alert('Por favor, ingrese un ID único para la tienda.');
                    return;
                }

                // Verifica si el storeId ya existe
                const storeDoc = await getDoc(doc(db, 'stores', storeId));
                if (storeDoc.exists()) {
                    alert('El ID de la tienda ya está en uso. Por favor, elija otro.');
                    return;
                }

                const coverImageFile = document.getElementById('coverImage').files[0];
                const imageUrlFile = document.getElementById('imageUrl').files[0];
                let coverUrl = '';
                let imageUrl = '';

                if (coverImageFile) {
                    const coverRef = ref(storage, `stores/${storeId}/cover_${Date.now()}`);
                    await uploadBytes(coverRef, coverImageFile);
                    coverUrl = await getDownloadURL(coverRef);
                }

                if (imageUrlFile) {
                    const imageRef = ref(storage, `stores/${storeId}/profile_${Date.now()}`);
                    await uploadBytes(imageRef, imageUrlFile);
                    imageUrl = await getDownloadURL(imageRef);
                }

                const storeData = {
                    name,
                    phone,
                    description,
                    email: user.email,
                    owner: user.uid,
                    createdAt: new Date().toISOString(),
                    coverUrl,
                    imageUrl,
                };
                await setDoc(doc(db, 'stores', storeId), storeData); // Usa el storeId personalizado
                alert('¡Registro como tienda exitoso!');
                window.location.href = `dashboard-store.html?storeId=${storeId}`; // Redirige con el storeId
            }
        } catch (error) {
            console.error('Error al registrar:', error.message);
            alert('Error al registrar: ' + error.message);
        }
    });
});