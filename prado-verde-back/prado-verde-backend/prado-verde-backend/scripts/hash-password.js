/**
 * Genera el hash bcrypt de una contraseña, para reemplazar el
 * marcador de posición del usuario "admin" en prado_verde_bd.sql
 * o para crear nuevos administradores.
 *
 * Uso:
 *   node scripts/hash-password.js "miContraseñaSegura"
 */
const bcrypt = require("bcrypt");

const password = process.argv[2];
if (!password) {
  console.error("Uso: node scripts/hash-password.js \"tu_contraseña\"");
  process.exit(1);
}

bcrypt.hash(password, 12).then((hash) => {
  console.log("\nHash bcrypt generado:\n");
  console.log(hash);
  console.log("\nÚsalo en un UPDATE, por ejemplo:");
  console.log(`UPDATE prado_verde.administradores SET password_hash = '${hash}' WHERE usuario = 'admin';\n`);
});
