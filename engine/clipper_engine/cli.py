import argparse

from . import config


def main():
    parser = argparse.ArgumentParser(prog="clipper", description="Cortes virais a partir de um vídeo longo")
    sub = parser.add_subparsers(dest="cmd", required=True)
    cut = sub.add_parser("cortar", help="processa um vídeo (arquivo ou URL)")
    cut.add_argument("video")
    cut.add_argument("--por-dia", type=int, default=3, help="cortes por lote/dia")
    cut.add_argument("--saida", default=None)
    cut.add_argument("--tema", default="", help='só trechos sobre um assunto, ex.: "dicas de dinheiro"')
    cut.add_argument("--duracao", default="0-1", choices=config.DURATIONS, help="minutos de cada corte")
    cut.add_argument("--quadrado", action="store_true", help="gera também versão 1:1")
    cut.add_argument("--sem-limpeza", action="store_true", help="não tira pausas e hesitações")
    cut.add_argument("--realcar-cor", action="store_true", help="realce leve de contraste e cor")
    send = sub.add_parser("enviar", help="envia um lote para o YouTube como privado")
    send.add_argument("pasta")
    send.add_argument("--lote", type=int, help="número do lote (veja lotes.csv)")
    send.add_argument("--compilado", action="store_true", help="envia também o compilado")
    sub.add_parser("servir", help="sobe o motor para o app (http://127.0.0.1:8000)")
    args = parser.parse_args()

    if args.cmd == "servir":
        import uvicorn
        uvicorn.run("clipper_engine.api:app", host="127.0.0.1", port=8000)
        return

    if args.cmd == "enviar":
        from . import youtube
        for video_id in youtube.send(args.pasta, args.lote, args.compilado):
            print(f"https://studio.youtube.com/video/{video_id}/edit")
        return

    from . import pipeline
    folder, manifest = pipeline.run(args.video, args.saida, args.por_dia,
                                    on_progress=lambda stage, pct: print(f"\r{stage:<12} {pct:4.0%}", end="", flush=True),
                                    tema=args.tema, duracao=args.duracao, quadrado=args.quadrado,
                                    limpeza=not args.sem_limpeza, cor=args.realcar_cor)
    comp = manifest["compilado"]
    print(f"\n{len(manifest['clips'])} cortes" + (f" + compilado de {comp['segundos'] // 60} min" if comp else ""))
    print(f"Pasta: {folder}")


if __name__ == "__main__":
    main()
