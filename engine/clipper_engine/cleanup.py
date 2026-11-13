"""Tira pausas longas e hesitações de dentro do corte, a partir dos tempos por palavra."""
import re

# Só hesitações puras. "é", "tipo", "né" e "um" ficam: em português também são palavras de verdade.
FILLERS = {"ã", "ãã", "ah", "ahn", "eh", "éh", "éé", "hã", "hum", "hmm", "hm", "uh", "uhm"}
PAUSE, BREATH = 0.6, 0.075


def norm(word):
    return re.sub(r"[^\w]", "", word["w"].lower())


def segments(words, length):
    """Trechos (início, fim) a manter, em segundos relativos ao corte."""
    kept = [w for w in words if norm(w) not in FILLERS]
    if not kept:
        return [(0.0, round(length, 3))]
    segs, start = [], 0.0
    for a, b in zip(kept, kept[1:]):
        filler = any(a["e"] <= w["s"] < b["s"] and norm(w) in FILLERS for w in words)
        if b["s"] - a["e"] > PAUSE or filler:
            segs.append((start, a["e"] + BREATH))
            start = max(b["s"] - BREATH, a["e"] + BREATH)
    segs.append((start, length))
    return [(round(s, 3), round(e, 3)) for s, e in segs if e - s > 0.05]


def remap(t, segs):
    """Onde o instante t do corte original cai depois dos cortes (num trecho removido: no início do próximo)."""
    done = 0.0
    for s, e in segs:
        if t < s:
            return round(done, 3)
        if t <= e:
            return round(done + t - s, 3)
        done += e - s
    return round(done, 3)


def remap_words(words, segs):
    return [{**w, "s": remap(w["s"], segs), "e": remap(w["e"], segs)}
            for w in words if norm(w) not in FILLERS and any(s <= w["s"] <= e for s, e in segs)]
