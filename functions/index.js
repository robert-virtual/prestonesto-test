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
const ONE_DAY_IN_MILIS = 1000 * 60 * 60 * 24;
const FIFTEEN_DAYS_IN_MILIS = ONE_DAY_IN_MILIS * 15;
const ONE_MINUTE = 1000 * 60;
const MINUTES_59 = 1000 * 60 * 59;
const SECONDS_59 = 1000 * 59;
const TIME_23_59_59 = 1000 * 60 * 60 * 23 + MINUTES_59 + SECONDS_59;

const { FirestoreDataConverter } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
/**
 * @type {FirestoreDataConverter<{Monto:number,TasaAnual:number,TasaMoraAnual:number,CalendarioPagos:{intereses:number,abonoCapital:number,diasMora:number,fecha:Date,status:string,saldo:number,Cuota:number,Mora:number}[]}>}
 */
const loanConverter = {
  fromFirestore(snapshop) {
    const data = snapshop.data();
    return {
      Monto: data.Monto,
      Cuota: data.Cuota,
      TasaAnual: data.TasaAnual,
      TasaMoraAnual: data.TasaMoraAnual,
      Balance: data.Balance,
      Plazo: data.Plazo,
      CalendarioPagos: data.CalendarioPagos.map((pago) => ({
        ...pago,
        fecha: new Date(pago.fecha.seconds * 1000),
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

// Create and deploy your first functions

// https://firebase.google.com/docs/functions/get-started

initializeApp();
const db = getFirestore();
/**
 * @type {number[]}
 */
const holydays = [];

exports.createLoan = onRequest(async (req, res) => {
  await db.collection("loans").add(req.body);
  res.json({ loan: req.body });
});

exports.pagBancatlan = onRequest(async (request, response) => {
  logger.info("Pago", { structuredData: true });
  const authenticaed = await auth(request, response);
  if (!authenticaed) {
    return;
  }

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
  // TODO: update calendario de pagos
  response.json({ msg: "Loan Updated" });
});

// consular saldo
exports.conBancatlan = onRequest(async (request, response) => {
  logger.info("Consulta", { structuredData: true });

  try {
    const consulta = await db.collection("consultas").add({
      DNI: request.body.dni,
      date: new Date(),
    });
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
    const loanQuery = await db
      .collection("loans")
      .withConverter(loanConverter)
      .where("UserDocReference", "==", user.ref)
      .where("status", "==", "firmado")
      .get();
    const loan = loanQuery.docs.at(0).data();
    const pago = loan.CalendarioPagos.find((pago) => pago.status == "F");
    if (!pago) {
      // TODO: no hay pagos pendisntes no tiene saldo pendiente
      response.json({});
    }
    // un concepto por cada pago pendiente
    const conceptos = [{ TrSVNu: 1, TrSVMo: pago.Cuota }];

    // un concepto mas en caso de existir mora
    if (pago.Mora > 0) {
      conceptos.push({ TrSVNu: 2, TrSVMo: pago.Mora });
    }
    const fechaVencimiento = pago.fecha;
    response.json({
      saldo: {
        IdConsulta: consulta.id,
        TrSSaV: formatDate(fechaVencimiento),
        TrSFeV: formatDate(fechaVencimiento),
        TrSCom: "Comentario",
        TrSPaM: "LPS",
        TrSVaM: "LPS",
        TrSPaR: loan.CalendarioPagos.filter((pago) => pago.status == "P")
          .length,
        conceptos,
      },

      user: users.docs.at(0).data(),
    });
  } catch (error) {
    response.status(500).json({
      error: error.message,
      errorDet: error.message,
    });
  }
});

const PromisePool = require("es6-promise-pool").default;
const MAX_CONCURRENT = 3;
exports.checkMora = onSchedule("every day 00:00", async (event) => {
  const promisePool = new PromisePool(async () => {
    const loansQuery = await db
      .collection("loans")
      .withConverter(loanConverter)
      .get();
    const loans = loansQuery.docs.map((loan) => ({
      ...loan.data(),
      id: loan.id,
    }));
    const loansWithMora = loans.filter((loan) => {
      // obtener el ultimo pago y verificar si ya vencio
      const pago = loan.CalendarioPagos.find((p) => p.status == "F");
      return pago.fecha.getTime() < new Date().getTime();
    });
    loansWithMora.forEach(async (loan) => {
      // obtener el ultimo pago pendiente o no recidido
      const pago = loan.CalendarioPagos.find((p) => p.status == "F");
      const TasaMoraDiaria = loan.TasaAnual + loan.TasaMoraAnual / 360;
      await db.doc("/loans/" + loan.id).update({
        // actualizar el pago vencido, agregar mora
        CalendarioPagos: loan.CalendarioPagos.map((p) => {
          if (pago.fecha.getTime() == p.fecha.getTime()) {
            return {
              ...p,
              Mora: p.abonoCapital * (p.diasMora + 1) * TasaMoraDiaria,
              diasMora: p.diasMora + 1,
            };
          }
          return p;
        }),
      });
    });
  }, MAX_CONCURRENT);
  await promisePool.start();
  logger.log("Verificando Mora de deudas");
});

function formatDate(date = new Date()) {
  return `${date.getFullYear()}-${prepend0(date.getMonth() + 1)}-${prepend0(
    date.getDate()
  )}`;
}
function prepend0(n) {
  if (`${n}`.length == 1) {
    return `0${n}`;
  }
  return n;
}

exports.addCalendarioPagosToLoan = onDocumentCreated(
  "/loans/{documentId}",
  async (event) => {
    logger.info("adding calendarizacion de pagos ", event.data.id);
    /**
     * @type {{TasaMoraAnual:number,TasaAnual:number,Balance:number,Cuota:number,Plazo:number,fecha_primer_pago:{seconds:number}}}
     */
    const loan = event.data.data();
    const fecha_primer_pago = new Date(loan.fecha_primer_pago.seconds * 1000);
    const tasaQuincenal = Number((loan.TasaAnual / 24).toFixed(7));
    const intereses1 = Number((loan.Balance * tasaQuincenal).toFixed(2));
    const abonoCapital1 = Number((loan.Cuota - intereses1).toFixed(2));
    const diasMora1 =
      (new Date().getTime() - fecha_primer_pago.getTime()) / ONE_DAY_IN_MILIS;
    const CalendarioPagos = [
      {
        fecha: fecha_primer_pago,
        status: "F",
        Cuota: loan.Cuota,
        abonoCapital: abonoCapital1,
        intereses: intereses1,
        diasMora: diasMora1,
        Mora: Number(
          (
            abonoCapital1 *
            diasMora1 *
            ((loan.TasaAnual + loan.TasaMoraAnual) / 360)
          ).toFixed(2)
        ),
        saldo: Number((loan.Balance - abonoCapital1).toFixed(2)),
      },
    ];

    logger.info(fecha_primer_pago.toLocaleString());
    let fechaUltimoPago = fecha_primer_pago.getTime();
    let ultimoBalance = Number((loan.Balance - abonoCapital1).toFixed(2));
    for (let i = 1; i < loan.Plazo; i++) {
      let fechaInMilis = fechaUltimoPago + FIFTEEN_DAYS_IN_MILIS;
      let maxHolyDays = 10;
      const intereses = Number((ultimoBalance * tasaQuincenal).toFixed(2));
      const abonoCapital = Number((loan.Cuota - intereses).toFixed(2));
      while (await isHolyDay(fechaInMilis)) {
        if (maxHolyDays == 0) {
          logger.info("max consecutive holydays reached");
          break;
        }
        logger.info(`${new Date(fechaInMilis).toLocaleString()} is a holyday`);
        fechaInMilis += ONE_DAY_IN_MILIS;
        maxHolyDays--;
      }
      fechaUltimoPago = fechaInMilis;
      ultimoBalance = Number((ultimoBalance - abonoCapital).toFixed(2));
      const diasMora = (new Date().getTime() - fechaInMilis) / ONE_DAY_IN_MILIS;
      CalendarioPagos.push({
        diasMora,
        Cuota: loan.Cuota,
        saldo: ultimoBalance,
        abonoCapital,
        intereses,
        Mora: Number(
          (
            abonoCapital *
            diasMora *
            ((loan.TasaAnual + loan.TasaMoraAnual) / 360)
          ).toFixed()
        ),
        fecha: new Date(fechaInMilis),
        status: "F",
      });
    }
    event.data.ref.update({ CalendarioPagos });
  }
);

exports.checkDates = onRequest(async (req, res) => {
  const setting = await db.doc("_rowy_/settings").get();
  const dateInMilis = new Date(req.body.date).getTime();
  res.json({
    isHolyDay: await isHolyDay(dateInMilis),
    dates: setting
      .data()
      .holydays2023.map((f) => new Date(f.seconds * 1000).toString()),
  });
});
exports.initBancatlan = onRequest(async (request, response) => {
  await db.doc("_rowy_/settings").set({
    holydays2023: [
      new Date("2023-01-01T23:59:59"), // 1 de enero
      new Date("2023-04-07T23:59:59"), // viernes santo
      new Date("2023-04-08T23:59:59"), // sabado santo
      new Date("2023-04-14T23:59:59"), // dia de las americas
      new Date("2023-05-01T23:59:59"), // dia de los trabajadores
      new Date("2023-09-15T23:59:59"), // 15 de septiembre
      new Date("2023-10-03T23:59:59"), // dia del soldado
      new Date("2023-10-17T23:59:59"), // dia de la raza
      new Date("2023-10-24T23:59:59"), // dia de las fuerzas armadas
      new Date("2023-12-25T23:59:59"), // navidad
    ],
  });
  await db.doc("_rowy_/settings").update({
    bancatlan_access_key:
      "7befa197c574d117525e58145f906417fc40f054fc10d7c863250751caa6ccca",
  });
  const user = await db.collection("users").add({
    nombres: "Roberto Carlos",
    apellidos: "Castillo Castellanos",
    DNI: "0703200101235",
    email: "robertocastillo945@gmail.com",
    phone_number: "+50488137603",
    created_time: new Date(),
  });
  await user.update({ uid: user.id });
  // const user = (await db.collection("users").get()).docs.at(0);
  // plazos en quincenas
  const Plazo = 12 * 2; // 24 quincenas // 12 meses
  const Monto = 15000;
  // const Cuota = 752.49;
  const TasaAnual = 0.37; // anual
  const TasaQuincenal = 0.37 / 24; // quincenal
  const Cuota = Number(
    (
      (Monto * (Math.pow(1 + TasaQuincenal, Plazo) * TasaQuincenal)) /
      (Math.pow(1 + TasaQuincenal, Plazo) - 1)
    ).toFixed(2)
  );
  await db.collection("loans").add({
    Monto,
    Cuota,
    TasaAnual,
    TasaMoraAnual: 0.72,
    Balance: Monto,
    Plazo,
    Transacciones: [
      {
        monto: 752.49,
        fecha: new Date("2023-05-15T23:59:59"),
      },
    ],
    fecha_primer_pago: new Date("2023-05-15T23:59:59"),
    fecha_ultimo_pago: new Date("2024-04-24T23:59:59"),
    fechaCreado: new Date("2023-05-15T23:59:59"),
    fechaFirma: new Date("2023-05-15T23:59:59"),
    UserDocReference: user,
    status: "firmado",
  });
  response.json({
    msg: "initialized",
  });
});

async function isHolyDay(dateInMilis) {
  if (holydays.length == 0) {
    const settings = (await db.doc("_rowy_/settings").get()).data();
    /**
     * @type {{seconds:number}[]}
     */
    const currentYearHolydays = settings["holydays" + new Date().getFullYear()];
    holydays.push(...currentYearHolydays.map((d) => Number(d.seconds * 1000)));
  }
  const date = new Date(dateInMilis);
  const day = date.getDay();
  logger.info({ day, date: date.toString(), local: date.toLocaleDateString() });

  // is sunday
  const isWeekend = [0].includes(day);
  const inHolydays = holydays.includes(dateInMilis);
  logger.info({ isWeekend, inHolydays });
  return inHolydays || isWeekend;
}

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
