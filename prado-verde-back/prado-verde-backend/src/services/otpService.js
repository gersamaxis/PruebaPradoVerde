const bcrypt = require("bcryptjs");
const { pool } = require("../db");

const OTP_EXP_MINUTES = Number(process.env.OTP_EXP_MINUTES || 5);
const SALT_ROUNDS = 10;

function generarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
}

/**
 * Crea un nuevo código OTP para un apartamento, lo guarda hasheado
 * (nunca en texto plano) y devuelve el código en claro solo para
 * poder enviarlo por SMS en este mismo request.
 */
async function crearCodigoOtp({ apartamentoId, telefonoDestino, ip }) {
  const codigo = generarCodigo();
  const codigoHash = await bcrypt.hash(codigo, SALT_ROUNDS);
  const expiraEn = new Date(Date.now() + OTP_EXP_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO codigos_otp (apartamento_id, codigo_hash, telefono_destino, expira_en, ip_solicitud)
     VALUES ($1, $2, $3, $4, $5)`,
    [apartamentoId, codigoHash, telefonoDestino, expiraEn, ip || null]
  );

  return { codigo, expiraEn };
}

/**
 * Verifica un código OTP contra el más reciente y vigente del apartamento.
 * Si es válido, lo marca como usado (no se puede reutilizar).
 */
async function verificarCodigoOtp({ apartamentoId, codigo }) {
  const { rows } = await pool.query(
    `SELECT id, codigo_hash
     FROM codigos_otp
     WHERE apartamento_id = $1 AND usado = FALSE AND expira_en > now()
     ORDER BY created_at DESC
     LIMIT 1`,
    [apartamentoId]
  );

  if (rows.length === 0) {
    return { valido: false, motivo: "sin_codigo_vigente" };
  }

  const { id, codigo_hash } = rows[0];
  const coincide = await bcrypt.compare(codigo, codigo_hash);

  if (!coincide) {
    return { valido: false, motivo: "codigo_incorrecto" };
  }

  await pool.query(`UPDATE codigos_otp SET usado = TRUE WHERE id = $1`, [id]);
  return { valido: true };
}

module.exports = { crearCodigoOtp, verificarCodigoOtp, OTP_EXP_MINUTES };
