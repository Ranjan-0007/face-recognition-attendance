---
title: Face Recognition API
emoji: 👤
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
---

# Face Recognition API

Combined Flask API for face enrollment and recognition using DeepFace/ArcFace.

## Environment Variables
- `MONGO_URI` — MongoDB connection string (set as HF Space Secret)
- `PORT` — Server port (default: 7860)
