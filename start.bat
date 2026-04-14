@echo off
echo Starting Face Recognition Attendance System...
echo.

echo Starting Node.js Server (port 5001)...
start "Node Server" cmd /k "cd server && node server.js"

echo Starting Python Enroll API (port 5002)...
start "Enroll API" cmd /k "cd python-face-api && python enroll.py"

echo Starting Python Recognize API (port 5003)...
start "Recognize API" cmd /k "cd python-face-api && python recognize_api.py"

echo Starting React Frontend (port 5173)...
start "React App" cmd /k "cd facefrontend && npm run dev"

echo.
echo All servers are starting...
echo.
echo  Node Server   : http://localhost:5001
echo  Enroll API    : http://localhost:5002
echo  Recognize API : http://localhost:5003
echo  React App     : http://localhost:5173
echo.
echo Opening app in browser in 5 seconds...
timeout /t 5 /nobreak
start http://localhost:5173