@echo off
echo ========================================
echo Starting Activity Log System
echo ========================================
echo.

echo Step 1: Checking Backend dependencies...
cd backend
if not exist "node_modules\mongoose" (
    echo Installing mongoose...
    call npm install mongoose
)
cd ..
echo.

echo Step 2: Clearing Vite Cache...
cd frontend
rmdir /s /q node_modules\.vite 2>nul
echo Vite cache cleared!
echo.

echo Step 3: Starting Backend...
start "Backend Server" cmd /k "cd ..\backend && npm start"
timeout /t 3

echo.
echo Step 4: Starting Frontend...
start "Frontend Server" cmd /k "npm start"

echo.
echo ========================================
echo Both servers are starting...
echo ========================================
echo.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit this window...
pause > nul
