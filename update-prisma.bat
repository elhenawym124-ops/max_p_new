@echo off
echo Updating Prisma Client...
cd backend
npx prisma generate
echo.
echo Done! Please restart your backend server if it's running.
pause

