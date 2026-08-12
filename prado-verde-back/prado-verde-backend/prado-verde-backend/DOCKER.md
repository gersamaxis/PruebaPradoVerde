# 🐳 Guía de Docker para Prado Verde Backend

## Archivos creados

- **Dockerfile** - Configuración para containerizar la aplicación
- **docker-compose.yml** - Orquestación de servicios (Backend + PostgreSQL)
- **.dockerignore** - Archivos a excluir del container
- **.env.docker** - Configuración de variables de entorno para Docker

---

## 📋 Requisitos previos

- Docker Desktop instalado ([descargar](https://www.docker.com/products/docker-desktop))
- Docker Compose (incluido en Docker Desktop)

---

## 🚀 Cómo levantar los servicios

### Opción 1: Usando docker-compose (Recomendado)

```bash
# Clonar/acceder al proyecto
cd prado-verde-backend

# Levantar los servicios (Backend + PostgreSQL)
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener los servicios
docker-compose down
```

**El backend estará disponible en:** `http://localhost:4000`

---

### Opción 2: Construir y ejecutar manualmente

```bash
# Construir la imagen Docker
docker build -t prado-verde-backend:latest .

# Ejecutar el container (con PostgreSQL ya levantado)
docker run -p 4000:4000 \
  -e DATABASE_URL="postgres://usuario:clave@host.docker.internal:5432/prado_verde" \
  -e JWT_SECRET="tu_secret_aqui" \
  prado-verde-backend:latest
```

---

## ⚙️ Configuración de variables de entorno

Edita el archivo `.env.docker` con tus valores:

```env
NODE_ENV=production
PORT=4000
DB_USER=usuario
DB_PASSWORD=clave
DB_NAME=prado_verde
JWT_SECRET=cambia_este_valor_en_produccion
OTP_EXP_MINUTES=5
SMS_PROVIDER=console
```

---

## 🗄️ Base de datos

La base de datos se crea automáticamente con `docker-compose up`:

- **Host:** `postgres` (desde el backend) o `localhost` (desde tu máquina)
- **Puerto:** `5432`
- **Usuario:** `usuario`
- **Contraseña:** `clave`
- **Database:** `prado_verde`

### Conectarse a PostgreSQL (dentro del container)

```bash
docker exec -it prado-verde-db psql -U usuario -d prado_verde
```

---

## ✅ Verificar que funciona

```bash
# Health check
curl http://localhost:4000/api/health

# Respuesta esperada:
# {"ok":true,"service":"prado-verde-backend"}
```

---

## 📦 Estructura de los servicios

```
┌─────────────────────────────────────┐
│      docker-compose.yml             │
├──────────────────┬──────────────────┤
│  prado-verde-db  │ prado-verde-back │
│  (PostgreSQL)    │  (Node.js/Express)
│  Puerto: 5432    │  Puerto: 4000
└──────────────────┴──────────────────┘
```

---

## 🔧 Comandos útiles

```bash
# Ver containers en ejecución
docker ps

# Ver logs del backend
docker-compose logs backend -f

# Ver logs de PostgreSQL
docker-compose logs postgres -f

# Ejecutar comandos en el container del backend
docker exec -it prado-verde-backend npm run hash-password

# Reconstruir la imagen (después de cambios en el código)
docker-compose up -d --build

# Limpiar todo (containers, volúmenes, redes)
docker-compose down -v
```

---

## 📝 Notas importantes

⚠️ **SEGURIDAD EN PRODUCCIÓN:**
- Cambiar `JWT_SECRET` por un valor aleatorio y seguro
- Cambiar `DB_PASSWORD` por una contraseña fuerte
- No versionar el archivo `.env` (usar `.env.example`)
- Usar variables de entorno desde el servidor (AWS Secrets Manager, etc.)

---

## 🐛 Solución de problemas

### El backend no se conecta a la base de datos
```bash
# Verificar que PostgreSQL está sano
docker-compose ps

# Ver logs de PostgreSQL
docker-compose logs postgres

# Verificar la URL de conexión en el backend
docker exec prado-verde-backend env | grep DATABASE_URL
```

### Puerto 5432 ya está en uso
```bash
# Cambiar el puerto en docker-compose.yml
# Línea: ports: - "5433:5432"  (5433 en tu máquina, 5432 en el container)
```

### Limpiar todo y comenzar de nuevo
```bash
docker-compose down -v
docker-compose up -d
```

---

## 📚 Referencias

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Node.js Docker Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
