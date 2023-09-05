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
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
const ONE_DAY_IN_MILIS = 1000 * 60 * 60 * 24;
const FIFTEEN_DAYS_IN_MILIS = ONE_DAY_IN_MILIS * 15;

const { FirestoreDataConverter } = require("firebase-admin/firestore");

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
  const db = getFirestore();

  try {
    const authenticaed = await auth(request, response);
    if (!authenticaed) {
      return;
    }
    const users = await db
      .collection("users")
      .where("DNI", "==", request.body.dni)
      .get();
    if (!users.size) {
      response.status(400).json({
        error: "Cliente no encontrado",
        errorDet: "El DNI proveido no conincide con ningun cliente",
      });
      return;
    }
    const user = users.docs.at(0);
    //TODO: obtener prestamo
    /**
     * @type {FirestoreDataConverter<{Mora:number,CalendarioPagos:{fechaVencimiento:Date,recibido:boolean,monto:number}[]}>}
     */
    const converter = {
      fromFirestore(snapshop) {
        const data = snapshop.data();
        return {
          Monto: data.Monto,
          Cuota: data.Cuota,
          Tasa: data.Tasa,
          Mora: data.Mora,
          Balance: data.Balance,
          Plazos: data.Plazos,
          CalendarioPagos: data.CalendarioPagos.map((pago) => ({
            ...pago,
            fechaVencimiento: new Date(pago.fechaVencimiento.seconds * 1000),
          })),
          Transacciones: data.Transacciones,
          fecha_primer_pago: data.fecha_primer_pago,
          fecha_ultimo_pago: data.fecha_ultimo_pago,
          fechaCreado: data.fechaCreado,
          fechaFirma: data.fechaFirma,
          user: data.user,
          status: data.status,
        };
      },
      toFirestore(data) {
        return data;
      },
    };
    const loanQuery = await db
      .collection("loans")
      .withConverter(converter)
      .where("user", "==", user.id)
      .where("status", "==", "firmado")
      .get();
    const loan = loanQuery.docs.at(0).data();
    const pagos = loan.CalendarioPagos.filter(
      (pago) =>
        pago.fechaVencimiento.getTime() <
          new Date().getTime() + FIFTEEN_DAYS_IN_MILIS && !pago.recibido
    );
    const conceptos = pagos.map((pago, idx) => ({
      id: idx + 1,
      monto: pago.monto,
    }));
    if (loan.Mora) {
      conceptos.push({ id: conceptos.length + 1, monto: loan.Mora });
    }
    response.json({
      saldos: [
        {
          conceptos,
        },
      ],
      user: users.docs.at(0).data(),
    });
  } catch (error) {
    response.status(500).json({
      error: error.message,
      errorDet: error.message,
    });
  }
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
    {
      monto: Cuota,
      fechaVencimiento: new Date("2023-08-15T24:00:00"),
      recibido: true,
    },
    {
      monto: Cuota,
      fechaVencimiento: new Date("2023-08-30T24:00:00"),
      recibido: true,
    },
    {
      monto: Cuota,
      fechaVencimiento: new Date("2023-09-15T24:00:00"),
      recibido: false,
    },
    {
      monto: Cuota,
      fechaVencimiento: new Date("2023-09-30T24:00:00"),
      recibido: false,
    },
    {
      monto: Cuota,
      fechaVencimiento: new Date("2023-10-15T24:00:00"),
      recibido: false,
    },
    {
      monto: Cuota,
      fechaVencimiento: new Date("2023-10-30T24:00:00"),
      recibido: false,
    },
    {
      monto: Cuota,
      fechaVencimiento: new Date("2023-11-15T24:00:00"),
      recibido: false,
    },
    {
      monto: Cuota,
      fechaVencimiento: new Date("2023-11-30T24:00:00"),
      recibido: false,
    },
    {
      monto: Cuota,
      fechaVencimiento: new Date("2023-12-15T24:00:00"),
      recibido: false,
    },
    {
      monto: Cuota,
      fechaVencimiento: new Date("2023-12-30T24:00:00"),
      recibido: false,
    },
    {
      monto: Cuota,
      fechaVencimiento: new Date("2024-01-15T24:00:00"),
      recibido: false,
    },
    {
      monto: Cuota,
      fechaVencimiento: new Date("2024-01-30T24:00:00"),
      recibido: false,
    },
    {
      monto: Cuota,
      fechaVencimiento: new Date("2024-02-15T24:00:00"),
      recibido: false,
    },
    {
      monto: Cuota,
      fechaVencimiento: new Date("2024-02-28T24:00:00"),
      recibido: false,
    },
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
