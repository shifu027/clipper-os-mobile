import json

from clipper_engine import boundaries, captions, package, pipeline, select, youtube

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
    ass = captions.build_ass([{"w": "oi", "s": 0, "e": 0.4}, {"w": "gente{", "s": 0.5, "e": 0.9}], "Olha isso")
    assert "Hook,OLHA ISSO" in ass
    assert r"{\c&H00E5FF&}OI{\c&HFFFFFF&} GENTE(" in ass
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
