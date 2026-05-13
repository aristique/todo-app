FROM node:18-alpine AS build

WORKDIR /app
COPY . .
# Для чистого HTML/JS/CSS сборка не нужна — просто копируем файлы

FROM nginx:alpine

# Копируем статику
COPY --from=build /app/index.html  /usr/share/nginx/html/
COPY --from=build /app/style.css   /usr/share/nginx/html/
COPY --from=build /app/app.js      /usr/share/nginx/html/

# Наш конфиг nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
