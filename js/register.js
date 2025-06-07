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
    getDownloadURL,
    googleProvider,
    signInWithPopup,
    collection,
    query,
    where,
    getDocs
} from './firebase-config.js';

console.log('Firebase auth:', auth);
console.log('Google provider:', googleProvider);

// Función para verificar si el usuario existe en Firestore
async function checkUserExists(userId) {
    console.log('Verificando si el usuario existe:', userId);
    const userDoc = doc(db, 'users', userId);
    const userSnapshot = await getDoc(userDoc);
    if (userSnapshot.exists()) {
        console.log('Usuario encontrado en colección users');
        return { exists: true, type: 'client', data: userSnapshot.data() };
    }

    const storeDoc = doc(db, 'stores', userId);
    const storeSnapshot = await getDoc(storeDoc);
    if (storeSnapshot.exists()) {
        console.log('Usuario encontrado en colección stores');
        return { exists: true, type: 'store', data: storeSnapshot.data() };
    }

    console.log('Usuario no encontrado');
    return { exists: false };
}

// Función para mostrar el formulario de registro
function showRegisterForm() {
    console.log('showRegisterForm called');
    const registerContainer = document.querySelector('.register-container');
    const formContent = document.getElementById('registerForm');
    const googleButton = document.querySelector('.btn-google');
    
    // Asegurarse de que el formulario esté en el DOM
    if (formContent) {
        // Eliminar la clase hidden-content
        if (formContent.classList.contains('hidden-content')) {
            formContent.classList.remove('hidden-content');
        }
        
        // Asegurarse de que el formulario esté visible
        formContent.style.display = 'block';
        
        // Ocultar el botón de Google si ya hay un usuario autenticado
        if (googleButton) {
            googleButton.style.display = 'none';
        }
    }
}

// Función para iniciar sesión con Google
window.loginWithGoogle = async function () {
    try {
        console.log('Iniciando proceso de inicio de sesión...');
        
        // Usar signInWithPopup
        console.log('Iniciando popup...');
        const result = await signInWithPopup(auth, googleProvider);
        console.log('Popup completado');
        
        const user = result.user;
        console.log('Usuario autenticado:', user);
        console.log('UID:', user.uid);
        console.log('Email:', user.email);
        
        // Verificar si el usuario ya existe
        const userCheck = await checkUserExists(user.uid);
        console.log('Resultado de checkUserExists:', userCheck);
        
        if (userCheck.exists) {
            console.log('Usuario existente encontrado');
            alert('¡Bienvenido de nuevo, ' + user.displayName + '!');
            window.location.href = 'index.html';
        } else {
            console.log('Nuevo usuario, mostrando formulario');
            // Mostrar el formulario de registro
            showRegisterForm();
        }
    } catch (error) {
        console.error('Error al iniciar sesión con Google:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        
        // Mostrar mensaje de error más descriptivo
        let errorMessage = 'Error al iniciar sesión: ';
        switch (error.code) {
            case 'auth/popup-blocked':
                errorMessage += 'El popup fue bloqueado por el navegador. Por favor, intenta de nuevo y asegúrate de permitir los popups para este sitio.';
                break;
            case 'auth/popup-closed-by-user':
                errorMessage += 'Operación cancelada por el usuario';
                break;
            default:
                errorMessage += error.message;
        }
        
        alert(errorMessage);
    }
};

// Event listener para cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded event triggered');
    console.log('Estado inicial de autenticación:', auth.currentUser);
    
    // Ocultar el formulario inicialmente
    const formContent = document.getElementById('registerForm');
    if (formContent) {
        formContent.classList.add('hidden-content');
    }

    // Configurar el botón de Google
    const googleButton = document.getElementById('googleSignInButton');
    if (googleButton) {
        googleButton.addEventListener('click', window.loginWithGoogle);
    }

    // Verificar el estado de autenticación
    auth.onAuthStateChanged(async (user) => {
        console.log('onAuthStateChanged triggered');
        console.log('User state:', user);
        
        if (user) {
            console.log('User authenticated:', user.uid);
            showRegisterForm();
        } else {
            console.log('No user authenticated');
            // Asegurarse de que el botón de Google esté visible si no hay usuario
            if (googleButton) {
                googleButton.style.display = 'block';
            }
        }
    });

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
        document.getElementById('username').removeAttribute('required');
    });

    // Manejar clic en el botón "Tienda"
    storeButton.addEventListener('click', () => {
        accountTypeInput.value = 'store';
        storeFields.style.display = 'block'; // Mostrar campos de tienda
        storeButton.classList.add('selected');
        clientButton.classList.remove('selected');

        // Agregar evento para actualizar storeId cuando se ingrese username
        const usernameInput = document.getElementById('username');
        const storeIdInput = document.getElementById('storeId');
        
        usernameInput.addEventListener('input', (e) => {
            // Generar storeId basado en el username
            const username = e.target.value;
            if (username) {
                // Convertir a minúsculas y reemplazar espacios por guiones
                storeIdInput.value = username.toLowerCase().replace(/\s+/g, '-');
            }
        });

        // Agregar el atributo "required" a los campos de tienda
        document.getElementById('description').setAttribute('required', 'true');
        document.getElementById('username').setAttribute('required', 'true');
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
        const username = document.getElementById('username').value.trim();
        const storeId = document.getElementById('storeId').value.trim();

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
                if (!username) {
                    alert('Por favor, ingrese un nombre de usuario.');
                    return;
                }

                // Verificar si el username ya está en uso
                const storesRef = collection(db, 'stores');
                const q = query(storesRef, where('username', '==', username));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    alert('El nombre de usuario ya está en uso. Por favor, elija otro.');
                    return;
                }

                // Verificar si el storeId ya está en uso
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
                    storeId,
                    username,
                    name,
                    phone,
                    description,
                    email: user.email,
                    owner: user.uid,
                    createdAt: new Date().toISOString(),
                    coverUrl,
                    imageUrl,
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