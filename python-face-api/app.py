"""
Combined Face Recognition API — Enrollment + Recognition
Stores face images in MongoDB instead of the filesystem.
Designed for deployment on Hugging Face Spaces (Docker SDK).
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import os
import base64
import logging
from datetime import datetime, timezone
from deepface import DeepFace
from pymongo import MongoClient, ASCENDING
from bson.binary import Binary

# ── Config ───────────────────────────────────────────────────────────────────
MODEL_NAME       = "ArcFace"
DETECTOR_BACKEND = "opencv"
DISTANCE_METRIC  = "cosine"
THRESHOLD        = 0.40
MIN_FACE_PX      = 80
BLUR_THRESHOLD   = 30.0
BRIGHTNESS_MIN   = 40
BRIGHTNESS_MAX   = 225
MAX_IMAGES       = 8
TARGET_SIZE      = (224, 224)
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ── MongoDB ──────────────────────────────────────────────────────────────────
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
mongo_client = MongoClient(MONGO_URI)
# Use database name from URI; fall back to 'test' (matches Mongoose default)
db = mongo_client.get_default_database(default="test")
face_collection = db["faceimages"]

# Ensure unique index on rollNumber (idempotent — safe to call every startup)
face_collection.create_index([("rollNumber", ASCENDING)], unique=True)
log.info("MongoDB connected → %s", db.name)

# ── OpenCV cascade ───────────────────────────────────────────────────────────
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


# ═══════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

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


def mongo_image_count(roll_number: str) -> int:
    """Return the number of stored images for a student."""
    doc = face_collection.find_one(
        {"rollNumber": roll_number}, {"images": 1}
    )
    if not doc or "images" not in doc:
        return 0
    return len(doc["images"])


def mongo_bytes_to_bgr(jpeg_bytes: bytes) -> np.ndarray:
    """Decode JPEG bytes from MongoDB back into a BGR numpy array."""
    np_arr = np.frombuffer(jpeg_bytes, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)


def verify_against_student_mongo(face_img: np.ndarray, roll: str) -> float | None:
    """
    Run DeepFace.verify against all images for one student (loaded from MongoDB).
    Returns the BEST (lowest) distance found, or None if all fail.
    """
    doc = face_collection.find_one({"rollNumber": roll}, {"images": 1})
    if not doc or not doc.get("images"):
        return None

    best_distance = None

    for img_doc in doc["images"]:
        try:
            ref_img = mongo_bytes_to_bgr(img_doc["data"])
            if ref_img is None:
                continue
            result = DeepFace.verify(
                img1_path        = face_img,       # numpy array
                img2_path        = ref_img,        # numpy array
                model_name       = MODEL_NAME,
                detector_backend = DETECTOR_BACKEND,
                distance_metric  = DISTANCE_METRIC,
                enforce_detection= False,          # face already cropped
            )
            dist = result["distance"]
            log.info("  %s/%s → %.4f", roll, img_doc.get("filename", "?"), dist)
            if best_distance is None or dist < best_distance:
                best_distance = dist
        except Exception as e:
            log.warning("  Skipping %s/%s: %s",
                        roll, img_doc.get("filename", "?"), e)

    return best_distance


# ═══════════════════════════════════════════════════════════════════════════════
#  ROUTES — ENROLLMENT
# ═══════════════════════════════════════════════════════════════════════════════

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

    # ── Cap check ─────────────────────────────────────────────────────────
    current = mongo_image_count(roll_number)
    if current >= MAX_IMAGES:
        return jsonify({
            "message"  : f"Already have {current}/{MAX_IMAGES} images. Delete old data first.",
            "count"    : current,
            "maxImages": MAX_IMAGES,
        }), 400

    # ── Crop with 20 % padding — same logic as enroll.py ─────────────────
    x, y, w, h = max(detected, key=lambda f: f[2] * f[3])
    pad = int(max(w, h) * 0.20)
    x1  = max(0, x - pad);            y1 = max(0, y - pad)
    x2  = min(frame.shape[1], x+w+pad); y2 = min(frame.shape[0], y+h+pad)

    face_colour = frame[y1:y2, x1:x2]
    face_gray   = gray[y1:y2,  x1:x2]

    # ── Quality gate ─────────────────────────────────────────────────────
    passed, reason = quality_check(face_gray)
    if not passed:
        return jsonify({"message": reason}), 400

    # ── Encode face as JPEG bytes and store in MongoDB ────────────────────
    face_colour = cv2.resize(face_colour, TARGET_SIZE)
    idx         = current + 1
    filename    = f"{roll_number}_{idx}.jpg"

    success, buf = cv2.imencode(".jpg", face_colour,
                                [cv2.IMWRITE_JPEG_QUALITY, 95])
    if not success:
        return jsonify({"message": "Failed to encode face image"}), 500

    jpeg_bytes = Binary(buf.tobytes())

    image_doc = {
        "filename"  : filename,
        "data"      : jpeg_bytes,
        "uploadedAt": datetime.now(timezone.utc),
    }

    # Upsert: create doc if first image, push otherwise
    face_collection.update_one(
        {"rollNumber": roll_number},
        {"$push": {"images": image_doc},
         "$setOnInsert": {"rollNumber": roll_number}},
        upsert=True,
    )

    new_count = mongo_image_count(roll_number)
    log.info("Enrolled %s — image %d/%d (MongoDB)", roll_number, new_count, MAX_IMAGES)

    return jsonify({
        "message"   : f"Image {new_count}/{MAX_IMAGES} captured!",
        "count"     : new_count,
        "maxImages" : MAX_IMAGES,
        "isComplete": new_count >= 5,
        "rollNumber": roll_number,
    }), 200


@app.route("/enroll/status/<roll_number>", methods=["GET"])
def enroll_status(roll_number):
    cnt = mongo_image_count(roll_number)
    return jsonify({
        "enrolled"  : cnt > 0,
        "count"     : cnt,
        "maxImages" : MAX_IMAGES,
        "isComplete": cnt >= 5,
    }), 200


@app.route("/enroll/<roll_number>", methods=["DELETE"])
def delete_enrollment(roll_number):
    result = face_collection.delete_one({"rollNumber": roll_number})
    if result.deleted_count == 0:
        return jsonify({"message": "Student not found in face database"}), 404
    log.info("Deleted face data for %s (MongoDB)", roll_number)
    return jsonify({"message": f"Face data for {roll_number} deleted"}), 200


# ═══════════════════════════════════════════════════════════════════════════════
#  ROUTES — RECOGNITION
# ═══════════════════════════════════════════════════════════════════════════════

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

    # ── 2. Crop largest face with 20 % padding ────────────────────────────
    x, y, w, h = max(detected, key=lambda f: f[2] * f[3])
    pad = int(max(w, h) * 0.20)
    x1  = max(0, x - pad);              y1 = max(0, y - pad)
    x2  = min(frame.shape[1], x+w+pad); y2 = min(frame.shape[0], y+h+pad)
    face_crop = frame[y1:y2, x1:x2]     # colour — ArcFace needs BGR

    # ── 3. Check enrolled students (from MongoDB) ─────────────────────────
    enrolled_rolls = face_collection.distinct("rollNumber")
    if not enrolled_rolls:
        return jsonify({"error": "No students enrolled yet."}), 500

    # ── 4. Compare against every student, keep best match ─────────────────
    best_roll     = None
    best_distance = float("inf")

    for roll in enrolled_rolls:
        dist = verify_against_student_mongo(face_crop, roll)
        if dist is not None and dist < best_distance:
            best_distance = dist
            best_roll     = roll

    log.info("Best match → %s  distance=%.4f  threshold=%.2f",
             best_roll, best_distance, THRESHOLD)

    # ── 5. Apply threshold ────────────────────────────────────────────────
    matched    = best_distance <= THRESHOLD
    confidence = max(0, int((1.0 - best_distance) * 100))

    if not matched:
        return jsonify({
            "rollNumber": "Unknown",
            "confidence": confidence,
            "distance"  : round(best_distance, 4),
            "matched"   : False,
        })

    return jsonify({
        "rollNumber": best_roll,
        "confidence": confidence,
        "distance"  : round(best_distance, 4),
        "matched"   : True,
    })


# ═══════════════════════════════════════════════════════════════════════════════
#  HEALTH
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    pipeline = [
        {"$project": {"rollNumber": 1, "imageCount": {"$size": {"$ifNull": ["$images", []]}}}},
        {"$group": {"_id": None,
                    "enrolled_students": {"$sum": 1},
                    "total_images": {"$sum": "$imageCount"}}},
    ]
    stats = list(face_collection.aggregate(pipeline))
    if stats:
        enrolled = stats[0]["enrolled_students"]
        total    = stats[0]["total_images"]
    else:
        enrolled = total = 0

    return jsonify({
        "status"           : "ok",
        "model"            : MODEL_NAME,
        "detector"         : DETECTOR_BACKEND,
        "threshold"        : THRESHOLD,
        "enrolled_students": enrolled,
        "total_images"     : total,
    })


# ═══════════════════════════════════════════════════════════════════════════════
#  STARTUP
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # Warm up DeepFace so the first request isn't slow
    log.info("Warming up DeepFace %s model…", MODEL_NAME)
    try:
        dummy = np.zeros((224, 224, 3), dtype=np.uint8)
        DeepFace.represent(dummy, model_name=MODEL_NAME,
                           detector_backend="skip", enforce_detection=False)
        log.info("DeepFace ready ✓")
    except Exception as e:
        log.warning("Warm-up failed (ok on first run): %s", e)

    PORT = int(os.environ.get("PORT", 7860))
    app.run(host="0.0.0.0", port=PORT, debug=False)
