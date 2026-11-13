"""Ponta a ponta com vídeo sintético: Whisper e Gemini são trocados por respostas fixas, o FFmpeg é real."""
import subprocess
import time

import pytest
from fastapi.testclient import TestClient

from clipper_engine import api, captions, config, db, media, pipeline, render

# palavras a cada 0,5 s, sem as de 10 a 13 s: o corte 1 tem uma pausa de 2,6 s para a limpeza tirar
WORDS = [{"w": f"palavra{i}", "s": i * 0.5, "e": i * 0.5 + 0.4} for i in range(240) if not 20 <= i <= 25]


def fake_select(words, duration, tema, duracao):
    def clip(start, end, score):
        return {"start": start, "end": end, "title": f"Corte aos {start}s", "hook": "Olha isso", "description": "desc",
                "hashtags": ["teste"], "hook_score": score, "retention": score, "value": score, "share": score,
                "keywords": ["palavra14"], "emojis": [{"word": "palavra16", "emoji": "🔥"}]}
    return {"clips": [clip(5, 30, 90), clip(40, 62, 70)],
            "highlights": [{"start": 70, "end": 82, "title": "Momento A", "score": 90},
                           {"start": 86, "end": 98, "title": "Momento B", "score": 80},
                           {"start": 102, "end": 114, "title": "Momento C", "score": 70}]}


@pytest.fixture(scope="module")
def video(tmp_path_factory):
    path = tmp_path_factory.mktemp("src") / "Vídeo de teste.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30:d=120", "-f", "lavfi",
                    "-i", "sine=f=440:d=120", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", str(path)], check=True)
    return path


def run(video, out, real=pipeline.run, **opts):
    return real(video, out, per_day=1, transcribe=lambda *a: {"words": WORDS}, select=fake_select,
                limits={"clip_range": (15, 40), "comp_range": (30, 40)}, **opts)


def test_pipeline_delivers_platform_folders(video, tmp_path, monkeypatch):
    from PIL import Image
    Image.new("RGBA", (300, 100), "red").save(tmp_path / "logo.png")
    monkeypatch.setattr(config, "BRAND", {"logo": str(tmp_path / "logo.png")})
    work, manifest = run(video, tmp_path, quadrado=True)
    first = media.probe(work / manifest["clips"][0]["files"]["shorts"])
    assert (first["width"], first["height"]) == (1080, 1920)
    assert 21.5 <= first["duration"] <= 23.5 and manifest["clips"][0]["duracao"] < 23.5  # 25 s - pausa de 2,6 s
    square = media.probe(work / manifest["clips"][0]["files"]["quadrado"])
    assert (square["width"], square["height"]) == (1080, 1080)
    assert list((work / "marca").glob("emoji-*.png")) and (work / "marca/logo-160.png").exists()
    assert {p.name for p in work.iterdir()} >= {"shorts", "reels", "tiktok", "compilados", "lotes.csv", "manifesto.json"}
    assert len(list((work / "tiktok").glob("*.mp4"))) == 2 and len(list((work / "tiktok").glob("*.txt"))) == 2
    comp = media.probe(work / manifest["compilado"]["file"])
    assert (comp["width"], comp["height"]) == (1920, 1080)
    assert 35 <= comp["duration"] <= 39
    assert (work / "compilados/capitulos.txt").read_text().startswith("00:00 Momento A\n00:12 Momento B")
    assert [c["lote"] for c in manifest["clips"]] == [1, 2]

    again, _ = run(video, tmp_path, quadrado=True)  # segunda rodada reaproveita tudo
    assert again == work


def test_crop_that_follows_the_speaker_renders(video, tmp_path):
    out = tmp_path / "seguindo.mp4"
    render.vertical(video, 0, 4, captions.build_ass([], "", brand={}), [(0.0, 0.2), (2.0, 0.8)], out, media.probe(video))
    info = media.probe(out)
    assert (info["width"], info["height"]) == (1080, 1920) and 3.5 <= info["duration"] <= 4.5


def test_api_runs_a_job(video, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "OUT", tmp_path)
    monkeypatch.setattr(pipeline, "run", lambda source, per_day, on_progress, **opts: run(source, tmp_path, **opts))
    with TestClient(api.app, base_url="http://127.0.0.1") as client:
        assert client.post("/jobs", json={"source": "nao-existe.mp4"}).status_code == 400
        assert client.get("/health", headers={"origin": "https://evil.example"}).status_code == 403
        assert client.get("/health", headers={"host": "evil.example"}).status_code == 400
        assert client.post("/jobs", json={"source": str(video), "duracao": "2-4"}).status_code == 400
        job = client.post("/jobs", json={"source": str(video), "tema": "teste", "limpeza": False}).json()
        for _ in range(600):
            state = client.get(f"/jobs/{job['id']}").json()
            if state["status"] in ("pronto", "erro"):
                break
            time.sleep(0.2)
        assert state["status"] == "pronto", state["error"]
        assert len(state["manifesto"]["clips"]) == 2
    assert db.get(job["id"])["folder"]


def test_scene_cuts_finds_hard_cut(tmp_path):
    out = tmp_path / "troca.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=c=red:s=640x360:d=3", "-f", "lavfi",
                    "-i", "color=c=blue:s=640x360:d=3", "-filter_complex", "[0][1]concat=n=2", "-c:v", "libx264",
                    "-preset", "ultrafast", str(out)], check=True)
    [cut] = media.scene_cuts(out)
    assert 2.9 <= cut <= 3.1


def test_color_option_raises_saturation(video, tmp_path):
    frames = {}
    for cor in (False, True):
        out = tmp_path / f"cor-{cor}.mp4"
        render.horizontal(video, 0, 2, captions.build_ass([], "", 1920, 1080, brand={}), out, cor=cor)
        stats = subprocess.run(["ffmpeg", "-v", "info", "-ss", "1", "-i", str(out), "-frames:v", "1", "-vf",
                                "signalstats,metadata=print:key=lavfi.signalstats.SATAVG", "-f", "null", "-"],
                               capture_output=True, text=True).stderr
        frames[cor] = float(stats.split("SATAVG=")[1].split()[0])
    assert frames[True] > frames[False] * 1.05
