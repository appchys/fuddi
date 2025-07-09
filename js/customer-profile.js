import { app, auth } from './firebase-config.js';
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Initialize Firestore
const db = getFirestore(app);

// Función para cargar los datos del cliente
async function loadCustomerProfile() {
    const user = auth.currentUser;
    if (!user) {
        alert("Por favor, inicia sesión para editar tu perfil.");
        window.location.href = "/login.html";
        return;
    }

    // Referencia a la colección "users"
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
        const customer = userDoc.data();

        // Mostrar el nombre del cliente en el formulario
        const customerNameInput = document.getElementById('customer-name-input');
        if (customerNameInput) {
            customerNameInput.value = customer.name || "";
        }

        // Mostrar el teléfono
        const customerPhoneInput = document.getElementById('customer-phone-input');
        if (customerPhoneInput) {
            customerPhoneInput.value = customer.phone || "";
        }

        // Mostrar fotos de portada y perfil
        if (customer.coverUrl) {
            document.getElementById('customer-cover-image').style.backgroundImage = `url(${customer.coverUrl})`;
        }
        if (customer.profileUrl) {
            document.getElementById('customer-profile-image').src = customer.profileUrl;
        }
    } else {
        console.error("No se encontraron datos del cliente.");
    }
}

// Función para guardar los cambios del perfil
async function saveCustomerProfile(event) {
    event.preventDefault();

    const user = auth.currentUser;
    if (!user) {
        alert("Por favor, inicia sesión para guardar los cambios.");
        return;
    }

    const userRef = doc(db, "users", user.uid);
    const updatedData = {
        name: document.getElementById('customer-name-input').value,
        phone: document.getElementById('customer-phone-input').value,
    };

    // Subir nuevas imágenes si se seleccionaron
    const coverFile = document.getElementById('customer-cover-input').files[0];
    const profileFile = document.getElementById('customer-profile-input').files[0];

    if (coverFile) {
        updatedData.coverUrl = await uploadFileToStorage(coverFile, `users/${user.uid}/cover`);
    }
    if (profileFile) {
        updatedData.profileUrl = await uploadFileToStorage(profileFile, `users/${user.uid}/profile`);
    }

    await updateDoc(userRef, updatedData);
    alert("Perfil actualizado correctamente.");
    loadCustomerProfile(); // Recargar los datos actualizados
}

// Función para subir archivos a Firebase Storage
async function uploadFileToStorage(file, path) {
    const storage = getStorage(app);
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

// Escuchar el evento de envío del formulario
document.getElementById('edit-customer-form').addEventListener('submit', saveCustomerProfile);

// Cargar los datos del cliente al cargar la página
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadCustomerProfile();
    } else {
        alert("Por favor, inicia sesión para acceder a esta página.");
        window.location.href = "/login.html";
    }
});