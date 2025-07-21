/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
admin.initializeApp();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'appchys.ec@gmail.com',
    pass: 'oukz zreo izmi clul'
  }
});

exports.sendOrderEmail = onDocumentCreated("orders/{orderId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const order = snap.data();

  // Obtener email de la tienda desde Firestore
  let storeEmail = 'munchys.ec@gmail.com';
  if (order.storeId) {
    try {
      const storeDoc = await admin.firestore().collection('stores').doc(order.storeId).get();
      if (storeDoc.exists && storeDoc.data().email) {
        storeEmail = storeDoc.data().email;
      }
    } catch (e) {
      console.error('No se pudo obtener el email de la tienda:', e);
    }
  }

  // Obtener datos del cliente usando userId
  let cliente = 'Cliente no especificado';
  let clienteWhatsapp = 'No registrado';
  if (order.userId) {
    try {
      const userDoc = await admin.firestore().collection('users').doc(order.userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        cliente = userData.name || cliente;
        clienteWhatsapp = userData.phone || clienteWhatsapp;
      }
    } catch (e) {
      console.error('No se pudo obtener los datos del cliente:', e);
    }
  }

  // Dirección de entrega (si aplica)
  let direccion = 'No aplica (retiro en tienda)';
  let mapaHtml = '';
  if (order.shippingAddress && order.shippingAddress.reference) {
    direccion = order.shippingAddress.reference;
    if (order.shippingAddress.latitude && order.shippingAddress.longitude) {
      const lat = order.shippingAddress.latitude;
      const lng = order.shippingAddress.longitude;
      const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=400x200&markers=color:red%7C${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyAgOiLYPpzxlUHkX3lCmp5KK4UF7wx7zMs'}`;
      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      mapaHtml = `
        <a href="${mapsLink}" target="_blank" style="display:inline-block;text-decoration:none;">
          <img src="${staticMapUrl}" alt="Ver ubicación en Google Maps" style="border-radius:8px;border:1px solid #ccc;max-width:100%;margin-top:8px;">
          <div style="text-align:center;font-size:0.95em;color:#3366cc;margin-top:4px;">Abrir en Google Maps</div>
        </a>
      `;
    }
  }

  // Productos del carrito (formato lista)
  let productosHtml = '<ul>';
  if (Array.isArray(order.products)) {
    order.products.forEach(item => {
      const totalItemPrice = (item.price * item.quantity).toFixed(2); // Calcula el precio total por cantidad
      productosHtml += `<li>${item.name} x${item.quantity} - $${totalItemPrice}</li>`;
    });
  }
  productosHtml += '</ul>';

  // Link de comprobante si es transferencia
  let comprobanteHtml = '';
  if (order.paymentMethod && order.paymentMethod.toLowerCase() === 'transferencia' && order.paymentProofUrl) {
    comprobanteHtml = `<p><a href="${order.paymentProofUrl}" target="_blank" style="color:#3366cc;font-weight:bold;">Ver comprobante</a></p>`;
  }

  // Botón para ver más detalles (store-orders.html con storeId)
  const detallesBtn = `
    <a href="https://fuddi.shop/store-orders.html?storeId=${order.storeId}" target="_blank" style="display:inline-block;padding:10px 18px;background:#3366cc;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:12px;">
      Ver más detalles
    </a>
  `;

  const aceptarBtn = `
  <a href="https://acceptorder-kqrddrvggq-uc.a.run.app?orderId=${event.params.orderId}" target="_blank" style="display:inline-block;padding:10px 18px;background:#28a745;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:12px;">
    Aceptar
  </a>
`;

  const rechazarBtn = `
  <a href="https://rejectorder-kqrddrvggq-uc.a.run.app?orderId=${event.params.orderId}" target="_blank" style="display:inline-block;padding:10px 18px;background:#dc3545;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:12px;">
    Rechazar
  </a>
`;

  const mailOptions = {
  from: 'pedidos@fuddi.shop',
  to: storeEmail,
  subject: `¡Nuevo pedido de ${cliente}!`,
  html: `
    <h2>¡Nuevo pedido recibido!</h2>
    <h3>Datos del cliente</h3>
    <ul>
      <li><strong>Nombre:</strong> ${cliente}</li>
      <li><strong>Whatsapp:</strong> ${clienteWhatsapp}</li>
      <li><strong>Dirección de entrega:</strong> ${direccion}</li>
    </ul>
    ${mapaHtml}
    <h3>Productos</h3>
    ${productosHtml}
    <p><strong>Total:</strong> $${order.total}</p>
    <p><strong>Método de pago:</strong> ${order.paymentMethod}</p>
    ${comprobanteHtml}
    ${detallesBtn}
    ${aceptarBtn} <!-- Botón para aceptar el pedido -->
    ${rechazarBtn} <!-- Botón para rechazar el pedido -->
    <p style="margin-top:16px;"><strong>Revisa el panel de administración para más detalles.</strong></p>
  `
};

  try {
    await transporter.sendMail(mailOptions);
    console.log('Correo enviado a la tienda:', storeEmail);
  } catch (error) {
    console.error('Error enviando correo:', error);
  }
});

exports.acceptOrder = onRequest(async (req, res) => {
  const { orderId } = req.query;

  if (!orderId) {
    return res.status(400).send('Falta el ID del pedido.');
  }

  try {
    const orderRef = admin.firestore().collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).send('Pedido no encontrado.');
    }

    // Actualiza el estado del pedido a "En preparación"
    await orderRef.update({ status: 'En preparación' });

    // Obtén el storeId del pedido
    const orderData = orderDoc.data();
    const storeId = orderData.storeId;

    if (!storeId) {
      return res.status(400).send('El pedido no tiene un storeId asociado.');
    }

    // Redirige a la página de pedidos de la tienda
    return res.redirect(`https://fuddi.shop/store-orders.html?storeId=${storeId}`);
  } catch (error) {
    console.error('Error al aceptar el pedido:', error);
    return res.status(500).send('Error al aceptar el pedido.');
  }
});

exports.rejectOrder = onRequest(async (req, res) => {
  const { orderId } = req.query;

  if (!orderId) {
    return res.status(400).send('Falta el ID del pedido.');
  }

  try {
    const orderRef = admin.firestore().collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).send('Pedido no encontrado.');
    }

    // Actualiza el estado del pedido a "Rechazado"
    await orderRef.update({ status: 'Rechazado' });

    // Obtén el storeId del pedido
    const orderData = orderDoc.data();
    const storeId = orderData.storeId;

    if (!storeId) {
      return res.status(400).send('El pedido no tiene un storeId asociado.');
    }

    // Redirige a la página de pedidos de la tienda
    return res.redirect(`https://fuddi.shop/store-orders.html?storeId=${storeId}`);
  } catch (error) {
    console.error('Error al rechazar el pedido:', error);
    return res.status(500).send('Error al rechazar el pedido.');
  }
});
