import json

from clipper_engine import boundaries, captions, cleanup, package, pipeline, reframe, render, select, youtube

WORDS = [{"w": f"p{i}", "s": i * 0.5, "e": i * 0.5 + 0.4} for i in range(2400)]  # 20 min, palavra a cada 0,5 s
WORDS[100]["s"] = 50.3  # pausa de 0,4 s antes da palavra 100 (a 99 termina em 49,9)


def clip(start, end, score=80, title="t"):
    return {"start": start, "end": end, "title": title, "hook": "olha isso", "description": "d", "hashtags": ["a"],
            "hook_score": score, "retention": score, "value": score, "share": score}


def test_snap_prefers_pause():
    assert boundaries.snap(49.2, WORDS, "s") == 50.3
    assert boundaries.snap(500.07, WORDS, "s") == 500.0


def test_refine_drops_overlap_and_bad_durations():
    raw = {"clips": [clip(100, 140, 90), clip(105, 138, 70), clip(300, 304), clip(400, 700), clip(800, 850, 60)],
           "highlights": []}
    clips = boundaries.refine(raw, WORDS, 1200)["clips"]
    assert [round(c["start"]) for c in clips] == [100, 800]
    assert clips[0]["score"] == 90


def test_compilation_lands_between_8_and_12_minutes():
    highlights = [{"start": i * 100, "end": i * 100 + 70, "title": f"m{i}", "score": 90 - i} for i in range(11)]
    plan = boundaries.refine({"clips": [], "highlights": highlights}, WORDS, 1200)
    assert plan["compilado_na_regra"] and 480 <= plan["compilado_segundos"] <= 720
    starts = [h["start"] for h in plan["highlights"]]
    assert starts == sorted(starts)


def test_compilation_is_completed_with_clips_when_highlights_are_short():
    raw = {"clips": [clip(i * 100, i * 100 + 60) for i in range(10)],
           "highlights": [{"start": 1050, "end": 1110, "title": "m", "score": 99}]}
    assert boundaries.refine(raw, WORDS, 1200)["compilado_na_regra"]


def test_ass_highlights_spoken_word_and_shows_hook():
    ass = captions.build_ass([{"w": "oi", "s": 0, "e": 0.4}, {"w": "gente{", "s": 0.5, "e": 0.9}], "Olha isso", brand={})
    assert "Hook,OLHA ISSO" in ass
    assert r"{\c&H00E5FF&}OI{\r} GENTE(" in ass
    assert "0:00:00.50" in ass


def test_slug_and_caption():
    assert package.slug("Não é fácil! 100%") == "nao-e-facil-100"
    assert "#a #Shorts" in package.caption(clip(0, 30), "shorts")


def test_transcript_lines_carry_timestamps():
    assert select.transcript_lines(WORDS[:60]).splitlines()[1].startswith("[12] ")


def test_chapters_follow_youtube_rules():
    three = [{"start": 0, "end": 60, "title": "a"}, {"start": 70, "end": 100, "title": "b"}, {"start": 200, "end": 215, "title": "c"}]
    assert pipeline.chapters(three) == "00:00 a\n01:00 b\n01:30 c\n"
    assert pipeline.chapters(three[:2]) is None
    assert pipeline.chapters([*three[:2], {"start": 200, "end": 205, "title": "curto"}]) is None


def test_youtube_send_uploads_only_the_batch_and_never_twice(tmp_path):
    clips = [{**clip(0, 30, title=f"c{i}"), "file": f"cortes/{i}.mp4", "lote": lote} for i, lote in enumerate([1, 1, 2])]
    (tmp_path / "manifesto.json").write_text(json.dumps({"clips": clips, "compilado": None}))
    calls = []

    def fake_upload(path, title, description, tags):
        calls.append(title)
        return f"id-{title}"

    assert youtube.send(tmp_path, lote=1, upload=fake_upload) == ["id-c0", "id-c1"]
    assert youtube.send(tmp_path, lote=1, upload=fake_upload) == [] and calls == ["c0", "c1"]
    assert json.loads((tmp_path / "manifesto.json").read_text())["clips"][0]["youtube_id"] == "id-c0"


