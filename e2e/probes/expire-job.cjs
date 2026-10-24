// `medusa exec` le pasa { container, args }; el job del build compilado recibe el contenedor.
exports.default = async function ({ container }) {
  const job = require(`${process.env.E2E_BACKEND_DIR}/src/jobs/expire-transfer-orders.js`)
  await (job.default ?? job)(container)
}
