const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL no está definida. Copia .env.example a .env y complétala.");
}

// SSL requerido para bases de datos en la nube (Render, Railway, Supabase, etc.)
// Desactivar SSL para: localhost, 127.0.0.1, Docker (postgres), o via DB_SSL=false
const dbUrl = process.env.DATABASE_URL || "";
const sslDisabled = process.env.DB_SSL === "false";
const isLocalOrDocker = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1") || dbUrl.includes("@postgres:");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (sslDisabled || isLocalOrDocker) ? false : { rejectUnauthorized: false },
});

// Log de conexión exitosa
pool.on("connect", () => {
  console.log("✅ Conectado a PostgreSQL");
});

module.exports = { pool };
