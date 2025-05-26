/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
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
  let storeEmail = 'munchys.ec@gmail.com'; // valor por defecto
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

  const mailOptions = {
    from: 'appchys.ec@gmail.com',
    to: storeEmail,
    subject: '¡Nuevo pedido recibido!',
    html: `
      <h2>¡Nuevo pedido recibido!</h2>
      <p>Cliente: ${order.userName || 'cliente'}</p>
      <p><strong>Total:</strong> $${order.total}</p>
      <p><strong>Método de pago:</strong> ${order.paymentMethod}</p>
      <p><strong>Revisa el panel de administración para más detalles.</strong></p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Correo enviado a la tienda:', storeEmail);
  } catch (error) {
    console.error('Error enviando correo:', error);
  }
});
