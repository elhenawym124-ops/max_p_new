@echo off
cd /d "%~dp0"
node node_modules\prisma\build\index.js generate
pause

