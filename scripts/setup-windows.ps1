# Instala o Clipper Engine no Windows 11. Rode uma vez, na raiz do repositório:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
# Use -Voz para instalar também o voice-bridge (Claude Code lendo as respostas em voz alta).
param([switch]$Voz)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Need($cmd, $id) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "Instalando $id..."
        winget install --id $id -e --accept-source-agreements --accept-package-agreements
    }
}
Need ffmpeg Gyan.FFmpeg
Need uv astral-sh.uv
Need node OpenJS.NodeJS.LTS
# winget só atualiza o PATH de terminais novos
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")

Push-Location engine
uv sync
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Write-Host "Baixando o modelo de transcrição (uma vez só)..."
uv run python -c "from faster_whisper import WhisperModel; from clipper_engine import config; WhisperModel(config.WHISPER_MODEL, device='cpu', compute_type='int8')"
Pop-Location

npm install
if ($Voz) { uv tool install "ai-voice-bridge[edge]" }

Write-Host ""
Write-Host "Pronto. Falta só:"
Write-Host "  1. Colar sua chave do Gemini em engine\.env (grátis: https://aistudio.google.com/apikey)"
Write-Host "  2. Abrir scripts\start-clipper.bat"
