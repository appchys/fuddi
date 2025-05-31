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

    // Exponer storeId al scope global
    window.getStoreId = () => storeId;

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
            const q = query(productsRef); // Puedes agregar orderBy si quieres orden global
            const querySnapshot = await getDocs(q);

            const products = [];
            querySnapshot.forEach((doc) => {
                products.push({ id: doc.id, ...doc.data() });
            });

            // Ordena por el campo 'order' si existe, si no por nombre
            products.sort((a, b) => {
                if (typeof a.order === 'number' && typeof b.order === 'number') {
                    return a.order - b.order;
                }
                return a.name.localeCompare(b.name);
            });

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

            // Agrupa productos por colección
            const productsByCollection = {};
            products.forEach(product => {
                let collectionNames = [];
                if (Array.isArray(product.collection)) {
                    collectionNames = product.collection;
                } else if (typeof product.collection === 'string') {
                    collectionNames = [product.collection];
                } else {
                    collectionNames = ['Sin colección'];
                }
                collectionNames.forEach(col => {
                    if (!productsByCollection[col]) productsByCollection[col] = [];
                    productsByCollection[col].push(product);
                });
            });

            // Obtener el documento de la tienda para el orden de colecciones
            const storeDocSnap = await getDoc(doc(db, 'stores', storeId));
            let collectionsOrder = [];
            if (storeDocSnap.exists() && storeDocSnap.data().collectionsOrder) {
                collectionsOrder = storeDocSnap.data().collectionsOrder;
            }

            let sortedCollections = Object.entries(productsByCollection);

            // Ordenar colecciones según collectionsOrder
            if (collectionsOrder.length) {
                sortedCollections.sort(([a], [b]) => {
                    const idxA = collectionsOrder.indexOf(a);
                    const idxB = collectionsOrder.indexOf(b);
                    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                });
            } else {
                sortedCollections.sort(([a], [b]) => a.localeCompare(b));
            }

            // Renderizar cada colección como lista (igual que en store.js)
            sortedCollections.forEach(([collectionName, products], colIdx) => {
                const collectionTitle = document.createElement('h2');
                collectionTitle.classList.add('collection-title');
                collectionTitle.textContent = collectionName;

                // Botones de mover colección
                if (collectionsOrder.length) {
                    const upBtn = document.createElement('button');
                    upBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
                    upBtn.className = 'btn move-collection-up';
                    upBtn.disabled = colIdx === 0;
                    upBtn.title = 'Subir colección';

                    const downBtn = document.createElement('button');
                    downBtn.innerHTML = '<i class="bi bi-arrow-down"></i>';
                    downBtn.className = 'btn move-collection-down';
                    downBtn.disabled = colIdx === sortedCollections.length - 1;
                    downBtn.title = 'Bajar colección';

                    collectionTitle.appendChild(upBtn);
                    collectionTitle.appendChild(downBtn);

                    // Listeners para mover colección
                    upBtn.addEventListener('click', async () => {
                        if (colIdx === 0) return;
                        const newOrder = [...collectionsOrder];
                        const idx = newOrder.indexOf(collectionName);
                        if (idx > 0) {
                            [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                            await updateDoc(doc(db, 'stores', storeId), { collectionsOrder: newOrder });
                            loadProducts();
                        }
                    });
                    downBtn.addEventListener('click', async () => {
                        if (colIdx === sortedCollections.length - 1) return;
                        const newOrder = [...collectionsOrder];
                        const idx = newOrder.indexOf(collectionName);
                        if (idx < newOrder.length - 1) {
                            [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                            await updateDoc(doc(db, 'stores', storeId), { collectionsOrder: newOrder });
                            loadProducts();
                        }
                    });
                }

                productsList.appendChild(collectionTitle);

                // Crear el contenedor de productos para esta colección
                const collectionList = document.createElement('div');
                collectionList.className = 'products-container';

                products.forEach((product, idx) => {
                    const productElement = document.createElement('div');
                    productElement.classList.add('product');
                    productElement.setAttribute('data-product-id', product.id);

                    // Agrega la clase 'hidden' si el producto está oculto
                    if (product.hidden) {
                        productElement.classList.add('hidden');
                    }

                    productElement.innerHTML = `
                        <div class="product-image-container">
                            ${product.imageUrl ? `
                                <img src="${product.imageUrl}" alt="${product.name}" class="product-image">
                            ` : `
                                <div class="placeholder-image">
                                    <span>${product.name.charAt(0).toUpperCase()}</span>
                                </div>
                            `}
                        </div>
                        <div class="product-info">
                            <h3>${product.name}</h3>
                            <p class="description">${product.description || ''}</p>
                            <p class="price">$${product.price ? product.price.toFixed(2) : '0.00'}</p>
                        </div>
                        <div class="product-actions">
                            <button class="btn move-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Subir">
                                <i class="bi bi-arrow-up"></i>
                            </button>
                            <button class="btn move-down" data-idx="${idx}" ${idx === products.length - 1 ? 'disabled' : ''} title="Bajar">
                                <i class="bi bi-arrow-down"></i>
                            </button>
                            <button class="btn toggle-visibility-btn" data-id="${product.id}" title="${product.hidden ? 'Mostrar' : 'Ocultar'}">
                                <i class="bi ${product.hidden ? 'bi-eye-slash' : 'bi-eye'}"></i>
                            </button>
                            <button class="btn" data-id="${product.id}">
                                <i class="bi bi-pencil-square"></i>
                            </button>
                            <button class="btn" data-id="${product.id}" data-image="${product.imageUrl}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    `;
                    collectionList.appendChild(productElement);
                });

                productsList.appendChild(collectionList);

                // Reordenar productos (agrega aquí los event listeners para mover)
                collectionList.querySelectorAll('.move-up, .move-down').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const idx = parseInt(e.currentTarget.dataset.idx);
                        const isUp = e.currentTarget.classList.contains('move-up');
                        const swapIdx = isUp ? idx - 1 : idx + 1;
                        if (swapIdx < 0 || swapIdx >= products.length) return;

                        // 1. Intercambia los productos en el array local
                        const newProducts = [...products];
                        [newProducts[idx], newProducts[swapIdx]] = [newProducts[swapIdx], newProducts[idx]];

                        // 2. Reasigna el campo order a todos los productos de la colección
                        const batchUpdates = [];
                        newProducts.forEach((prod, i) => {
                            const prodRef = doc(db, `stores/${storeId}/products`, prod.id);
                            batchUpdates.push(updateDoc(prodRef, { order: i }));
                        });

                        await Promise.all(batchUpdates);
                        loadProducts();
                    });
                });

                collectionList.querySelectorAll('.toggle-visibility-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const productId = e.currentTarget.dataset.id;
                        const product = products.find(p => p.id === productId);
                        if (!product) return;
                        try {
                            await updateDoc(doc(db, `stores/${storeId}/products`, productId), {
                                hidden: !product.hidden
                            });
                            await loadProducts();
                        } catch (error) {
                            alert('Error al cambiar la visibilidad del producto');
                        }
                    });
                });
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
                document.getElementById('productCollection').value = product.collection;
                
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
        const collectionName = document.getElementById('productCollection').value;
        const imageFile = document.getElementById('productImage').files[0];

        if (!name || isNaN(price) || !description || !collectionName) {
            alert('Por favor complete todos los campos requeridos');
            return;
        }

        try {
            let imageUrl;
            
            // Only upload image if a new one was selected
            if (imageFile) {
                const storageRef = ref(storage, `stores/${storeId}/products/${Date.now()}_${imageFile.name}`);
                await uploadBytes(storageRef, imageFile);
                imageUrl = await getDownloadURL(storageRef);
            }

            const productData = {
                name,
                price,
                description,
                collection: collectionName,
                ...(imageUrl && { imageUrl }), // Only update imageUrl if we have a new one
                updatedAt: new Date().toISOString()
            };

            if (isEditMode) {
                // Update existing product
                await updateDoc(doc(db, `stores/${storeId}/products`, currentProductId), productData);
            } else {
                // Create new product
                productData.createdAt = new Date().toISOString();
                await addDoc(collection(db, `stores/${storeId}/products`), productData);
            }

            closeModal();
            await loadProducts();
            alert(`Producto ${isEditMode ? 'actualizado' : 'agregado'} correctamente`);
        } catch (error) {
            console.error('Error al guardar el producto:', error);
            alert('Error al guardar el producto. Intente nuevamente.');
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

// Cargar colecciones
async function loadCollections() {
    const productsRef = collection(db, `stores/${storeId}/products`);
    const querySnapshot = await getDocs(productsRef);
    const collectionsSet = new Set();
    querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.collection) {
            if (Array.isArray(data.collection)) {
                data.collection.forEach(c => collectionsSet.add(c));
            } else {
                collectionsSet.add(data.collection);
            }
        }
    });
    return Array.from(collectionsSet);
}