def test_prompt_carries_theme_and_duration():
    text = select.prompt(WORDS, 3600, "dicas de dinheiro", "1-3")
    assert '"dicas de dinheiro"' in text and "de 60 a 180 segundos" in text and "de 13 a 20 trechos" in text
    assert "tema" not in select.prompt(WORDS, 3600)
    assert "de 2 a 4 trechos" in select.prompt(WORDS, 3600, duracao="10-15")


def test_refine_respects_chosen_duration():
    raw = {"clips": [clip(100, 130), clip(200, 320)], "highlights": []}
    assert [round(c["start"]) for c in boundaries.refine(raw, WORDS, 1200, clip_range=(60, 180))["clips"]] == [200]


def test_keywords_and_brand_colors():
    words = [{"w": "dinheiro", "s": 0, "e": 0.4}, {"w": "rápido!", "s": 0.5, "e": 0.9}]
    ass = captions.build_ass(words, "", keywords=["Rápido"], brand={"fonte": "Montserrat", "cor_fala": "#FF0000"})
    assert "Style: Cap,Montserrat," in ass
    assert r"{\c&H0000FF&}DINHEIRO{\r} {\c&H7AFF3C&}RÁPIDO!{\r}" in ass  # falada em vermelho, chave em verde


def test_emoji_appears_when_its_word_is_spoken():
    words = [{"w": "olha", "s": 0.2, "e": 0.5}, {"w": "Dinheiro,", "s": 0.6, "e": 1.0}]
    [(char, x, y, size, s, e)] = captions.emoji_overlays(words, [{"word": "dinheiro", "emoji": "💰"}], 1080, 1920, brand={})
    assert (char, s, e, size, x) == ("💰", 0.6, 2.1, 150, 465) and 0 < y < 1920 - 460


def test_cleanup_cuts_long_pause_and_hesitation():
    words = [{"w": "um", "s": 0.0, "e": 0.4}, {"w": "dois", "s": 0.5, "e": 0.9}, {"w": "três", "s": 2.0, "e": 2.4},
             {"w": "hum...", "s": 2.5, "e": 2.8}, {"w": "quatro", "s": 3.0, "e": 3.4}]
    segs = cleanup.segments(words, 4.0)
    assert segs == [(0.0, 0.975), (1.925, 2.475), (2.925, 4.0)]
    kept = cleanup.remap_words(words, segs)
    assert [w["w"] for w in kept] == ["um", "dois", "três", "quatro"]
    assert kept[-1]["s"] == 1.6  # 3,0 s - 1,025 de pausa - 0,45 do "hum"
    assert cleanup.segments(WORDS[:10], 5.0) == [(0.0, 5.0)]


def test_speaker_tracking_follows_who_talks_and_ignores_blips():
    a, b = 0.3, 0.7
    talk = lambda who: [(a, 9.0 if who == "a" else 1.0), (b, 9.0 if who == "b" else 1.0)]
    samples = [(t / 2, talk("a")) for t in range(8)]           # A fala de 0 a 4 s
    samples += [(4.0, talk("b"))]                              # B mexe a boca 0,5 s: não troca
    samples += [(t / 2, talk("a")) for t in range(9, 10)]
    samples += [(t / 2, talk("b")) for t in range(10, 16)]     # B fala a partir de 5 s
    assert reframe.pick(samples) == [(0.0, a), (5.0, b)]
    assert reframe.pick([(t, []) for t in range(10)]) is None


def test_crop_follows_track_with_hard_cuts():
    assert render.crop_x([(0.0, 0.3), (5.0, 0.7)], 1920, 608) == "if(lt(t,5.00),272,1040)"
