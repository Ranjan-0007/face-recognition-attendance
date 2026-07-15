"""
Combined Face Recognition API — Enrollment + Recognition (Lightweight ONNX Version)
Stores face images and 512-d embeddings in MongoDB.
Uses ONNX Runtime (ArcFace model) instead of TensorFlow/DeepFace to run within 512MB RAM on Render.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import os
import base64
import logging
import requests
from datetime import datetime, timezone
import onnxruntime as ort
from pymongo import MongoClient, ASCENDING
from bson.binary import Binary

# ── Config ───────────────────────────────────────────────────────────────────
MODEL_PATH       = "arcface.onnx"
MODEL_URL        = "https://huggingface.co/garavv/arcface-onnx/resolve/main/arc.onnx"
MIN_FACE_PX      = 80
BLUR_THRESHOLD   = 30.0
BRIGHTNESS_MIN   = 40
BRIGHTNESS_MAX   = 225
MAX_IMAGES       = 8
THRESHOLD        = 0.40  # Cosine distance threshold (1 - cos_sim <= 0.40)
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ── Model Download & Loading ──────────────────────────────────────────────────
def download_model_if_missing():
    if not os.path.exists(MODEL_PATH):
        log.info("ArcFace model '%s' not found. Downloading from Hugging Face...", MODEL_PATH)
        try:
            r = requests.get(MODEL_URL, stream=True)
            r.raise_for_status()
            total_size = int(r.headers.get('content-length', 0))
            downloaded = 0
            with open(MODEL_PATH, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            percent = int(100 * downloaded / total_size)
                            if percent % 20 == 0:
                                log.info("Downloading: %d%% completed", percent)
            log.info("Model downloaded successfully ✓")
        except Exception as e:
            log.error("Failed to download model: %s", e)
            if os.path.exists(MODEL_PATH):
                os.remove(MODEL_PATH)
            raise SystemExit("Required model file is missing and download failed.")

download_model_if_missing()

# Start ONNX Runtime Session (optimized for CPU execution)
log.info("Initializing ONNX Runtime session...")
opts = ort.SessionOptions()
opts.intra_op_num_threads = 1
opts.inter_op_num_threads = 1
opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
ort_session = ort.InferenceSession(MODEL_PATH, sess_options=opts)
log.info("ONNX ArcFace model loaded successfully ✓")

# ── MongoDB ──────────────────────────────────────────────────────────────────
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
mongo_client = MongoClient(MONGO_URI)
db = mongo_client.get_default_database(default="test")
face_collection = db["faceimages"]

# Ensure unique index on rollNumber
face_collection.create_index([("rollNumber", ASCENDING)], unique=True)
log.info("MongoDB connected → %s", db.name)

# ── OpenCV Cascade ───────────────────────────────────────────────────────────
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


def preprocess_face(face_bgr: np.ndarray, input_shape: list) -> np.ndarray:
    """Resize, convert to RGB, normalize, and shape for the ArcFace ONNX model."""
    # ArcFace models generally require 112x112 input
    face_resized = cv2.resize(face_bgr, (112, 112))
    
    # BGR (OpenCV) -> RGB
    face_rgb = cv2.cvtColor(face_resized, cv2.COLOR_BGR2RGB)
    
    # Normalize pixel values to [-1, 1]: (pixel - 127.5) / 128.0
    face_norm = (face_rgb.astype(np.float32) - 127.5) / 128.0
    
    # Handle channel-first or channel-last shapes
    if input_shape[1] == 3:  # e.g., [1, 3, 112, 112]
        face_input = np.transpose(face_norm, (2, 0, 1))
    else:                    # e.g., [1, 112, 112, 3]
        face_input = face_norm
        
    return np.expand_dims(face_input, axis=0)


def extract_embedding(face_bgr: np.ndarray) -> list[float]:
    """Runs ArcFace model inference and returns the normalized 512-d float list."""
    inputs = ort_session.get_inputs()[0]
    input_shape = inputs.shape
    
    # Fallback to standard ArcFace shape if dynamic
    if not input_shape or None in input_shape or isinstance(input_shape[2], str):
        input_shape = [1, 3, 112, 112]
        
    face_input = preprocess_face(face_bgr, input_shape)
    
    input_name = inputs.name
    output_name = ort_session.get_outputs()[0].name
    
    embeddings = ort_session.run([output_name], {input_name: face_input})[0]
    embedding = embeddings[0]
    
    # L2 normalize the embedding
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
        
    return embedding.tolist()


def get_or_create_embedding(roll_number: str, img_doc: dict) -> list[float] | None:
    """Gets stored embedding from image document or computes and saves it if missing."""
    emb = img_doc.get("embedding")
    if emb is not None:
        return list(emb)
        
    # If missing (legacy data), compute and backport it
    ref_img = mongo_bytes_to_bgr(img_doc["data"])
    if ref_img is None:
        return None
        
    try:
        log.info("Computing missing embedding for legacy image: %s/%s", roll_number, img_doc["filename"])
        emb = extract_embedding(ref_img)
        # Update MongoDB doc so we don't have to compute it again next time
        face_collection.update_one(
            {"rollNumber": roll_number, "images.filename": img_doc["filename"]},
            {"$set": {"images.$.embedding": emb}}
        )
        return emb
    except Exception as e:
        log.error("Failed to compute legacy embedding: %s", e)
        return None


# ── Enrollment Routes ──────────────────────────────────────────────

@app.route("/enroll", methods=["POST"])
def enroll_person():
    data        = request.get_json() or {}
    roll_number = data.get("rollNumber") or data.get("usn")
    image_data  = data.get("image")

    if not roll_number or not image_data:
        return jsonify({"message": "rollNumber and image are required"}), 400

    # Decode
    frame = decode_image(image_data)
    if frame is None:
        return jsonify({"message": "Could not decode image"}), 400

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Detect faces
    detected = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=6,
        minSize=(MIN_FACE_PX, MIN_FACE_PX), flags=cv2.CASCADE_SCALE_IMAGE,
    )

    if len(detected) == 0:
        return jsonify({"message": "No face detected. Ensure your face is clearly visible."}), 400
    if len(detected) > 1:
        return jsonify({"message": f"{len(detected)} faces found. Only one person should be in frame."}), 400

    # Check capacity limit
    current = mongo_image_count(roll_number)
    if current >= MAX_IMAGES:
        return jsonify({
            "message"  : f"Already have {current}/{MAX_IMAGES} images. Delete old data first.",
            "count"    : current,
            "maxImages": MAX_IMAGES,
        }), 400

    # Crop largest face with 20% padding
    x, y, w, h = max(detected, key=lambda f: f[2] * f[3])
    pad = int(max(w, h) * 0.20)
    x1  = max(0, x - pad);              y1 = max(0, y - pad)
    x2  = min(frame.shape[1], x + w + pad); y2 = min(frame.shape[0], y + h + pad)

    face_colour = frame[y1:y2, x1:x2]
    face_gray   = gray[y1:y2,  x1:x2]

    # Quality check
    passed, reason = quality_check(face_gray)
    if not passed:
        return jsonify({"message": reason}), 400

    # Resize to 224x224 for storage and encode as JPEG bytes
    face_store = cv2.resize(face_colour, (224, 224))
    success, buf = cv2.imencode(".jpg", face_store, [cv2.IMWRITE_JPEG_QUALITY, 95])
    if not success:
        return jsonify({"message": "Failed to encode face image"}), 500

    # Compute embedding
    try:
        embedding = extract_embedding(face_colour)
    except Exception as e:
        log.error("Embedding extraction failed: %s", e)
        return jsonify({"message": "Failed to extract face embedding vectors"}), 500

    idx = current + 1
    filename = f"{roll_number}_{idx}.jpg"
    jpeg_bytes = Binary(buf.tobytes())

    image_doc = {
        "filename"  : filename,
        "data"      : jpeg_bytes,
        "embedding" : embedding,
        "uploadedAt": datetime.now(timezone.utc),
    }

    # Save to MongoDB
    face_collection.update_one(
        {"rollNumber": roll_number},
        {"$push": {"images": image_doc},
         "$setOnInsert": {"rollNumber": roll_number}},
        upsert=True,
    )

    new_count = mongo_image_count(roll_number)
    log.info("Enrolled %s — image %d/%d (MongoDB + Embedding)", roll_number, new_count, MAX_IMAGES)

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


# ── Recognition Routes ─────────────────────────────────────────────

@app.route("/recognize", methods=["POST"])
def recognize():
    data = request.get_json()
    if not data or "image" not in data:
        return jsonify({"error": "No image provided"}), 400

    frame = decode_image(data["image"])
    if frame is None:
        return jsonify({"error": "Could not decode image"}), 400

    # Face presence check
    gray     = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    detected = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5,
        minSize=(MIN_FACE_PX, MIN_FACE_PX), flags=cv2.CASCADE_SCALE_IMAGE,
    )

    if len(detected) == 0:
        return jsonify({"rollNumber": "No face detected", "confidence": None, "matched": False})

    # Crop largest face with 20% padding
    x, y, w, h = max(detected, key=lambda f: f[2] * f[3])
    pad = int(max(w, h) * 0.20)
    x1  = max(0, x - pad);              y1 = max(0, y - pad)
    x2  = min(frame.shape[1], x + w + pad); y2 = min(frame.shape[0], y + h + pad)
    face_crop = frame[y1:y2, x1:x2]

    # Get query embedding vector
    try:
        query_embedding = extract_embedding(face_crop)
    except Exception as e:
        log.error("Failed to extract query embedding: %s", e)
        return jsonify({"error": "Failed to analyze face features"}), 500

    # Fetch all enrolled students
    cursor = face_collection.find({}, {"rollNumber": 1, "images": 1})
    best_roll     = None
    best_distance = float("inf")

    for student_doc in cursor:
        roll = student_doc["rollNumber"]
        images = student_doc.get("images") or []
        
        for img_doc in images:
            ref_emb = get_or_create_embedding(roll, img_doc)
            if ref_emb is None:
                continue
                
            # Cosine similarity dot product
            cos_sim = np.dot(query_embedding, ref_emb)
            # Distance: 1.0 - cos_sim (smaller is better, matching DeepFace style)
            distance = 1.0 - cos_sim
            
            if distance < best_distance:
                best_distance = distance
                best_roll     = roll

    log.info("Best match → %s  distance=%.4f  threshold=%.2f", best_roll, best_distance, THRESHOLD)

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


# ── Health Check ───────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    try:
        enrolled = face_collection.count_documents({})
        pipeline = [{"$unwind": "$images"}, {"$count": "total"}]
        result = list(face_collection.aggregate(pipeline))
        total_images = result[0]["total"] if result else 0
    except Exception:
        enrolled = 0
        total_images = 0

    return jsonify({
        "status":            "ok",
        "model":             "ArcFace ONNX (Lightweight CPU)",
        "detector":          "opencv",
        "threshold":         THRESHOLD,
        "enrolled_students": enrolled,
        "total_images":      total_images,
    })


# ── Startup ────────────────────────────────────────────────────────

if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 5002))
    app.run(host="0.0.0.0", port=PORT, debug=False)
