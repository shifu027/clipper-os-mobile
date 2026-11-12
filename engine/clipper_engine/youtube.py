"""Envia cortes e compilado para o YouTube como PRIVADOS. Você revisa e publica no YouTube Studio."""
import json
from pathlib import Path

from . import config, package

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def upload(path, title, description, tags):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    token, secrets = config.ROOT / "token.json", config.ROOT / "credentials.json"
    creds = Credentials.from_authorized_user_file(token, SCOPES) if token.exists() else None
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    elif not creds or not creds.valid:
        if not secrets.exists():
            raise RuntimeError("Falta engine/credentials.json (cliente OAuth 'App para computador'). Veja engine/README.md.")
        creds = InstalledAppFlow.from_client_secrets_file(secrets, SCOPES).run_local_server(port=0)
    token.write_text(creds.to_json())
    body = {"snippet": {"title": title[:100], "description": description, "tags": tags},
            "status": {"privacyStatus": "private"}}
    media = MediaFileUpload(str(path), chunksize=-1, resumable=True)
    return build("youtube", "v3", credentials=creds).videos().insert(part="snippet,status", body=body, media_body=media).execute()["id"]


def send(folder, lote=None, compilado=False, upload=upload):
    """Envia o que ainda não foi enviado. O id fica no manifesto, então rodar de novo não duplica."""
    folder = Path(folder)
    path = folder / "manifesto.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    comp = manifest["compilado"]
    jobs = [(c, c["file"], c["title"], package.caption(c, "shorts"), c["hashtags"])
            for c in manifest["clips"] if c["lote"] == lote]
    if compilado and comp:
        jobs.append((comp, comp["file"], f"Melhores momentos - {folder.name}", comp.get("capitulos") or "", []))
    sent = []
    for item, file, title, description, tags in jobs:
        if item.get("youtube_id"):
            continue
        item["youtube_id"] = upload(folder / file, title, description, tags)
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")  # a cada envio: queda não duplica
        sent.append(item["youtube_id"])
    return sent
