@echo off
rem Instala o Clipper Engine no Windows 11 pelo CMD (nao precisa de PowerShell).
rem Rode uma vez, na raiz do repositorio (ou de dois cliques no arquivo):
rem   scripts\setup-windows.bat
rem Use "scripts\setup-windows.bat voz" para instalar tambem o voice-bridge.
setlocal
cd /d "%~dp0.."

call :precisa ffmpeg Gyan.FFmpeg
call :precisa uv astral-sh.uv
call :precisa node OpenJS.NodeJS.LTS
rem o YouTube exige um programa JavaScript para baixar videos
call :precisa deno DenoLand.Deno
if defined SEMWINGET goto :sem_winget
if defined INSTALOU call :recarregar_path

set FALTA=
for %%c in (ffmpeg uv node deno) do where %%c >nul 2>nul || set FALTA=%%c
if not defined FALTA goto :engine
echo.
echo Instalei os programas, mas este CMD ainda nao enxerga o %FALTA%.
echo Feche esta janela, abra um CMD novo e rode o script de novo.
goto :fim

:engine
pushd engine
uv sync || goto :erro
if not exist .env copy .env.example .env >nul
echo Baixando o modelo de transcricao (uma vez so)...
uv run python -c "from faster_whisper import WhisperModel; from clipper_engine import config; WhisperModel(config.WHISPER_MODEL, device='cpu', compute_type='int8')" || goto :erro
popd

call npm install || goto :erro
if /i "%~1"=="voz" uv tool install "ai-voice-bridge[edge]"

echo.
echo Pronto. Falta so:
echo   1. Colar sua chave do Gemini em engine\.env (gratis: https://aistudio.google.com/apikey)
echo   2. Abrir scripts\start-clipper.bat
goto :fim

:precisa
where %1 >nul 2>nul && exit /b 0
where winget >nul 2>nul || (set SEMWINGET=1& set FALTA=%FALTA% %1& exit /b 0)
echo Instalando %2...
winget install --id %2 -e --accept-source-agreements --accept-package-agreements
set INSTALOU=1
exit /b 0

:recarregar_path
rem o winget so atualiza o PATH de terminais novos; le o PATH atualizado do registro
for /f "tokens=2,*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH_MAQ=%%b"
for /f "tokens=2,*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "PATH_USU=%%b"
call set "PATH=%PATH%;%PATH_MAQ%;%PATH_USU%"
exit /b 0

:sem_winget
echo.
echo Faltam estes programas:%FALTA%
echo O winget nao esta disponivel neste PC, entao nao consigo instalar sozinho.
echo Instale o "Instalador de Aplicativo" (App Installer) pela Microsoft Store
echo ou peca para a TI instalar, e depois rode este script de novo.
goto :fim

:erro
echo.
echo Deu erro no passo acima. Copie a mensagem e me mande.

:fim
pause
endlocal
