@echo off
echo ========================================
echo Stopping All Servers
echo ========================================
echo.

echo Step 1: Stopping Docker containers (if running)...
docker-compose down 2>nul
if %errorlevel% equ 0 (
    echo Docker containers stopped.
) else (
    echo Docker not available or no containers running.
)
echo.

echo Step 2: Stopping Node.js processes...
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr /I "PID"') do (
    echo Stopping Node.js process %%a...
    taskkill /F /PID %%a >nul 2>&1
)
echo.

echo Step 3: Stopping processes on ports 3000, 3001, 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Stopping process on port 3000 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo Stopping process on port 3001 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do (
    echo Stopping process on port 5000 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)
echo.

echo Step 4: Stopping npm processes...
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq npm.exe" /FO LIST ^| findstr /I "PID"') do (
    echo Stopping npm process %%a...
    taskkill /F /PID %%a >nul 2>&1
)
echo.

echo ========================================
echo All servers stopped!
echo ========================================
echo.
pause







