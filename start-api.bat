@echo off
chcp 65001 >nul



if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt

echo Setting environment variables...
set HMAC_KEY=supersecret

echo Starting server...
python -m uvicorn app:APP --host 0.0.0.0 --port 8080 --reload 