@echo off
title GroqMind AI Chatbot Launcher
echo ===================================================
echo             GroqMind Chatbot Launcher              
echo ===================================================
echo.

cd /d "%~dp0"

:: Check Python installation
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found in your PATH. Please install Python.
    pause
    exit /b 1
)

:: Create Virtual Environment if it doesn't exist
if not exist .venv (
    echo [INFO] Creating Python virtual environment [.venv]...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

:: Run Custom Pure-Python Installation Pipeline
echo [INFO] Verifying environment dependencies...

.venv\Scripts\python -c "import langsmith" >nul 2>nul
if %errorlevel% neq 0 (
    echo [1/5] Installing setuptools and langsmith...
    .venv\Scripts\python -m pip install setuptools >nul 2>nul
    .venv\Scripts\python -m pip install --no-deps "langsmith<0.2.0"
) else (
    echo [1/5] Setuptools and langsmith already installed.
)

.venv\Scripts\python -c "import yaml" >nul 2>nul
if %errorlevel% neq 0 (
    echo [2/5] Installing PyYAML [pure Python mode]...
    set PYYAML_FORCE_LIBYAML=0
    if exist pyyaml-6.0.3 (
        rd /s /q pyyaml-6.0.3
    )
    .venv\Scripts\python backend\scratch\install_pyyaml.py
) else (
    echo [2/5] PyYAML already installed.
)

.venv\Scripts\python -c "import fastapi" >nul 2>nul
if %errorlevel% neq 0 (
    echo [3/5] Installing FastAPI, Pydantic v1, and standard packages...
    .venv\Scripts\python -m pip install "pydantic<2.0.0" "fastapi<0.100.0" uvicorn python-dotenv httpx jsonpatch tenacity packaging distro requests requests-toolbelt sniffio websockets anyio orjson xxhash
) else (
    echo [3/5] FastAPI and standard packages already installed.
)

.venv\Scripts\python -c "import langchain_groq" >nul 2>nul
if %errorlevel% neq 0 (
    echo [4/5] Installing LangChain Core and Groq integrations...
    .venv\Scripts\python -m pip install --no-deps "langchain-core<0.2.0" "langchain-groq<=0.1.3"
) else (
    echo [4/5] LangChain and Groq integrations already installed.
)

echo.
echo [5/5] Applying slot compatibility fix to charset_normalizer...
if exist .venv\Lib\site-packages\charset_normalizer\cd.cp315-win_amd64.pyd (
    del /f /q .venv\Lib\site-packages\charset_normalizer\cd.cp315-win_amd64.pyd
)
if exist .venv\Lib\site-packages\charset_normalizer\md.cp315-win_amd64.pyd (
    del /f /q .venv\Lib\site-packages\charset_normalizer\md.cp315-win_amd64.pyd
)

echo.
echo [INFO] Environment check:
.venv\Scripts\python -c "import fastapi; import uvicorn; import dotenv; import langchain_core; import langchain_groq; from langchain_groq import ChatGroq; print('-> Environment verified successfully!')"
if %errorlevel% neq 0 (
    echo [ERROR] Environment verification failed. Please check logs.
    pause
    exit /b 1
)

:: Start browser in background
echo.
echo [INFO] Launching browser to http://127.0.0.1:8000 ...
timeout /t 2 /nobreak >nul
start http://127.0.0.1:8000

:: Run backend FastAPI server
echo [INFO] Starting FastAPI server on port 8000...
echo.
.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
pause
