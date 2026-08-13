-- =====================================================
-- PRADO VERDE - Base de Datos
-- Ejecutar este script en pgAdmin 4 o en Render
-- =====================================================

-- Usar esquema public (por defecto en PostgreSQL)
-- SET search_path TO public;

-- Tabla de administradores
CREATE TABLE IF NOT EXISTS administradores (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100),
    rol VARCHAR(20) DEFAULT 'admin',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de apartamentos
CREATE TABLE IF NOT EXISTS apartamentos (
    id SERIAL PRIMARY KEY,
    identificador VARCHAR(20) UNIQUE NOT NULL, -- Ej: T1-0101, T2-1806
    telefono_principal VARCHAR(20),
    whatsapp VARCHAR(20),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agregar columnas si ya existe la tabla (migracion)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='apartamentos' AND column_name='whatsapp') THEN
        ALTER TABLE apartamentos ADD COLUMN whatsapp VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='apartamentos' AND column_name='email') THEN
        ALTER TABLE apartamentos ADD COLUMN email VARCHAR(100);
    END IF;
END $$;

-- Tabla de códigos OTP
CREATE TABLE IF NOT EXISTS codigos_otp (
    id SERIAL PRIMARY KEY,
    apartamento_id INTEGER REFERENCES apartamentos(id),
    codigo_hash VARCHAR(255) NOT NULL,
    telefono_destino VARCHAR(100) NOT NULL,
    ip_solicitud VARCHAR(45),
    usado BOOLEAN DEFAULT FALSE,
    expira_en TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de residentes
CREATE TABLE IF NOT EXISTS residentes (
    id SERIAL PRIMARY KEY,
    apartamento_id INTEGER REFERENCES apartamentos(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    documento VARCHAR(20) NOT NULL,
    es_principal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(apartamento_id, documento)
);

-- Tabla de mascotas
CREATE TABLE IF NOT EXISTS mascotas (
    id SERIAL PRIMARY KEY,
    apartamento_id INTEGER REFERENCES apartamentos(id) ON DELETE CASCADE,
    nombre VARCHAR(50) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('canino', 'felino', 'ave', 'otro')),
    cantidad INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de caracterización de apartamentos
CREATE TABLE IF NOT EXISTS caracterizacion_apartamentos (
    id SERIAL PRIMARY KEY,
    apartamento_id INTEGER UNIQUE REFERENCES apartamentos(id) ON DELETE CASCADE,
    personas_mayores BOOLEAN DEFAULT FALSE,
    ninos BOOLEAN DEFAULT FALSE,
    movilidad_reducida BOOLEAN DEFAULT FALSE,
    dificultad_neurologica BOOLEAN DEFAULT FALSE,
    prioridad_evacuacion BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INSERTAR USUARIO ADMIN
-- Contraseña: Login exito2026
-- Hash generado con bcrypt (12 rounds)
-- =====================================================
INSERT INTO administradores (usuario, password_hash, nombre_completo, rol, activo)
VALUES (
    'admin',
    '$2b$12$YvQDMt1/OzofrFBX7gjFl.OGkopIBgEBfMYUSk/HD0/q.STpzFXjS',
    'Administrador Principal',
    'admin',
    TRUE
) ON CONFLICT (usuario) DO NOTHING;

-- =====================================================
-- INSERTAR APARTAMENTOS DE EJEMPLO (2 torres, 18 pisos, 6 aptos por piso)
-- =====================================================
DO $$
DECLARE
    torre INTEGER;
    piso INTEGER;
    apto TEXT;
    apt_id TEXT;
BEGIN
    FOR torre IN 1..2 LOOP
        FOR piso IN 1..18 LOOP
            FOREACH apto IN ARRAY ARRAY['01', '02', '03', '04', '05', '06'] LOOP
                apt_id := 'T' || torre || '-' || LPAD(piso::TEXT, 2, '0') || apto;
                INSERT INTO apartamentos (identificador, telefono_principal)
                VALUES (apt_id, NULL)
                ON CONFLICT (identificador) DO NOTHING;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- =====================================================
-- APARTAMENTOS DE PRUEBA CON DATOS DE CONTACTO
-- Actualiza estos con datos reales para probar
-- =====================================================
UPDATE apartamentos 
SET 
    telefono_principal = '+573001234567',
    whatsapp = '+573001234567',
    email = 'residente.prueba@ejemplo.com'
WHERE identificador = 'T1-0101';

UPDATE apartamentos 
SET 
    telefono_principal = '+573009876543',
    whatsapp = '+573009876543',
    email = 'residente2@ejemplo.com'
WHERE identificador = 'T1-0102';

UPDATE apartamentos 
SET 
    telefono_principal = '+573005551234',
    email = 'solo.email@ejemplo.com'
WHERE identificador = 'T1-0201';

-- Verificar que todo se creó correctamente
SELECT 'Administradores:' AS tabla, COUNT(*) AS total FROM administradores
UNION ALL
SELECT 'Apartamentos:', COUNT(*) FROM apartamentos
UNION ALL
SELECT 'Aptos con teléfono:', COUNT(*) FROM apartamentos WHERE telefono_principal IS NOT NULL
UNION ALL
SELECT 'Aptos con WhatsApp:', COUNT(*) FROM apartamentos WHERE whatsapp IS NOT NULL
UNION ALL
SELECT 'Aptos con email:', COUNT(*) FROM apartamentos WHERE email IS NOT NULL;
