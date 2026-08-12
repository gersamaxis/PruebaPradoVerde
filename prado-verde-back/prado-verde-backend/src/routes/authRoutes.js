const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { enviarSms } = require("../services/smsService");
const { crearCodigoOtp, verificarCodigoOtp, OTP_EXP_MINUTES } = require("../services/otpService");

const router = express.Router();

function identificadorApto(torre, piso, apto) {
  const pisoStr = String(piso).padStart(2, "0");
  return `T${torre}-${pisoStr}${apto}`;
}

function firmarTokenAdmin(admin) {
  return jwt.sign(
    { sub: admin.id, usuario: admin.usuario, rol: admin.rol, tipo: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function firmarTokenResidente(apartamento) {
  return jwt.sign(
    { sub: apartamento.id, identificador: apartamento.identificador, tipo: "residente" },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
}

/* =====================================================================
   LOGIN ADMINISTRATIVO
   POST /api/auth/admin/login
   body: { usuario, password }
===================================================================== */
router.post("/admin/login", async (req, res) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
      return res.status(400).json({ ok: false, error: "Usuario y contraseña son obligatorios." });
    }

    const { rows } = await pool.query(
      `SELECT id, usuario, password_hash, nombre_completo, rol, activo
       FROM administradores WHERE usuario = $1`,
      [usuario.trim().toLowerCase()]
    );

    if (rows.length === 0 || !rows[0].activo) {
      return res.status(401).json({ ok: false, error: "Usuario o contraseña incorrectos." });
    }

    const admin = rows[0];
    const coincide = await bcrypt.compare(password, admin.password_hash);
    if (!coincide) {
      return res.status(401).json({ ok: false, error: "Usuario o contraseña incorrectos." });
    }

    const token = firmarTokenAdmin(admin);
    return res.json({
      ok: true,
      token,
      admin: { id: admin.id, usuario: admin.usuario, nombre: admin.nombre_completo, rol: admin.rol },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error interno al iniciar sesión." });
  }
});

/* =====================================================================
   LOGIN RESIDENTES — PASO 1: solicitar código por SMS
   POST /api/auth/resident/request-code
   body: { torre, piso, apto }   (apto: "01".."06")
===================================================================== */
router.post("/resident/request-code", async (req, res) => {
  try {
    const { torre, piso, apto } = req.body;
    if (!torre || !piso || !apto) {
      return res.status(400).json({ ok: false, error: "Torre, piso y apartamento son obligatorios." });
    }

    const identificador = identificadorApto(torre, piso, apto);
    const { rows } = await pool.query(
      `SELECT id, identificador, telefono_principal FROM apartamentos WHERE identificador = $1`,
      [identificador]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Apartamento no encontrado." });
    }

    const apartamento = rows[0];
    if (!apartamento.telefono_principal) {
      return res.status(400).json({
        ok: false,
        error: "Este apartamento no tiene un residente principal vinculado. Contacte a la administración.",
      });
    }

    const { codigo, expiraEn } = await crearCodigoOtp({
      apartamentoId: apartamento.id,
      telefonoDestino: apartamento.telefono_principal,
      ip: req.ip,
    });

    await enviarSms(
      apartamento.telefono_principal,
      `Prado Verde: tu código de acceso es ${codigo}. Vence en ${OTP_EXP_MINUTES} minutos. No lo compartas.`
    );

    const respuesta = {
      ok: true,
      message: "Código enviado por SMS.",
      telefonoEnmascarado: "••• ••• " + apartamento.telefono_principal.slice(-4),
      expiraEn,
    };

    // Solo en desarrollo devolvemos el código en la respuesta, para poder
    // probar sin una pasarela SMS real conectada. NUNCA hacer esto en producción.
    if (process.env.NODE_ENV !== "production") {
      respuesta.codigoDemo = codigo;
    }

    return res.json(respuesta);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error interno al solicitar el código." });
  }
});

/* =====================================================================
   LOGIN RESIDENTES — PASO 2: verificar código
   POST /api/auth/resident/verify-code
   body: { torre, piso, apto, codigo }
===================================================================== */
router.post("/resident/verify-code", async (req, res) => {
  try {
    const { torre, piso, apto, codigo } = req.body;
    if (!torre || !piso || !apto || !codigo) {
      return res.status(400).json({ ok: false, error: "Torre, piso, apartamento y código son obligatorios." });
    }

    const identificador = identificadorApto(torre, piso, apto);
    const { rows } = await pool.query(
      `SELECT id, identificador FROM apartamentos WHERE identificador = $1`,
      [identificador]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Apartamento no encontrado." });
    }
    const apartamento = rows[0];

    const resultado = await verificarCodigoOtp({ apartamentoId: apartamento.id, codigo: String(codigo).trim() });
    if (!resultado.valido) {
      const mensaje =
        resultado.motivo === "sin_codigo_vigente"
          ? "No hay un código vigente. Solicita uno nuevo."
          : "Código incorrecto. Verifica el mensaje de texto recibido.";
      return res.status(401).json({ ok: false, error: mensaje });
    }

    const token = firmarTokenResidente(apartamento);
    return res.json({ ok: true, token, apartamento: { id: apartamento.id, identificador: apartamento.identificador } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error interno al verificar el código." });
  }
});

module.exports = router;
