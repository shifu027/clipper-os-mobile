import asyncio
import json
import queue
import re
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, db, pipeline

LOCAL = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
jobs = queue.Queue()


def worker():
    while True:
        job_id = jobs.get()
        job = db.get(job_id)
        try:
            db.update(job_id, status="processando")
            folder, _ = pipeline.run(job["source"], per_day=job["per_day"],
                                     on_progress=lambda stage, pct: db.update(job_id, stage=stage, pct=pct))
            db.update(job_id, status="pronto", pct=1, folder=folder.name)
        except Exception as err:  # o worker não pode morrer por causa de um vídeo
            db.update(job_id, status="erro", error=str(err)[-600:])


@asynccontextmanager
async def lifespan(_):
    threading.Thread(target=worker, daemon=True).start()
    for job in db.all_jobs():  # retoma o que ficou pela metade; as etapas prontas vêm do cache
        if job["status"] in ("fila", "processando"):
            jobs.put(job["id"])
    yield


app = FastAPI(title="Clipper Engine", lifespan=lifespan)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost"])
app.add_middleware(CORSMiddleware, allow_origin_regex=LOCAL, allow_methods=["*"], allow_headers=["*"])
config.OUT.mkdir(parents=True, exist_ok=True)
app.mount("/saida", StaticFiles(directory=config.OUT), name="saida")


@app.middleware("http")
async def only_local_pages(request: Request, call_next):
    # O motor lê arquivos do disco: nenhuma página fora do localhost pode chamá-lo.
    origin = request.headers.get("origin")
    if origin and not re.fullmatch(LOCAL, origin):
        return JSONResponse({"detail": "origem não permitida"}, 403)
    return await call_next(request)


def view(job):
    manifest = config.OUT / job["folder"] / "manifesto.json"
    if job["status"] == "pronto" and manifest.exists():
        job["manifesto"] = json.loads(manifest.read_text(encoding="utf-8"))
    return job


class NewJob(BaseModel):
    source: str
    per_day: int = 3


@app.get("/health")
def health():
    return {"ok": True, "saida": str(config.OUT)}


@app.put("/upload")
async def upload(request: Request, name: str):
    folder = config.OUT / "_uploads"
    folder.mkdir(exist_ok=True)
    target = folder / Path(name).name
    with open(target, "wb") as f:
        async for chunk in request.stream():
            f.write(chunk)
    return {"source": str(target)}


@app.post("/jobs")
def create(body: NewJob):
    if not body.source.startswith(("http://", "https://")) and not Path(body.source).is_file():
        raise HTTPException(400, "arquivo não encontrado")
    job_id = db.create(body.source, max(body.per_day, 1))
    jobs.put(job_id)
    return db.get(job_id)


@app.get("/jobs")
def list_jobs():
    return db.all_jobs()


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    job = db.get(job_id)
    if not job:
        raise HTTPException(404)
    return view(job)


@app.get("/jobs/{job_id}/events")
async def events(job_id: str):
    async def stream():
        while True:
            job = db.get(job_id)
            yield f"data: {json.dumps(job, ensure_ascii=False)}\n\n"
            if not job or job["status"] in ("pronto", "erro"):
                return
            await asyncio.sleep(1)
    return StreamingResponse(stream(), media_type="text/event-stream")
