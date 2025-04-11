import { getFirestore, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { app, auth } from './firebase-config.js';

// Inicializa Firestore y Storage
const db = getFirestore(app);
const storage = getStorage(app);

document.addEventListener('DOMContentLoaded', async () => {
    const productsList = document.getElementById('products-list');
    const addProductBtn = document.getElementById('add-product-btn');
    const addProductForm = document.getElementById('add-product-form');
    const productForm = document.getElementById('productForm');
    const cancelAddProduct = document.getElementById('cancel-add-product');

    let storeId = null;

    // Verificar si el usuario está autenticado
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                // Obtener el ID de la tienda desde la URL
                const params = new URLSearchParams(window.location.search);
                storeId = params.get('storeId');

                if (!storeId) {
                    productsList.innerHTML = '<p>No se proporcionó un ID de tienda.</p>';
                    return;
                }

                // Cargar los productos de la tienda
                const productsRef = collection(db, `stores/${storeId}/products`);
                const querySnapshot = await getDocs(productsRef);

                if (querySnapshot.empty) {
                    productsList.innerHTML = '<p>No hay productos registrados.</p>';
                    return;
                }

                // Mostrar los productos en la lista
                querySnapshot.forEach((doc) => {
                    const product = doc.data();
                    const productElement = document.createElement('div');
                    productElement.classList.add('product-item');
                    productElement.innerHTML = `
                        <h3>${product.name}</h3>
                        <p><strong>Precio:</strong> $${product.price.toFixed(2)}</p>
                        <p><strong>Descripción:</strong> ${product.description}</p>
                        <img src="${product.imageUrl}" alt="${product.name}" style="width: 100px; height: 100px;">
                    `;
                    productsList.appendChild(productElement);
                });
            } catch (error) {
                console.error('Error al cargar los productos:', error);
                productsList.innerHTML = '<p>Hubo un error al cargar los productos. Por favor, inténtalo de nuevo más tarde.</p>';
            }
        } else {
            alert('Por favor, inicia sesión para gestionar los productos.');
            window.location.href = '/login.html';
        }
    });

    // Mostrar el formulario para agregar un producto
    addProductBtn.addEventListener('click', () => {
        addProductForm.style.display = 'block';
    });

    // Ocultar el formulario para agregar un producto
    cancelAddProduct.addEventListener('click', () => {
        addProductForm.style.display = 'none';
    });

    // Manejar el envío del formulario para agregar un producto
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const productName = document.getElementById('productName').value;
        const productPrice = parseFloat(document.getElementById('productPrice').value);
        const productDescription = document.getElementById('productDescription').value;
        const productImage = document.getElementById('productImage').files[0];

        if (!productImage) {
            alert('Por favor, selecciona una imagen para el producto.');
            return;
        }

        try {
            // Subir la imagen al almacenamiento
            const imageRef = ref(storage, `stores/${storeId}/products/${productImage.name}`);
            await uploadBytes(imageRef, productImage);
            const imageUrl = await getDownloadURL(imageRef);

            // Guardar el producto en Firestore
            const productData = {
                name: productName,
                price: productPrice,
                description: productDescription,
                imageUrl,
                createdAt: new Date().toISOString(),
            };

            const productsRef = collection(db, `stores/${storeId}/products`);
            await addDoc(productsRef, productData);

            alert('¡Producto agregado exitosamente!');
            window.location.reload(); // Recargar la página para mostrar el nuevo producto
        } catch (error) {
            console.error('Error al agregar el producto:', error);
            alert('Hubo un error al agregar el producto. Por favor, inténtalo de nuevo.');
        }
    });
});