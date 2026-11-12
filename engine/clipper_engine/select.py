import os

from pydantic import BaseModel

from . import config

PROMPT = """Você é editor de cortes virais para Shorts, Reels e TikTok.
Abaixo está a transcrição de um vídeo de {minutes} minutos. Cada linha começa com o tempo em segundos.

Devolva:
1. "clips": de 12 a 20 trechos de {clip_min} a {clip_max} segundos que funcionam sozinhos, sem contexto.
   Cada um precisa abrir com um gancho forte nos 3 primeiros segundos e terminar numa frase completa.
   Notas de 0 a 100: hook (gancho), retention (prende até o fim), value (ensina/emociona/diverte), share (dá vontade de compartilhar).
   Seja exigente: nota acima de 85 só para trecho realmente excepcional.
2. "highlights": de 8 a 12 melhores momentos de 40 a 90 segundos, que somados deem entre 8 e 12 minutos,
   para um compilado horizontal do YouTube. Podem repetir assuntos dos clips.

Escreva title, hook, description e hashtags no idioma da transcrição. title com até 60 caracteres,
hook com até 6 palavras (texto que aparece na tela), hashtags sem o símbolo #.
start e end são segundos do vídeo original.

TRANSCRIÇÃO:
{transcript}"""


class Clip(BaseModel):
    start: float
    end: float
    title: str
    hook: str
    description: str
    hashtags: list[str]
    hook_score: int
    retention: int
    value: int
    share: int


class Highlight(BaseModel):
    start: float
    end: float
    title: str
    score: int


class Selection(BaseModel):
    clips: list[Clip]
    highlights: list[Highlight]


def transcript_lines(words, seconds=12):
    lines, start, buf = [], None, []
    for word in words:
        if start is None:
            start = word["s"]
        buf.append(word["w"])
        if word["e"] - start >= seconds:
            lines.append(f"[{int(start)}] {' '.join(buf)}")
            start, buf = None, []
    if buf:
        lines.append(f"[{int(start)}] {' '.join(buf)}")
    return "\n".join(lines)


def select(words, duration):
    from google import genai

    if not os.environ.get("GEMINI_API_KEY"):
        raise RuntimeError("Falta GEMINI_API_KEY em engine/.env (grátis em https://aistudio.google.com/apikey)")
    prompt = PROMPT.format(minutes=round(duration / 60), clip_min=config.CLIP_MIN, clip_max=config.CLIP_MAX,
                           transcript=transcript_lines(words))
    response = genai.Client(api_key=os.environ["GEMINI_API_KEY"]).models.generate_content(
        model=config.GEMINI_MODEL, contents=prompt,
        config={"response_mime_type": "application/json", "response_schema": Selection})
    return Selection.model_validate_json(response.text).model_dump()
