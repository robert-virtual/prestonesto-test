/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { getFirestore } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");

// Create and deploy your first functions

// https://firebase.google.com/docs/functions/get-started

initializeApp();

exports.pagBancatlan = onRequest(async (request, response) => {
  logger.info("Pago", { structuredData: true });
  const authenticaed = await auth(request, response);
  if (!authenticaed) {
    return;
  }

  const db = getFirestore();
  const users = await db
    .collection("users")
    .where("dni", "==", request.body.dni)
    .get();
  if (!users.size) {
    response.json({
      error: "Cliente no encontrado",
      errorDet: "El DNI proveido no conincide con ningun cliente",
    });
    return;
  }
  const user = users.docs.at(0);
  const loans = await db
    .collection("loans")
    .where("user", "==", user.id)
    .where("status", "==", "signed")
    .get();
  const loan = loans.docs.at(0);
  const loanData = loan.data();
  const amountToPay = request.body.amount;
  // DONE: agregar nuevo pago
  // DONE: actualizar prestamo: fecha de ultimo pago
  await db.doc(`loans/${loan.id}`).set({
    ...loanData,
    balance: loanData.balance - amountToPay,
    lastPayment: new Date(),
    payments: [...loanData.payments, { amount: amountToPay, date: new Date() }],
  });
  response.json({ msg: "Loan Updated" });
});

// consular saldo
exports.conBancatlan = onRequest(async (request, response) => {
  logger.info("Consulta", { structuredData: true });
  const authenticaed = await auth(request, response);
  if (!authenticaed) {
    return;
  }
  const db = getFirestore();
  const users = await db
    .collection("users")
    .where("dni", "==", request.body.dni)
    .get();
  if (!users.size) {
    response.json({
      error: "Cliente no encontrado",
      errorDet: "El DNI proveido no conincide con ningun cliente",
    });
    return;
  }
  const user = users.docs.at(0);
  //TODO: obtener prestamo
  const loan = await db
    .collection("loans")
    .where("user", "==", user.id)
    .where("status", "==", "signed")
    .get();
  response.json({
    loan: loan.docs.at(0).data(),
    user: users.docs.at(0).data(),
  });
});

exports.initBancatlan = onRequest(async (request, response) => {
  const db = getFirestore();
  await db.doc("_rowy_/settings").set({
    bancatlan_access_key:
      "7befa197c574d117525e58145f906417fc40f054fc10d7c863250751caa6ccca",
  });
  const user = await db.collection("users").add({
    names: "Roberto Carlos Castillo Castellanos",
    dni: "0703200101235",
    email: "robertocastillo945@gmail.com",
    phoneNumber: "+50488137603",
    createdAt: new Date(),
  });
  // const user = (await db.collection("users").get()).docs.at(0);
  await db.collection("loans").add({
    amount: 100000,
    quota: 1000,
    rate: 0.17,
    mora: 0,
    balance: 99000,
    terms: 6,
    paymentsSchedule: [
      {
        amount: 1000,
        date: new Date(),
      },
    ],
    payments: [
      {
        amount: 1000,
        date: new Date(),
      },
    ],
    firstPayment: new Date(),
    lastPayment: new Date(),
    createdAt: new Date(),
    user: user.id,
    status: "signed",
  });
  response.json({ msg: "initialized" });
});

/**
 *
 * @param {import("firebase-functions/v1").Request} req
 * @param {import("firebase-functions/v1").Response} res
 */
const auth = async (req, res) => {
  const authorization = req.header("Authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    res.status(403).json({
      error: "UnAuthorized",
    });
    return false;
  }
  const access_key = authorization.split(" ")[1];

  const settings = await getFirestore().doc("_rowy_/settings").get();
  if (access_key !== settings.data().bancatlan_access_key) {
    res.status(403).json({
      error: "UnAuthorized",
    });
    return false;
  }
  return true;
};
