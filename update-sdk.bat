@echo off
chcp 65001 >nul
echo ========================================
echo   تحديث Facebook Business SDK
echo ========================================
echo.

cd /d "%~dp0backend"

echo 🔄 جاري تحديث المكتبة...
echo.

call npm install facebook-nodejs-business-sdk@latest

echo.
echo ========================================
echo   التحقق من الإصدار المثبت:
echo ========================================
call npm list facebook-nodejs-business-sdk

echo.
echo ✅ تم التحديث بنجاح!
echo.
pause

















