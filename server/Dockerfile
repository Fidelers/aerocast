# server/Dockerfile
FROM node:22-slim

# Устанавливаем инструменты для сборки бинарных модулей (sqlite3)
RUN printf 'Acquire::Retries "5";\n' > /etc/apt/apt.conf.d/80-retries \
    && apt-get update \
    && apt-get install -y ca-certificates \
    && sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/* /etc/apt/apt.conf.d/80-retries

WORKDIR /app

# Копируем зависимости
COPY server/package*.json ./
RUN npm install --omit=dev --build-from-source=sqlite3

# Копируем код
COPY server/ .

EXPOSE 3000

CMD ["node", "server.js"]