import "./App.css";
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  FaLock, FaCheckCircle, FaCamera, FaTrash, FaTimes,
  FaCalendarAlt, FaExclamationTriangle, FaMedal, FaFire
} from "react-icons/fa";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/* ─── Face Management ──────────────────────────────────────────── */
const FaceManagement = ({ rollNumber }) => {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const [faceStatus,   setFaceStatus]   = useState(null);
  const [capturing,    setCapturing]    = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [mode,         setMode]         = useState("status");
  const [loading,      setLoading]      = useState(false);
  const [toast,        setToast]        = useState({ msg: "", type: "" });
  const TARGET = 5;

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  };

  const fetchStatus = async () => {
    try {
      const res  = await fetch(`http://localhost:5001/api/student/face-status/${rollNumber}`);
      const data = await res.json();
      setFaceStatus(data);
    } catch { setFaceStatus({ enrolled: false, photoCount: 0 }); }
  };

  useEffect(() => { if (rollNumber) fetchStatus(); }, [rollNumber]);

  useEffect(() => {
    if (mode !== "recapture") return;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch { showToast("Camera access denied", "error"); }
    };
    startCamera();
    return () => {
      if (videoRef.current?.srcObject)
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    };
  }, [mode]);

  const handleDeleteFace = async () => {
    if (!window.confirm("Delete all face photos? You will need to re-enroll.")) return;
    setLoading(true);
    try {
      const res  = await fetch(`http://localhost:5001/api/student/face/${rollNumber}`, { method: "DELETE" });
      const data = await res.json();
      showToast(data.message, "success");
      await fetchStatus();
    } catch { showToast("Error deleting face photos", "error"); }
    setLoading(false);
  };

  const captureOnce = async () => {
    const canvas = canvasRef.current, video = videoRef.current;
    if (!canvas || !video) return;
    setCapturing(true);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg");
    try {
      const res = await fetch("http://localhost:5002/enroll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNumber, image: imageData }),
      });
      const result = await res.json();
      if (!res.ok) { showToast(result.message, "error"); setCapturing(false); return; }
      const newCount = captureCount + 1;
      setCaptureCount(newCount);
      if (newCount >= TARGET) {
        showToast("Face enrolled! Recognition is now active.", "success");
        setMode("status"); setCaptureCount(0); await fetchStatus();
      } else {
        showToast(`Photo ${newCount}/${TARGET} saved!`, "info");
      }
    } catch { showToast("Cannot connect to face server (port 5002)", "error"); }
    setCapturing(false);
  };

  return (
    <div className="max-w-md mx-auto">
      {toast.msg && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
          toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-gray-800"
        }`}>{toast.msg}</div>
      )}

      {mode === "status" && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-gray-800 text-lg mb-1">Face Recognition</h2>
          <p className="text-xs text-gray-400 mb-6">Manage your face photos for automatic attendance</p>
          {faceStatus ? (
            <div className={`rounded-2xl p-5 mb-5 ${faceStatus.enrolled ? "bg-green-50 border-2 border-green-200" : "bg-red-50 border-2 border-red-200"}`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{faceStatus.enrolled ? "✅" : "❌"}</span>
                <div>
                  <p className={`font-bold text-sm ${faceStatus.enrolled ? "text-green-700" : "text-red-700"}`}>
                    {faceStatus.enrolled ? "Face Enrolled" : "Not Enrolled"}
                  </p>
                  <p className={`text-xs mt-0.5 ${faceStatus.enrolled ? "text-green-600" : "text-red-600"}`}>
                    {faceStatus.enrolled
                      ? `${faceStatus.photoCount} photos stored — attendance marking active`
                      : "Enroll your face to use the attendance system"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-5 mb-5 text-center">
              <p className="text-gray-400 text-sm">Loading...</p>
            </div>
          )}
          <div className="space-y-3">
            <button onClick={() => { setMode("recapture"); setCaptureCount(0); }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1E2A78] to-blue-600 text-white font-bold text-sm hover:opacity-90 transition flex items-center justify-center gap-2">
              <FaCamera />
              {faceStatus?.enrolled ? "Re-enroll Face (New Photos)" : "Enroll Face Now"}
            </button>
            {faceStatus?.enrolled && (
              <button onClick={handleDeleteFace} disabled={loading}
                className="w-full py-3 rounded-xl border-2 border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 transition disabled:opacity-60 flex items-center justify-center gap-2">
                <FaTrash size={13} />
                {loading ? "Deleting..." : "Delete Face Photos"}
              </button>
            )}
          </div>
          <div className="mt-5 bg-blue-50 rounded-xl p-4 text-xs text-blue-700">
            <p className="font-semibold mb-1">Tips for best recognition accuracy:</p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Enroll in the same lighting as your classroom</li>
              <li>Take photos from slightly different angles (left, right, straight)</li>
              <li>Remove glasses for 1–2 photos if possible</li>
              <li>Minimum 5 photos for good accuracy</li>
            </ul>
          </div>
        </div>
      )}

      {mode === "recapture" && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 text-sm">Capture New Face Photos</h2>
            <button onClick={() => setMode("status")} className="text-gray-400 hover:text-gray-600 p-1">
              <FaTimes />
            </button>
          </div>
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Photos captured</span>
              <span className="font-bold text-[#1E2A78]">{captureCount}/{TARGET}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="h-3 rounded-full bg-gradient-to-r from-blue-600 to-[#1E2A78] transition-all"
                style={{ width: `${(captureCount / TARGET) * 100}%` }} />
            </div>
          </div>
          <div className="bg-black rounded-2xl overflow-hidden mb-4" style={{ height: "250px" }}>
            <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} width="640" height="480" className="hidden" />
          </div>
          <div className="bg-yellow-50 rounded-xl p-3 mb-4 text-xs text-yellow-700">
            Re-enrolling replaces your existing photos. Ensure good lighting.
          </div>
          <button onClick={captureOnce} disabled={capturing}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-700 to-[#1E2A78] text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
            <FaCamera />
            {capturing ? "Saving..." : `Take Photo ${captureCount + 1} of ${TARGET}`}
          </button>
        </div>
      )}
    </div>
  );
};

/* ─── Main StudentDashboard ────────────────────────────────────── */
const StudentDashboard = () => {
  const navigate = useNavigate();

  const [student,          setStudent]          = useState(null);
  const [profile,          setProfile]          = useState(null);
  const [periodAttendance, setPeriodAttendance] = useState([]);
  const [preciseStats,     setPreciseStats]     = useState(null);
  const [periods,          setPeriods]          = useState([]);
  const [timetable,        setTimetable]        = useState({});
  const [loading,          setLoading]          = useState(true);
  const [activeTab,        setActiveTab]        = useState("dashboard");
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);

  const [pwForm,    setPwForm]    = useState({ current: "", newPw: "", confirm: "" });
  const [pwErrors,  setPwErrors]  = useState({});
  const [pwLoading, setPwLoading] = useState(false);
  const [pwToast,   setPwToast]   = useState({ msg: "", type: "" });

  const showPwToast = (msg, type = "info") => {
    setPwToast({ msg, type });
    setTimeout(() => setPwToast({ msg: "", type: "" }), 3500);
  };

  useEffect(() => {
    const info  = localStorage.getItem("studentInfo");
    const token = localStorage.getItem("studentToken");
    if (!info || !token) { navigate("/student-register"); return; }
    setStudent(JSON.parse(info));
  }, []);

  useEffect(() => {
    if (!student) return;
    const fetchData = async () => {
      try {
        const [periodRes, perSettRes, studentsRes, statsRes, holidayRes] = await Promise.all([
          fetch(`http://localhost:5001/api/periodwise-attendance?rollNumber=${encodeURIComponent(student.rollNumber)}`),
          fetch(`http://localhost:5001/api/periods`),
          fetch(`http://localhost:5001/api/students`),
          fetch(`http://localhost:5001/api/student/attendance-stats/${encodeURIComponent(student.rollNumber)}`),
          fetch(`http://localhost:5001/api/holidays/upcoming`).catch(() => ({ json: () => [] })),
        ]);
        const periodData  = await periodRes.json();
        const perSet      = await perSettRes.json();
        const studData    = await studentsRes.json();
        const statsData   = await statsRes.json();
        const holidayData = await holidayRes.json().catch(() => []);

        setPeriodAttendance(
          Array.isArray(periodData)
            ? periodData.filter(l => l.rollNumber === student.rollNumber)
            : []
        );
        setPeriods(Array.isArray(perSet) ? perSet : []);

        // ✅ Precise stats from server (timetable-based calculation)
        if (statsData && !statsData.message) {
          setPreciseStats(statsData);
        }

        if (Array.isArray(studData)) {
          const found = studData.find(s => s.rollNumber === student.rollNumber);
          if (found) setProfile(found);
        }

        if (Array.isArray(holidayData)) {
          setUpcomingHolidays(holidayData);
        }

        const className =
          student.className ||
          (Array.isArray(studData)
            ? studData.find(s => s.rollNumber === student.rollNumber)?.className
            : null);

        if (className) {
          const ttRes  = await fetch(`http://localhost:5001/api/timetable/${encodeURIComponent(className)}`);
          const ttData = await ttRes.json();
          setTimetable(ttData?.slots || {});
        }
      } catch (err) { console.error("Fetch error:", err); }
      setLoading(false);
    };
    fetchData();
  }, [student]);

  const handleLogout = () => {
    localStorage.removeItem("studentToken");
    localStorage.removeItem("studentInfo");
    navigate("/student-register");
  };

  const handleChangePassword = async () => {
    const e = {};
    if (!pwForm.current)                 e.current = "Current password required";
    if (!pwForm.newPw)                   e.newPw   = "New password required";
    if (pwForm.newPw.length < 6)         e.newPw   = "Minimum 6 characters";
    if (pwForm.newPw !== pwForm.confirm) e.confirm  = "Passwords do not match";
    setPwErrors(e);
    if (Object.keys(e).length > 0) return;
    setPwLoading(true);
    try {
      const res  = await fetch("http://localhost:5001/api/student/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNumber: student.rollNumber, currentPassword: pwForm.current, newPassword: pwForm.newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        showPwToast(data.message, "success");
        setPwForm({ current: "", newPw: "", confirm: "" });
        setPwErrors({});
      } else showPwToast(data.message, "error");
    } catch { showPwToast("Server error. Try again.", "error"); }
    setPwLoading(false);
  };

  const pad        = (n)    => String(n).padStart(2, "0");
  const formatTime = (h, m) => {
    const suffix = h >= 12 ? "PM" : "AM";
    const hour   = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${pad(m)} ${suffix}`;
  };

  const now             = new Date();
  const today           = now.toLocaleDateString();
  const todayName       = now.toLocaleDateString("en-US", { weekday: "long" });
  const isSunday        = now.getDay() === 0;
  const currentTotalMin = now.getHours() * 60 + now.getMinutes();

  const presentToday      = periodAttendance.filter(l => new Date(l.recognizedAt).toLocaleDateString() === today);
  const todayPeriodsCount = new Set(presentToday.map(l => l.period)).size;

  // ✅ Precise stats — from server (timetable × weeks enrolled)
  const overallPercent     = preciseStats?.overallPercent  ?? 0;
  const totalAttended      = preciseStats?.totalAttended   ?? periodAttendance.length;
  const totalScheduled     = preciseStats?.totalScheduled  ?? 0;
  const weeksEnrolled      = preciseStats?.weeksEnrolled   ?? 1;
  const subjectStatsServer = preciseStats?.subjectStats    ?? {};

  // ✅ Color based on 75% university requirement
  const getPercentColor = (pct) => pct >= 75 ? "text-green-600" : pct >= 60 ? "text-yellow-600" : "text-red-500";
  const getBarColor     = (pct) => pct >= 75 ? "bg-green-500"   : pct >= 60 ? "bg-yellow-400"   : "bg-red-400";
  const getStatusBg     = (pct) => pct >= 75
    ? "bg-green-50 border-green-200 text-green-700"
    : pct >= 60
    ? "bg-yellow-50 border-yellow-200 text-yellow-700"
    : "bg-red-50 border-red-200 text-red-700";

  // How many more periods needed to reach 75%
  const periodsNeededFor75 = () => {
    if (overallPercent >= 75 || totalScheduled === 0) return 0;
    // We need: (attended + x) / (scheduled + x) >= 0.75
    // Solving: x >= (0.75 * scheduled - attended) / 0.25
    const needed = Math.ceil((0.75 * totalScheduled - totalAttended) / 0.25);
    return Math.max(0, needed);
  };

  // Attendance streak (consecutive school days with attendance)
  const calcStreak = () => {
    if (!periodAttendance.length) return 0;
    const uniqueDates = [...new Set(
      periodAttendance.map(l => new Date(l.recognizedAt).toDateString())
    )].map(d => new Date(d)).sort((a, b) => b - a);
    let streak = 0;
    let prev   = new Date();
    prev.setHours(0, 0, 0, 0);
    for (const d of uniqueDates) {
      const dClean = new Date(d); dClean.setHours(0, 0, 0, 0);
      const diff   = (prev - dClean) / (1000 * 60 * 60 * 24);
      if (diff <= 1 || (diff <= 3 && prev.getDay() === 1)) { // allow weekend gap
        streak++;
        prev = dClean;
      } else break;
    }
    return streak;
  };
  const streak = calcStreak();

  const currentPeriod = isSunday ? null : periods.find(p => {
    const s = p.startHour * 60 + p.startMinute;
    const e = p.endHour   * 60 + p.endMinute;
    return currentTotalMin >= s && currentTotalMin < e;
  });
  const nextPeriod = isSunday ? null : periods
    .map(p => ({ ...p, start: p.startHour * 60 + p.startMinute }))
    .filter(p => p.start > currentTotalMin)
    .sort((a, b) => a.start - b.start)[0] || null;

  // Build subject summary using server stats when available
  const getSubjectsFromTimetable = () => {
    const s = new Set();
    Object.values(timetable).forEach(daySlots => {
      if (Array.isArray(daySlots))
        daySlots.forEach(slot => {
          if (slot.subject && slot.subject.trim() && slot.subject !== "Free / No Class")
            s.add(slot.subject);
        });
    });
    return [...s];
  };
  const timetableSubjects = getSubjectsFromTimetable();

  const periodSummary = timetableSubjects.map(subject => {
    const ss = subjectStatsServer[subject];
    return {
      subject,
      attended:  ss?.attended  ?? periodAttendance.filter(l => l.period === subject).length,
      scheduled: ss?.scheduled ?? 0,
      percent:   ss?.percent   ?? 0,
      today:     presentToday.filter(l => l.period === subject).length,
    };
  }).sort((a, b) => a.percent - b.percent); // lowest first

  const todaySlots = timetable[todayName] || [];

  const activeSlotTimings = periods
    .map((p, i) => ({ ...p, index: i }))
    .filter(p => DAYS.some(day => {
      const slot = (timetable[day] || [])[p.index];
      return slot?.subject && slot.subject !== "Free / No Class" && slot.subject.trim();
    }));

  const info = profile || student;

  const inputCls = (f) =>
    `w-full rounded-xl px-4 py-2.5 text-sm border-2 transition focus:outline-none focus:ring-2 focus:ring-blue-300 ${
      pwErrors[f] ? "border-red-400 bg-red-50" : "border-gray-200 bg-gray-50"
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1E2A78] to-[#f0f4ff]">

      {/* Header */}
      <div className="bg-[#1E2A78] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-white font-black">GN</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm">Student Portal</p>
            <p className="text-blue-300 text-xs">Guru Nanak Dev University College</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="px-3 py-1.5 text-xs bg-red-600/80 text-white rounded-lg hover:bg-red-700 transition font-medium">
          Logout
        </button>
      </div>

      {/* Tab Bar */}
      <div className="bg-[#1E2A78] px-6 pb-0 flex gap-1 border-t border-white/10 overflow-x-auto">
        {[
          { id: "dashboard", label: "Dashboard"       },
          { id: "timetable", label: "My Timetable"    },
          { id: "face",      label: "My Face"         },
          { id: "password",  label: "Change Password" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition whitespace-nowrap ${
              activeTab === tab.id ? "bg-white text-[#1E2A78]" : "text-white/70 hover:text-white hover:bg-white/10"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto p-5">

        {/* ══ DASHBOARD TAB ══ */}
        {activeTab === "dashboard" && (
          <>
            {/* Profile Card */}
            {info && (
              <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
                <div className="flex flex-col sm:flex-row items-start gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-[#1E2A78] flex items-center justify-center text-white font-black text-3xl flex-shrink-0">
                    {info.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <h2 className="font-black text-gray-800 text-xl">{info.name}</h2>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {info.course    && <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{info.course}</span>}
                          {info.semester  && <span className="bg-[#1E2A78] text-white text-xs font-bold px-2 py-0.5 rounded-full">Sem {info.semester}</span>}
                          {info.className && <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">{info.className}</span>}
                          {streak >= 3 && (
                            <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <FaFire className="text-orange-500" /> {streak} day streak!
                            </span>
                          )}
                        </div>
                        {info.department && <p className="text-sm text-gray-400 mt-1">{info.department}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-400 mb-1">Today</p>
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                          presentToday.length > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}>
                          {presentToday.length > 0 ? `✓ ${todayPeriodsCount} period${todayPeriodsCount !== 1 ? "s" : ""}` : "✗ Not marked"}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 mt-4 pt-4 border-t border-gray-100">
                      {[
                        ["Roll No",  info.rollNumber],
                        ["Phone",    info.phone   || "—"],
                        ["Email",    info.email   || student?.email || "—"],
                        ["Enrolled", info.enrolledAt
                          ? new Date(info.enrolledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : "—"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
                          <p className="text-xs font-semibold text-gray-700 mt-0.5 break-all">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Holiday banners */}
            {isSunday && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-5 flex items-center gap-4">
                <span className="text-4xl">🏖️</span>
                <div>
                  <p className="font-bold text-amber-800">Sunday — College Holiday</p>
                  <p className="text-amber-600 text-xs mt-0.5">No classes today. Enjoy your day off!</p>
                </div>
              </div>
            )}
            {!isSunday && upcomingHolidays.length > 0 && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-3 mb-5 flex items-start gap-3">
                <FaCalendarAlt className="text-blue-500 text-lg flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Upcoming Holidays</p>
                  <div className="flex flex-wrap gap-2">
                    {upcomingHolidays.slice(0, 4).map(h => (
                      <span key={h._id} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        📅 {h.name} — {new Date(h.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Current/Next period banner */}
            {!isSunday && currentPeriod && (
              <div className="bg-green-600 rounded-2xl p-4 mb-5 flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-xs font-semibold uppercase tracking-wide">Class in progress now</p>
                  <p className="text-white font-black text-lg">{currentPeriod.subject}</p>
                  <p className="text-green-200 text-xs">{formatTime(currentPeriod.startHour, currentPeriod.startMinute)} – {formatTime(currentPeriod.endHour, currentPeriod.endMinute)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                  <p className="text-green-200 text-xs font-medium">Mark attendance now!</p>
                </div>
              </div>
            )}
            {!isSunday && !currentPeriod && nextPeriod && (
              <div className="bg-amber-500 rounded-2xl p-4 mb-5 flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-xs font-semibold uppercase tracking-wide">Next class today</p>
                  <p className="text-white font-black text-lg">{nextPeriod.subject}</p>
                  <p className="text-amber-100 text-xs">Starts at {formatTime(nextPeriod.startHour, nextPeriod.startMinute)}</p>
                </div>
                <div className="text-right">
                  <p className="text-amber-100 text-xs">Come back at</p>
                  <p className="text-white font-black text-xl">{formatTime(nextPeriod.startHour, nextPeriod.startMinute)}</p>
                </div>
              </div>
            )}

            {/* ✅ ATTENDANCE OVERVIEW — Properly Designed */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-gray-800 text-sm">Attendance Overview</h2>
                {totalScheduled > 0 && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                    {weeksEnrolled} week{weeksEnrolled !== 1 ? "s" : ""} · {totalScheduled} scheduled
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 mb-5">
                {/* Big circular percentage */}
                <div className={`flex-shrink-0 w-36 h-36 rounded-full flex flex-col items-center justify-center border-[10px] ${
                  overallPercent >= 75 ? "border-green-400" : overallPercent >= 60 ? "border-yellow-400" : "border-red-400"
                } relative`}>
                  <span className={`text-4xl font-black ${getPercentColor(overallPercent)}`}>{overallPercent}%</span>
                  <span className="text-xs text-gray-400 font-medium">Overall</span>
                  {overallPercent >= 75 && (
                    <FaMedal className="absolute -top-2 -right-2 text-yellow-400 text-xl" />
                  )}
                </div>

                <div className="flex-1 w-full space-y-4">
                  {/* Progress bar with 75% marker */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Progress toward 75% requirement</span>
                      <span className="text-xs text-gray-500 font-bold">{totalAttended} / {totalScheduled || "?"}</span>
                    </div>
                    <div className="relative w-full bg-gray-100 rounded-full h-5">
                      <div className={`h-5 rounded-full transition-all duration-700 ${getBarColor(overallPercent)}`}
                        style={{ width: `${Math.min(overallPercent, 100)}%` }} />
                      {/* 75% target line */}
                      <div className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: "75%" }}>
                        <div className="w-0.5 h-full bg-gray-600 opacity-50" />
                      </div>
                      {/* Percentage text inside bar */}
                      {overallPercent > 10 && (
                        <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                          {overallPercent}%
                        </span>
                      )}
                    </div>
                    <div className="relative mt-1">
                      <span className="absolute text-xs text-gray-500 font-semibold" style={{ left: "calc(75% - 24px)" }}>
                        75% ↑
                      </span>
                    </div>
                  </div>

                  {/* Status card */}
                  <div className={`mt-6 rounded-xl p-3 border-2 ${getStatusBg(overallPercent)}`}>
                    <div className="flex items-start gap-2">
                      {overallPercent >= 75
                        ? <FaMedal className="text-lg flex-shrink-0 mt-0.5" />
                        : <FaExclamationTriangle className="text-lg flex-shrink-0 mt-0.5" />}
                      <div>
                        <p className="font-bold text-sm">
                          {overallPercent >= 75
                            ? `Great! You're ${overallPercent - 75}% above requirement ✓`
                            : overallPercent >= 60
                            ? `Needs improvement — ${periodsNeededFor75()} more periods needed ⚠️`
                            : totalScheduled === 0
                            ? `No timetable data — contact HOD to set your schedule`
                            : `Critical — ${periodsNeededFor75()} more periods to avoid detention 🚨`}
                        </p>
                        {overallPercent < 75 && totalScheduled > 0 && (
                          <p className="text-xs mt-0.5 opacity-80">
                            Attend every class from now on to improve your percentage.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick stats row */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
                {[
                  { label: "Periods Attended", value: totalAttended,      color: "text-[#1E2A78]", bg: "bg-blue-50"   },
                  { label: "Total Scheduled",  value: totalScheduled||"—", color: "text-gray-700",  bg: "bg-gray-50"   },
                  { label: "Today's Periods",  value: todayPeriodsCount,  color: "text-green-600", bg: "bg-green-50"  },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ✅ Subject-wise Attendance with proper % bars */}
            {periodSummary.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-800 text-sm">Subject-wise Attendance</h2>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                    {preciseStats ? "Timetable-based %" : "From records"}
                  </span>
                </div>

                <div className="space-y-3.5">
                  {periodSummary.map(({ subject, attended, scheduled, percent, today: todayCount }) => (
                    <div key={subject}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-700 truncate flex-1 mr-2">{subject}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {todayCount > 0 && (
                            <span className="text-xs text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded-full">✓ Today</span>
                          )}
                          <span className={`text-xs font-black w-10 text-right ${getPercentColor(percent)}`}>
                            {scheduled > 0 ? `${percent}%` : `${attended}×`}
                          </span>
                          {scheduled > 0 && (
                            <span className="text-xs text-gray-400 w-14 text-right">{attended}/{scheduled}</span>
                          )}
                        </div>
                      </div>
                      <div className="relative w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div className={`h-2.5 rounded-full transition-all ${getBarColor(percent)}`}
                          style={{ width: `${Math.min(percent, 100)}%` }} />
                        {/* 75% target marker */}
                        <div className="absolute top-0 bottom-0 w-px bg-gray-500 opacity-40" style={{ left: "75%" }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-green-500 rounded-full inline-block" /> ≥75% Good</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-yellow-400 rounded-full inline-block" /> 60–74% Low</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-400 rounded-full inline-block" /> &lt;60% Critical</span>
                  <span className="flex items-center gap-1"><span className="w-px h-3 bg-gray-500 opacity-40 inline-block" /> 75% target</span>
                </div>
              </div>
            )}

            {/* Attendance Log */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800 text-sm">My Attendance Log</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{periodAttendance.length} records</span>
              </div>
              {loading ? (
                <p className="text-center py-8 text-gray-400 text-sm">Loading...</p>
              ) : periodAttendance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto border-separate border-spacing-y-1.5 text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                        <th className="text-left px-4 py-2.5 rounded-l-lg">Date</th>
                        <th className="text-left px-4 py-2.5">Subject / Period</th>
                        <th className="text-left px-4 py-2.5 rounded-r-lg">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodAttendance.slice(0, 40).map((log, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-2.5 font-medium text-gray-800">
                            {new Date(log.recognizedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{log.period}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">
                            {new Date(log.recognizedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {periodAttendance.length > 40 && (
                    <p className="text-center text-xs text-gray-400 mt-3">Showing 40 of {periodAttendance.length}</p>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-sm">No attendance records yet.</p>
                  <p className="text-gray-300 text-xs mt-1">Come during class hours and use the face recognition system.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ TIMETABLE TAB ══ */}
        {activeTab === "timetable" && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-sm">
                My Class Timetable
                {info?.className && <span className="ml-2 text-xs font-normal text-gray-400">— {info.className}</span>}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Semester {info?.semester || "—"} · {info?.course || "—"}</p>
            </div>

            {Object.keys(timetable).length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-400 text-sm">Timetable not configured for your class yet.</p>
                <p className="text-gray-300 text-xs mt-1">Contact your HOD to set up the timetable for {info?.className || "your class"}.</p>
              </div>
            ) : (
              <>
                {todaySlots.length > 0 && !isSunday && (
                  <div className="p-5 bg-blue-50 border-b border-blue-100">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">Today — {todayName}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {todaySlots.map((slot, i) => {
                        const p = periods[i];
                        const isNow = p && (() => {
                          const s = p.startHour * 60 + p.startMinute;
                          const e = p.endHour   * 60 + p.endMinute;
                          return currentTotalMin >= s && currentTotalMin < e;
                        })();
                        const markedToday = presentToday.some(l => l.period === slot.subject);
                        return (
                          <div key={i} className={`rounded-xl p-3 border-2 ${
                            isNow
                              ? "border-green-400 bg-green-50"
                              : "border-blue-200 bg-white"
                          }`}>
                            <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                              <span className="text-xs font-bold text-[#1E2A78]">P{i + 1}</span>
                              {p && <span className="text-xs text-gray-400 font-mono">{formatTime(p.startHour, p.startMinute)}</span>}
                              {isNow && <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">Now</span>}
                            </div>
                            <p className={`text-xs font-semibold leading-tight ${slot.subject ? "text-gray-800" : "text-gray-300"}`}>
                              {slot.subject || "Free"}
                            </p>
                            {slot.teacher && <p className="text-xs text-blue-500 mt-0.5">{slot.teacher}</p>}
                            {slot.room && <p className="text-xs text-gray-400 mt-0.5">{slot.room}</p>}
                            {markedToday && slot.subject && (
                              <span className="text-xs text-green-600 font-semibold bg-green-50 px-1.5 py-0.5 rounded-full mt-1 inline-block">✓ Marked</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-[#1E2A78]">
                        <th className="text-left px-4 py-3 text-white font-semibold w-20 sticky left-0 bg-[#1E2A78] z-10">Day</th>
                        {(activeSlotTimings.length > 0 ? activeSlotTimings : periods.map((p, i) => ({ ...p, index: i }))).map((p, i) => (
                          <th key={i} className="px-3 py-3 text-center text-white font-semibold whitespace-nowrap min-w-24">
                            P{p.index + 1}
                            <div className="text-white/80 text-xs font-semibold mt-0.5">{formatTime(p.startHour, p.startMinute)}</div>
                            <div className="text-white/50 text-xs font-normal">– {formatTime(p.endHour, p.endMinute)}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((day, di) => {
                        const daySlots    = timetable[day] || [];
                        const isToday     = day === todayName;
                        const slotsToShow = activeSlotTimings.length > 0
                          ? activeSlotTimings
                          : periods.map((p, i) => ({ ...p, index: i }));
                        return (
                          <tr key={day} className={`border-t border-gray-50 ${isToday ? "bg-blue-50/50" : di % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                            <td className={`px-4 py-3 font-bold text-xs whitespace-nowrap sticky left-0 z-10 ${isToday ? "text-[#1E2A78] bg-blue-50/80" : "text-gray-500 bg-inherit"}`}>
                              {day.slice(0, 3)}{isToday && <span className="ml-1 text-blue-500">●</span>}
                            </td>
                            {slotsToShow.map((p) => {
                              const slot   = daySlots[p.index] || {};
                              const isNow  = isToday && !isSunday && (() => {
                                const s = p.startHour * 60 + p.startMinute;
                                const e = p.endHour   * 60 + p.endMinute;
                                return currentTotalMin >= s && currentTotalMin < e;
                              })();
                              const marked = isToday && presentToday.some(l => l.period === slot.subject);
                              return (
                                <td key={p.index} className={`px-2 py-2 text-center ${isNow ? "bg-green-50" : ""}`}>
                                  {slot.subject ? (
                                    <div className={`rounded-lg px-2 py-1.5 border ${marked ? "bg-green-50 border-green-200" : isNow ? "bg-green-100 border-green-300" : "bg-white border-gray-200"}`}>
                                      <p className="font-semibold text-gray-700 text-xs leading-tight line-clamp-2">{slot.subject}</p>
                                      {slot.room && <p className="text-gray-400 text-xs mt-0.5">{slot.room}</p>}
                                      {marked && <p className="text-green-600 text-xs font-bold mt-0.5">✓</p>}
                                    </div>
                                  ) : <span className="text-gray-200">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ MY FACE TAB ══ */}
        {activeTab === "face" && <FaceManagement rollNumber={student?.rollNumber} />}

        {/* ══ CHANGE PASSWORD TAB ══ */}
        {activeTab === "password" && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-[#1E2A78] rounded-xl flex items-center justify-center">
                  <FaLock className="text-white text-lg" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-800 text-lg">Change Password</h2>
                  <p className="text-xs text-gray-400">Update your login password</p>
                </div>
              </div>
              {pwToast.msg && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium text-white ${pwToast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
                  {pwToast.type === "success"
                    ? <span className="flex items-center gap-2"><FaCheckCircle /> {pwToast.msg}</span>
                    : pwToast.msg}
                </div>
              )}
              <div className="space-y-4">
                {[
                  { field: "current", label: "Current Password", placeholder: "Enter current password" },
                  { field: "newPw",   label: "New Password",     placeholder: "Minimum 6 characters"    },
                  { field: "confirm", label: "Confirm Password", placeholder: "Retype new password"      },
                ].map(({ field, label, placeholder }) => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">{label}</label>
                    <input type="password" value={pwForm[field === "newPw" ? "newPw" : field]}
                      onChange={e => { setPwForm(f => ({ ...f, [field === "newPw" ? "newPw" : field]: e.target.value })); setPwErrors({}); }}
                      className={inputCls(field)} placeholder={placeholder} />
                    {pwErrors[field] && <p className="text-xs text-red-500 mt-1">{pwErrors[field]}</p>}
                  </div>
                ))}
                <button onClick={handleChangePassword} disabled={pwLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1E2A78] to-blue-600 text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-60">
                  {pwLoading ? "Changing..." : "Change Password"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default StudentDashboard;