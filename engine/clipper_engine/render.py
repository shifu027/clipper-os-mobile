from pathlib import Path

from . import config
from .media import encode, run

AUDIO = ["-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart"]
LOUD = "loudnorm=I=-14:TP=-1.5:LRA=11"
GRADE = "eq=contrast=1.06:saturation=1.12:gamma=0.98"  # realce leve de contraste e cor
EMOJI_FONTS = [r"C:\Windows\Fonts\seguiemj.ttf", "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
               "/System/Library/Fonts/Apple Color Emoji.ttc"]


def emoji_png(char, folder: Path, size):
    """Emoji colorido como PNG (o libass só desenha emoji em preto e branco). None se não houver fonte de emoji."""
    from PIL import Image, ImageDraw, ImageFont

    path = folder / f"emoji-{'-'.join(f'{ord(c):x}' for c in char)}-{size}.png"
    font = next((f for f in EMOJI_FONTS if Path(f).exists()), None)
    if path.exists() or not font:
        return path if path.exists() else None
    try:
        img = Image.new("RGBA", (220, 220))
        ImageDraw.Draw(img).text((110, 110), char, font=ImageFont.truetype(font, 109), embedded_color=True, anchor="mm")
    except OSError:
        return None
    box = img.getbbox()
    if not box:
        return None
    folder.mkdir(parents=True, exist_ok=True)
    img.crop(box).resize((size, size)).save(path)
    return path


def logo_png(folder: Path, width):
    """Logo da marca já no tamanho, no canto superior direito. None sem logo no marca.json."""
    from PIL import Image

    if not config.BRAND.get("logo"):
        return None
    path = folder / f"logo-{width}.png"
    if not path.exists():
        img = Image.open(config.ROOT / config.BRAND["logo"]).convert("RGBA")
        img.resize((width, round(img.height * width / img.width))).save(path)
    return path


def crop_x(track, w, crop_w):
    """Expressão do FFmpeg com a posição do recorte em cada trecho: corte seco quando a pessoa que fala muda."""
    xs = [min(max(int(x * w - crop_w / 2), 0), w - crop_w) for _, x in track]
    expr = str(xs[-1])
    for (t, _), x in zip(reversed(track[1:]), reversed(xs[:-1])):
        expr = f"if(lt(t,{t:.2f}),{x},{expr})"
    return expr


def vertical(src, start, end, ass, track, out: Path, info, size=(1080, 1920), segs=None, overlays=(), cor=False):
    """Corte vertical (ou quadrado). Com `track`: recorte seguindo quem fala. Sem rosto: vídeo inteiro sobre fundo desfocado."""
    w, h = info["width"], info["height"]
    tw, th = size
    if w / h <= tw / th + 0.01:
        vf = f"scale={tw}:{th}:force_original_aspect_ratio=decrease,pad={tw}:{th}:(ow-iw)/2:(oh-ih)/2"
    elif not track:
        vf = (f"split[a][b];[a]scale={tw}:{th}:force_original_aspect_ratio=increase,crop={tw}:{th},boxblur=24[bg];"
              f"[b]scale={tw}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2")
    else:
        crop_w = int(h * tw / th) // 2 * 2
        vf = f"crop=w={crop_w}:h={h}:x='{crop_x(track, w, crop_w)}':y=0,scale={tw}:{th}"
    _cut(src, start, end, ass, f"{vf},{GRADE}" if cor else vf, LOUD, out, segs, overlays)


def horizontal(src, start, end, ass, out: Path, overlays=(), cor=False):
    """Trecho 16:9 1920x1080 do compilado, com fade curto nas pontas."""
    d = end - start
    vf = ("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,"
          f"fade=t=in:d=0.3,fade=t=out:st={d - 0.3:.2f}:d=0.3" + (f",{GRADE}" if cor else ""))
    _cut(src, start, end, ass, vf, f"{LOUD},afade=t=in:d=0.3,afade=t=out:st={d - 0.3:.2f}:d=0.3", out, None, overlays)


def _cut(src, start, end, ass, vf, af, out, segs, overlays):
    # ffmpeg roda dentro da pasta do corte: o filtro `ass` recebe só o nome do arquivo (sem escapar C:\ no Windows).
    sub, part = out.with_suffix(".ass"), out.with_suffix(".part.mp4")
    sub.write_text(ass, encoding="utf-8")
    if segs and segs != [(0, round(end - start, 3))]:
        # shortcut: corte seco no áudio entre trechos; se aparecer estalo, trocar por crossfade curto
        keep = "+".join(f"between(t,{a:.3f},{b:.3f})" for a, b in segs)
        vf = f"fps=30,select='{keep}',setpts=N/30/TB,{vf}"
        af = f"aselect='{keep}',asetpts=N/SR/TB,{af}"
    head = ["-ss", f"{start:.2f}", "-t", f"{end - start:.2f}", "-i", Path(src).resolve()]
    if overlays:
        graph = f"[0:v]{vf},setsar=1,ass={sub.name}[v0]"
        for i, (png, x, y, s, e) in enumerate(overlays, 1):
            head += ["-i", png]
            when = f":enable='between(t,{s:.2f},{e:.2f})'" if e else ""
            graph += f";[v{i - 1}][{i}:v]overlay={x}:{y}{when}[v{i}]"
        video = ["-filter_complex", graph, "-map", f"[v{len(overlays)}]", "-map", "0:a?"]
    else:
        video = ["-vf", f"{vf},setsar=1,ass={sub.name}"]
    encode([*head, *video, "-af", af, "-r", "30"], [*AUDIO, part.name], cwd=out.parent)
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
