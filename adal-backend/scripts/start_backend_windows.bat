@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0\.."

set "PYTHON_BIN="
if exist "venv\Scripts\python.exe" set "PYTHON_BIN=venv\Scripts\python.exe"
if not defined PYTHON_BIN if exist ".venv\Scripts\python.exe" set "PYTHON_BIN=.venv\Scripts\python.exe"
if not defined PYTHON_BIN if exist "adal\Scripts\python.exe" set "PYTHON_BIN=adal\Scripts\python.exe"

if not defined PYTHON_BIN (
    echo Error: No Windows virtual environment python found.
    echo Checked:
    echo   venv\Scripts\python.exe
    echo   .venv\Scripts\python.exe
    echo   adal\Scripts\python.exe
    exit /b 1
)

if "%HOST%"=="" set "HOST=0.0.0.0"
if "%PORT%"=="" set "PORT=9006"
if "%RELOAD%"=="" set "RELOAD=1"

"%PYTHON_BIN%" -c "import uvicorn" >nul 2>nul
if errorlevel 1 (
    echo Error: uvicorn is not installed in %PYTHON_BIN%
    echo Run:
    echo   %PYTHON_BIN% -m pip install -r requirements.txt
    exit /b 1
)

set "RELOAD_FLAG="
if not "%RELOAD%"=="0" set "RELOAD_FLAG=--reload"

echo Starting ADAL backend...
echo Python: %PYTHON_BIN%
echo URL: http://%HOST%:%PORT%

"%PYTHON_BIN%" -m uvicorn app.main:app --host %HOST% --port %PORT% %RELOAD_FLAG% %*
