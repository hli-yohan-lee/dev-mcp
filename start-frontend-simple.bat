@echo off
chcp 65001 >nul
echo Starting Frontend (Simple Version)...

cd frontend

REM Check if node_modules exists
if not exist node_modules (
    echo Installing dependencies...
    npm install
)

REM Try to start with npm run dev
echo Starting development server...
npm run dev

REM If that fails, try alternative
if errorlevel 1 (
    echo npm run dev failed, trying alternative...
    npx vite --host 0.0.0.0 --port 3000
) 