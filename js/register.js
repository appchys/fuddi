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
    const clientButton = document.getElementById('clientButton');
    const storeButton = document.getElementById('storeButton');
    const accountTypeInput = document.getElementById('accountType');
    const storeFields = document.getElementById('storeFields');

    // Manejar clic en el botón "Cliente"
    clientButton.addEventListener('click', () => {
        accountTypeInput.value = 'client';
        storeFields.style.display = 'none'; // Ocultar campos de tienda
        clientButton.classList.add('selected');
        storeButton.classList.remove('selected');

        // Eliminar el atributo "required" de los campos de tienda
        document.getElementById('description').removeAttribute('required');
        document.getElementById('storeId').removeAttribute('required');
        document.getElementById('imageUrl').removeAttribute('required');
        document.getElementById('coverImage').removeAttribute('required');
    });

    // Manejar clic en el botón "Tienda"
    storeButton.addEventListener('click', () => {
        accountTypeInput.value = 'store';
        storeFields.style.display = 'block'; // Mostrar campos de tienda
        storeButton.classList.add('selected');
        clientButton.classList.remove('selected');

        // Agregar el atributo "required" a los campos de tienda
        document.getElementById('description').setAttribute('required', 'true');
        document.getElementById('storeId').setAttribute('required', 'true');
        document.getElementById('imageUrl').setAttribute('required', 'true');
        document.getElementById('coverImage').setAttribute('required', 'true');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const user = auth.currentUser;
        if (!user) {
            alert('No estás autenticado. Por favor, inicia sesión.');
            window.location.href = 'index.html';
            return;
        }

        const accountType = accountTypeInput.value; // Obtener el tipo de cuenta seleccionado
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
                window.location.href = 'index.html'; // Redirigir a inicio
            } else if (accountType === 'store') {
                const storeId = document.getElementById('storeId').value.trim();
                if (!storeId) {
                    alert('Por favor, ingrese un ID único para la tienda.');
                    return;
                }

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
                    storeId, // Guardar el storeId explícitamente como un campo
                    name,
                    phone,
                    description,
                    email: user.email,
                    owner: user.uid,
                    createdAt: new Date().toISOString(),
                    coverUrl, // Puede ser una cadena vacía si no se subió imagen
                    imageUrl, // Puede ser una cadena vacía si no se subió imagen
                };
                await setDoc(doc(db, 'stores', storeId), storeData);
                alert('¡Registro como tienda exitoso!');
                window.location.href = `store.html?storeId=${storeId}`;
            }
        } catch (error) {
            console.error('Error al registrar:', error.message);
            alert('Error al registrar: ' + error.message);
        }
    });
});