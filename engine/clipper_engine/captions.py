HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV
Style: Cap,Arial,{cap},&H00FFFFFF,&H00000000,&H80000000,-1,1,{outline},2,2,60,60,{cap_margin}
Style: Hook,Arial,{hook},&H00000000,&H0000E5FF,&H0000E5FF,-1,3,14,0,8,80,80,{hook_margin}

[Events]
Format: Layer, Start, End, Style, Text
"""
HIGHLIGHT, WHITE = r"{\c&H00E5FF&}", r"{\c&HFFFFFF&}"


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


def build_ass(words, hook, w=1080, h=1920, hook_seconds=3.0):
    """Legenda palavra a palavra (a palavra falada fica amarela) + gancho no topo nos primeiros segundos.
    `words` tem tempos relativos ao início do corte."""
    vertical = h > w
    out = HEADER.format(w=w, h=h, cap=84 if vertical else 56, outline=6 if vertical else 4,
                        cap_margin=460 if vertical else 70, hook=62 if vertical else 48,
                        hook_margin=230 if vertical else 60)
    if hook:
        out += f"Dialogue: 1,{stamp(0)},{stamp(hook_seconds)},Hook,{clean(hook).upper()}\n"
    for group in groups(words):
        for i, word in enumerate(group):
            end = group[i + 1]["s"] if i + 1 < len(group) else word["e"]
            text = " ".join((HIGHLIGHT + clean(x["w"]).upper() + WHITE) if x is word else clean(x["w"]).upper()
                            for x in group)
            out += f"Dialogue: 0,{stamp(word['s'])},{stamp(max(end, word['s'] + 0.05))},Cap,{text}\n"
    return out


def words_between(words, start, end):
    return [{"w": x["w"], "s": x["s"] - start, "e": x["e"] - start} for x in words if x["s"] >= start and x["e"] <= end]
