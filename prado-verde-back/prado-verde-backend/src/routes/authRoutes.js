const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { enviarSms } = require("../services/smsService");
const { enviarWhatsapp } = require("../services/whatsappService");
const { enviarEmail } = require("../services/emailService");
const { crearCodigoOtp, verificarCodigoOtp, OTP_EXP_MINUTES } = require("../services/otpService");

const router = express.Router();

function identificadorApto(torre, piso, apto) {
  const pisoStr = String(piso).padStart(2, "0");
  return `T${torre}-${pisoStr}${apto}`;
}

function maskPhone(phone) {
  if (!phone || phone.length < 4) return null;
  return "••• ••• " + phone.slice(-4);
}

function maskEmail(email) {
  if (!email || !email.includes("@")) return null;
  const [local, domain] = email.split("@");
  const masked = local.length > 2 ? local[0] + "•••" + local.slice(-1) : "•••";
  return masked + "@" + domain;
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
   OBTENER MÉTODOS DE CONTACTO DISPONIBLES (PÚBLICO)
   GET /api/auth/resident/contact-methods?torre=1&piso=1&apto=01
   Devuelve qué métodos de contacto tiene configurado el apartamento
   (datos enmascarados, no requiere autenticación)
===================================================================== */
router.get("/resident/contact-methods", async (req, res) => {
  try {
    const { torre, piso, apto } = req.query;
    if (!torre || !piso || !apto) {
      return res.status(400).json({ ok: false, error: "Torre, piso y apartamento son obligatorios." });
    }

    const identificador = identificadorApto(torre, piso, apto);
    const { rows } = await pool.query(
      `SELECT telefono_principal, whatsapp, email FROM apartamentos WHERE identificador = $1`,
      [identificador]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Apartamento no encontrado." });
    }

    const apt = rows[0];
    const methods = [];
    
    if (apt.telefono_principal) {
      methods.push({ method: "sms", label: "SMS", masked: maskPhone(apt.telefono_principal) });
    }
    if (apt.whatsapp) {
      methods.push({ method: "whatsapp", label: "WhatsApp", masked: maskPhone(apt.whatsapp) });
    }
    if (apt.email) {
      methods.push({ method: "email", label: "Correo electrónico", masked: maskEmail(apt.email) });
    }

    return res.json({ ok: true, methods });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error interno." });
  }
});

/* =====================================================================
   LOGIN RESIDENTES — PASO 1: solicitar código por SMS, WhatsApp o Email
   POST /api/auth/resident/request-code
   body: { torre, piso, apto, method }   
   - apto: "01".."06"
   - method: "sms" | "whatsapp" | "email" (default: "sms")
===================================================================== */
router.post("/resident/request-code", async (req, res) => {
  try {
    const { torre, piso, apto, method = "sms" } = req.body;
    if (!torre || !piso || !apto) {
      return res.status(400).json({ ok: false, error: "Torre, piso y apartamento son obligatorios." });
    }

    // Validar método de envío
    const metodosValidos = ["sms", "whatsapp", "email"];
    if (!metodosValidos.includes(method)) {
      return res.status(400).json({ ok: false, error: "Método de envío inválido. Use: sms, whatsapp o email." });
    }

    const identificador = identificadorApto(torre, piso, apto);
    const { rows } = await pool.query(
      `SELECT id, identificador, telefono_principal, whatsapp, email FROM apartamentos WHERE identificador = $1`,
      [identificador]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Apartamento no encontrado." });
    }

    const apartamento = rows[0];
    
    // Determinar el contacto según el método seleccionado
    let contacto = null;
    let contactoEnmascarado = null;
    const metodosLabels = { sms: "SMS", whatsapp: "WhatsApp", email: "correo electrónico" };

    if (method === "sms") {
      contacto = apartamento.telefono_principal;
      if (contacto) {
        contactoEnmascarado = "••• ••• " + contacto.slice(-4);
      }
    } else if (method === "whatsapp") {
      contacto = apartamento.whatsapp;
      if (contacto) {
        contactoEnmascarado = "••• ••• " + contacto.slice(-4);
      }
    } else if (method === "email") {
      contacto = apartamento.email;
      if (contacto && contacto.includes("@")) {
        const [local, domain] = contacto.split("@");
        const masked = local.length > 2 ? local[0] + "•••" + local.slice(-1) : "•••";
        contactoEnmascarado = masked + "@" + domain;
      }
    }

    if (!contacto) {
      return res.status(400).json({
        ok: false,
        error: `Este apartamento no tiene ${metodosLabels[method]} registrado. Contacte a la administración.`,
      });
    }

    const { codigo, expiraEn } = await crearCodigoOtp({
      apartamentoId: apartamento.id,
      telefonoDestino: contacto, // Se usa el campo telefono_destino genéricamente
      ip: req.ip,
    });

    // Enviar código según el método seleccionado
    const mensajeOtp = `Prado Verde: tu código de acceso es ${codigo}. Vence en ${OTP_EXP_MINUTES} minutos. No lo compartas.`;
    
    if (method === "sms") {
      await enviarSms(contacto, mensajeOtp);
    } else if (method === "whatsapp") {
      await enviarWhatsapp(contacto, mensajeOtp);
    } else if (method === "email") {
      await enviarEmail(contacto, "Código de acceso - Prado Verde", mensajeOtp);
    }

    const respuesta = {
      ok: true,
      message: `Código enviado por ${metodosLabels[method]}.`,
      contactoEnmascarado,
      telefonoEnmascarado: contactoEnmascarado, // Compatibilidad con frontend anterior
      expiraEn,
    };

    // Solo en desarrollo devolvemos el código en la respuesta, para poder
    // probar sin una pasarela real conectada. NUNCA hacer esto en producción.
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
