# MCP Stack - Simple Start Guide

## Quick Start

### Option 1: Start All Services (Recommended)
```cmd
start.bat
```

### Option 2: Start Individual Services
Open separate terminal windows and run:

```cmd
# Terminal 1 - Frontend
start-frontend.bat

# Terminal 2 - MCP Server  
start-mcp.bat

# Terminal 3 - Corp API Server
start-api.bat
```

## Access URLs

- **Frontend**: http://localhost:3000
- **MCP Server**: http://localhost:9000  
- **Corp API**: http://localhost:8080

## Stop Services

```cmd
stop.bat
```

Or close each terminal window manually.

## Requirements

- Python 3.11+
- Node.js 14+ (18+ recommended)
- Git

## Troubleshooting

### Frontend Issues (Node.js Version Problems)
If you get "Unexpected reserved word" errors:

1. **Fix Dependencies** (Recommended):
   ```cmd
   fix-frontend.bat
   ```

2. **Alternative Frontend Start**:
   ```cmd
   start-frontend-simple.bat
   ```

3. **Manual Fix**:
   ```cmd
   cd frontend
   rmdir /s /q node_modules
   del package-lock.json
   npm install
   ```

### Environment Variable Errors
- The scripts now automatically set required environment variables
- No need to create .env files manually

### Path Errors
1. Make sure you're in the project root directory
2. Run `start.bat` from the root folder
3. Check that Python and Node.js are installed

## Test

1. Open http://localhost:3000 in your browser
2. Select an action (e.g., PDF_METADATA)
3. Enter args JSON
4. Click Invoke
5. Check response

## What's Fixed

- ✅ Environment variable errors (COMPANY_API_BASE, HMAC_KEY)
- ✅ Node.js compatibility issues (Vite 3.x, TypeScript 4.x)
- ✅ Path and directory errors
- ✅ Automatic environment variable setup
- ✅ Frontend dependency compatibility 