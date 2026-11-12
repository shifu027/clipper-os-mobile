"""Ponta a ponta com vídeo sintético: Whisper e Gemini são trocados por respostas fixas, o FFmpeg é real."""
import subprocess
import time

import pytest
from fastapi.testclient import TestClient

from clipper_engine import api, config, db, media, pipeline

WORDS = [{"w": f"palavra{i}", "s": i * 0.5, "e": i * 0.5 + 0.4} for i in range(240)]


def fake_select(words, duration):
    def clip(start, end, score):
        return {"start": start, "end": end, "title": f"Corte aos {start}s", "hook": "Olha isso", "description": "desc",
                "hashtags": ["teste"], "hook_score": score, "retention": score, "value": score, "share": score}
    return {"clips": [clip(5, 30, 90), clip(40, 62, 70)],
            "highlights": [{"start": 70, "end": 85, "title": "Momento A", "score": 90},
                           {"start": 90, "end": 105, "title": "Momento B", "score": 80}]}


@pytest.fixture(scope="module")
def video(tmp_path_factory):
    path = tmp_path_factory.mktemp("src") / "Vídeo de teste.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30:d=120", "-f", "lavfi",
                    "-i", "sine=f=440:d=120", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", str(path)], check=True)
    return path


def run(video, out, real=pipeline.run):
    return real(video, out, per_day=1, transcribe=lambda *a: {"words": WORDS}, select=fake_select,
                        limits={"clip_range": (15, 40), "comp_range": (20, 40)})


def test_pipeline_delivers_platform_folders(video, tmp_path):
    work, manifest = run(video, tmp_path)
    first = media.probe(work / manifest["clips"][0]["files"]["shorts"])
    assert (first["width"], first["height"]) == (1080, 1920)
    assert 24 <= first["duration"] <= 27
    assert {p.name for p in work.iterdir()} >= {"shorts", "reels", "tiktok", "compilados", "lotes.csv", "manifesto.json"}
    assert len(list((work / "tiktok").glob("*.mp4"))) == 2 and len(list((work / "tiktok").glob("*.txt"))) == 2
    comp = media.probe(work / "compilados/melhores-momentos.mp4")
    assert (comp["width"], comp["height"]) == (1920, 1080)
    assert 29 <= comp["duration"] <= 32
    assert (work / "compilados/capitulos.txt").read_text().startswith("00:00 Momento A\n00:15 Momento B")
    assert [c["lote"] for c in manifest["clips"]] == [1, 2]

    again, _ = run(video, tmp_path)  # segunda rodada reaproveita tudo
    assert again == work


def test_api_runs_a_job(video, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "OUT", tmp_path)
    monkeypatch.setattr(pipeline, "run", lambda source, per_day, on_progress: run(source, tmp_path))
    with TestClient(api.app) as client:
        assert client.post("/jobs", json={"source": "nao-existe.mp4"}).status_code == 400
        assert client.get("/health", headers={"origin": "https://evil.example"}).status_code == 403
        job = client.post("/jobs", json={"source": str(video)}).json()
        for _ in range(600):
            state = client.get(f"/jobs/{job['id']}").json()
            if state["status"] in ("pronto", "erro"):
                break
            time.sleep(0.2)
        assert state["status"] == "pronto", state["error"]
        assert len(state["manifesto"]["clips"]) == 2
    assert db.get(job["id"])["folder"]
