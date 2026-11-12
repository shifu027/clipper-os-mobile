import sqlite3
import time
import uuid

from . import config


def _db():
    config.OUT.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(config.OUT / "clipper.db")
    db.row_factory = sqlite3.Row
    db.execute("""CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, source TEXT, per_day INTEGER, status TEXT,
                  stage TEXT, pct REAL, folder TEXT, error TEXT, created REAL)""")
    return db


def create(source, per_day):
    job_id = uuid.uuid4().hex[:12]
    with _db() as db:
        db.execute("INSERT INTO jobs VALUES (?,?,?,'fila','',0,'','',?)", (job_id, source, per_day, time.time()))
    return job_id


def update(job_id, **fields):
    with _db() as db:
        db.execute(f"UPDATE jobs SET {', '.join(k + '=?' for k in fields)} WHERE id=?", (*fields.values(), job_id))


def get(job_id):
    row = _db().execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
    return dict(row) if row else None


def all_jobs():
    return [dict(r) for r in _db().execute("SELECT * FROM jobs ORDER BY created DESC")]
