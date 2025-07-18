import { app } from './firebase-config.js';
import { getFirestore, doc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showCart, setupCartSidebarClose, addToCart, updateCartCount } from '../components/cart.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const db = getFirestore(app);
const auth = getAuth();

// Obtener storeId y productId de la ruta amigable
const pathParts = window.location.pathname.split('/').filter(Boolean);
const storeId = pathParts[0]; // 'munchys'
const productId = pathParts[1]; // 'Ku3SQoPKdikbgnRudaVX'

const main = document.getElementById('product-main');

// Renderiza la sección de reviews SIEMPRE
renderReviewsSection();

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
        // Renderiza la sección de reviews después de mostrar el producto de ejemplo
        renderReviewsSection();
        return;
    }

    // Obtener datos del producto
    const productDoc = await getDoc(doc(db, `stores/${storeId}/products`, productId));
    if (!productDoc.exists()) {
        main.innerHTML = '<p>Producto no encontrado.</p>';
        // Renderiza la sección de reviews aunque no exista el producto
        renderReviewsSection();
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

    renderReviewsSection();
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


// Renderiza la sección de reviews después de mostrar el producto
function renderReviewsSection() {
    if (document.getElementById('product-reviews-section')) return; // Ya existe

    // Puedes obtener la imagen del usuario autenticado o usar un placeholder
    const user = auth.currentUser;
    const userImg = user && user.photoURL ? user.photoURL : '/img/user-placeholder.png';

    const reviewsSection = document.createElement('div');
    reviewsSection.id = 'product-reviews-section';
    reviewsSection.className = 'product-reviews-section';
    reviewsSection.innerHTML = `
        <form id="review-form" class="review-form-horizontal">
            <img src="${userImg}" alt="Tu perfil" class="review-profile-img">
            <div class="review-form-fields">
                <div id="star-rating">
                    <i class="bi bi-star" data-value="1"></i>
                    <i class="bi bi-star" data-value="2"></i>
                    <i class="bi bi-star" data-value="3"></i>
                    <i class="bi bi-star" data-value="4"></i>
                    <i class="bi bi-star" data-value="5"></i>
                </div>
                <div class="review-comment-box">
                    <textarea id="review-comment" placeholder="Escribe tu comentario..." required></textarea>
                    <button type="submit" class="review-submit-btn" title="Enviar">
                        <i class="bi bi-send"></i>
                    </button>
                </div>
            </div>
        </form>
        <div id="reviews-list"></div>
    `;
    main.appendChild(reviewsSection);

    setupReviewForm();
    loadReviews();
}

// Manejo de estrellas
function setupReviewForm() {
    const starRating = document.getElementById('star-rating');
    const stars = starRating.querySelectorAll('i');
    let selectedRating = 0;

    stars.forEach(star => {
        star.addEventListener('mouseenter', function() {
            const val = parseInt(this.dataset.value);
            stars.forEach((s, i) => s.classList.toggle('selected', i < val));
        });
        star.addEventListener('click', function() {
            selectedRating = parseInt(this.dataset.value);
            stars.forEach((s, i) => s.classList.toggle('selected', i < selectedRating));
        });
    });

    // Cuando el mouse sale del área de estrellas, muestra solo las seleccionadas
    starRating.addEventListener('mouseleave', function() {
        stars.forEach((s, i) => s.classList.toggle('selected', i < selectedRating));
    });

    document.getElementById('review-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const comment = document.getElementById('review-comment').value.trim();
        if (!selectedRating || !comment) return alert('Por favor, selecciona una calificación y escribe un comentario.');
        try {
            const user = auth.currentUser;
            let displayName = "Anónimo";
            let photoURL = "/img/user-placeholder.png";
            if (user) {
                displayName = user.displayName || user.email || "Usuario";
                photoURL = user.photoURL || "/img/user-placeholder.png";
            }
            await addDoc(collection(db, `stores/${storeId}/products/${productId}/reviews`), {
                rating: selectedRating,
                comment,
                createdAt: serverTimestamp(),
                userName: displayName,
                userPhoto: photoURL,
                userId: user.uid // <--- importante
            });
            document.getElementById('review-form').reset();
            selectedRating = 0;
            stars.forEach(s => s.classList.remove('selected'));
            loadReviews();
        } catch (err) {
            alert('No se pudo enviar tu comentario');
        }
    });

    const reviewComment = document.getElementById('review-comment');
    const reviewSubmitBtn = document.querySelector('.review-submit-btn');

    // Oculta el botón inicialmente
    reviewSubmitBtn.style.display = 'none';

    // Muestra el botón solo si hay texto
    reviewComment.addEventListener('input', function() {
        if (this.value.trim().length > 0) {
            reviewSubmitBtn.style.display = 'flex';
        } else {
            reviewSubmitBtn.style.display = 'none';
        }
    });
}

// Cargar y mostrar reviews
async function loadReviews() {
    const reviewsList = document.getElementById('reviews-list');
    reviewsList.innerHTML = '<div style="color:#888;">Cargando comentarios...</div>';
    const q = query(
        collection(db, `stores/${storeId}/products/${productId}/reviews`),
        orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        reviewsList.innerHTML = `
            <div class="review-item">
                <div class="review-stars">★★★★★</div>
                <div class="review-comment">¡Este producto es excelente! Muy recomendado.</div>
                <div class="review-user" style="color:#888;font-size:0.95em;">Cliente de ejemplo</div>
            </div>
            <div style="color:#888;">Sé el primero en comentar este producto.</div>
        `;
        return;
    }
    reviewsList.innerHTML = '';
    const user = auth.currentUser;

    snapshot.forEach(doc => {
        const data = doc.data();
        const isOwn = user && (user.uid === data.userId); // userId debe guardarse en cada review
        reviewsList.innerHTML += `
            <div class="review-item" data-review-id="${doc.id}">
                <div class="review-header">
                    <img src="${data.userPhoto || '/img/user-placeholder.png'}" alt="Perfil" class="review-header-img">
                    <div>
                        <div class="review-author">${data.userName || 'Anónimo'}</div>
                        <div class="review-stars">${'★'.repeat(data.rating)}${'☆'.repeat(5 - data.rating)}</div>
                    </div>
                    ${isOwn ? `
                        <button class="review-delete-btn" title="Eliminar comentario">
                            <i class="bi bi-trash"></i>
                        </button>
                    ` : ''}
                </div>
                <div class="review-comment">${data.comment}</div>
            </div>
        `;
    });

    document.querySelectorAll('.review-delete-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            const reviewItem = this.closest('.review-item');
            const reviewId = reviewItem.getAttribute('data-review-id');
            if (confirm('¿Eliminar este comentario?')) {
                await deleteDoc(doc(db, `stores/${storeId}/products/${productId}/reviews`, reviewId));
                loadReviews();
            }
        });
    });
}