const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL no está definida. Copia .env.example a .env y complétala.");
}

// Configuración SSL para producción (Render, Railway, etc.)
const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// Todas las tablas viven en el esquema administradores
pool.on("connect", (client) => {
  client.query("SET search_path TO administradores");
});

module.exports = { pool };
