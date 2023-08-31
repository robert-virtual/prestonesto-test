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
    .where("estado", "==", "firmado")
    .get();
  const loan = loans.docs.at(0);
  const loanData = loan.data();
  const monto = request.body.amount;
  // DONE: agregar nuevo pago
  // DONE: actualizar prestamo: fecha de ultimo pago
  await db.doc(`loans/${loan.id}`).set({
    ...loanData,
    balance: loanData.balance - monto,
    transacciones: [...loanData.transacciones, { monto, fecha: new Date() }],
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
    .where("DNI", "==", request.body.dni)
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
    .where("status", "==", "firmado")
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
    nombres: "Roberto Carlos Castillo Castellanos",
    DNI: "0703200101235",
    email: "robertocastillo945@gmail.com",
    phone_number: "+50488137603",
    created_time: new Date(),
  });
  // const user = (await db.collection("users").get()).docs.at(0);
  // plazos en quincenas
  const Plazos = 6 * 2;
  const Cuota = 1000;
  const CalendarioPagos = [
    { monto: Cuota, fecha: new Date("9/15/2023"), recibido: false },
    { monto: Cuota, fecha: new Date("9/30/2023"), recibido: false },
    { monto: Cuota, fecha: new Date("10/15/2023"), recibido: false },
    { monto: Cuota, fecha: new Date("10/30/2023"), recibido: false },
    { monto: Cuota, fecha: new Date("11/15/2023"), recibido: false },
    { monto: Cuota, fecha: new Date("11/30/2023"), recibido: false },
    { monto: Cuota, fecha: new Date("12/15/2023"), recibido: false },
    { monto: Cuota, fecha: new Date("12/30/2023"), recibido: false },
    { monto: Cuota, fecha: new Date("01/15/2023"), recibido: false },
    { monto: Cuota, fecha: new Date("01/30/2023"), recibido: false },
    { monto: Cuota, fecha: new Date("02/15/2023"), recibido: false },
    { monto: Cuota, fecha: new Date("02/30/2023"), recibido: false },
  ];

  await db.collection("loans").add({
    Monto: 100000,
    Cuota,
    Tasa: 0.17,
    Mora: 0,
    Balance: 99000,
    Plazos,
    CalendarioPagos,
    Transacciones: [
      {
        monto: 1000,
        fecha: new Date(),
      },
    ],
    fecha_primer_pago: new Date(),
    fecha_ultimo_pago: new Date(),
    fechaCreado: new Date(),
    fechaFirma: new Date(),
    user: user.id,
    status: "firmado",
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
