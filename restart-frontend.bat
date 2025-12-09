@echo off
echo ========================================
echo Restarting Frontend (Clearing Vite Cache)
echo ========================================
echo.

cd frontend

echo Step 1: Clearing Vite cache...
rmdir /s /q node_modules\.vite 2>nul
echo Vite cache cleared!
echo.

echo Step 2: Starting Frontend...
npm start

pause
