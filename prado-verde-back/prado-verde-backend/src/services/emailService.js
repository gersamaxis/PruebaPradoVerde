/**
 * Servicio de envío de correo electrónico.
 *
 * Por defecto (EMAIL_PROVIDER=console) solo registra el mensaje en consola,
 * útil para desarrollo y pruebas sin configurar SMTP.
 *
 * Para producción, integra un proveedor real (ej. SendGrid, Nodemailer SMTP, etc.)
 * reemplazando el cuerpo de esta función. El resto de la aplicación
 * (rutas, controladores) no necesita cambiar.
 */

async function enviarEmail(destinatario, asunto, mensaje) {
  const provider = process.env.EMAIL_PROVIDER || "console";

  if (provider === "console") {
    console.log(`📧 [Email simulado] Para: ${destinatario} | Asunto: ${asunto} | Mensaje: ${mensaje}`);
    return { ok: true, provider: "console" };
  }

  if (provider === "sendgrid") {
    // Ejemplo de integración real con SendGrid:
    //
    // const sgMail = require("@sendgrid/mail");
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // const msg = {
    //   to: destinatario,
    //   from: process.env.EMAIL_FROM || "noreply@pradoverde.com",
    //   subject: asunto,
    //   text: mensaje,
    //   html: `<p>${mensaje}</p>`,
    // };
    // await sgMail.send(msg);
    // return { ok: true, provider: "sendgrid" };
    throw new Error("Integración con SendGrid no configurada todavía. Ver comentarios en emailService.js");
  }

  if (provider === "smtp") {
    // Ejemplo de integración real con Nodemailer SMTP:
    //
    // const nodemailer = require("nodemailer");
    // const transporter = nodemailer.createTransport({
    //   host: process.env.SMTP_HOST,
    //   port: process.env.SMTP_PORT || 587,
    //   secure: false,
    //   auth: {
    //     user: process.env.SMTP_USER,
    //     pass: process.env.SMTP_PASS,
    //   },
    // });
    // const info = await transporter.sendMail({
    //   from: process.env.EMAIL_FROM || "noreply@pradoverde.com",
    //   to: destinatario,
    //   subject: asunto,
    //   text: mensaje,
    //   html: `<p>${mensaje}</p>`,
    // });
    // return { ok: true, provider: "smtp", messageId: info.messageId };
    throw new Error("Integración SMTP no configurada todavía. Ver comentarios en emailService.js");
  }

  throw new Error(`Proveedor de email desconocido: ${provider}`);
}

module.exports = { enviarEmail };
