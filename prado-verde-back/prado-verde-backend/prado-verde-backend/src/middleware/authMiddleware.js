const jwt = require("jsonwebtoken");

function extraerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) return token;
  return null;
}

/**
 * requireAuth(tipoEsperado)
 *   tipoEsperado: "admin" | "residente" | undefined (cualquiera autenticado)
 */
function requireAuth(tipoEsperado) {
  return (req, res, next) => {
    const token = extraerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Token no proporcionado." });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (tipoEsperado && payload.tipo !== tipoEsperado) {
        return res.status(403).json({ ok: false, error: "No autorizado para este recurso." });
      }
      req.user = payload;
      next();
    } catch (err) {
      return res.status(401).json({ ok: false, error: "Token inválido o expirado." });
    }
  };
}

module.exports = { requireAuth };
