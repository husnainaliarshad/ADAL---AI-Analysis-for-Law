@echo off
title Adal-FYP Backend
cd /d "adal-backend"
call .\venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 9006
pause