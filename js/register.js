// register.js
import { 
    auth, 
    db, 
    doc, 
    setDoc, 
    storage, 
    ref, 
    uploadBytes, 
    getDoc, 
    addDoc, 
    collection 
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
        const storeId = document.getElementById('storeId').value.trim(); // ID único ingresado por el usuario

        try {
            if (accountType === 'store') {
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
                    storeId, // Guardar el storeId ingresado por el usuario como un campo
                    name,
                    phone,
                    description,
                    email: user.email,
                    owner: user.uid,
                    createdAt: new Date().toISOString(),
                    coverUrl, // Puede ser una cadena vacía si no se subió imagen
                    imageUrl, // Puede ser una cadena vacía si no se subió imagen
                };

                // Generar automáticamente el ID del documento
                const storeRef = await addDoc(collection(db, 'stores'), storeData);
                const generatedStoreDocId = storeRef.id; // ID único generado por Firestore
                console.log('Tienda registrada con ID:', generatedStoreDocId);

                alert('¡Registro como tienda exitoso!');
                window.location.href = `store.html?storeDocId=${generatedStoreDocId}`;
            }
        } catch (error) {
            console.error('Error al registrar:', error.message);
            alert('Error al registrar: ' + error.message);
        }
    });
});