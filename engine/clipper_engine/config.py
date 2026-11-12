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

CLIP_MIN, CLIP_MAX = 20, 75
COMP_MIN, COMP_MAX = 480, 720
LIMITS = {"shorts": 60, "reels": 90, "tiktok": 600}
