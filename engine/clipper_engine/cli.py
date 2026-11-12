import argparse

from . import config


def main():
    parser = argparse.ArgumentParser(prog="clipper", description="Cortes virais a partir de um vídeo longo")
    sub = parser.add_subparsers(dest="cmd", required=True)
    cut = sub.add_parser("cortar", help="processa um vídeo (arquivo ou URL)")
    cut.add_argument("video")
    cut.add_argument("--por-dia", type=int, default=3, help="cortes por lote/dia")
    cut.add_argument("--saida", default=None)
    sub.add_parser("servir", help="sobe o motor para o app (http://127.0.0.1:8000)")
    args = parser.parse_args()

    if args.cmd == "servir":
        import uvicorn
        uvicorn.run("clipper_engine.api:app", host="127.0.0.1", port=8000)
        return

    from . import pipeline
    folder, manifest = pipeline.run(args.video, args.saida, args.por_dia,
                                    on_progress=lambda stage, pct: print(f"\r{stage:<12} {pct:4.0%}", end="", flush=True))
    comp = manifest["compilado"]
    print(f"\n{len(manifest['clips'])} cortes" + (f" + compilado de {comp['segundos'] // 60} min" if comp else ""))
    print(f"Pasta: {folder}")


if __name__ == "__main__":
    main()
