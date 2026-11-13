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
uv run clipper cortar video.mp4 --tema "dicas de dinheiro" --duracao 1-3 --quadrado
```

| Opção | O que faz |
|---|---|
| `--tema "..."` | só cortes sobre esse assunto (a nota mede o quanto o trecho fala dele) |
| `--duracao` | `0-1` (padrão), `1-3`, `3-5`, `5-10` ou `10-15` minutos por corte |
| `--quadrado` | gera também a versão 1:1, na pasta `quadrado/` |
| `--sem-limpeza` | não tira pausas longas nem hesitações ("hã", "hum") |

Na aba **Cortes** do app os mesmos campos aparecem abaixo do botão de arquivo.

### O que cada corte vertical tem

- **Recorte que segue quem fala**: com duas ou mais pessoas, o corte vai para quem está mexendo a boca
  e só troca depois de 1,5 s, para não pular a cada interjeição. Sem rosto, vídeo inteiro sobre fundo desfocado.
- **Legenda** palavra a palavra, com as palavras-chave em outra cor e até 3 **emojis** coloridos.
- **Bordas nas trocas de cena**: se o corte começaria ou terminaria alguns quadros depois de uma troca
  de câmera, a borda vai para a troca (nunca corta fala). As trocas são detectadas uma vez por vídeo.
- **Pausas e hesitações removidas** (pausas acima de 0,6 s ficam com 0,15 s). "é", "tipo", "né" e "um"
  não são removidos, porque em português também são palavras.

## O que sai

```
engine/saida/<video>/
  shorts/ reels/ tiktok/   NN_notaXX_titulo.mp4 + .txt (título, descrição, hashtags)
  compilados/              melhores-momentos.mp4 + capitulos.txt
  lotes.csv                lote 1 = dia 1, em ordem de nota
  manifesto.json
```

Se o processo cair, rode de novo: transcrição, seleção e cortes já prontos são reaproveitados.

## Modelo de marca (opcional)

Copie `engine/marca.example.json` para `engine/marca.json` e ajuste: fonte (precisa estar instalada
no Windows), cores, altura da legenda (fração da altura, a partir de baixo), logo (PNG, caminho a
partir da pasta `engine`) e `vocabulario`: nomes que o Whisper deve escrever certo. Se mudar o
vocabulário depois de processar um vídeo, apague o `transcricao.json` da pasta dele para transcrever de novo.

## Enviar para o YouTube

Os vídeos sobem como **privados**; você revisa e publica no YouTube Studio.

Uma vez só:
1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e ative a **YouTube Data API v3**.
2. Crie um cliente OAuth do tipo **App para computador** e salve o JSON como `engine\credentials.json`.
3. Em **Google Auth Platform → Público-alvo**, adicione a conta dona do canal como usuário de teste.

```powershell
cd engine
uv run clipper enviar saida\<video> --lote 1
uv run clipper enviar saida\<video> --lote 2 --compilado
```

Na primeira vez abre o navegador para você autorizar. Rodar de novo não reenvia o que já subiu
(o id fica no `manifesto.json`). A cota padrão da API é de 100 envios por dia. Com o app em modo
de teste, o Google expira a autorização a cada 7 dias.

## Ajustes (`engine/.env`)

| Variável | Padrão | |
|---|---|---|
| `GEMINI_API_KEY` | — | obrigatória |
| `GEMINI_MODEL` | `gemini-flash-latest` | |
| `WHISPER_MODEL` | `small` | `medium` = mais preciso, ~3x mais lento |
| `CLIPPER_SAIDA` | `engine/saida` | pasta de saída |

Durações e limites por plataforma ficam em `clipper_engine/config.py`.

## Limites conhecidos

- Seguir quem fala usa o movimento da boca: quem escuta mexendo muito a cabeça pode confundir. Perfil
  e rostos pequenos às vezes não são detectados; aí o corte usa o fundo desfocado.
- Trocas de cena suaves (fade, zoom) não são detectadas, e luz piscando pode ser lida como troca.
- Emojis coloridos usam a fonte de emoji do Windows (Segoe UI Emoji). Sem ela, o corte sai sem emoji.
- Vídeo com menos de ~20 min pode não render um compilado de 8 min; o manifesto avisa.
- TikTok e Instagram: envio manual. YouTube: pelo comando `enviar`, sempre como privado.

## Testes

```bash
cd engine && uv run pytest
```
