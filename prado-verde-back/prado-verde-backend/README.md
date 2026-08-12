# Prado Verde · Backend de login

Implementa el **login real** que reemplaza el modo demo de los prototipos:

- **Administración**: usuario + contraseña (hash bcrypt) → JWT.
- **Residentes**: seleccionan torre/piso/apto → reciben un código por SMS (OTP) → lo verifican → JWT.

Se conecta directamente a las tablas creadas por `prado_verde_bd.sql` (`administradores`, `apartamentos`, `codigos_otp`).

## 1. Instalación

```bash
cd prado-verde-backend
npm install
cp .env.example .env
```

Edita `.env` con tu cadena de conexión real (`DATABASE_URL`) y un `JWT_SECRET` aleatorio y largo.

## 2. Crear la contraseña real del administrador

El script SQL crea el usuario `admin` con un hash de marcador de posición. Genera un hash real:

```bash
node scripts/hash-password.js "TuContraseñaSegura123"
```

Copia el hash resultante y ejecútalo contra la base de datos:

```sql
UPDATE prado_verde.administradores
SET password_hash = 'HASH_GENERADO_AQUI'
WHERE usuario = 'admin';
```

## 3. Levantar el servidor

```bash
npm run dev     # con recarga automática (nodemon)
# o
npm start
```

Por defecto queda en `http://localhost:4000`.

## 4. Endpoints

### Login administrativo
```
POST /api/auth/admin/login
Body: { "usuario": "admin", "password": "TuContraseñaSegura123" }
→ { ok: true, token: "...", admin: { id, usuario, nombre, rol } }
```

### Login de residentes — paso 1: pedir código
```
POST /api/auth/resident/request-code
Body: { "torre": 1, "piso": 5, "apto": "03" }
→ { ok: true, message: "Código enviado por SMS.", telefonoEnmascarado: "••• ••• 1234" }
```
En `NODE_ENV=development` la respuesta también incluye `codigoDemo` para poder probar sin una pasarela SMS real conectada. En producción ese campo no se envía.

### Login de residentes — paso 2: verificar código
```
POST /api/auth/resident/verify-code
Body: { "torre": 1, "piso": 5, "apto": "03", "codigo": "482913" }
→ { ok: true, token: "...", apartamento: { id, identificador } }
```

### Rutas protegidas de ejemplo
```
GET /api/admin/ping      (requiere Authorization: Bearer <token de admin>)
GET /api/resident/ping   (requiere Authorization: Bearer <token de residente>)
```

## 5. Conectar una pasarela SMS real

Edita `src/services/smsService.js` y agrega tu proveedor (Twilio, Infobip, etc.) en la rama correspondiente. El resto de la aplicación no necesita cambios: las rutas ya llaman a `enviarSms(telefono, mensaje)`.

## 6. Seguridad — resumen de lo ya implementado

- Contraseñas de administradores: hash bcrypt, nunca texto plano.
- Códigos OTP: se guardan hasheados (bcrypt) y expiran (`OTP_EXP_MINUTES`, por defecto 5 min).
- Un código OTP no se puede reutilizar (`usado = TRUE` tras verificarse).
- Sesiones vía JWT firmado, con expiración (8 h admin, 2 h residentes) y tipo (`admin`/`residente`) para separar permisos.

### Pendiente recomendado antes de producción
- Límite de intentos de verificación de OTP (actualmente no hay bloqueo tras varios intentos fallidos).
- Rate limiting general de la API (ej. `express-rate-limit`).
- HTTPS obligatorio y `helmet` para cabeceras de seguridad.
- Rotación/revocación de JWT (lista negra o refresh tokens) si se requiere cierre de sesión forzado.
