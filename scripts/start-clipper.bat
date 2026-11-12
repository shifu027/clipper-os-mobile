@echo off
rem Sobe o motor de cortes e o app. Feche as duas janelas para desligar.
cd /d "%~dp0.."
start "Clipper Engine" cmd /k "cd engine && uv run clipper servir"
start "Clipper OS" cmd /k "npm run dev"
