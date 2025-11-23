@echo off
echo ========================================
echo   Homepage System Setup
echo ========================================
echo.

echo Step 1: Generating Prisma Client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo ERROR: Failed to generate Prisma Client
    pause
    exit /b 1
)
echo.

echo Step 2: Running Database Migration...
call npx prisma migrate dev --name add_homepage_templates
if %errorlevel% neq 0 (
    echo ERROR: Failed to run migration
    pause
    exit /b 1
)
echo.

echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Please restart your backend server now.
echo.
pause
