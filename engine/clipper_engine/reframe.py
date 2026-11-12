from statistics import median


def face_x(video, start, end, samples=30):
    """Posição horizontal (0..1) do rosto principal no trecho, ou None se quase não aparece rosto."""
    import cv2

    detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    capture = cv2.VideoCapture(str(video))
    step = max((end - start) / samples, 0.5)
    centers, tries, t = [], 0, start
    while t < end:
        capture.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, frame = capture.read()
        t += step
        if not ok:
            continue
        tries += 1
        scale = 640 / frame.shape[1]
        gray = cv2.cvtColor(cv2.resize(frame, None, fx=scale, fy=scale), cv2.COLOR_BGR2GRAY)
        faces = detector.detectMultiScale(gray, 1.1, 5, minSize=(40, 40))
        if len(faces):
            x, _, w, _ = max(faces, key=lambda f: f[2] * f[3])
            centers.append((x + w / 2) / gray.shape[1])
    capture.release()
    return median(centers) if tries and len(centers) >= tries * 0.3 else None
