FROM node:18-alpine

WORKDIR /app

# Сначала копируем package.json для использования кэша слоёв
COPY package.json .
RUN npm install --production

# Копируем остальной код
COPY . .

EXPOSE 4000

CMD ["node", "index.js"]
