// register.js
import { 
    auth, 
    db, 
    doc, 
    setDoc, 
    storage, 
    ref, 
    uploadBytes 
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
                const coverImageFile = document.getElementById('coverImage').files[0];
                const imageUrlFile = document.getElementById('imageUrl').files[0];
                let coverURL = ''; // Cambiado de coverImageUrl a coverURL
                let imageUrl = '';

                if (coverImageFile) {
                    const coverRef = ref(storage, `stores/${user.uid}/cover_${Date.now()}`);
                    await uploadBytes(coverRef, coverImageFile);
                    coverURL = await getDownloadURL(coverRef); // Cambiado de coverImageUrl a coverURL
                }

                if (imageUrlFile) {
                    const imageRef = ref(storage, `stores/${user.uid}/profile_${Date.now()}`);
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
                    coverURL, // Cambiado de coverImageUrl a coverURL
                    imageUrl,
                };
                await setDoc(doc(db, 'stores', user.uid), storeData);
                alert('¡Registro como tienda exitoso!');
                window.location.href = 'dashboard-store.html'; // Dashboard de tienda
            }
        } catch (error) {
            console.error('Error al registrar:', error.message);
            alert('Error al registrar: ' + error.message);
        }
    });
});