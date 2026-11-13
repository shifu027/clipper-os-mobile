def transcribe(wav, model_name, duration, on_progress, vocabulary=()):
    from faster_whisper import WhisperModel

    try:
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
    except Exception as err:
        raise RuntimeError(f"Não consegui carregar o modelo Whisper '{model_name}'. "
                           f"Na primeira vez ele é baixado da internet (huggingface.co). Detalhe: {err}") from err
    # nomes da marca viram dica para o Whisper escrever certo
    hint = ", ".join(vocabulary) or None
    segments, info = model.transcribe(str(wav), word_timestamps=True, vad_filter=True, hotwords=hint, initial_prompt=hint)
    words = []
    for segment in segments:
        words += [{"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2)} for w in segment.words]
        on_progress(min(segment.end / duration, 1))
    return {"language": info.language, "words": words}
