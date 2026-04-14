import "./App.css";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch, FaTimes, FaCheckCircle, FaCalendarAlt,
  FaClipboardCheck, FaCamera, FaUserPlus
} from "react-icons/fa";
import { COURSES_BY_DEPARTMENT, getSemesters } from "./courses";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const TeacherDashboard = () => {
  const navigate    = useNavigate();
  const [teacherInfo, setTeacherInfo] = useState(() => JSON.parse(localStorage.getItem("teacherInfo") || "{}"));

  const [activeTab, setActiveTab]             = useState("timetable");
  const [students, setStudents]               = useState([]);
  const [attendance, setAttendance]           = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [teacherSchedule, setTeacherSchedule] = useState({});
  const [periods, setPeriods]                 = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [searchText, setSearchText]           = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentStats, setStudentStats]       = useState(null);
  const [toast, setToast]                     = useState({ msg: "", type: "" });
  const [manualForm, setManualForm]           = useState({
    rollNumber: "", name: "", period: "", recognizedAt: ""
  });
  const [manualLoading, setManualLoading]     = useState(false);

  // All unique subjects from teacher's timetable + profile
  const [allMySubjects, setAllMySubjects]     = useState([]);

  // Add student
  const [addStudentForm, setAddStudentForm]   = useState({
    name: "", rollNumber: "", age: "", course: "", semester: "", phone: "", email: "", password: ""
  });
  const [addStudentStep, setAddStudentStep]   = useState("form");
  const [captureCount, setCaptureCount]       = useState(0);
  const [addStudentLoading, setAddStudentLoading] = useState(false);
  const [addStudentErrors, setAddStudentErrors]   = useState({});
  const [derivedClassName, setDerivedClassName]   = useState("");
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  };

  const dept     = teacherInfo.department || "";
  const subjects = teacherInfo.subjects   || [];
  const classes  = teacherInfo.classes    || [];
  const deptCourses = COURSES_BY_DEPARTMENT[dept] || [];

  const fetchAll = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("teacherToken");
      let activeTeacher = teacherInfo;

      if (token) {
        const meRes = await fetch("http://localhost:5001/api/teacher/me", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (meRes.ok) {
          const freshTeacher = await meRes.json();
          localStorage.setItem("teacherInfo", JSON.stringify(freshTeacher));
          setTeacherInfo(freshTeacher);
          activeTeacher = freshTeacher;
        }
      }

      const deptValue = activeTeacher.department || dept;
      const allStudentsRes = await fetch(`http://localhost:5001/api/students?department=${encodeURIComponent(deptValue)}`);
      const allStudents    = await allStudentsRes.json();
      const myStudents     = Array.isArray(allStudents)
        ? allStudents.filter(s => (activeTeacher.classes || []).includes(s.className)) : [];
      setStudents(myStudents);

      const perRes  = await fetch("http://localhost:5001/api/periods");
      const perData = await perRes.json();
      setPeriods(Array.isArray(perData) ? perData : []);

      const ttRes  = await fetch(`http://localhost:5001/api/teacher-timetable/${encodeURIComponent(activeTeacher.name)}`);
      const ttData = await ttRes.json();
      const schedule = ttData?.schedule || {};
      setTeacherSchedule(schedule);

      const subjectsSet = new Set();
      const classesSet = new Set();
      Object.values(schedule).forEach(daySlots => {
        daySlots.forEach(slot => {
          if (slot.subject) subjectsSet.add(slot.subject);
          if (slot.className) classesSet.add(slot.className);
        });
      });
      const derivedSubjects = [...subjectsSet].sort();
      const derivedClasses = [...classesSet].sort();

      const updatedInfo = { ...activeTeacher, subjects: derivedSubjects, classes: derivedClasses };
      localStorage.setItem("teacherInfo", JSON.stringify(updatedInfo));
      setTeacherInfo(updatedInfo);

      setAllMySubjects(derivedSubjects);

      if (derivedSubjects.length > 0) {
        const attPromises = derivedSubjects.map(subject =>
          fetch(`http://localhost:5001/api/periodwise-attendance?period=${encodeURIComponent(subject)}&confirmed=true`)
            .then(r => r.json()).catch(() => [])
        );
        const attResults = await Promise.all(attPromises);
        const allAtt     = attResults.flat().filter(l => l?.rollNumber);
        const myRolls    = new Set(myStudents.map(s => s.rollNumber));
        setAttendance(allAtt.filter(l => myRolls.has(l.rollNumber)));
      } else {
        setAttendance([]);
      }

      await fetchTodayAttendance(activeTeacher, myStudents, derivedSubjects, attendanceDate);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const fetchTodayAttendance = async (activeTeacher = teacherInfo, myStudents = students, derivedSubjects = allMySubjects, date = attendanceDate) => {
    if (!activeTeacher.name) return;
    try {
      const query = [`department=${encodeURIComponent(activeTeacher.department || dept)}`];
      if (date) query.push(`date=${encodeURIComponent(date)}`);
      else query.push(`today=true`);
      const res = await fetch(`http://localhost:5001/api/periodwise-attendance?${query.join('&')}`);
      const logs = await res.json();
      if (!Array.isArray(logs)) {
        setTodayAttendance([]);
        return;
      }
      const allowedRolls = new Set(myStudents.map(s => s.rollNumber));
      const allowedSubjects = new Set(derivedSubjects);
      setTodayAttendance(logs.filter(log => allowedRolls.has(log.rollNumber) && allowedSubjects.has(log.period)));
    } catch (err) {
      console.error(err);
      setTodayAttendance([]);
    }
  };

  const confirmAttendance = async (logId) => {
    if (!teacherInfo.name) return;
    try {
      const res = await fetch(`http://localhost:5001/api/attendance/${logId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherName: teacherInfo.name })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
      } else {
        showToast(data.message || "Confirm failed", "error");
      }
      await fetchAll();
    } catch (err) {
      console.error(err);
      showToast("Failed to confirm attendance", "error");
    }
  };

  const confirmAllAttendance = async () => {
    if (!teacherInfo.name) return;
    try {
      const res = await fetch("http://localhost:5001/api/attendance/confirm-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherName: teacherInfo.name, date: attendanceDate })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
      } else {
        showToast(data.message || "Confirm all failed", "error");
      }
      await fetchAll();
    } catch (err) {
      console.error(err);
      showToast("Failed to confirm all attendance", "error");
    }
  };

  // Camera for face capture
  useEffect(() => {
    if (addStudentStep !== "face") return;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch { showToast("Camera access denied", "error"); }
    };
    start();
    return () => {
      if (videoRef.current?.srcObject)
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    };
  }, [addStudentStep]);

  const fetchStudentStats = async (rollNumber) => {
    try {
      const res  = await fetch(`http://localhost:5001/api/student/attendance-stats/${rollNumber}`);
      const data = await res.json();
      setStudentStats(data);
    } catch { setStudentStats(null); }
  };

  const today   = new Date().toLocaleDateString();
  // ✅ FIX: Use full English day name to match timetable keys
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const now       = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  // ✅ FIX: No classes on Sunday
  const isWeekend  = now.getDay() === 0; // Sunday = 0
  const todayPeriods = isWeekend ? [] : (teacherSchedule[todayName] || []);

  const getStudentPercent = (rollNumber) => {
    const logs = attendance.filter(l => l.rollNumber === rollNumber);
    if (!logs.length) return 0;
    const presentDays = new Set(logs.map(l => new Date(l.recognizedAt).toLocaleDateString())).size;
    const totalDays   = new Set(attendance.map(l => new Date(l.recognizedAt).toLocaleDateString())).size;
    return totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
  };

  const getTodayPeriods = (rollNumber) =>
    attendance.filter(l => l.rollNumber === rollNumber && new Date(l.recognizedAt).toLocaleDateString() === today).length;

  // ✅ FIX: Manual attendance — only assigned subjects, no time restriction
  const handleManualAttendance = async () => {
    const { rollNumber, period, recognizedAt } = manualForm;
    if (!rollNumber.trim()) return showToast("Roll number required", "error");
    if (!period)            return showToast("Select a subject/period", "error");

    // Check teacher is authorized for this subject
    if (!allMySubjects.includes(period)) {
      return showToast("You are not authorized to mark attendance for this subject", "error");
    }

    setManualLoading(true);
    try {
      const res  = await fetch("http://localhost:5001/api/periodwise-attendance", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          rollNumber: rollNumber.trim(),
          period,                                           // ✅ manual period — bypasses time check
          recognizedAt: recognizedAt || new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`✓ ${data.message}`, "success");
        setManualForm({ rollNumber: "", name: "", period: "", recognizedAt: "" });
        fetchAll();
      } else {
        showToast(data.message || "Failed to mark attendance", "error");
      }
    } catch { showToast("Server error. Is the backend running?", "error"); }
    setManualLoading(false);
  };

  // ── Add Student ────────────────────────────────────────────────
  const validateAddStudent = () => {
    const e = {};
    if (!addStudentForm.name.trim())       e.name       = "Required";
    if (!addStudentForm.rollNumber.trim()) e.rollNumber  = "Required";
    if (!addStudentForm.course)            e.course      = "Required";
    if (!addStudentForm.semester)          e.semester    = "Required";
    if (!addStudentForm.email.trim())      e.email       = "Required";
    if (!/\S+@\S+\.\S+/.test(addStudentForm.email)) e.email = "Invalid email";
    if (!addStudentForm.password)          e.password    = "Required";
    if (addStudentForm.password.length < 6) e.password  = "Min 6 chars";
    // Check className is in teacher's assigned classes
    const cn = `${addStudentForm.course} Sem ${addStudentForm.semester}`;
    if (addStudentForm.course && addStudentForm.semester && !classes.includes(cn)) {
      e.semester = `You can only add students to: ${classes.join(", ")}`;
    }
    setAddStudentErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAddStudentSave = async () => {
    if (!validateAddStudent()) return;
    const cn = `${addStudentForm.course} Sem ${addStudentForm.semester}`;
    setDerivedClassName(cn);
    setAddStudentLoading(true);
    try {
      const profileRes = await fetch("http://localhost:5001/api/students", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addStudentForm, department: dept, className: cn }),
      });
      const profileData = await profileRes.json();
      if (!profileRes.ok) {
        showToast(profileData.message, "error");
        if (profileData.message?.toLowerCase().includes("roll"))
          setAddStudentErrors(prev => ({ ...prev, rollNumber: profileData.message }));
        setAddStudentLoading(false); return;
      }
      const accRes = await fetch("http://localhost:5001/api/admin/create-student-account", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNumber: addStudentForm.rollNumber, password: addStudentForm.password }),
      });
      const accData = await accRes.json();
      if (accRes.ok) {
        showToast(`${addStudentForm.name} enrolled! Class: ${cn}`, "success");
        setAddStudentStep("face");
      } else {
        await fetch("http://localhost:5001/api/student/rollback", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rollNumber: addStudentForm.rollNumber }),
        });
        showToast(accData.message, "error");
      }
    } catch { showToast("Server error", "error"); }
    setAddStudentLoading(false);
  };

  const captureStudentFace = async () => {
    setAddStudentLoading(true);
    const canvas = canvasRef.current, video = videoRef.current;
    if (!canvas || !video) return;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg");
    try {
      const res = await fetch("http://localhost:5002/enroll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNumber: addStudentForm.rollNumber, image: imageData }),
      });
      const result = await res.json();
      if (!res.ok) { showToast(result.message, "error"); setAddStudentLoading(false); return; }
      const newCount = captureCount + 1;
      setCaptureCount(newCount);
      if (newCount >= 5) { showToast("All captures done!", "success"); setAddStudentStep("done"); }
      else showToast(`Photo ${newCount}/5 saved!`, "info");
    } catch { showToast("Cannot connect to face server (port 5002)", "error"); }
    setAddStudentLoading(false);
  };

  const resetAddStudent = () => {
    setAddStudentForm({ name: "", rollNumber: "", age: "", course: "", semester: "", phone: "", email: "", password: "" });
    setAddStudentStep("form"); setCaptureCount(0); setAddStudentErrors({}); setDerivedClassName("");
    fetchAll();
  };

  const filteredStudents = students.filter(s =>
    s.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    s.rollNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
    s.className?.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredAttendanceByDate = attendance.filter(l =>
    new Date(l.recognizedAt).toISOString().slice(0, 10) === attendanceDate
  );
  const attendanceDateLabel = attendanceDate === today ? "Present Today" : `Present ${attendanceDate}`;

  const pad = n => String(n).padStart(2, "0");
  const ic  = "w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-600 bg-gray-50";
  const eic = (f) => `w-full border-2 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-gray-50 ${addStudentErrors[f] ? "border-red-400 bg-red-50" : "border-gray-100 focus:border-green-600"}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {toast.msg && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
          toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-gray-800"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setSelectedStudent(null); setStudentStats(null); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl"><FaTimes /></button>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-green-700 flex items-center justify-center text-white font-black text-2xl">
                {selectedStudent.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-800">{selectedStudent.name}</h2>
                <p className="text-sm text-gray-500">{selectedStudent.rollNumber}</p>
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{selectedStudent.className}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[["Course", selectedStudent.course || "—"], ["Semester", selectedStudent.semester ? `Sem ${selectedStudent.semester}` : "—"], ["Phone", selectedStudent.phone || "—"], ["Email", selectedStudent.email || "—"]].map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{k}</p>
                  <p className="text-sm font-semibold text-gray-700 mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            {studentStats ? (
              <div className="bg-green-50 rounded-2xl p-4 mb-4">
                <h3 className="font-bold text-gray-800 text-sm mb-3">Attendance in Your Subjects</h3>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { val: `${studentStats.overallPercent}%`, label: "Overall", color: studentStats.overallPercent >= 75 ? "text-green-600" : studentStats.overallPercent >= 50 ? "text-yellow-600" : "text-red-500" },
                    { val: studentStats.totalAttended, label: "Attended", color: "text-[#1E2A78]" },
                    { val: studentStats.totalScheduled, label: "Scheduled", color: "text-gray-500" },
                  ].map(({ val, label, color }) => (
                    <div key={label} className="text-center">
                      <p className={`text-2xl font-black ${color}`}>{val}</p>
                      <p className="text-xs text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {Object.entries(studentStats.subjectStats || {})
                    .filter(([s]) => allMySubjects.includes(s))
                    .map(([subj, data]) => (
                      <div key={subj} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 flex-1 truncate">{subj}</span>
                        <div className="w-20 bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${data.percent >= 75 ? "bg-green-500" : data.percent >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                            style={{ width: `${data.percent}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-600 w-12 text-right">{data.attended}/{data.scheduled}</span>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <button onClick={() => fetchStudentStats(selectedStudent.rollNumber)}
                className="w-full mb-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition">
                Load Detailed Stats
              </button>
            )}
            <h3 className="font-bold text-gray-800 text-sm mb-2">Recent (last 8)</h3>
            <div className="space-y-1.5">
              {attendance.filter(l => l.rollNumber === selectedStudent.rollNumber).slice(0, 8).map((log, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-xs text-gray-700">{new Date(log.recognizedAt).toLocaleDateString("en-IN")}</span>
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{log.period}</span>
                  <span className="text-xs text-gray-400">{new Date(log.recognizedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-green-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-white font-black text-xs">TCH</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm">Teacher Portal</p>
            <p className="text-green-200 text-xs">{dept} Department</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/70 text-xs hidden sm:block">{teacherInfo.name}</span>
          <button onClick={() => { localStorage.removeItem("teacherToken"); localStorage.removeItem("teacherInfo"); navigate("/teacher-login"); }}
            className="px-3 py-1.5 text-xs bg-red-600/80 text-white rounded-lg hover:bg-red-700 transition font-medium">
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-green-700 px-6 pb-0 flex gap-1 border-t border-white/10 overflow-x-auto">
        {[
          { id: "timetable",  label: "My Timetable"   },
          { id: "today",      label: "Today's Classes" },
          { id: "attendance", label: "Attendance"      },
          { id: "manual",     label: "Mark Manual"     },
          { id: "students",   label: "My Students"     },
          { id: "addstudent", label: "Add Student"     },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition whitespace-nowrap ${
              activeTab === tab.id ? "bg-white text-green-700" : "text-white/70 hover:text-white hover:bg-white/10"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto p-5">

        {/* My info card */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-5 flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-700 flex items-center justify-center text-white font-black text-xl flex-shrink-0">
            {teacherInfo.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-gray-800">{teacherInfo.name}</p>
            <p className="text-xs text-gray-400">{dept} · @{teacherInfo.username}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {subjects.map(s => (
              <span key={s} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{s}</span>
            ))}
            {classes.map(c => (
              <span key={c} className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">{c}</span>
            ))}
          </div>
        </div>

        {/* ── MY TIMETABLE ── */}
        {activeTab === "timetable" && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-sm">My Weekly Timetable</h2>
              <p className="text-xs text-gray-400 mt-0.5">Auto-generated from HOD's class timetables · {dept}</p>
            </div>
            {periods.length > 0 && (
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {periods.map((p, i) => (
                    <span key={i} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded-lg font-mono">
                      P{i + 1}: {pad(p.startHour)}:{pad(p.startMinute)}–{pad(p.endHour)}:{pad(p.endMinute)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-green-700">
                    <th className="text-left px-4 py-3 text-white font-semibold w-28">Day</th>
                    {periods.map((p, i) => (
                      <th key={i} className="px-3 py-3 text-center text-white font-semibold whitespace-nowrap">
                        P{i + 1}
                        <div className="text-white/60 text-xs font-normal">{pad(p.startHour)}:{pad(p.startMinute)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day, di) => {
                    const daySlots = teacherSchedule[day] || [];
                    const isToday  = day === todayName;
                    return (
                      <tr key={day} className={`border-t border-gray-50 ${isToday ? "bg-green-50/50" : di % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                        <td className={`px-4 py-3 font-bold text-xs whitespace-nowrap ${isToday ? "text-green-700" : "text-gray-500"}`}>
                          {day.slice(0, 3)}{isToday && <span className="ml-1 text-green-600">●</span>}
                        </td>
                        {periods.map((p, i) => {
                          const slot     = daySlots.find(s => s.slotIndex === i);
                          const startMin = p.startHour * 60 + p.startMinute;
                          const endMin   = p.endHour   * 60 + p.endMinute;
                          const isNow    = isToday && !isWeekend && currentMin >= startMin && currentMin < endMin;
                          return (
                            <td key={i} className="px-2 py-2 text-center">
                              {slot ? (
                                <div className={`rounded-xl px-2 py-2 border ${isNow ? "bg-green-100 border-green-400" : "bg-white border-gray-200"}`}>
                                  <p className="font-bold text-gray-800 text-xs leading-tight">{slot.subject}</p>
                                  <p className="text-xs text-blue-600 mt-0.5">{slot.className}</p>
                                  {slot.room && <p className="text-xs text-gray-400">{slot.room}</p>}
                                  {isNow && <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold mt-1 inline-block">Now</span>}
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
            {!Object.values(teacherSchedule).some(d => d.length > 0) && (
              <div className="p-12 text-center">
                <FaCalendarAlt className="text-gray-300 text-4xl mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No classes assigned to you yet</p>
                <p className="text-gray-300 text-xs mt-1">Ask your HOD to build the timetable and assign you to classes</p>
              </div>
            )}
          </div>
        )}

        {/* ── TODAY'S CLASSES ── */}
        {activeTab === "today" && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-bold text-gray-800 text-sm mb-1">Today's Classes — {todayName}</h2>
            {/* ✅ FIX: Show Sunday message */}
            {isWeekend ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🏖️</div>
                <p className="text-gray-600 font-bold text-lg">Sunday — College Holiday</p>
                <p className="text-gray-400 text-sm mt-1">No classes today. See you Monday!</p>
              </div>
            ) : todayPeriods.length === 0 ? (
              <div className="text-center py-10">
                <FaCalendarAlt className="text-gray-300 text-4xl mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No classes scheduled for you today</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {todayPeriods.map((slot, i) => {
                  const p        = periods[slot.slotIndex];
                  const startMin = p ? p.startHour * 60 + p.startMinute : 0;
                  const endMin   = p ? p.endHour   * 60 + p.endMinute   : 0;
                  const isNow    = p && currentMin >= startMin && currentMin < endMin;
                  const isPast   = p && currentMin >= endMin;
                  const presentCount = new Set(
                    attendance.filter(l => l.period === slot.subject && new Date(l.recognizedAt).toLocaleDateString() === today).map(l => l.rollNumber)
                  ).size;
                  const classStudents = students.filter(s => s.className === slot.className).length;
                  return (
                    <div key={i} className={`rounded-2xl border-2 p-4 ${isNow ? "border-green-400 bg-green-50" : isPast ? "border-gray-200 bg-gray-50" : "border-blue-200 bg-white"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#1E2A78] bg-[#1E2A78]/10 px-2 py-0.5 rounded-lg">P{slot.slotIndex + 1}</span>
                        {isNow && <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">Now</span>}
                        {isPast && !isNow && <span className="text-xs text-gray-400">Done</span>}
                      </div>
                      <p className="font-black text-gray-800 text-sm">{slot.subject}</p>
                      <p className="text-xs text-blue-600 font-semibold mt-0.5">{slot.className}</p>
                      {slot.room && <p className="text-xs text-gray-400 mt-0.5">{slot.room}</p>}
                      {p && <p className="text-xs text-gray-500 font-mono mt-1">{pad(p.startHour)}:{pad(p.startMinute)} – {pad(p.endHour)}:{pad(p.endMinute)}</p>}
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                        <FaClipboardCheck className={`text-xs ${presentCount > 0 ? "text-green-500" : "text-gray-300"}`} />
                        <span className="text-xs text-gray-500">{presentCount}/{classStudents} present</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ATTENDANCE ── */}
        {activeTab === "attendance" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              {[
                { label: "My Students",   value: students.length, color: "text-[#1E2A78]" },
                { label: attendanceDateLabel, value: new Set(filteredAttendanceByDate.map(l => l.rollNumber)).size, color: "text-green-600" },
                { label: "Total Logs",    value: attendance.length, color: "text-blue-600" },
                { label: "My Subjects",   value: allMySubjects.length, color: "text-purple-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">{label}</p>
                  <p className={`text-3xl font-black ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-bold text-gray-800 text-sm">Attendance Verification</h2>
                  <p className="text-xs text-gray-400">Review and confirm attendance records for your students for the selected date.</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <label className="text-xs text-gray-500">Date</label>
                  <input type="date" value={attendanceDate}
                    onChange={e => { setAttendanceDate(e.target.value); fetchTodayAttendance(undefined, undefined, undefined, e.target.value); }}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-600 bg-white" />
                  <button onClick={() => setShowPendingOnly(prev => !prev)}
                    className={`px-4 py-2 rounded-xl border text-xs font-semibold transition ${showPendingOnly ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                    {showPendingOnly ? 'Showing pending only' : 'Show pending only'}
                  </button>
                  {todayAttendance.filter(log => !log.confirmed).length > 0 && (
                    <button onClick={confirmAllAttendance}
                      className="px-4 py-2 rounded-xl bg-green-700 text-white text-xs font-semibold hover:bg-green-800 transition">
                      Confirm all ({todayAttendance.filter(log => !log.confirmed).length})
                    </button>
                  )}
                </div>
              </div>

              {todayAttendance.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  No attendance records generated for today yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto border-separate border-spacing-y-1.5 text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                        <th className="text-left px-4 py-3">Name</th>
                        <th className="text-left px-4 py-3">Roll No</th>
                        <th className="text-left px-4 py-3">Subject</th>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="text-left px-4 py-3 rounded-r-lg">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayAttendance.filter(log => !showPendingOnly || !log.confirmed)
                      .map((log, i) => (
                        <tr key={log._id || i} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 font-medium text-gray-800">{log.name}</td>
                          <td className="px-4 py-3 text-xs font-mono text-gray-500">{log.rollNumber}</td>
                          <td className="px-4 py-3"><span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{log.period}</span></td>
                          <td className="px-4 py-3 text-xs">
                            {log.confirmed ? (
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">Confirmed</span>
                            ) : (
                              <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Pending</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {!log.confirmed ? (
                              <button onClick={() => confirmAttendance(log._id)}
                                className="px-3 py-1 rounded-xl bg-green-700 text-white font-semibold hover:bg-green-800 transition">
                                Confirm
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2 py-1 text-[11px] font-semibold">
                                Confirmed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <h2 className="font-bold text-gray-800 text-sm mb-4">Attendance by Subject — {attendanceDate}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {allMySubjects.map(subject => {
                  const count = new Set(filteredAttendanceByDate.filter(l => l.period === subject).map(l => l.rollNumber)).size;
                  return (
                    <div key={subject} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                      <p className="text-xs font-bold text-gray-600 leading-tight line-clamp-2 mb-1">{subject}</p>
                      <p className="text-2xl font-black text-green-700">{count}</p>
                      <p className="text-xs text-gray-400">present today</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-bold text-gray-800 text-sm mb-4">Recent Logs</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto border-separate border-spacing-y-1.5 text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3 rounded-l-lg">Name</th>
                      <th className="text-left px-4 py-3">Roll No</th>
                      <th className="text-left px-4 py-3">Subject</th>
                      <th className="text-left px-4 py-3 rounded-r-lg">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.slice(0, 20).map((log, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition cursor-pointer"
                        onClick={() => { const s = students.find(st => st.rollNumber === log.rollNumber); if (s) { setSelectedStudent(s); setStudentStats(null); } }}>
                        <td className="px-4 py-3 font-medium text-gray-800">{log.name}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">{log.rollNumber}</td>
                        <td className="px-4 py-3"><span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{log.period}</span></td>
                        <td className="px-4 py-3 text-xs text-gray-400">{new Date(log.recognizedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      </tr>
                    ))}
                    {!attendance.length && <tr><td colSpan="4" className="text-center py-10 text-gray-400 text-sm">No records yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── MANUAL MARK ── */}
        {activeTab === "manual" && (
          <div className="bg-white rounded-2xl shadow-sm p-5 max-w-md mx-auto">
            <h2 className="font-bold text-gray-800 text-sm mb-1">Mark Attendance Manually</h2>
            <p className="text-xs text-gray-400 mb-1">Only for your assigned subjects · No time restriction for manual entry</p>

            {/* Quick select from today's schedule */}
            {todayPeriods.length > 0 && !isWeekend && (
              <div className="bg-green-50 rounded-xl p-3 mb-4">
                <p className="text-xs font-bold text-green-700 mb-2">Today's Schedule (Quick Select)</p>
                <div className="flex flex-wrap gap-1">
                  {todayPeriods.map((slot, i) => (
                    <button key={i}
                      onClick={() => setManualForm(prev => ({ ...prev, period: slot.subject }))}
                      className={`text-xs px-2 py-1 rounded-full border font-medium transition ${
                        manualForm.period === slot.subject
                          ? "bg-green-700 text-white border-green-700"
                          : "bg-white text-green-700 border-green-300 hover:bg-green-100"
                      }`}>
                      P{slot.slotIndex + 1}: {slot.subject}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Roll Number</label>
                <input type="text" value={manualForm.rollNumber}
                  onChange={e => {
                    const val = e.target.value;
                    setManualForm(prev => ({ ...prev, rollNumber: val }));
                    const found = students.find(s => s.rollNumber === val.trim());
                    if (found) setManualForm(prev => ({ ...prev, rollNumber: val, name: found.name }));
                    else setManualForm(prev => ({ ...prev, rollNumber: val, name: "" }));
                  }}
                  className={ic} placeholder="Enter student roll number" />
                {manualForm.name && (
                  <p className="text-xs text-green-600 font-semibold mt-1 flex items-center gap-1">
                    <FaCheckCircle /> {manualForm.name}
                  </p>
                )}
                {manualForm.rollNumber && !manualForm.name && (
                  <p className="text-xs text-orange-500 mt-1">⚠ Roll number not found in your students</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Subject / Period</label>
                <select value={manualForm.period}
                  onChange={e => setManualForm({ ...manualForm, period: e.target.value })}
                  className={ic}>
                  <option value="">— Select your subject —</option>
                  {allMySubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {allMySubjects.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">
                    No subjects assigned yet. Ask your HOD to assign subjects and build the timetable.
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Date & Time (optional — defaults to now)</label>
                <input type="datetime-local" value={manualForm.recognizedAt}
                  onChange={e => setManualForm({ ...manualForm, recognizedAt: e.target.value })}
                  className={ic} />
              </div>
              <button onClick={handleManualAttendance} disabled={manualLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-green-700 to-green-600 text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-60">
                {manualLoading ? "Marking..." : "Mark Attendance"}
              </button>
            </div>
          </div>
        )}

        {/* ── MY STUDENTS ── */}
        {activeTab === "students" && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="font-bold text-gray-800 text-sm">My Students ({filteredStudents.length})</h2>
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                  className="border-2 border-gray-100 rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none focus:border-green-600 w-60"
                  placeholder="Search students..." />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border-separate border-spacing-y-1.5 text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 rounded-l-lg">Name</th>
                    <th className="text-left px-4 py-3">Roll No</th>
                    <th className="text-left px-4 py-3">Class</th>
                    <th className="text-left px-4 py-3">Attendance</th>
                    <th className="text-left px-4 py-3 rounded-r-lg">Today</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => {
                    const pct  = getStudentPercent(student.rollNumber);
                    const tPer = getTodayPeriods(student.rollNumber);
                    return (
                      <tr key={student._id} className="hover:bg-green-50 transition cursor-pointer"
                        onClick={() => { setSelectedStudent(student); setStudentStats(null); }}>
                        <td className="px-4 py-3 font-semibold text-gray-800">{student.name}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">{student.rollNumber}</td>
                        <td className="px-4 py-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">{student.className || "—"}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-xs font-semibold ${pct >= 75 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-500"}`}>{pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${tPer > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                            {tPer > 0 ? `✓ ${tPer}p` : "Absent"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredStudents.length && <tr><td colSpan="5" className="text-center py-10 text-gray-400 text-sm">No students in your assigned classes</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ADD STUDENT ── */}
        {activeTab === "addstudent" && (
          <div className="bg-white rounded-2xl shadow-sm p-6 max-w-2xl">
            <div className="flex items-center gap-2 mb-6">
              {[{ num: 1, label: "Details", step: "form" }, { num: 2, label: "Face", step: "face" }, { num: 3, label: "Done", step: "done" }].map((s, i) => {
                const order = { form: 1, face: 2, done: 3 };
                const curr  = order[addStudentStep];
                const active = order[s.step] <= curr;
                return (
                  <React.Fragment key={s.num}>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${active ? "bg-green-700 text-white" : "bg-gray-200 text-gray-400"}`}>
                        {curr > order[s.step] ? "✓" : s.num}
                      </div>
                      <span className={`text-xs font-semibold hidden sm:block ${active ? "text-green-700" : "text-gray-400"}`}>{s.label}</span>
                    </div>
                    {i < 2 && <div className={`flex-1 h-0.5 rounded ${curr > order[s.step] ? "bg-green-700" : "bg-gray-200"}`} />}
                  </React.Fragment>
                );
              })}
            </div>

            {addStudentStep === "form" && (
              <>
                <h2 className="font-bold text-gray-800 text-sm mb-1">Add New Student</h2>
                <p className="text-xs text-gray-400 mb-4">
                  Department: <strong>{dept}</strong> · You can add to: <strong>{classes.join(", ") || "No classes assigned yet"}</strong>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "name",       placeholder: "Full name",         type: "text"     },
                    { key: "rollNumber", placeholder: "Roll number",       type: "text"     },
                    { key: "age",        placeholder: "Age",               type: "number"   },
                    { key: "phone",      placeholder: "Phone",             type: "tel"      },
                    { key: "email",      placeholder: "Email (for login)", type: "email"    },
                    { key: "password",   placeholder: "Password (min 6)",  type: "password" },
                  ].map(({ key, placeholder, type }) => (
                    <div key={key}>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block capitalize">
                        {key.replace("rollNumber", "Roll Number")}
                      </label>
                      <input type={type} value={addStudentForm[key]}
                        onChange={e => { setAddStudentForm({ ...addStudentForm, [key]: e.target.value }); setAddStudentErrors(prev => ({ ...prev, [key]: "" })); }}
                        className={eic(key)} placeholder={placeholder} />
                      {addStudentErrors[key] && <p className="text-xs text-red-500 mt-1">{addStudentErrors[key]}</p>}
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Course</label>
                    <select value={addStudentForm.course}
                      onChange={e => setAddStudentForm({ ...addStudentForm, course: e.target.value, semester: "" })}
                      className={eic("course")}>
                      <option value="">Select course</option>
                      {deptCourses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {addStudentErrors.course && <p className="text-xs text-red-500 mt-1">{addStudentErrors.course}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Semester</label>
                    <select value={addStudentForm.semester}
                      onChange={e => setAddStudentForm({ ...addStudentForm, semester: e.target.value })}
                      className={eic("semester")} disabled={!addStudentForm.course}>
                      <option value="">{addStudentForm.course ? "Select semester" : "Select course first"}</option>
                      {(addStudentForm.course ? getSemesters(addStudentForm.course) : []).map(s => (
                        <option key={s} value={String(s)}>Semester {s}</option>
                      ))}
                    </select>
                    {addStudentErrors.semester && <p className="text-xs text-red-500 mt-1">{addStudentErrors.semester}</p>}
                  </div>

                  {addStudentForm.course && addStudentForm.semester && (
                    <div className="sm:col-span-2">
                      <div className={`border-2 rounded-xl p-3 flex items-center gap-3 ${
                        classes.includes(`${addStudentForm.course} Sem ${addStudentForm.semester}`)
                          ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                      }`}>
                        <span className="text-xl">{classes.includes(`${addStudentForm.course} Sem ${addStudentForm.semester}`) ? "✅" : "❌"}</span>
                        <div>
                          <p className={`text-xs font-semibold uppercase tracking-wide ${classes.includes(`${addStudentForm.course} Sem ${addStudentForm.semester}`) ? "text-green-600" : "text-red-600"}`}>
                            Class will be:
                          </p>
                          <p className={`text-lg font-black ${classes.includes(`${addStudentForm.course} Sem ${addStudentForm.semester}`) ? "text-green-700" : "text-red-700"}`}>
                            {addStudentForm.course} Sem {addStudentForm.semester}
                          </p>
                          {!classes.includes(`${addStudentForm.course} Sem ${addStudentForm.semester}`) && (
                            <p className="text-xs text-red-500 mt-0.5">You are not assigned to this class</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <button onClick={handleAddStudentSave} disabled={addStudentLoading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-green-700 to-green-600 text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                      <FaUserPlus />
                      {addStudentLoading ? "Saving..." : "Save & Continue to Face Capture →"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {addStudentStep === "face" && (
              <>
                <h2 className="font-bold text-gray-800 text-sm mb-1">Capture Face for {addStudentForm.name}</h2>
                <p className="text-xs text-gray-400 mb-4">Roll: {addStudentForm.rollNumber} · Class: {derivedClassName}</p>
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5"><span>Photos</span><span className="font-bold">{captureCount}/5</span></div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-green-600 transition-all" style={{ width: `${(captureCount / 5) * 100}%` }} />
                  </div>
                </div>
                <div className="bg-black rounded-2xl overflow-hidden mb-4" style={{ height: "260px" }}>
                  <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} width="640" height="480" className="hidden" />
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={captureStudentFace} disabled={addStudentLoading}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-green-700 to-green-600 text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50">
                    <FaCamera />
                    {addStudentLoading ? "Saving..." : `Take Photo ${captureCount + 1} of 5`}
                  </button>
                  <button onClick={() => setAddStudentStep("done")}
                    className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 text-sm font-medium">
                    Skip — enroll face later
                  </button>
                </div>
              </>
            )}

            {addStudentStep === "done" && (
              <div className="text-center py-6">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <FaCheckCircle className="text-green-600 text-4xl" />
                </div>
                <h2 className="text-xl font-black text-gray-800 mb-2">Student Added!</h2>
                <p className="text-sm text-gray-500 mb-1">{addStudentForm.name} enrolled in {dept}</p>
                <p className="text-xs text-green-700 font-bold mb-5">Class: {derivedClassName}</p>
                <button onClick={resetAddStudent}
                  className="w-full max-w-xs py-3 rounded-xl bg-gradient-to-r from-green-700 to-green-600 text-white font-bold text-sm hover:opacity-90 transition">
                  Add Another Student
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default TeacherDashboard;