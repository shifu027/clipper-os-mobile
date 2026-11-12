import json
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


def download(url, folder: Path):
    import yt_dlp
    opts = {"outtmpl": str(folder / "%(title).80s [%(id)s].%(ext)s"), "format": "bv*[height<=1080]+ba/b",
            "merge_output_format": "mp4", "quiet": True, "noplaylist": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return Path(ydl.prepare_filename(info)).with_suffix(".mp4")
