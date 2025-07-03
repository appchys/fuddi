import { app } from './firebase-config.js';
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showCart, setupCartSidebarClose, addToCart, updateCartCount } from '../components/cart.js';

const db = getFirestore(app);

// Obtener storeId y productId de la ruta amigable
const pathParts = window.location.pathname.split('/').filter(Boolean);
const storeId = pathParts[0]; // 'munchys'
const productId = pathParts[1]; // 'Ku3SQoPKdikbgnRudaVX'

const main = document.getElementById('product-main');

// Mostrar producto
async function loadProduct() {
    if (!storeId || !productId) {
        main.innerHTML = `
        <div class="product-detail-page">
            <img src="/img/placeholder.png" alt="Producto de ejemplo" class="product-image" style="max-width:260px;display:block;margin:0 auto 18px auto;">
            <h1>Producto de ejemplo</h1>
            <p class="product-price" style="font-size:1.3em;color:#16a34a;font-weight:bold;">$99.99</p>
            <p class="product-description" style="margin:18px 0;">
                Esta es una descripción de ejemplo para el producto. Aquí puedes mostrar las características, beneficios y detalles relevantes del producto.
            </p>
            <div class="product-btns-row">
                <a href="/${storeId}" class="product-menu-btn"><i class="bi bi-shop"></i>Ver tienda</a>
                <button class="product-menu-btn" id="add-to-cart-btn" disabled><i class="bi bi-cart-plus"></i>Añadir al carrito</button>
                <button class="product-menu-btn" id="share-btn"><i class="bi bi-share"></i>Compartir</button>
            </div>
            <hr style="margin:32px 0;">
            <div style="text-align:center;">
                <img src="/img/placeholder.png" alt="Logo tienda" style="width:60px;height:60px;border-radius:50%;margin-bottom:8px;">
                <div style="font-weight:bold;">Tienda de ejemplo</div>
                <div style="color:#666;">Descripción breve de la tienda de ejemplo.</div>
            </div>
        </div>
        `;
        // Habilita compartir aunque sea ejemplo
        document.getElementById('share-btn').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                document.getElementById('share-btn').textContent = '¡Enlace copiado!';
                setTimeout(() => {
                    document.getElementById('share-btn').innerHTML = '<i class="bi bi-share"></i> Compartir';
                }, 1500);
            } catch (err) {
                alert('No se pudo copiar el enlace');
            }
        });
        return;
    }

    // Obtener datos del producto
    const productDoc = await getDoc(doc(db, `stores/${storeId}/products`, productId));
    if (!productDoc.exists()) {
        main.innerHTML = '<p>Producto no encontrado.</p>';
        return;
    }
    const product = productDoc.data();

    // Obtener datos de la tienda
    const storeDoc = await getDoc(doc(db, "stores", storeId));
    const store = storeDoc.exists() ? storeDoc.data() : {};

    main.innerHTML = `
    <div class="product-detail-page">
        <img src="${product.imageUrl || store.imageUrl || '/img/placeholder.png'}" alt="${product.name}" class="product-image" style="max-width:260px;display:block;margin:0 auto 18px auto;">
        <h1>${product.name}</h1>
        <p class="product-price" style="font-size:1.3em;color:#16a34a;font-weight:bold;">$${product.price ? product.price.toFixed(2) : 'No disponible'}</p>
        <p class="product-description" style="margin:18px 0;">${product.description || ''}</p>
        <div class="product-btns-row">
            <a href="/${storeId}" class="product-menu-btn"><i class="bi bi-shop"></i>Ver tienda</a>
            <button class="product-menu-btn" id="add-to-cart-btn"><i class="bi bi-cart-plus"></i>Añadir al carrito</button>
            <button class="product-menu-btn" id="share-btn"><i class="bi bi-share"></i>Compartir</button>
        </div>
        <hr style="margin:32px 0;">
        <div style="text-align:center;">
            <img src="${store.imageUrl || '/img/placeholder.png'}" alt="Logo tienda" style="width:60px;height:60px;border-radius:50%;margin-bottom:8px;">
            <div style="font-weight:bold;">${store.name || ''}</div>
            <div style="color:#666;">${store.description || ''}</div>
        </div>
    </div>
    `;

    // Asigna el listener después de crear el botón
    document.getElementById('add-to-cart-btn').addEventListener('click', () => {
        addToCart(productId);
        showCart(); // Abre el carrito automáticamente
    });

    document.getElementById('share-btn').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            // Puedes mostrar un mensaje visual si quieres
            document.getElementById('share-btn').textContent = '¡Enlace copiado!';
            setTimeout(() => {
                document.getElementById('share-btn').innerHTML = '<i class="bi bi-share"></i> Compartir';
            }, 1500);
        } catch (err) {
            alert('No se pudo copiar el enlace');
        }
    });
}

loadProduct();

// Asegúrate de tener window.storeId definido
window.storeId = storeId;

// Botón flotante para abrir el carrito
document.getElementById('cart-button').addEventListener('click', showCart);

// Inicializar cierre del sidebar
setupCartSidebarClose();

// Actualizar contador al cargar la página
updateCartCount();