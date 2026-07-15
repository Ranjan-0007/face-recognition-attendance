# Lightweight Face Recognition API

Combined Flask API for face enrollment and recognition using an optimized ArcFace model with ONNX Runtime. Designed to run in CPU-only, low-RAM environments (like Render Free Tier).

## Environment Variables
- `MONGO_URI` — MongoDB Atlas connection string
- `PORT` — Server port (default: 5002)

## Deploying on Render
1. Create a new **Web Service** on Render.
2. Set the root directory to `python-face-api`.
3. Set the environment variable `MONGO_URI`.
4. Render will automatically detect the `Dockerfile` and build/deploy the service.
