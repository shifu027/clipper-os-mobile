# Clipper Engine

Motor local de cortes: entra um vídeo longo (~1h), saem cortes verticais em lotes para
Shorts / Reels / TikTok e um compilado horizontal de 8–12 min para o YouTube.

Sem Docker. Transcrição local (faster-whisper), seleção dos momentos pelo Gemini, render pelo FFmpeg
(Intel Quick Sync quando disponível, x264 caso contrário).

## Instalar (Windows 11)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
```

Depois cole sua chave do Gemini em `engine\.env` (grátis em https://aistudio.google.com/apikey).

## Usar

**Pelo app:** abra `scripts\start-clipper.bat` e vá na aba **Cortes**. O app exige login, então o
`.env` da raiz precisa ter `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (veja `docs/supabase-setup.md`).

**Pelo terminal** (não precisa do app nem de login):

```powershell
cd engine
uv run clipper cortar "C:\Videos\podcast.mp4" --por-dia 3
uv run clipper cortar "https://www.youtube.com/watch?v=..."
```

## O que sai

```
engine/saida/<video>/
  shorts/ reels/ tiktok/   NN_notaXX_titulo.mp4 + .txt (título, descrição, hashtags)
  compilados/              melhores-momentos.mp4 + capitulos.txt
  lotes.csv                lote 1 = dia 1, em ordem de nota
  manifesto.json
```

Se o processo cair, rode de novo: transcrição, seleção e cortes já prontos são reaproveitados.

## Ajustes (`engine/.env`)

| Variável | Padrão | |
|---|---|---|
| `GEMINI_API_KEY` | — | obrigatória |
| `GEMINI_MODEL` | `gemini-flash-latest` | |
| `WHISPER_MODEL` | `small` | `medium` = mais preciso, ~3x mais lento |
| `CLIPPER_SAIDA` | `engine/saida` | pasta de saída |

Durações e limites por plataforma ficam em `clipper_engine/config.py`.

## Limites conhecidos

- O recorte vertical usa uma posição fixa por corte, centrada no rosto principal; ele não acompanha
  quem fala quando duas pessoas alternam. Sem rosto visível, usa o vídeo inteiro sobre fundo desfocado
  (isso também acontece se o caminho do arquivo tiver acentos e o OpenCV não conseguir abri-lo no Windows).
- Vídeo com menos de ~20 min pode não render um compilado de 8 min; o manifesto avisa.
- Postagem automática ainda não existe: os arquivos saem prontos para envio manual.

## Testes

```bash
cd engine && uv run pytest
```
