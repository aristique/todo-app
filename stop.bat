@echo off
title ToDo App — Stop

echo ============================================
echo  ToDo App — Stopping all containers
echo ============================================
echo.

echo Stopping and removing containers...
docker rm -f postgres-db todo-backend todo-frontend >nul 2>&1
echo      Done.
echo.

echo Removing Docker network...
docker network rm todo-network >nul 2>&1
echo      Done.
echo.

echo ============================================
echo  All containers stopped and removed.
echo ============================================
echo.

set /p CLEAN="Remove Docker images too? (y/n): "
if /i "%CLEAN%"=="y" (
    echo Removing images...
    docker rmi todo-db todo-backend todo-frontend >nul 2>&1
    echo      Images removed.
) else (
    echo      Images kept (data volume also preserved).
)
echo.
pause
