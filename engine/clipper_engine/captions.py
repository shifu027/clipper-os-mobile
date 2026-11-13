from . import cleanup, config

HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV
Style: Cap,{font},{cap},&H00{text},&H00000000,&H80000000,-1,1,{outline},2,2,60,60,{cap_margin}
Style: Hook,{font},{hook},&H00000000,&H00{spoken},&H00{spoken},-1,3,14,0,8,80,80,{hook_margin}

[Events]
Format: Layer, Start, End, Style, Text
"""


def bgr(hex_rgb):
    """'#RRGGBB' -> 'BBGGRR', a ordem de cor do ASS."""
    h = hex_rgb.lstrip("#")
    return (h[4:6] + h[2:4] + h[0:2]).upper()


def stamp(t):
    t = max(t, 0)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def clean(text):
    return text.replace("{", "(").replace("}", ")").replace("\n", " ").strip()


def groups(words, size=3, max_gap=0.6):
    group = []
    for word in words:
        if group and (len(group) == size or word["s"] - group[-1]["e"] > max_gap or group[-1]["w"][-1:] in ".!?"):
            yield group
            group = []
        group.append(word)
    if group:
        yield group


def layout(w, h, brand):
    vertical = h > w
    cap = 84 if vertical else 56
    margin = int(h * brand["altura_legenda"]) if "altura_legenda" in brand else (460 if vertical else 70)
    return cap, margin


def build_ass(words, hook, w=1080, h=1920, hook_seconds=3.0, keywords=(), brand=None):
    """Legenda palavra a palavra: a palavra falada na cor de fala, as palavras-chave na cor de destaque.
    Gancho no topo nos primeiros segundos. `words` tem tempos relativos ao início do corte."""
    brand = config.BRAND if brand is None else brand
    vertical = h > w
    cap, margin = layout(w, h, brand)
    spoken, accent = bgr(brand.get("cor_fala", "#FFE500")), bgr(brand.get("cor_destaque", "#3CFF7A"))
    out = HEADER.format(w=w, h=h, font=brand.get("fonte", "Arial"), text=bgr(brand.get("cor_legenda", "#FFFFFF")),
                        spoken=spoken, cap=cap, outline=6 if vertical else 4, cap_margin=margin,
                        hook=62 if vertical else 48, hook_margin=230 if vertical else 60)
    keys = {cleanup.norm({"w": t}) for k in keywords for t in k.split() if len(cleanup.norm({"w": t})) >= 3}
    if hook:
        out += f"Dialogue: 1,{stamp(0)},{stamp(hook_seconds)},Hook,{clean(hook).upper()}\n"

    def paint(x, now):
        color = spoken if x is now else accent if cleanup.norm(x) in keys else None
        text = clean(x["w"]).upper()
        return rf"{{\c&H{color}&}}{text}{{\r}}" if color else text

    for group in groups(words):
        for i, word in enumerate(group):
            end = group[i + 1]["s"] if i + 1 < len(group) else word["e"]
            text = " ".join(paint(x, word) for x in group)
            out += f"Dialogue: 0,{stamp(word['s'])},{stamp(max(end, word['s'] + 0.05))},Cap,{text}\n"
    return out


def emoji_overlays(words, emojis, w, h, brand=None):
    """(emoji, x, y, tamanho, início, fim): cada emoji aparece 1,5 s acima da legenda quando a palavra é dita."""
    brand = config.BRAND if brand is None else brand
    cap, margin = layout(w, h, brand)
    size = 150 if h > w else 110
    y = h - margin - int(2.4 * cap) - size
    out = []
    for item in emojis:
        word = next((x for x in words if cleanup.norm(x) == cleanup.norm({"w": item["word"]})), None)
        if word:
            out.append((item["emoji"], (w - size) // 2, y, size, word["s"], word["s"] + 1.5))
    return out


def words_between(words, start, end):
    return [{"w": x["w"], "s": x["s"] - start, "e": x["e"] - start} for x in words if x["s"] >= start and x["e"] <= end]
