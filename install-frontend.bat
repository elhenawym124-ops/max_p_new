@echo off
echo ========================================
echo Installing Frontend Packages
echo ========================================
echo.

cd frontend

echo Installing date-fns...
call npm install date-fns

echo.
echo Installing recharts...
call npm install recharts

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo You can now run: npm start
echo.
pause
