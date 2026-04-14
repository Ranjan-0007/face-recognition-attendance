from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import os
import base64
import logging

# ── Config ───────────────────────────────────────────────────────────────────
FACES_DIR        = "faces"
THRESHOLD        = 0.5            # Histogram correlation threshold (0.0-1.0)
MIN_FACE_PX      = 80
# ──────────────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

# ORB detector for feature matching (no external deps)
orb = cv2.ORB_create(nfeatures=500)


# ── Helpers ───────────────────────────────────────────────────────────────────

def decode_image(data_uri: str):
    """Base64 data-URI → BGR numpy array."""
    try:
        _, encoded = data_uri.split(",", 1)
    except ValueError:
        encoded = data_uri
    img_bytes = base64.b64decode(encoded)
    np_arr    = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)


def get_enrolled_students() -> list[str]:
    """Return all roll-number folder names."""
    if not os.path.exists(FACES_DIR):
        return []
    return [
        d for d in os.listdir(FACES_DIR)
        if os.path.isdir(os.path.join(FACES_DIR, d))
    ]


def verify_against_student(face_img: np.ndarray, roll: str) -> float | None:
    """
    Compare captured face against all enrolled images for a student.
    Uses ORB feature matching. Returns best score (0-1), or None if folder not found.
    """
    folder = os.path.join(FACES_DIR, roll)
    if not os.path.exists(folder):
        return None
    
    img_files = [
        f for f in os.listdir(folder)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ]
    best_score = 0.0

    for img_file in img_files:
        img_path = os.path.join(folder, img_file)
        try:
            enrolled_img = cv2.imread(img_path)
            if enrolled_img is None:
                continue
            
            # Detect features with ORB
            kp1, des1 = orb.detectAndCompute(face_img, None)
            kp2, des2 = orb.detectAndCompute(enrolled_img, None)
            
            if des1 is None or des2 is None:
                log.warning("  Skipping %s/%s: no features", roll, img_file)
                continue
            
            # Match features
            bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
            matches = bf.match(des1, des2)
            good_matches = [m for m in matches if m.distance < 50]
            
            # Score based on match quality and quantity
            score = min(1.0, len(good_matches) / max(len(kp1), len(kp2)))
            log.info("  %s/%s → %.4f (%d matches)", roll, img_file, score, len(good_matches))
            
            if score > best_score:
                best_score = score
        except Exception as e:
            log.warning("  Skipping %s/%s: %s", roll, img_file, e)

    return best_score if best_score > 0 else None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/recognize", methods=["POST"])
def recognize():
    data = request.get_json()
    if not data or "image" not in data:
        return jsonify({"error": "No image provided"}), 400

    frame = decode_image(data["image"])
    if frame is None:
        return jsonify({"error": "Could not decode image"}), 400

    # ── 1. Quick face presence check with OpenCV ──────────────────────────
    gray     = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    detected = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5,
        minSize=(MIN_FACE_PX, MIN_FACE_PX), flags=cv2.CASCADE_SCALE_IMAGE,
    )

    if len(detected) == 0:
        return jsonify({"rollNumber": "No face detected", "confidence": None,
                        "matched": False})

    # ── 2. Crop largest face with 20% padding ─────────────────────────────
    x, y, w, h = max(detected, key=lambda f: f[2] * f[3])
    pad = int(max(w, h) * 0.20)
    x1  = max(0, x - pad);              y1 = max(0, y - pad)
    x2  = min(frame.shape[1], x+w+pad); y2 = min(frame.shape[0], y+h+pad)
    face_crop = frame[y1:y2, x1:x2]

    # ── 3. Check enrolled students ────────────────────────────────────────
    enrolled = get_enrolled_students()
    if not enrolled:
        return jsonify({"error": "No students enrolled yet."}), 500

    # ── 4. Compare against every student, keep best match ─────────────────
    best_roll     = None
    best_score    = 0.0

    for roll in enrolled:
        score = verify_against_student(face_crop, roll)
        if score is not None and score > best_score:
            best_score = score
            best_roll  = roll

    log.info("Best match → %s  score=%.4f  threshold=%.2f",
             best_roll, best_score, THRESHOLD)

    # ── 5. Apply threshold ────────────────────────────────────────────────
    matched    = best_score >= THRESHOLD
    confidence = int(best_score * 100)

    if not matched:
        return jsonify({
            "rollNumber": "Unknown",
            "confidence": confidence,
            "score"     : round(best_score, 4),
            "matched"   : False,
        })

    return jsonify({
        "rollNumber": best_roll,
        "confidence": confidence,
        "score"     : round(best_score, 4),
        "matched"   : True,
    })


@app.route("/health", methods=["GET"])
def health():
    enrolled = total_images = 0
    if os.path.exists(FACES_DIR):
        for d in os.listdir(FACES_DIR):
            p = os.path.join(FACES_DIR, d)
            if os.path.isdir(p):
                enrolled += 1
                total_images += len([
                    f for f in os.listdir(p)
                    if f.lower().endswith((".jpg", ".jpeg", ".png"))
                ])
    return jsonify({
        "status"            : "ok",
        "model"             : "face_recognition (dlib)",
        "detector"          : "dlib CNN",
        "threshold"         : THRESHOLD,
        "enrolled_students" : enrolled,
        "total_images"      : total_images,
    })


if __name__ == "__main__":
    # Warm up face_recognition on startup so first request isn't slow
    log.info("Warming up face_recognition…")
    try:
        dummy = np.zeros((224, 224, 3), dtype=np.uint8)
        face_recognition.face_encodings(dummy)
        log.info("face_recognition ready ✓")
    except Exception as e:
        log.warning("Warm-up failed (ok on first run): %s", e)

    PORT = int(os.environ.get("PORT", 5003))
    app.run(host="0.0.0.0", port=PORT, debug=False)