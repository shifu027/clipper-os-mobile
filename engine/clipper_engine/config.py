import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

if (ROOT / ".env").exists():
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        key, sep, value = line.partition("=")
        if sep and not key.strip().startswith("#"):
            os.environ.setdefault(key.strip(), value.strip())

OUT = Path(os.environ.get("CLIPPER_SAIDA") or ROOT / "saida")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")

# --duracao: segundos mínimo e máximo de cada corte
DURATIONS = {"0-1": (20, 60), "1-3": (60, 180), "3-5": (180, 300), "5-10": (300, 600), "10-15": (600, 900)}
COMP_MIN, COMP_MAX = 480, 720
LIMITS = {"shorts": 60, "reels": 90, "tiktok": 600}

# Modelo de marca opcional (veja marca.example.json). Sem o arquivo, fica o visual padrão.
BRAND = json.loads((ROOT / "marca.json").read_text(encoding="utf-8")) if (ROOT / "marca.json").exists() else {}
