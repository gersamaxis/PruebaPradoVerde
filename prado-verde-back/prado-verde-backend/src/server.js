require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const apartmentRoutes = require("./routes/apartmentRoutes");
const { requireAuth } = require("./middleware/authMiddleware");

const app = express();
app.use(cors());
app.use(express.json());

// Ruta raíz - información de la API
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "prado-verde-backend",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      adminLogin: "POST /api/auth/admin/login",
      residentRequestCode: "POST /api/auth/resident/request-code",
      residentVerifyCode: "POST /api/auth/resident/verify-code",
      apartments: "/api/apartments/:identificador"
    }
  });
});

app.get("/api/health", (req, res) => res.json({ ok: true, service: "prado-verde-backend" }));

app.use("/api/auth", authRoutes);
app.use("/api/apartments", apartmentRoutes);

// Ejemplos de rutas protegidas (a completar con la lógica real de apartamentos, etc.)
app.get("/api/admin/ping", requireAuth("admin"), (req, res) => {
  res.json({ ok: true, mensaje: `Hola ${req.user.usuario}, sesión administrativa válida.` });
});

app.get("/api/resident/ping", requireAuth("residente"), (req, res) => {
  res.json({ ok: true, mensaje: `Sesión válida para el apartamento ${req.user.identificador}.` });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Backend de login de Prado Verde escuchando en http://localhost:${PORT}`);
});
