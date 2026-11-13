import csv
import json
import os
import re
import shutil
import unicodedata
from pathlib import Path

from . import config


def slug(text, size=40):
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")[:size] or "corte"


def link(src: Path, dst: Path):
    dst.unlink(missing_ok=True)
    try:
        os.link(src, dst)  # mesmo arquivo em várias pastas sem gastar disco
    except OSError:
        shutil.copy2(src, dst)


def caption(clip, platform):
    tags = [*clip["hashtags"], *(["Shorts"] if platform == "shorts" else [])]
    return f"{clip['title']}\n\n{clip['description']}\n\n{' '.join('#' + t.lstrip('#') for t in tags)}\n"


def package(work: Path, clips, compilation, per_day):
    """Distribui os cortes nas pastas por plataforma e escreve lotes.csv + manifesto.json."""
    rows = []
    for folder in [*config.LIMITS, "quadrado"]:
        shutil.rmtree(work / folder, ignore_errors=True)  # sem sobras de uma rodada anterior com outras opções
    for i, clip in enumerate(clips, 1):
        length = clip.get("duracao", clip["end"] - clip["start"])
        name = f"{i:02d}_nota{clip['score']}_{slug(clip['title'])}"
        clip["platforms"] = [p for p, limit in config.LIMITS.items() if length <= limit]
        clip["files"] = {}
        for platform in clip["platforms"]:
            folder = work / platform
            folder.mkdir(exist_ok=True)
            link(work / clip["file"], folder / f"{name}.mp4")
            (folder / f"{name}.txt").write_text(caption(clip, platform), encoding="utf-8")
            clip["files"][platform] = f"{platform}/{name}.mp4"
        if "1:1" in clip.get("formatos", {}):
            (work / "quadrado").mkdir(exist_ok=True)
            link(work / clip["formatos"]["1:1"], work / "quadrado" / f"{name}.mp4")
            (work / "quadrado" / f"{name}.txt").write_text(caption(clip, "reels"), encoding="utf-8")
            clip["files"]["quadrado"] = f"quadrado/{name}.mp4"
        clip["lote"] = (i - 1) // per_day + 1
        rows.append([clip["lote"], i, f"{name}.mp4", clip["score"], round(length), " ".join(clip["platforms"]), clip["title"]])
    with open(work / "lotes.csv", "w", newline="", encoding="utf-8-sig") as f:
        csv.writer(f, delimiter=";").writerows([["lote_dia", "ordem", "arquivo", "nota", "segundos", "plataformas", "titulo"], *rows])
    manifest = {"clips": clips, "compilado": compilation, "por_dia": per_day}
    (work / "manifesto.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest
