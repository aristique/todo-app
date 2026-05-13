@echo off
setlocal EnableDelayedExpansion
title ToDo App — Start

echo ============================================
echo  ToDo App — Starting all containers
echo ============================================
echo.

REM ── 1. Удаляем старые контейнеры (игнорируем ошибки если их нет) ──────────
echo [1/7] Removing old containers (if any)...
docker rm -f postgres-db todo-backend todo-frontend >nul 2>&1
echo      Done.
echo.

REM ── 2. Собираем образы ───────────────────────────────────────────────────
echo [2/7] Building images...
echo      Building todo-db...
docker build -t todo-db       ./db       >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Failed to build todo-db
    pause
    exit /b 1
)
echo      Building todo-backend...
docker build -t todo-backend  ./backend  >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Failed to build todo-backend
    pause
    exit /b 1
)
echo      Building todo-frontend...
docker build -t todo-frontend ./frontend >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Failed to build todo-frontend
    pause
    exit /b 1
)
echo      All images built successfully.
echo.

REM ── 3. Создаём сеть (игнорируем если уже существует) ─────────────────────
echo [3/7] Creating Docker network...
docker network create todo-network >nul 2>&1
echo      Network ready.
echo.

REM ── 4. Запускаем PostgreSQL ───────────────────────────────────────────────
echo [4/7] Starting PostgreSQL...
docker run -d ^
  --name postgres-db ^
  --network todo-network ^
  -e POSTGRES_USER=todouser ^
  -e POSTGRES_PASSWORD=todopassword ^
  -e POSTGRES_DB=tododb ^
  -v todo-pg-data:/var/lib/postgresql/data ^
  todo-db >nul
if errorlevel 1 (
    echo [ERROR] Failed to start postgres-db
    pause
    exit /b 1
)
echo      PostgreSQL started.
echo.

REM ── 5. Ждём пока БД стартует ─────────────────────────────────────────────
echo [5/7] Waiting for PostgreSQL to be ready...
set READY=0
for /l %%i in (1,1,15) do (
    if !READY!==0 (
        docker exec postgres-db pg_isready -U todouser -d tododb >nul 2>&1
        if !errorlevel!==0 (
            echo      PostgreSQL is ready!
            set READY=1
        ) else (
            echo      Attempt %%i/15 — waiting 2 seconds...
            timeout /t 2 /nobreak >nul
        )
    )
)
if !READY!==0 (
    echo [WARNING] PostgreSQL might not be ready, continuing anyway...
)
echo.

REM ── 6. Запускаем Backend ─────────────────────────────────────────────────
echo [6/7] Starting Backend...
docker run -d ^
  --name todo-backend ^
  --network todo-network ^
  -e DB_HOST=postgres-db ^
  -e DB_PORT=5432 ^
  -e DB_USER=todouser ^
  -e DB_PASSWORD=todopassword ^
  -e DB_NAME=tododb ^
  -e PORT=4000 ^
  todo-backend >nul
if errorlevel 1 (
    echo [ERROR] Failed to start todo-backend
    pause
    exit /b 1
)
echo      Backend started.
echo.

REM ── 7. Запускаем Frontend (Nginx) ────────────────────────────────────────
echo [7/7] Starting Frontend (Nginx)...
docker run -d ^
  --name todo-frontend ^
  --network todo-network ^
  -p 3000:80 ^
  todo-frontend >nul
if errorlevel 1 (
    echo [ERROR] Failed to start todo-frontend
    pause
    exit /b 1
)
echo      Frontend started.
echo.

REM ── Итог ─────────────────────────────────────────────────────────────────
echo ============================================
echo  All containers are running!
echo ============================================
echo.
docker ps --filter "name=postgres-db" --filter "name=todo-backend" --filter "name=todo-frontend" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.
echo  Open in browser: http://localhost:3000
echo.
pause
