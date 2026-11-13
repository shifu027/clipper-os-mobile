import os

from pydantic import BaseModel

from . import config

PROMPT = """Você é editor de cortes virais para Shorts, Reels e TikTok.
Abaixo está a transcrição de um vídeo de {minutes} minutos. Cada linha começa com o tempo em segundos.

Devolva:
1. "clips": de {few} a {most} trechos de {clip_min} a {clip_max} segundos que funcionam sozinhos, sem contexto.
   Um corte bom sobrevive sem o resto do vídeo: abre num pensamento completo (se a primeira frase depende
   do minuto anterior, descarte), tem uma virada (uma afirmação e depois algo que a prova ou complica)
   e termina numa frase fechada, não num raciocínio pela metade.
   Notas de 0 a 100: hook (gancho), retention (prende até o fim), value (ensina/emociona/diverte), share (dá vontade de compartilhar).
   Seja exigente: nota acima de 85 só para trecho realmente excepcional.
   keywords: de 3 a 6 palavras ditas no trecho, escritas exatamente como faladas, que merecem destaque na legenda.
   emojis: até 3, cada um ligado a uma palavra dita no trecho ("word") onde ele deve aparecer.
2. "highlights": de 8 a 12 melhores momentos de 40 a 90 segundos, que somados deem entre 8 e 12 minutos,
   para um compilado horizontal do YouTube. Podem repetir assuntos dos clips.

Escreva title, hook, description e hashtags no idioma da transcrição. title com até 60 caracteres,
hook com até 6 palavras: é o texto que aparece na tela nos 3 primeiros segundos e deve usar palavras
DIFERENTES da primeira fala do corte. hashtags sem o símbolo #.
start e end são segundos do vídeo original.
{tema}
TRANSCRIÇÃO:
{transcript}"""


class Emoji(BaseModel):
    word: str
    emoji: str


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
    keywords: list[str]
    emojis: list[Emoji]


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


def prompt(words, duration, tema="", duracao="0-1"):
    clip_min, clip_max = config.DURATIONS[duracao]
    most = max(3, min(20, int(duration // clip_max)))
    focus = (f'\nSÓ escolha trechos sobre este tema: "{tema}". As notas já devem medir o quanto o trecho fala dele; '
             "se houver poucos trechos sobre o tema, devolva poucos.\n") if tema else ""
    return PROMPT.format(minutes=round(duration / 60), few=max(1, most * 2 // 3), most=most, clip_min=clip_min,
                         clip_max=clip_max, tema=focus, transcript=transcript_lines(words))


def select(words, duration, tema="", duracao="0-1"):
    from google import genai

    if not os.environ.get("GEMINI_API_KEY"):
        raise RuntimeError("Falta GEMINI_API_KEY em engine/.env (grátis em https://aistudio.google.com/apikey)")
    response = genai.Client(api_key=os.environ["GEMINI_API_KEY"]).models.generate_content(
        model=config.GEMINI_MODEL, contents=prompt(words, duration, tema, duracao),
        config={"response_mime_type": "application/json", "response_schema": Selection})
    return Selection.model_validate_json(response.text).model_dump()
