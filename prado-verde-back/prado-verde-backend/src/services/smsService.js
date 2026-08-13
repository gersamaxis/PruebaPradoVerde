/**
 * Servicio de envío de SMS.
 *
 * Por defecto (SMS_PROVIDER=console) solo registra el mensaje en consola,
 * útil para desarrollo y pruebas sin gastar créditos de un proveedor real.
 *
 * Para producción, integra un proveedor real (ej. Twilio, Infobip, etc.)
 * reemplazando el cuerpo de esta función. El resto de la aplicación
 * (rutas, controladores) no necesita cambiar.
 */

async function enviarSms(telefono, mensaje) {
  const provider = process.env.SMS_PROVIDER || "console";

  if (provider === "console") {
    console.log(`📲 [SMS simulado] Para: ${telefono} | Mensaje: ${mensaje}`);
    return { ok: true, provider: "console" };
  }

  if (provider === "twilio") {
    // Verificar si las credenciales de Twilio están configuradas
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) {
      console.warn("⚠️ [SMS] Twilio no configurado, usando modo consola como fallback");
      console.log(`📲 [SMS simulado] Para: ${telefono} | Mensaje: ${mensaje}`);
      return { ok: true, provider: "console-fallback" };
    }
    
    // Integración real con Twilio
    const twilio = require("twilio")(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    const result = await twilio.messages.create({
      body: mensaje,
      from: process.env.TWILIO_FROM_NUMBER,
      to: telefono,
    });
    return { ok: true, provider: "twilio", sid: result.sid };
  }

  // Fallback para provider desconocido
  console.warn(`⚠️ [SMS] Proveedor desconocido (${provider}), usando modo consola como fallback`);
  console.log(`📲 [SMS simulado] Para: ${telefono} | Mensaje: ${mensaje}`);
  return { ok: true, provider: "console-fallback" };
}

module.exports = { enviarSms };
