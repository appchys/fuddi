import { getFirestore, collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { app, auth } from './firebase-config.js';

const db = getFirestore(app);
const storage = getStorage(app);

document.addEventListener('DOMContentLoaded', async () => {
    const productsList = document.getElementById('products-list');
    const addProductBtn = document.getElementById('add-product-btn');
    const productModal = document.getElementById('product-modal');
    const modalCloseBtn = document.querySelector('.modal-close');
    const cancelAddProduct = document.getElementById('cancel-add-product');
    const productForm = document.getElementById('productForm');
    const modalTitle = document.getElementById('modal-title');

    let storeId = null;
    let currentProductId = null;
    let isEditMode = false;

    // Funciones para manejar el modal
    const openModal = () => {
        productModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        productModal.classList.remove('active');
        document.body.style.overflow = '';
        resetForm();
    };

    const resetForm = () => {
        productForm.reset();
        currentProductId = null;
        isEditMode = false;
        modalTitle.innerHTML = '<i class="bi bi-plus-circle"></i> Agregar Producto';
    };

    // Event listeners para el modal
    addProductBtn.addEventListener('click', openModal);
    modalCloseBtn.addEventListener('click', closeModal);
    cancelAddProduct.addEventListener('click', closeModal);

    // Cerrar modal al hacer clic fuera del contenido
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) {
            closeModal();
        }
    });

    // Verificar autenticación
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            storeId = localStorage.getItem('storeId');
            
            if (!storeId) {
                productsList.innerHTML = '<p class="error">No se encontró un ID de tienda. Por favor, inicia sesión nuevamente.</p>';
                return;
            }

            await loadProducts();
        } else {
            alert('Por favor, inicia sesión para gestionar los productos.');
            window.location.href = '/login.html';
        }
    });

    // Cargar productos
    async function loadProducts() {
        try {
            const productsRef = collection(db, `stores/${storeId}/products`);
            const querySnapshot = await getDocs(productsRef);

            productsList.innerHTML = '';

            if (querySnapshot.empty) {
                productsList.innerHTML = `
                    <div class="empty-state">
                        <i class="bi bi-box-seam"></i>
                        <p>No hay productos registrados</p>
                    </div>
                `;
                return;
            }

            querySnapshot.forEach((doc) => {
                const product = doc.data();
                const productId = doc.id;
                
                const productElement = document.createElement('div');
                productElement.classList.add('product-item');
                productElement.innerHTML = `
                    <div class="product-info-container">
                        <div class="product-info">
                            <div class="product-image-container">
                                <img src="${product.imageUrl}" alt="${product.name}" class="product-image">
                            </div>
                            <div class="product-details">
                                <h3>${product.name}</h3>
                                <p class="price">$${product.price.toFixed(2)}</p>
                                <p class="description">${product.description}</p>
                            </div>
                            
                        </div>
                        <div class="product-actions">
                            <button class="btn" data-id="${productId}">
                                <i class="bi bi-pencil-square"></i>
                            </button>
                            <button class="btn" data-id="${productId}" data-image="${product.imageUrl}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
                productsList.appendChild(productElement);
            });

            // Agregar event listeners a los botones
            document.querySelectorAll('.btn').forEach(btn => {
                if (btn.querySelector('i.bi-pencil-square')) {
                    btn.addEventListener('click', handleEditProduct);
                } else if (btn.querySelector('i.bi-trash')) {
                    btn.addEventListener('click', handleDeleteProduct);
                }
            });

        } catch (error) {
            console.error('Error al cargar productos:', error);
            productsList.innerHTML = '<p class="error">Error al cargar los productos. Intente nuevamente.</p>';
        }
    }

    // Manejar edición de producto
    async function handleEditProduct(e) {
        currentProductId = e.currentTarget.dataset.id;
        isEditMode = true;
        
        try {
            const productDoc = doc(db, `stores/${storeId}/products`, currentProductId);
            const productSnapshot = await getDoc(productDoc);

            if (productSnapshot.exists()) {
                const product = productSnapshot.data();
                
                document.getElementById('productName').value = product.name;
                document.getElementById('productPrice').value = product.price;
                document.getElementById('productDescription').value = product.description;
                
                modalTitle.innerHTML = '<i class="bi bi-pencil-square"></i> Editar Producto';
                openModal();
            }
        } catch (error) {
            console.error('Error al cargar producto para editar:', error);
            alert('Error al cargar el producto para editar');
        }
    }

    // Manejar eliminación de producto
    async function handleDeleteProduct(e) {
        const productId = e.currentTarget.dataset.id;
        const imageUrl = e.currentTarget.dataset.image;

        if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
            try {
                // Eliminar de Firestore
                await deleteDoc(doc(db, `stores/${storeId}/products`, productId));
                
                // Eliminar imagen de Storage
                const imageRef = ref(storage, imageUrl);
                await deleteObject(imageRef);
                
                await loadProducts();
                alert('Producto eliminado correctamente');
            } catch (error) {
                console.error('Error al eliminar producto:', error);
                alert('Error al eliminar el producto');
            }
        }
    }

    // Manejar envío del formulario
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('productName').value;
        const price = parseFloat(document.getElementById('productPrice').value);
        const description = document.getElementById('productDescription').value;
        const imageFile = document.getElementById('productImage').files[0];

        if (!name || isNaN(price) || !description) {
            alert('Por favor complete todos los campos requeridos');
            return;
        }

        try {
            let imageUrl = '';
            
            // Si es modo edición y no se subió nueva imagen, mantener la existente
            if (!(isEditMode && !imageFile)) {
                if (!imageFile) {
                    alert('Por favor seleccione una imagen');
                    return;
                }
                
                // Subir nueva imagen
                const imageRef = ref(storage, `stores/${storeId}/products/${Date.now()}_${imageFile.name}`);
                await uploadBytes(imageRef, imageFile);
                imageUrl = await getDownloadURL(imageRef);
            }

            const productData = {
                name,
                price,
                description,
                ...(!(isEditMode && !imageFile) && { imageUrl }), // Solo actualiza imageUrl si no es modo edición o si se subió nueva imagen
                updatedAt: new Date().toISOString()
            };

            if (isEditMode) {
                // Actualizar producto existente
                await updateDoc(doc(db, `stores/${storeId}/products`, currentProductId), productData);
            } else {
                // Crear nuevo producto
                productData.createdAt = new Date().toISOString();
                await addDoc(collection(db, `stores/${storeId}/products`), productData);
            }

            closeModal();
            await loadProducts();
            alert(`Producto ${isEditMode ? 'actualizado' : 'agregado'} correctamente`);
            
        } catch (error) {
            console.error('Error al guardar producto:', error);
            alert('Error al guardar el producto');
        }
    });
});

// Agregar esto al archivo store-products.js

// Manejar la visualización del nombre del archivo y vista previa
document.getElementById('productImage').addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name || 'Ningún archivo seleccionado';
    document.getElementById('file-input-label').textContent = 
        e.target.files[0] ? 'Cambiar imagen' : 'Seleccionar imagen';
    document.getElementById('file-input-name').textContent = fileName;
    
    // Mostrar vista previa si es una imagen
    if (e.target.files[0] && e.target.files[0].type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const preview = document.getElementById('imagePreview');
            preview.src = event.target.result;
            document.getElementById('imagePreviewContainer').style.display = 'block';
        };
        reader.readAsDataURL(e.target.files[0]);
    } else {
        document.getElementById('imagePreviewContainer').style.display = 'none';
    }
});

// Mejorar el enfoque del modal al abrir
function openModal() {
    productModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    // Enfocar el primer campo al abrir el modal
    setTimeout(() => document.getElementById('productName').focus(), 100);
}