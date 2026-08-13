const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL no está definida. Copia .env.example a .env y complétala.");
}

// SSL requerido para bases de datos en la nube (Render, Railway, Supabase, etc.)
// Solo desactivar SSL para localhost
const dbUrl = process.env.DATABASE_URL || "";
const isLocalhost = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
});

// Log de conexión exitosa
pool.on("connect", () => {
  console.log("✅ Conectado a PostgreSQL");
});

module.exports = { pool };
