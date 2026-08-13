const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

// Helper: verificar si el usuario puede modificar un apartamento
function puedeModificar(user, identificador) {
  if (user.tipo === "admin") return true;
  if (user.tipo === "residente" && user.identificador === identificador) return true;
  return false;
}

/* =====================================================================
   OBTENER DATOS DE UN APARTAMENTO
   GET /api/apartments/:identificador
   Requiere autenticación (admin o residente del mismo apartamento)
===================================================================== */
router.get("/:identificador", requireAuth(), async (req, res) => {
  try {
    const { identificador } = req.params;
    
    // Verificar permisos: admin puede ver todo, residente solo su apartamento
    if (!puedeModificar(req.user, identificador)) {
      return res.status(403).json({ ok: false, error: "No tienes permiso para ver este apartamento." });
    }

    const { rows } = await pool.query(
      `SELECT id, identificador, telefono_principal, whatsapp, email, created_at
       FROM apartamentos WHERE identificador = $1`,
      [identificador]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Apartamento no encontrado." });
    }

    // Obtener residentes del apartamento
    const residentes = await pool.query(
      `SELECT id, nombre, documento, es_principal, created_at
       FROM residentes WHERE apartamento_id = $1 ORDER BY es_principal DESC, nombre`,
      [rows[0].id]
    );

    // Obtener mascotas del apartamento
    const mascotas = await pool.query(
      `SELECT id, nombre, tipo, cantidad, created_at
       FROM mascotas WHERE apartamento_id = $1 ORDER BY nombre`,
      [rows[0].id]
    );

    // Obtener caracterización
    const caracterizacion = await pool.query(
      `SELECT personas_mayores, ninos, movilidad_reducida, dificultad_neurologica, prioridad_evacuacion
       FROM caracterizacion_apartamentos WHERE apartamento_id = $1`,
      [rows[0].id]
    );

    return res.json({
      ok: true,
      apartamento: rows[0],
      residentes: residentes.rows,
      mascotas: mascotas.rows,
      caracterizacion: caracterizacion.rows[0] || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error interno al obtener el apartamento." });
  }
});

/* =====================================================================
   ACTUALIZAR DATOS DE CONTACTO DEL APARTAMENTO
   PUT /api/apartments/:identificador
   Requiere autenticación (admin o residente del mismo apartamento)
===================================================================== */
router.put("/:identificador", requireAuth(), async (req, res) => {
  try {
    const { identificador } = req.params;
    
    if (!puedeModificar(req.user, identificador)) {
      return res.status(403).json({ ok: false, error: "No tienes permiso para modificar este apartamento." });
    }
    
    const { telefono_principal, whatsapp, email } = req.body;

    const { rows } = await pool.query(
      `UPDATE apartamentos 
       SET telefono_principal = COALESCE($1, telefono_principal),
           whatsapp = COALESCE($2, whatsapp),
           email = COALESCE($3, email)
       WHERE identificador = $4
       RETURNING id, identificador, telefono_principal, whatsapp, email`,
      [telefono_principal, whatsapp, email, identificador]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Apartamento no encontrado." });
    }

    return res.json({ ok: true, apartamento: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error interno al actualizar el apartamento." });
  }
});

/* =====================================================================
   AGREGAR/ACTUALIZAR RESIDENTE
   POST /api/apartments/:identificador/residentes
===================================================================== */
router.post("/:identificador/residentes", requireAuth(), async (req, res) => {
  try {
    const { identificador } = req.params;
    
    if (!puedeModificar(req.user, identificador)) {
      return res.status(403).json({ ok: false, error: "No tienes permiso para modificar este apartamento." });
    }
    
    const { nombre, documento, es_principal } = req.body;

    if (!nombre || !documento) {
      return res.status(400).json({ ok: false, error: "Nombre y documento son obligatorios." });
    }

    // Obtener el ID del apartamento
    const apto = await pool.query(
      `SELECT id FROM apartamentos WHERE identificador = $1`,
      [identificador]
    );
    if (apto.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Apartamento no encontrado." });
    }

    // Si es principal, quitar el flag de otros residentes
    if (es_principal) {
      await pool.query(
        `UPDATE residentes SET es_principal = FALSE WHERE apartamento_id = $1`,
        [apto.rows[0].id]
      );
    }

    const { rows } = await pool.query(
      `INSERT INTO residentes (apartamento_id, nombre, documento, es_principal)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (apartamento_id, documento) 
       DO UPDATE SET nombre = EXCLUDED.nombre, es_principal = EXCLUDED.es_principal
       RETURNING id, nombre, documento, es_principal`,
      [apto.rows[0].id, nombre, documento, es_principal || false]
    );

    return res.json({ ok: true, residente: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error interno al guardar el residente." });
  }
});

/* =====================================================================
   ELIMINAR RESIDENTE
   DELETE /api/apartments/:identificador/residentes/:id
===================================================================== */
router.delete("/:identificador/residentes/:id", requireAuth(), async (req, res) => {
  try {
    const { identificador, id } = req.params;
    
    if (!puedeModificar(req.user, identificador)) {
      return res.status(403).json({ ok: false, error: "No tienes permiso para modificar este apartamento." });
    }

    await pool.query(`DELETE FROM residentes WHERE id = $1`, [id]);

    return res.json({ ok: true, message: "Residente eliminado." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error interno al eliminar el residente." });
  }
});

/* =====================================================================
   AGREGAR MASCOTA
   POST /api/apartments/:identificador/mascotas
===================================================================== */
router.post("/:identificador/mascotas", requireAuth(), async (req, res) => {
  try {
    const { identificador } = req.params;
    
    if (!puedeModificar(req.user, identificador)) {
      return res.status(403).json({ ok: false, error: "No tienes permiso para modificar este apartamento." });
    }
    
    const { nombre, tipo, cantidad } = req.body;

    if (!nombre || !tipo) {
      return res.status(400).json({ ok: false, error: "Nombre y tipo de mascota son obligatorios." });
    }

    const tiposValidos = ["canino", "felino", "ave", "otro"];
    if (!tiposValidos.includes(tipo.toLowerCase())) {
      return res.status(400).json({ ok: false, error: "Tipo de mascota inválido." });
    }

    const apto = await pool.query(
      `SELECT id FROM apartamentos WHERE identificador = $1`,
      [identificador]
    );
    if (apto.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Apartamento no encontrado." });
    }

    const { rows } = await pool.query(
      `INSERT INTO mascotas (apartamento_id, nombre, tipo, cantidad)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, tipo, cantidad`,
      [apto.rows[0].id, nombre, tipo.toLowerCase(), cantidad || 1]
    );

    return res.json({ ok: true, mascota: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error interno al guardar la mascota." });
  }
});

/* =====================================================================
   ELIMINAR MASCOTA
   DELETE /api/apartments/:identificador/mascotas/:id
===================================================================== */
router.delete("/:identificador/mascotas/:id", requireAuth(), async (req, res) => {
  try {
    const { identificador, id } = req.params;
    
    if (!puedeModificar(req.user, identificador)) {
      return res.status(403).json({ ok: false, error: "No tienes permiso para modificar este apartamento." });
    }

    await pool.query(`DELETE FROM mascotas WHERE id = $1`, [id]);

    return res.json({ ok: true, message: "Mascota eliminada." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error interno al eliminar la mascota." });
  }
});

/* =====================================================================
   ACTUALIZAR CARACTERIZACIÓN
   PUT /api/apartments/:identificador/caracterizacion
===================================================================== */
router.put("/:identificador/caracterizacion", requireAuth(), async (req, res) => {
  try {
    const { identificador } = req.params;
    
    if (!puedeModificar(req.user, identificador)) {
      return res.status(403).json({ ok: false, error: "No tienes permiso para modificar este apartamento." });
    }
    
    const { personas_mayores, ninos, movilidad_reducida, dificultad_neurologica, prioridad_evacuacion } = req.body;

    const apto = await pool.query(
      `SELECT id FROM apartamentos WHERE identificador = $1`,
      [identificador]
    );
    if (apto.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Apartamento no encontrado." });
    }

    const { rows } = await pool.query(
      `INSERT INTO caracterizacion_apartamentos 
       (apartamento_id, personas_mayores, ninos, movilidad_reducida, dificultad_neurologica, prioridad_evacuacion)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (apartamento_id) 
       DO UPDATE SET 
         personas_mayores = EXCLUDED.personas_mayores,
         ninos = EXCLUDED.ninos,
         movilidad_reducida = EXCLUDED.movilidad_reducida,
         dificultad_neurologica = EXCLUDED.dificultad_neurologica,
         prioridad_evacuacion = EXCLUDED.prioridad_evacuacion
       RETURNING *`,
      [apto.rows[0].id, personas_mayores || false, ninos || false, movilidad_reducida || false, dificultad_neurologica || false, prioridad_evacuacion || false]
    );

    return res.json({ ok: true, caracterizacion: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error interno al guardar la caracterización." });
  }
});

module.exports = router;
