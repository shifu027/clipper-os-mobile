"""Transforma a resposta crua da IA em cortes válidos: bordas em pausas, sem sobreposição, durações na regra."""
from . import config

PAUSE, REACH = 0.3, 3.0


def snap(t, words, edge):
    """Move t para o início ("s") ou fim ("e") de palavra mais próximo, preferindo onde há pausa."""
    best, best_cost = t, None
    for i, word in enumerate(words):
        at = word[edge]
        if abs(at - t) > REACH:
            continue
        if edge == "s":
            gap = at - words[i - 1]["e"] if i else PAUSE
        else:
            gap = words[i + 1]["s"] - at if i + 1 < len(words) else PAUSE
        cost = abs(at - t) + (0 if gap >= PAUSE else REACH)
        if best_cost is None or cost < best_cost:
            best, best_cost = at, cost
    return best


def overlap(a, b):
    shared = min(a["end"], b["end"]) - max(a["start"], b["start"])
    return shared / min(a["end"] - a["start"], b["end"] - b["start"])


def _fit(item, words, duration, cuts=()):
    start = max(0, snap(item["start"], words, "s") - 0.1)
    end = min(duration, snap(item["end"], words, "e") + 0.2)
    spoken = [w for w in words if start <= w["s"] and w["e"] <= end]
    if spoken:
        # troca de cena entre a borda e a fala: a borda vai para a troca, sem os quadros soltos da outra tomada
        start = max((c for c in cuts if start < c <= spoken[0]["s"]), default=start)
        end = min((c for c in cuts if spoken[-1]["e"] <= c < end), default=end)
    return {**item, "start": round(start, 2), "end": round(end, 2)}


def refine(raw, words, duration, clip_range=config.DURATIONS["0-1"],
           comp_range=(config.COMP_MIN, config.COMP_MAX), cuts=()):
    clips = []
    for item in raw["clips"]:
        clip = _fit(item, words, duration, cuts)
        clip["score"] = round(.35 * clip["hook_score"] + .3 * clip["retention"] + .2 * clip["value"] + .15 * clip["share"])
        if clip_range[0] - 5 <= clip["end"] - clip["start"] <= clip_range[1] + 15:
            clips.append(clip)
    clips.sort(key=lambda c: -c["score"])
    kept = []
    for clip in clips:
        if all(overlap(clip, other) < 0.5 for other in kept):
            kept.append(clip)

    # Compilado: melhores momentos sem sobreposição, completados com cortes até caber em comp_range.
    pool = sorted((_fit(h, words, duration, cuts) for h in raw["highlights"]), key=lambda h: -h["score"])
    pool += [{"start": c["start"], "end": c["end"], "title": c["title"], "score": c["score"]} for c in kept]
    highlights, total = [], 0
    for item in pool:
        length = item["end"] - item["start"]
        if total >= comp_range[0] or total + length > comp_range[1] or length <= 0:
            continue
        if all(overlap(item, other) <= 0 for other in highlights):
            highlights.append(item)
            total += length
    highlights.sort(key=lambda h: h["start"])
    return {"clips": kept, "highlights": highlights, "compilado_segundos": round(total),
            "compilado_na_regra": comp_range[0] <= total <= comp_range[1]}
