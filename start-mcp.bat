@echo off
chcp 65001 >nul
echo Starting MCP Server...

cd mcp-server
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt

echo Setting environment variables...
set COMPANY_API_BASE=http://localhost:8080
set HMAC_KEY=supersecret
set MCP_ID=mcp-invest

echo Starting server...
python -m uvicorn app:APP --host 0.0.0.0 --port 9000 --reload 