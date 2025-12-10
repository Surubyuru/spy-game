FROM node:18-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (solo las necesarias para produccion)
RUN npm install --production

# Copiar el resto del código
COPY . .

# Exponer el puerto (Easypanel detectara esto)
EXPOSE 3000

# Comando para iniciar
CMD ["node", "server.js"]
