/**
 * Servicio de envío de mensajes por WhatsApp.
 *
 * Por defecto (WHATSAPP_PROVIDER=console) solo registra el mensaje en consola,
 * útil para desarrollo y pruebas sin gastar créditos de un proveedor real.
 *
 * Para producción, integra un proveedor real (ej. Twilio WhatsApp, Meta Business API, etc.)
 * reemplazando el cuerpo de esta función. El resto de la aplicación
 * (rutas, controladores) no necesita cambiar.
 */

async function enviarWhatsapp(telefono, mensaje) {
  const provider = process.env.WHATSAPP_PROVIDER || "console";

  // Normalizar número: agregar prefijo de Colombia si no tiene código de país
  let telefonoNormalizado = telefono.replace(/\D/g, ""); // Quitar todo excepto dígitos
  if (telefonoNormalizado.length === 10 && telefonoNormalizado.startsWith("3")) {
    telefonoNormalizado = "57" + telefonoNormalizado; // Agregar código de Colombia
  }
  if (!telefonoNormalizado.startsWith("whatsapp:")) {
    telefonoNormalizado = "whatsapp:+" + telefonoNormalizado;
  }

  if (provider === "console") {
    console.log(`💬 [WhatsApp simulado] Para: ${telefonoNormalizado} | Mensaje: ${mensaje}`);
    return { ok: true, provider: "console" };
  }

  if (provider === "twilio") {
    // Verificar si las credenciales de Twilio están configuradas
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.warn("⚠️ [WhatsApp] Twilio no configurado, usando modo consola como fallback");
      console.log(`💬 [WhatsApp simulado] Para: ${telefonoNormalizado} | Mensaje: ${mensaje}`);
      return { ok: true, provider: "console-fallback" };
    }
    
    // Integración real con Twilio WhatsApp
    const twilio = require("twilio")(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    const result = await twilio.messages.create({
      body: mensaje,
      from: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886", // Sandbox de Twilio
      to: telefonoNormalizado,
    });
    return { ok: true, provider: "twilio", sid: result.sid };
  }

  if (provider === "meta") {
    // Verificar si las credenciales de Meta están configuradas
    if (!process.env.META_PHONE_NUMBER_ID || !process.env.META_ACCESS_TOKEN) {
      console.warn("⚠️ [WhatsApp] Meta API no configurada, usando modo consola como fallback");
      console.log(`💬 [WhatsApp simulado] Para: ${telefonoNormalizado} | Mensaje: ${mensaje}`);
      return { ok: true, provider: "console-fallback" };
    }

    // Integración con Meta Business API (Cloud API)
    const axios = require("axios");
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.META_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: telefonoNormalizado.replace("whatsapp:+", ""),
        type: "text",
        text: { body: mensaje },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    return { ok: true, provider: "meta", messageId: response.data.messages[0].id };
  }

  // Fallback para provider desconocido
  console.warn(`⚠️ [WhatsApp] Proveedor desconocido (${provider}), usando modo consola como fallback`);
  console.log(`💬 [WhatsApp simulado] Para: ${telefonoNormalizado} | Mensaje: ${mensaje}`);
  return { ok: true, provider: "console-fallback" };
}

module.exports = { enviarWhatsapp };
