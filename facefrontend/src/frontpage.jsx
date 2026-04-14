import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const Front = () => {
  const [recognizedRoll, setRecognizedRoll] = useState("");
  const [recognizedName, setRecognizedName] = useState("");
  const [students, setStudents]             = useState([]);
  const [periods, setPeriods]               = useState([]);
  const [status, setStatus]                 = useState("idle");
  const [message, setMessage]               = useState("");
  const [nextPeriod, setNextPeriod]         = useState(null);
  const [lateInfo, setLateInfo]             = useState(null);
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studRes, perRes] = await Promise.all([
          axios.get("http://localhost:5001/api/students"),
          axios.get("http://localhost:5001/api/periods"),
        ]);
        setStudents(Array.isArray(studRes.data) ? studRes.data : []);
        setPeriods(Array.isArray(perRes.data)   ? perRes.data  : []);
      } catch (err) { console.error("Error fetching data:", err); }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const getCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera error:", err);
        setStatus("error");
        setMessage("Camera access denied. Please allow camera permission.");
      }
    };
    getCamera();
  }, []);

  const formatTime = (h, m) => {
    const suffix = h >= 12 ? "PM" : "AM";
    const hour   = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
  };

  // ✅ FIX: Don't suggest next period on Sunday/holiday
  const isSunday = () => new Date().getDay() === 0;

  const findNextPeriodLocal = (periodsArr) => {
    if (isSunday()) return null; // No next period on Sunday
    const now        = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    return periodsArr
      .map(p => ({ ...p, startTotalMin: p.startHour * 60 + p.startMinute }))
      .filter(p => p.startTotalMin > currentMin)
      .sort((a, b) => a.startTotalMin - b.startTotalMin)[0] || null;
  };

  const handleMarkAttendance = async () => {
    if (status === "scanning") return;

    // ✅ FIX: Check Sunday before even scanning
    if (isSunday()) {
      setStatus("no_period");
      setMessage("Today is Sunday — college is closed. No attendance today!");
      setNextPeriod(null);
      return;
    }

    setStatus("scanning");
    setMessage("");
    setRecognizedRoll("");
    setRecognizedName("");
    setNextPeriod(null);
    setLateInfo(null);

    const canvas = canvasRef.current;
    const video  = videoRef.current;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg");

    try {
      // Step 1 — Face recognition
      const response = await axios.post(
        "http://localhost:5003/recognize",
        { image: imageData },
        { timeout: 15000 }
      );

      const rollNumber = response.data.rollNumber || response.data.usn;

      if (!rollNumber || rollNumber === "No face detected") {
        setStatus("no_face");
        setMessage("No face detected. Look directly at the camera and try again.");
        return;
      }

      if (rollNumber === "Unknown") {
        setStatus("unknown");
        setMessage("Face not recognized. Are you enrolled in the system?");
        return;
      }

      setRecognizedRoll(rollNumber);
      const matchedStudent = students.find(s => s.rollNumber === rollNumber || s.usn === rollNumber);
      if (matchedStudent) setRecognizedName(matchedStudent.name);

      // Step 2 — Mark attendance (server checks timetable + 15-min window)
      try {
        const attRes = await axios.post(
          "http://localhost:5001/api/periodwise-attendance",
          { rollNumber, recognizedAt: new Date().toISOString() }
        );
        setStatus("success");
        setMessage(attRes.data.message || "Attendance marked successfully!");
      } catch (err) {
        const errData   = err.response?.data || {};
        const errMsg    = errData.message  || "";
        const errStatus = errData.status   || "";

        if (errStatus === "late" || errMsg.toLowerCase().includes("late")) {
          setStatus("late");
          setMessage(errMsg);
          setLateInfo(errData);
        } else if (errMsg.includes("No valid class period") || errMsg.includes("holiday") || errMsg.includes("Sunday")) {
          setStatus("no_period");
          setMessage(isSunday()
            ? "Today is Sunday — college is closed. No attendance today!"
            : "No class scheduled at this time.");
          // ✅ Only show next period on working days
          setNextPeriod(!isSunday() ? (errData.nextPeriod || findNextPeriodLocal(periods)) : null);
        } else if (errMsg.includes("already recorded")) {
          setStatus("already_marked");
          setMessage("Your attendance is already marked for this period today!");
        } else {
          setStatus("error");
          setMessage(errMsg || "Failed to record attendance.");
        }
      }

    } catch (err) {
      console.error("[ERROR]", err);
      if (err.code === "ECONNREFUSED" || err.message?.includes("Network Error")) {
        setStatus("error");
        setMessage("Cannot connect to recognition server. Make sure recognize_api.py is running on port 5003.");
      } else {
        setStatus("error");
        setMessage(err.response?.data?.message || "Recognition failed. Try again.");
      }
    }
  };

  const reset = () => {
    setStatus("idle");
    setMessage("");
    setRecognizedRoll("");
    setRecognizedName("");
    setNextPeriod(null);
    setLateInfo(null);
  };

  const statusConfig = {
    idle:          { border: "border-[#E8E4FF]",  text: "",                icon: null },
    scanning:      { border: "border-blue-400",   text: "text-blue-300",   icon: "⏳" },
    success:       { border: "border-green-400",  text: "text-green-300",  icon: "✅" },
    no_face:       { border: "border-orange-400", text: "text-orange-300", icon: "😶" },
    unknown:       { border: "border-orange-400", text: "text-orange-300", icon: "👤" },
    no_period:     { border: "border-yellow-400", text: "text-yellow-300", icon: "🕐" },
    late:          { border: "border-red-400",    text: "text-red-300",    icon: "⏰" },
    already_marked:{ border: "border-blue-400",   text: "text-blue-300",   icon: "ℹ️" },
    error:         { border: "border-red-400",    text: "text-red-300",    icon: "⚠️" },
  };

  const cfg        = statusConfig[status] || statusConfig.idle;
  const isScanning = status === "scanning";

  return (
    <div className="absolute inset-0 h-full w-full px-5 py-10"
      style={{ background: "radial-gradient(125% 125% at 50% 10%, #000 40%, #63e 100%)" }}>

      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-6xl">

          {/* Camera */}
          <div className="w-full sm:w-1/2 flex items-center justify-center">
            <div className={`w-full aspect-video bg-black rounded-2xl shadow-2xl overflow-hidden border-2 transition-all ${cfg.border}`}>
              <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} width="640" height="480" className="hidden" />
            </div>
          </div>

          {/* Right panel */}
          <div className="w-full sm:w-1/2 flex flex-col items-center justify-center text-center gap-4">

            <h1 className="text-4xl font-bold text-white drop-shadow-md">
              Smart Attendance System
            </h1>
            <p className="text-blue-300 text-sm">Guru Nanak Dev University College</p>

            {/* Sunday notice */}
            {isSunday() && (
              <div className="bg-yellow-500/20 border border-yellow-400/40 rounded-2xl px-5 py-3 w-full max-w-sm">
                <p className="text-yellow-300 font-bold text-sm">🏖️ Sunday — College Holiday</p>
                <p className="text-yellow-200 text-xs mt-0.5">Attendance marking is disabled today</p>
              </div>
            )}

            {/* Recognized info */}
            {(recognizedRoll || recognizedName) && (
              <div className="bg-white/10 rounded-2xl px-6 py-4 w-full max-w-sm border border-white/20">
                {recognizedRoll && (
                  <div className="mb-2">
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Roll Number</p>
                    <p className="text-emerald-400 font-black text-xl">{recognizedRoll}</p>
                  </div>
                )}
                {recognizedName && (
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Name</p>
                    <p className="text-emerald-400 font-bold text-lg">{recognizedName}</p>
                  </div>
                )}
              </div>
            )}

            {/* Status message */}
            {status !== "idle" && (
              <div className={`w-full max-w-sm rounded-2xl border-2 px-5 py-4 bg-white/5 ${cfg.border}`}>
                <div className="flex items-center gap-2 justify-center mb-2">
                  {cfg.icon && <span className="text-xl">{cfg.icon}</span>}
                  <p className={`font-bold text-sm ${cfg.text}`}>
                    {status === "scanning"        ? "Scanning..."
                    : status === "success"        ? "Attendance Marked!"
                    : status === "no_face"        ? "No Face Detected"
                    : status === "unknown"        ? "Face Not Recognized"
                    : status === "no_period"      ? "No Class Now"
                    : status === "late"           ? "You Are Late!"
                    : status === "already_marked" ? "Already Marked"
                    : "Error"}
                  </p>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">{message}</p>

                {/* Next period — only on working days */}
                {status === "no_period" && nextPeriod && !isSunday() && (
                  <div className="mt-3 pt-3 border-t border-yellow-500/30">
                    <p className="text-yellow-200 text-xs font-semibold">Next class today:</p>
                    <p className="text-yellow-300 font-black text-lg">{nextPeriod.subject}</p>
                    {nextPeriod.room && <p className="text-yellow-200 text-xs">Room: {nextPeriod.room}</p>}
                    <p className="text-yellow-200 text-xs mt-0.5">
                      {formatTime(nextPeriod.startHour, nextPeriod.startMinute)} – {formatTime(nextPeriod.endHour, nextPeriod.endMinute)}
                    </p>
                    <p className="text-yellow-400 text-xs mt-1 font-medium">
                      Come back at {formatTime(nextPeriod.startHour, nextPeriod.startMinute)}
                    </p>
                  </div>
                )}

                {status === "no_period" && !nextPeriod && !isSunday() && (
                  <div className="mt-3 pt-3 border-t border-yellow-500/30">
                    <p className="text-yellow-200 text-xs">No more classes scheduled for today.</p>
                  </div>
                )}

                {/* Late tip */}
                {status === "late" && (
                  <div className="mt-3 pt-3 border-t border-red-500/30">
                    <p className="text-red-200 text-xs">
                      Attendance can only be marked within the first <strong>15 minutes</strong> of class.
                      Please contact your teacher to manually mark your attendance.
                    </p>
                  </div>
                )}

                {status !== "scanning" && (
                  <button onClick={reset}
                    className="mt-3 w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition">
                    Try Again
                  </button>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              <button onClick={handleMarkAttendance} disabled={isScanning || isSunday()}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-800 bg-gradient-to-r from-gray-100 via-[#c7d2fe] to-[#8678f9] px-6 font-bold text-gray-950 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {isScanning ? "Scanning..." : isSunday() ? "Closed Today" : "Mark Attendance"}
              </button>

              <Link to="/Signin">
                <button className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-800 bg-gradient-to-r from-gray-100 via-[#c7d2fe] to-[#8678f9] px-6 font-medium text-gray-950 hover:opacity-90">
                  Admin Panel
                </button>
              </Link>

              <Link to="/student-register">
                <button className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-800 bg-gradient-to-r from-gray-100 via-[#c7d2fe] to-[#8678f9] px-6 font-medium text-gray-950 hover:opacity-90">
                  Student Portal
                </button>
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Front;