# Etapa 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Etapa 2: Runtime
FROM node:18-alpine

WORKDIR /app

# Establecer variables de entorno
ENV NODE_ENV=production

# Copiar node_modules de la etapa anterior
COPY --from=builder /app/node_modules ./node_modules

# Copiar el código de la aplicación
COPY src ./src
COPY scripts ./scripts
COPY prado_verde_bd.sql ./

# Exponer el puerto (por defecto 4000)
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Comando para iniciar la aplicación
CMD ["node", "src/server.js"]
