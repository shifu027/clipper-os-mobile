"""Acha quem está falando e devolve onde centralizar o recorte vertical ao longo do corte."""
import subprocess

FPS, WIDTH = 8, 480


def scan(video, start, end, info):
    """A cada 0,5 s: rostos visíveis como (centro x de 0 a 1, movimento da boca)."""
    import cv2
    import numpy as np

    height = int(round(WIDTH * info["height"] / info["width"] / 2)) * 2
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{start:.2f}", "-t", f"{end - start:.2f}", "-i", str(video),
                          "-vf", f"fps={FPS},scale={WIDTH}:{height}", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                         check=True, capture_output=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, height, WIDTH).astype(np.int16)
    detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    samples = []
    for i in range(0, len(frames), FPS // 2):
        faces = []
        for x, y, w, h in detector.detectMultiScale(frames[i].astype(np.uint8), 1.1, 5, minSize=(30, 30)):
            mouth = (slice(y + int(.65 * h), y + int(.95 * h)), slice(x + w // 4, x + 3 * w // 4))
            moves = [np.abs(frames[j + 1][mouth] - frames[j][mouth]).mean() for j in range(i, min(i + 3, len(frames) - 1))]
            faces.append(((x + w / 2) / WIDTH, float(np.mean(moves)) if moves else 0.0))
        samples.append((i / FPS, faces))
    return samples


def pick(samples, hold=3, ratio=1.3, same=0.12):
    """[(t, x)] com a pessoa a enquadrar a partir de t, ou None se quase não há rosto.
    Só troca de pessoa depois de `hold` amostras seguidas (1,5 s): uma boca mexendo rápido não faz o corte pular."""
    seen = [(t, faces) for t, faces in samples if faces]
    if not samples or len(seen) < 0.3 * len(samples):
        return None
    track, xs, cand, streak, cand_t = [], [], None, 0, 0.0
    for t, faces in seen:
        faces = sorted(faces, key=lambda f: -f[1])
        x = faces[0][0]
        if track and len(faces) > 1 and faces[0][1] < ratio * faces[1][1]:
            x = min(faces, key=lambda f: abs(f[0] - track[-1][1]))[0]  # ninguém claramente falando: fica em quem estava
        if not track:
            track, xs = [[0.0, x]], [x]
        elif abs(x - track[-1][1]) < same:
            xs.append(x)
            cand, streak = None, 0  # voltou a quem estava: o piscar de antes não conta
        else:
            if cand is not None and abs(x - cand) < same:
                streak += 1
            else:
                cand, streak, cand_t = x, 1, t
            if streak >= hold:
                track[-1][1] = sorted(xs)[len(xs) // 2]
                track.append([cand_t, cand])
                xs, cand, streak = [cand], None, 0
    track[-1][1] = sorted(xs)[len(xs) // 2]
    return [tuple(seg) for seg in track]


def track(video, start, end, info):
    return pick(scan(video, start, end, info))
