import hashlib
import json
from pathlib import Path

from . import boundaries, captions, cleanup, config, media, package, reframe, render
from .select import select as gemini_select
from .transcribe import transcribe as whisper_transcribe

def work_dir(video: Path, out_root: Path):
    # sem a data do arquivo: reenviar o mesmo vídeo pelo navegador reaproveita a transcrição
    key = hashlib.sha1(f"{video.name}{video.stat().st_size}".encode()).hexdigest()[:8]
    return out_root / f"{package.slug(video.stem)}-{key}"


def cached(path: Path, make):
    """Etapa retomável: se o resultado já está em disco, reaproveita."""
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    data = make()
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def chapters(highlights):
    """Capítulos no formato do YouTube, ou None: ele ignora listas com menos de 3 entradas ou trechos < 10 s."""
    if len(highlights) < 3 or any(h["end"] - h["start"] < 10 for h in highlights):
        return None
    lines, t = [], 0
    for h in highlights:
        lines.append(f"{int(t // 60):02d}:{int(t % 60):02d} {h['title']}")
        t += h["end"] - h["start"]
    return "\n".join(lines) + "\n"


def run(source, out_root=None, per_day=3, on_progress=lambda stage, pct: None,
        transcribe=whisper_transcribe, select=gemini_select, limits=None,
        tema="", duracao="0-1", quadrado=False, limpeza=True):
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
        result = transcribe(wav, config.WHISPER_MODEL, info["duration"], lambda p: on_progress("transcricao", p),
                            config.BRAND.get("vocabulario", []))
        wav.unlink()
        return result

    on_progress("transcricao", 0)
    words = cached(work / "transcricao.json", make_transcript)["words"]
    on_progress("selecao", 0)
    key = hashlib.sha1(f"{tema}|{duracao}".encode()).hexdigest()[:6]  # outro tema/duração = outra seleção
    raw = cached(work / f"selecao-{key}.json", lambda: select(words, info["duration"], tema, duracao))
    plan = boundaries.refine(raw, words, info["duration"], **{"clip_range": config.DURATIONS[duracao], **(limits or {})})
    sizes = {"9:16": (1080, 1920), **({"1:1": (1080, 1080)} if quadrado else {})}

    for i, clip in enumerate(plan["clips"], 1):
        on_progress("cortes", (i - 1) / len(plan["clips"]))
        start, end = clip["start"], clip["end"]
        rel = captions.words_between(words, start, end)
        segs = cleanup.segments(rel, end - start) if limpeza else [(0, round(end - start, 3))]
        spoken = cleanup.remap_words(rel, segs)
        clip["duracao"] = round(sum(e - s for s, e in segs), 2)
        clip["formatos"], track = {}, False
        for fmt, (w, h) in sizes.items():
            # o nome carrega trecho e opções: rodar de novo com outras opções não reaproveita o vídeo errado
            name = f"cortes/{int(start * 100)}-{int(end * 100)}-{fmt.replace(':', 'x')}{'-limpo' if limpeza else ''}.mp4"
            clip["formatos"][fmt] = name
            if (work / name).exists():
                continue
            if track is False:
                found = reframe.track(video, start, end, info) if info["width"] > info["height"] else None
                track = [(cleanup.remap(t, segs), x) for t, x in found] if found else None
            overlays = [(png, x, y, s, e) for char, x, y, size, s, e in
                        captions.emoji_overlays(spoken, clip.get("emojis", []), w, h)
                        if (png := render.emoji_png(char, work / "marca", size))]
            if logo := render.logo_png(work / "marca", 160):
                overlays.append((logo, w - 200, 40, 0, None))
            ass = captions.build_ass(spoken, clip["hook"], w, h, keywords=clip.get("keywords", []))
            render.vertical(video, start, end, ass, track, work / name, info, (w, h), segs, overlays)
        clip["file"] = clip["formatos"]["9:16"]

    compilation = None
    if plan["highlights"]:
        folder = work / "compilados"
        folder.mkdir(exist_ok=True)
        key = hashlib.sha1(str([(h["start"], h["end"]) for h in plan["highlights"]]).encode()).hexdigest()[:6]
        final = folder / f"melhores-momentos-{key}.mp4"
        logo = render.logo_png(work / "marca", 200)
        if not final.exists():
            parts = []
            for i, h in enumerate(plan["highlights"]):
                on_progress("compilado", i / len(plan["highlights"]))
                parts.append(folder / f"parte{i:02d}.mp4")
                render.horizontal(video, h["start"], h["end"], captions.build_ass([], h["title"], 1920, 1080), parts[-1],
                                  [(logo, 1680, 40, 0, None)] if logo else ())
            render.concat(parts, final)
        text = chapters(plan["highlights"])
        if text:
            (folder / "capitulos.txt").write_text(text, encoding="utf-8")
        compilation = {"file": f"compilados/{final.name}", "segundos": plan["compilado_segundos"],
                       "capitulos": text,
                       "na_regra_8_12_min": plan["compilado_na_regra"], "momentos": plan["highlights"]}

    on_progress("pacote", 0)
    manifest = package.package(work, plan["clips"], compilation, per_day)
    on_progress("pacote", 1)
    return work, manifest
