import hashlib
import json
from pathlib import Path

from . import boundaries, captions, config, media, package, reframe, render
from .select import select as gemini_select
from .transcribe import transcribe as whisper_transcribe

STAGES = ["ingestao", "transcricao", "selecao", "cortes", "compilado", "pacote"]


def work_dir(video: Path, out_root: Path):
    stat = video.stat()
    key = hashlib.sha1(f"{video.name}{stat.st_size}{stat.st_mtime_ns}".encode()).hexdigest()[:8]
    return out_root / f"{package.slug(video.stem)}-{key}"


def cached(path: Path, make):
    """Etapa retomável: se o resultado já está em disco, reaproveita."""
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    data = make()
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def chapters(highlights):
    lines, t = [], 0
    for h in highlights:
        lines.append(f"{int(t // 60):02d}:{int(t % 60):02d} {h['title']}")
        t += h["end"] - h["start"]
    return "\n".join(lines) + "\n"


def run(source, out_root=None, per_day=3, on_progress=lambda stage, pct: None,
        transcribe=whisper_transcribe, select=gemini_select, limits=None):
    out_root = Path(out_root or config.OUT)
    out_root.mkdir(parents=True, exist_ok=True)
    on_progress("ingestao", 0)
    if str(source).startswith(("http://", "https://")):
        (out_root / "_downloads").mkdir(exist_ok=True)
        source = media.download(source, out_root / "_downloads")
    video = Path(source).resolve()
    info = media.probe(video)
    work = work_dir(video, out_root)
    (work / "cortes").mkdir(parents=True, exist_ok=True)

    def make_transcript():
        wav = work / "audio.wav"
        media.extract_audio(video, wav)
        result = transcribe(wav, config.WHISPER_MODEL, info["duration"], lambda p: on_progress("transcricao", p))
        wav.unlink()
        return result

    on_progress("transcricao", 0)
    words = cached(work / "transcricao.json", make_transcript)["words"]
    on_progress("selecao", 0)
    raw = cached(work / "selecao.json", lambda: select(words, info["duration"]))
    plan = boundaries.refine(raw, words, info["duration"], **(limits or {}))

    for i, clip in enumerate(plan["clips"], 1):
        on_progress("cortes", (i - 1) / len(plan["clips"]))
        clip["file"] = f"cortes/{i:02d}.mp4"
        out = work / clip["file"]
        if not out.exists():
            ass = captions.build_ass(captions.words_between(words, clip["start"], clip["end"]), clip["hook"])
            x = reframe.face_x(video, clip["start"], clip["end"]) if info["width"] > info["height"] else None
            render.vertical(video, clip["start"], clip["end"], ass, x, out, info)

    compilation = None
    if plan["highlights"]:
        folder = work / "compilados"
        folder.mkdir(exist_ok=True)
        final = folder / "melhores-momentos.mp4"
        if not final.exists():
            parts = []
            for i, h in enumerate(plan["highlights"]):
                on_progress("compilado", i / len(plan["highlights"]))
                parts.append(folder / f"parte{i:02d}.mp4")
                render.horizontal(video, h["start"], h["end"], captions.build_ass([], h["title"], 1920, 1080), parts[-1])
            render.concat(parts, final)
        (folder / "capitulos.txt").write_text(chapters(plan["highlights"]), encoding="utf-8")
        compilation = {"file": "compilados/melhores-momentos.mp4", "segundos": plan["compilado_segundos"],
                       "na_regra_8_12_min": plan["compilado_na_regra"], "momentos": plan["highlights"]}

    on_progress("pacote", 0)
    manifest = package.package(work, plan["clips"], compilation, per_day)
    on_progress("pacote", 1)
    return work, manifest
