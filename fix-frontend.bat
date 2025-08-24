@echo off
chcp 65001 >nul
echo Fixing Frontend Dependencies...

cd frontend

echo Removing old dependencies...
if exist node_modules (
    rmdir /s /q node_modules
)
if exist package-lock.json (
    del package-lock.json
)

echo Installing new dependencies...
npm install

echo.
echo Frontend dependencies fixed!
echo Now you can run: start-frontend.bat
pause 