@echo off
cd /d "%~dp0"
python -c "import yaml, markdown_it"
if errorlevel 1 python -m pip install -r requirements.txt
if errorlevel 1 (
  pause
  exit /b 1
)
python scripts\editor.py
if errorlevel 1 pause
