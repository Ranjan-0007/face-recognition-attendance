# Face Rego

A face recognition attendance system with a React frontend, Node/Express backend, and Python face enrollment scripts.

## Project structure

- `facefrontend/` - React app for HOD, teacher, and student dashboards
- `server/` - Node.js / Express backend API
- `python-face-api/` - Python face recognition and enrollment scripts
- `start.bat` - Convenience script to start the project

## Setup

### 1. Backend

```bash
cd server
npm install
```

Create a `.env` file in the root of the repository or in `server/`. You can use `.env.example` as a template.

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/<dbname>?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_here
PORT=5001
```

### 2. Frontend

```bash
cd facefrontend
npm install
npm run dev
```

### 3. Python face API

If you have Python dependencies, install them in `python-face-api`.

```bash
cd python-face-api
pip install -r requirements.txt
```

If `requirements.txt` is not present, install the packages used by the Python scripts manually.

## Running

Start backend:

```bash
cd server
node server.js
```

Start frontend:

```bash
cd facefrontend
npm run dev
```

## GitHub guidance

Do commit:

- `facefrontend/`
- `server/`
- `python-face-api/`
- `start.bat`
- `.gitignore`
- `.env.example`
- `README.md`

Do not commit:

- `.env`
- `node_modules/`
- build output like `dist/` or `build/`
- editor files like `.vscode/` or `.idea/`
- local logs and caches
- `python-face-api/faces/` if it contains student photos

## Notes

- `server/server.js` now loads environment variables using `dotenv`
- `.env` is intentionally ignored so your MongoDB credentials stay private