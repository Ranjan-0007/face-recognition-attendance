from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import os
import base64
import logging

# ── Config ──────────────────────────────────────────────────────────────────
FACES_DIR      = "faces"
MAX_IMAGES     = 8             # Max images per student (5 minimum for good accuracy)
MIN_FACE_PX    = 80            # Reject tiny/distant faces
BLUR_THRESHOLD = 40.0          # Laplacian variance — below = too blurry
BRIGHTNESS_MIN = 40            # Reject dark images
BRIGHTNESS_MAX = 225           # Reject overexposed images
TARGET_SIZE    = (224, 224)    # ArcFace preferred input size
# ────────────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def decode_image(data_uri: str):
    """Base64 data-URI → BGR numpy array."""
    try:
        _, encoded = data_uri.split(",", 1)
    except ValueError:
        encoded = data_uri
    img_bytes = base64.b64decode(encoded)
    np_arr    = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)


def quality_check(face_gray: np.ndarray) -> tuple[bool, str]:
    """Return (passed, reason) for a cropped grayscale face."""
    blur = cv2.Laplacian(face_gray, cv2.CV_64F).var()
    if blur < BLUR_THRESHOLD:
        return False, f"Too blurry (score {blur:.0f}). Hold the camera steady."

    brightness = float(np.mean(face_gray))
    if brightness < BRIGHTNESS_MIN:
        return False, "Too dark. Move to a better-lit area."
    if brightness > BRIGHTNESS_MAX:
        return False, "Overexposed. Avoid strong backlight."

    return True, "ok"


def count_images(folder: str) -> int:
    if not os.path.exists(folder):
        return 0
    return len([f for f in os.listdir(folder)
                if f.lower().endswith((".jpg", ".jpeg", ".png"))])


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/enroll", methods=["POST"])
def enroll_person():
    data        = request.get_json() or {}
    roll_number = data.get("rollNumber") or data.get("usn")
    image_data  = data.get("image")

    if not roll_number or not image_data:
        return jsonify({"message": "rollNumber and image are required"}), 400

    # ── Decode ────────────────────────────────────────────────────────────
    frame = decode_image(image_data)
    if frame is None:
        return jsonify({"message": "Could not decode image"}), 400

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # ── Detect faces ──────────────────────────────────────────────────────
    detected = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=6,
        minSize=(MIN_FACE_PX, MIN_FACE_PX), flags=cv2.CASCADE_SCALE_IMAGE,
    )

    if len(detected) == 0:
        return jsonify({"message": "No face detected. Ensure your face is clearly visible."}), 400
    if len(detected) > 1:
        return jsonify({"message": f"{len(detected)} faces found. Only one person should be in frame."}), 400

    # ── Folder / cap check ────────────────────────────────────────────────
    folder  = os.path.join(FACES_DIR, str(roll_number))
    os.makedirs(folder, exist_ok=True)
    current = count_images(folder)

    if current >= MAX_IMAGES:
        return jsonify({
            "message"  : f"Already have {current}/{MAX_IMAGES} images. Delete old data first.",
            "count"    : current,
            "maxImages": MAX_IMAGES,
        }), 400

    # ── Crop with 20% padding — OpenCV detection needs context ──────┐
    x, y, w, h = max(detected, key=lambda f: f[2] * f[3])
    pad = int(max(w, h) * 0.20)
    x1  = max(0, x - pad);            y1 = max(0, y - pad)
    x2  = min(frame.shape[1], x+w+pad); y2 = min(frame.shape[0], y+h+pad)

    face_colour = frame[y1:y2, x1:x2]
    face_gray   = gray[y1:y2,  x1:x2]

    # ── Quality gate ──────────────────────────────────────────────────────
    passed, reason = quality_check(face_gray)
    if not passed:
        return jsonify({"message": reason}), 400

    # ── Save full-colour image for best matching quality ──────────────┐
    face_colour = cv2.resize(face_colour, TARGET_SIZE)
    idx         = current + 1
    save_path   = os.path.join(folder, f"{roll_number}_{idx}.jpg")
    cv2.imwrite(save_path, face_colour, [cv2.IMWRITE_JPEG_QUALITY, 95])

    new_count = count_images(folder)
    log.info("Enrolled %s — image %d/%d → %s", roll_number, new_count, MAX_IMAGES, save_path)

    return jsonify({
        "message"   : f"Image {new_count}/{MAX_IMAGES} captured!",
        "count"     : new_count,
        "maxImages" : MAX_IMAGES,
        "isComplete": new_count >= 5,
        "rollNumber": roll_number,
    }), 200


@app.route("/enroll/status/<roll_number>", methods=["GET"])
def enroll_status(roll_number):
    folder = os.path.join(FACES_DIR, roll_number)
    cnt    = count_images(folder)
    return jsonify({
        "enrolled"  : cnt > 0,
        "count"     : cnt,
        "maxImages" : MAX_IMAGES,
        "isComplete": cnt >= 5,
    }), 200


@app.route("/enroll/<roll_number>", methods=["DELETE"])
def delete_enrollment(roll_number):
    import shutil
    folder = os.path.join(FACES_DIR, roll_number)
    if not os.path.exists(folder):
        return jsonify({"message": "Student not found in face database"}), 404
    shutil.rmtree(folder)
    log.info("Deleted face data for %s", roll_number)
    return jsonify({"message": f"Face data for {roll_number} deleted"}), 200


@app.route("/health", methods=["GET"])
def health():
    enrolled = total_images = 0
    if os.path.exists(FACES_DIR):
        for d in os.listdir(FACES_DIR):
            p = os.path.join(FACES_DIR, d)
            if os.path.isdir(p):
                enrolled     += 1
                total_images += count_images(p)
    return jsonify({"status": "ok", "enrolled_students": enrolled,
                    "total_images": total_images})


if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 5002))
    app.run(host="0.0.0.0", port=PORT, debug=False)