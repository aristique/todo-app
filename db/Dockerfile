FROM postgres:15-alpine

# Копируем скрипт инициализации в специальную директорию
# PostgreSQL автоматически выполнит все .sql файлы из /docker-entrypoint-initdb.d/
COPY init.sql /docker-entrypoint-initdb.d/init.sql

EXPOSE 5432
