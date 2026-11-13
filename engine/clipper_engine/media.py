import json
import re
import shutil
import subprocess
from pathlib import Path

X264 = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p"]
QSV = ["-c:v", "h264_qsv", "-global_quality", "23", "-pix_fmt", "nv12"]
_encoder = None


def run(cmd, cwd=None):
    subprocess.run([str(c) for c in cmd], cwd=cwd, check=True, capture_output=True)


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height:format=duration", "-of", "json", str(path)],
        check=True, capture_output=True, text=True).stdout
    data = json.loads(out)
    stream = data["streams"][0]
    return {"duration": float(data["format"]["duration"]), "width": stream["width"], "height": stream["height"]}


def encoder():
    """Intel Quick Sync quando existe; senao x264."""
    global _encoder
    if _encoder is None:
        try:
            run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=s=1280x720:d=0.2", *QSV, "-f", "null", "-"])
            _encoder = QSV
        except (subprocess.CalledProcessError, FileNotFoundError):
            _encoder = X264
    return _encoder


def encode(args_before, args_after, cwd):
    """Roda o ffmpeg com o encoder detectado; se o Quick Sync falhar no meio, cai para x264."""
    global _encoder
    try:
        run(["ffmpeg", "-y", "-v", "error", *args_before, *encoder(), *args_after], cwd=cwd)
    except subprocess.CalledProcessError as err:
        if _encoder is X264:
            raise RuntimeError(err.stderr.decode(errors="replace")[-800:]) from err
        _encoder = X264
        encode(args_before, args_after, cwd)


def extract_audio(video, wav: Path):
    run(["ffmpeg", "-y", "-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", wav])


# trecho do erro do yt-dlp (minúsculo) -> o que dizer
DOWNLOAD_ERRORS = [
    ("private video", "Esse vídeo é privado. Use um vídeo público ou não listado, ou baixe e envie o arquivo."),
    ("confirm your age", "O YouTube exige login para esse vídeo (restrição de idade). Baixe e envie o arquivo."),
    ("not a bot", "O YouTube pediu para confirmar que não é um robô. Tente de novo mais tarde, ou baixe e envie o arquivo."),
    ("video unavailable", "Vídeo indisponível: confira o link (pode ter sido removido ou bloqueado no seu país)."),
]


def download(url, folder: Path):
    import yt_dlp

    opts = {"outtmpl": str(folder / "%(title).80s [%(id)s].%(ext)s"), "format": "bv*[height<=1080]+ba/b",
            "merge_output_format": "mp4", "quiet": True, "noplaylist": True}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            return Path(ydl.prepare_filename(info)).with_suffix(".mp4")
    except yt_dlp.utils.DownloadError as err:
        text = str(err).lower()
        message = next((m for key, m in DOWNLOAD_ERRORS if key in text), None)
        if not message and not shutil.which("deno"):
            # desde 2025 o YouTube exige um programa JavaScript; o yt-dlp usa o Deno por padrão
            message = "Falta o Deno, que o YouTube passou a exigir. Rode scripts\\setup-windows.ps1 de novo."
        raise RuntimeError(message or f"Não consegui baixar o vídeo: {err}") from err


def scene_cuts(video, threshold=0.35):
    """Instantes (s) das trocas secas de câmera ou tomada. Uma passada em resolução baixa."""
    log = subprocess.run(["ffmpeg", "-hide_banner", "-hwaccel", "auto", "-i", str(video), "-an", "-vf",
                          f"fps=10,scale=320:-2,select='gt(scene,{threshold})',showinfo", "-f", "null", "-"],
                         check=True, capture_output=True, text=True, errors="replace").stderr
    return [round(float(t), 2) for t in re.findall(r"pts_time:([\d.]+)", log)]
