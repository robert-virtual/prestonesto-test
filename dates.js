const ONE_DAY_IN_MILIS = 1000 * 60 * 60 * 24;
const FIFTEEN_DAYS_IN_MILIS = ONE_DAY_IN_MILIS * 15;
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

//obtener pagos de los proximos 15 dias
// const pagos = CalendarioPagos.filter(
//   (pago) =>
//     pago.fechaVencimiento.getTime() <
//       new Date().getTime() + FIFTEEN_DAYS_IN_MILIS && !pago.recibido
// );

const pagos = CalendarioPagos.filter((pago) => pago.recibido);
console.log(pagos);
