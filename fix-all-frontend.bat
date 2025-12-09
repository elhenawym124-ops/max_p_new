@echo off
echo ========================================
echo Fixing All Frontend Issues
echo ========================================
echo.

cd frontend

echo Step 1: Stopping any running processes...
echo Please close Vite dev server (Ctrl+C) if running
timeout /t 5

echo.
echo Step 2: Clearing Vite cache...
rmdir /s /q node_modules\.vite 2>nul
echo Vite cache cleared!

echo.
echo Step 3: Clearing npm cache...
call npm cache clean --force

echo.
echo Step 4: Reinstalling all packages...
call npm install --legacy-peer-deps

echo.
echo Step 5: Installing missing packages...
call npm install @tanstack/react-query@latest @tanstack/react-query-devtools@latest --legacy-peer-deps

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Now you can run: npm start
echo.
pause
