from pathlib import Path

from .media import encode, run

AUDIO = ["-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart"]
LOUD = "loudnorm=I=-14:TP=-1.5:LRA=11"


def vertical(src, start, end, ass, x_frac, out: Path, info):
    """Corte 9:16 1080x1920. Com rosto: recorta centrado nele. Sem rosto: vídeo inteiro sobre fundo desfocado."""
    w, h = info["width"], info["height"]
    if w / h <= 0.6:
        vf = "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"
    elif x_frac is None:
        vf = ("split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24[bg];"
              "[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2")
    else:
        crop_w = int(h * 9 / 16) // 2 * 2
        x = min(max(int(x_frac * w - crop_w / 2), 0), w - crop_w)
        vf = f"crop={crop_w}:{h}:{x}:0,scale=1080:1920"
    _cut(src, start, end, ass, vf, LOUD, out)


def horizontal(src, start, end, ass, out: Path):
    """Trecho 16:9 1920x1080 do compilado, com fade curto nas pontas."""
    d = end - start
    vf = ("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,"
          f"fade=t=in:d=0.3,fade=t=out:st={d - 0.3:.2f}:d=0.3")
    _cut(src, start, end, ass, vf, f"{LOUD},afade=t=in:d=0.3,afade=t=out:st={d - 0.3:.2f}:d=0.3", out)


def _cut(src, start, end, ass, vf, af, out):
    # ffmpeg roda dentro da pasta do corte: o filtro `ass` recebe só o nome do arquivo (sem escapar C:\ no Windows).
    sub, part = out.with_suffix(".ass"), out.with_suffix(".part.mp4")
    sub.write_text(ass, encoding="utf-8")
    encode(["-ss", f"{start:.2f}", "-t", f"{end - start:.2f}", "-i", Path(src).resolve(),
            "-vf", f"{vf},setsar=1,ass={sub.name}", "-af", af, "-r", "30"], [*AUDIO, part.name], cwd=out.parent)
    sub.unlink()
    part.replace(out)  # se o ffmpeg cair no meio, a retomada não encontra um .mp4 truncado com o nome final


def concat(parts, out: Path):
    listing, part = out.with_suffix(".txt"), out.with_suffix(".part.mp4")
    listing.write_text("".join(f"file '{p.name}'\n" for p in parts), encoding="utf-8")
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listing.name, "-c", "copy",
         "-movflags", "+faststart", part.name], cwd=out.parent)
    part.replace(out)
    listing.unlink()
    for p in parts:
        p.unlink()
