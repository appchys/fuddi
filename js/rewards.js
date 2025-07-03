import { collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app } from './firebase-config.js';

// Registra puntos en el historial del usuario si la orden está completada/entregada
export async function addPointsForOrder({ userId, orderId, amount, status }) {
    const db = getFirestore(app);
    if (!userId || !orderId || typeof amount !== 'number') return;

    // Solo sumar puntos si la orden está completada o entregada
    if (!['Completado', 'Entregado'].includes(status)) return;

    // Verifica si ya se sumaron puntos por esta orden
    const pointsHistoryRef = collection(db, `users/${userId}/pointsHistory`);
    const q = query(pointsHistoryRef, where("orderId", "==", orderId));
    const existing = await getDocs(q);
    if (!existing.empty) return; // Ya se sumaron puntos por esta orden

    const points = Math.floor(amount); // 1 punto por cada dólar entero

    await addDoc(pointsHistoryRef, {
        orderId,
        points,
        amount,
        type: "compra",
        timestamp: new Date().toISOString()
    });
}

export async function getTotalPoints(userId) {
    const db = getFirestore(app);
    const pointsHistoryRef = collection(db, `users/${userId}/pointsHistory`);
    const snapshot = await getDocs(pointsHistoryRef);
    let total = 0;
    snapshot.forEach(doc => {
        total += doc.data().points || 0;
    });
    return total;
}