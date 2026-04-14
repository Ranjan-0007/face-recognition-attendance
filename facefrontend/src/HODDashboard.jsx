import "./App.css";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus, FaTrash, FaEdit, FaSearch, FaBook,
  FaTimes, FaSave, FaExclamationTriangle, FaCamera,
  FaCheckCircle, FaUserPlus, FaCalendarAlt, FaClipboardList,
  FaChalkboardTeacher, FaExchangeAlt
} from "react-icons/fa";
import SubstituteManager from "./Substitutemanager";
import {
  COURSES_BY_DEPARTMENT, getSemesters,
  DEFAULT_SUBJECTS_BY_DEPARTMENT,
  CLASSES_BY_DEPARTMENT          // ✅ FIX: import this for timetable
} from "./courses";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function buildClassName(course, semester) {
  if (!course || !semester) return "";
  return `${course} Sem ${semester}`;
}

const HODDashboard = () => {
  const navigate = useNavigate();
  const hodInfo  = JSON.parse(localStorage.getItem("hodInfo") || "{}");
  const dept     = hodInfo.department || "";

  const [activeTab, setActiveTab]       = useState("overview");
  const [teachers, setTeachers]         = useState([]);
  const [students, setStudents]         = useState([]);
  const [attendance, setAttendance]     = useState([]);
  const [attendanceDate, setAttendanceDate] = useState("");
  const [attendanceDay, setAttendanceDay] = useState("All");
  const [deptSubjects, setDeptSubjects] = useState([]);
  const [periods, setPeriods]           = useState([]);
  const [selectedClass, setSelectedClass]       = useState("");
  const [currentTimetable, setCurrentTimetable] = useState({});
  const [allDeptTimetables, setAllDeptTimetables] = useState({});
  const [savingTT, setSavingTT]         = useState(false);
  const [clashWarning, setClashWarning] = useState("");
  const [toast, setToast]               = useState({ msg: "", type: "" });
  const [searchStudent, setSearchStudent]       = useState("");
  const [selectedStudent, setSelectedStudent]   = useState(null);
  const [studentStats, setStudentStats]         = useState(null);
  const [editTeacher, setEditTeacher]   = useState(null);
  const [newSubject, setNewSubject]     = useState("");
  const [teacherForm, setTeacherForm]   = useState({
    name: "", username: "", email: "", password: "", subjects: [], classes: []
  });

  // Add student
  const [addStudentForm, setAddStudentForm]   = useState({
    name: "", rollNumber: "", age: "", course: "",
    semester: "", phone: "", email: "", password: ""
  });
  const [addStudentStep, setAddStudentStep]   = useState("form");
  const [captureCount, setCaptureCount]       = useState(0);
  const [addStudentLoading, setAddStudentLoading] = useState(false);
  const [addStudentErrors, setAddStudentErrors]   = useState({});
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  // Delete attendance modal
  const [deleteAttModal, setDeleteAttModal] = useState(null);
  const [showSubstituteManager, setShowSubstituteManager] = useState(false);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  };

  // ✅ FIX: Use CLASSES_BY_DEPARTMENT from courses.js — NOT derived from enrolled students
  // This ensures HOD can create timetables for ALL classes in their dept, even with no students yet
  const deptClasses  = CLASSES_BY_DEPARTMENT[dept] || [];
  const deptCourses  = COURSES_BY_DEPARTMENT[dept] || [];

  const fetchAll = async () => {
    try {
      const [teachRes, studRes, attRes, subjRes, perRes, ttRes] = await Promise.all([
        fetch(`http://localhost:5001/api/hod/teachers?department=${encodeURIComponent(dept)}`),
        fetch(`http://localhost:5001/api/students?department=${encodeURIComponent(dept)}`),
        fetch(`http://localhost:5001/api/periodwise-attendance?department=${encodeURIComponent(dept)}`),
        fetch(`http://localhost:5001/api/dept-subjects/${encodeURIComponent(dept)}`),
        fetch(`http://localhost:5001/api/periods`),
        fetch(`http://localhost:5001/api/timetables?department=${encodeURIComponent(dept)}`),
      ]);
      const [teachData, studData, attData, subjData, perData, ttData] = await Promise.all([
        teachRes.json(), studRes.json(), attRes.json(), subjRes.json(), perRes.json(), ttRes.json()
      ]);
      setStudents(Array.isArray(studData)  ? studData  : []);
      setAttendance(Array.isArray(attData) ? attData   : []);
      setPeriods(Array.isArray(perData)    ? perData   : []);
      if (subjData?.isDefault || !subjData?.subjects?.length) {
        setDeptSubjects(DEFAULT_SUBJECTS_BY_DEPARTMENT[dept] || []);
      } else {
        setDeptSubjects(subjData.subjects || []);
      }

      // ✅ Derive subjects/classes for each teacher from timetables
      const timetables = Array.isArray(ttData) ? ttData : [];
      const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      const teachersWithDerived = (Array.isArray(teachData) ? teachData : []).map(teacher => {
        const subjectsSet = new Set();
        const classesSet = new Set();
        timetables.forEach(tt => {
          DAYS.forEach(day => {
            const daySlots = tt.slots?.[day] || [];
            daySlots.forEach(slot => {
              if (slot?.teacher === teacher.name && slot.subject) {
                subjectsSet.add(slot.subject);
                classesSet.add(tt.className);
              }
            });
          });
        });
        return {
          ...teacher,
          subjects: [...subjectsSet].sort(),
          classes: [...classesSet].sort()
        };
      });
      setTeachers(teachersWithDerived);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { if (dept) fetchAll(); }, []);

  // ✅ Fetch all department timetables for SubstituteManager
  const fetchAllDeptTimetables = async () => {
    try {
      const ttData = {};
      for (const cls of deptClasses) {
        const res = await fetch(`http://localhost:5001/api/timetable/${encodeURIComponent(cls)}`);
        const data = await res.json();
        if (data?.slots) ttData[cls] = data.slots;
      }
      setAllDeptTimetables(ttData);
    } catch { console.error("Failed to fetch department timetables"); }
  };

  useEffect(() => { if (deptClasses.length) fetchAllDeptTimetables(); }, [deptClasses]);

  // Load timetable when class selected
  useEffect(() => {
    if (!selectedClass || !periods.length) return;
    const fetchTT = async () => {
      try {
        const res  = await fetch(`http://localhost:5001/api/timetable/${encodeURIComponent(selectedClass)}`);
        const data = await res.json();
        if (data?.slots && Object.keys(data.slots).length > 0) {
          // Ensure every day has the right number of slots
          const normalised = {};
          DAYS.forEach(day => {
            const existing = data.slots[day] || [];
            normalised[day] = periods.map((_, i) => existing[i] || { slot: i, subject: "", teacher: "", room: "" });
          });
          setCurrentTimetable(normalised);
        } else {
          const empty = {};
          DAYS.forEach(day => { empty[day] = periods.map((_, i) => ({ slot: i, subject: "", teacher: "", room: "" })); });
          setCurrentTimetable(empty);
        }
      } catch {
        const empty = {};
        DAYS.forEach(day => { empty[day] = periods.map((_, i) => ({ slot: i, subject: "", teacher: "", room: "" })); });
        setCurrentTimetable(empty);
      }
    };
    fetchTT();
    setClashWarning("");
  }, [selectedClass, periods]);

  // Camera for face capture
  useEffect(() => {
    if (addStudentStep !== "face") return;
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
  }, [addStudentStep]);

  const today = new Date().toLocaleDateString();

  const fetchStudentStats = async (rollNumber) => {
    try {
      const res  = await fetch(`http://localhost:5001/api/student/attendance-stats/${rollNumber}`);
      const data = await res.json();
      setStudentStats(data);
    } catch { setStudentStats(null); }
  };

  // ── Timetable editor ──────────────────────────────────────────
  const updateSlot = async (day, slotIndex, field, value) => {
    setCurrentTimetable(prev => ({
      ...prev,
      [day]: (prev[day] || []).map((s, i) => i === slotIndex ? { ...s, [field]: value } : s)
    }));
    if (field === "teacher" && value.trim()) {
      setClashWarning("");
      try {
        const res = await fetch("http://localhost:5001/api/timetable/check-clash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacherName: value, day, slotIndex, excludeClassName: selectedClass }),
        });
        const data = await res.json();
        if (data.clash) setClashWarning(`⚠️ ${data.message}`);
      } catch { /* silent */ }
    }
  };

  const clearDay = (day) => {
    setCurrentTimetable(prev => ({
      ...prev,
      [day]: periods.map((_, i) => ({ slot: i, subject: "", teacher: "", room: "" }))
    }));
  };

  const copyDayToAll = (fromDay) => {
    setCurrentTimetable(prev => {
      const newTT = { ...prev };
      DAYS.forEach(day => { if (day !== fromDay) newTT[day] = (prev[fromDay] || []).map(s => ({ ...s })); });
      return newTT;
    });
    showToast(`Copied ${fromDay} to all days`, "success");
  };

  const saveTimetable = async () => {
    if (!selectedClass)   return showToast("Select a class first", "error");
    if (clashWarning)     return showToast("Fix teacher clash before saving", "error");
    if (!periods.length)  return showToast("Admin must configure period time-slots first", "error");
    setSavingTT(true);
    try {
      const res = await fetch("http://localhost:5001/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ className: selectedClass, department: dept, slots: currentTimetable, createdByHOD: hodInfo.username }),
      });
      const data = await res.json();
      if (res.ok) showToast(`Timetable saved for ${selectedClass}!`, "success");
      else        showToast(data.message, "error");
    } catch { showToast("Server error", "error"); }
    setSavingTT(false);
  };

  // ── Subjects ──────────────────────────────────────────────────
  const handleAddSubject = async () => {
    if (!newSubject.trim()) return;
    const updated = [...new Set([...deptSubjects, newSubject.trim()])];
    try {
      await fetch("http://localhost:5001/api/dept-subjects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: dept, subjects: updated }),
      });
      setDeptSubjects(updated); setNewSubject(""); showToast("Subject added!", "success");
    } catch { showToast("Server error", "error"); }
  };

  const handleRemoveSubject = async (subject) => {
    const updated = deptSubjects.filter(s => s !== subject);
    await fetch("http://localhost:5001/api/dept-subjects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department: dept, subjects: updated }),
    });
    setDeptSubjects(updated);
  };

  // ── Teachers ──────────────────────────────────────────────────
  const handleCreateTeacher = async () => {
    const { name, username, email, password } = teacherForm;
    if (!name || !username || !email || !password) { showToast("All fields required", "error"); return; }
    try {
      const res  = await fetch("http://localhost:5001/api/hod/create-teacher", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, email, password, department: dept, createdBy: hodInfo.username }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setTeacherForm({ name: "", username: "", email: "", password: "", subjects: [], classes: [] });
        fetchAll();
      } else showToast(data.message, "error");
    } catch { showToast("Server error", "error"); }
  };

  const handleUpdateTeacher = async () => {
    if (!editTeacher) return;
    try {
      const res  = await fetch(`http://localhost:5001/api/hod/teachers/${editTeacher._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editTeacher.name }),
      });
      const data = await res.json();
      if (res.ok) { showToast(data.message, "success"); setEditTeacher(null); fetchAll(); }
      else showToast(data.message, "error");
    } catch { showToast("Server error", "error"); }
  };

  // ── Delete Student ────────────────────────────────────────────
  const handleDeleteStudent = async (rollNumber, name) => {
    if (!window.confirm(`Delete student ${name}? This cannot be undone.`)) return;
    try {
      const res  = await fetch(`http://localhost:5001/api/students/${encodeURIComponent(rollNumber)}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setSelectedStudent(null); setStudentStats(null);
        fetchAll();
      } else showToast(data.message, "error");
    } catch { showToast("Server error", "error"); }
  };

  // ── Delete Today's Attendance ─────────────────────────────────
  const handleDeleteTodayAttendance = async (rollNumber) => {
    try {
      const res  = await fetch(`http://localhost:5001/api/attendance/student/${encodeURIComponent(rollNumber)}/today`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setDeleteAttModal(null);
        fetchAll();
      } else showToast(data.message, "error");
    } catch { showToast("Server error", "error"); }
  };

  // ── Add Student ───────────────────────────────────────────────
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
    setAddStudentErrors(e);
    return Object.keys(e).length === 0;
  };

  const derivedClassName = buildClassName(addStudentForm.course, addStudentForm.semester);

  const handleAddStudentSave = async () => {
    if (!validateAddStudent()) return;
    if (addStudentErrors.rollNumber) { showToast("Fix errors before saving", "error"); return; }
    setAddStudentLoading(true);
    try {
      const profileRes = await fetch("http://localhost:5001/api/students", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addStudentForm, department: dept, className: derivedClassName }),
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
        showToast(`${addStudentForm.name} enrolled! Class: ${derivedClassName}`, "success");
        setAddStudentStep("face");
      } else {
        // Rollback student profile
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
    setAddStudentStep("form"); setCaptureCount(0); setAddStudentErrors({});
    fetchAll();
  };

  const getStudentPercent = (rollNumber) => {
    const logs = attendance.filter(l => l.rollNumber === rollNumber);
    if (!logs.length) return 0;
    const presentDays = new Set(logs.map(l => new Date(l.recognizedAt).toLocaleDateString())).size;
    const totalDays   = new Set(attendance.map(l => new Date(l.recognizedAt).toLocaleDateString())).size;
    return totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
  };

  const getTodayPeriodsCount = (rollNumber) =>
    attendance.filter(l => l.rollNumber === rollNumber && new Date(l.recognizedAt).toLocaleDateString() === today).length;

  const filteredStudents = students.filter(s =>
    s.name?.toLowerCase().includes(searchStudent.toLowerCase()) ||
    s.rollNumber?.toLowerCase().includes(searchStudent.toLowerCase())
  );

  const pad = n => String(n).padStart(2, "0");
  const ic  = "w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E2A78] bg-gray-50";
  const eic = (f) => `w-full border-2 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-gray-50 ${addStudentErrors[f] ? "border-red-400 bg-red-50" : "border-gray-100 focus:border-[#1E2A78]"}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {toast.msg && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-xs ${
          toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-[#1E2A78]"
        }`}>{toast.msg}</div>
      )}

      {/* Delete Attendance Modal */}
      {deleteAttModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaTrash className="text-orange-500 text-xl" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Delete Today's Attendance?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Delete all attendance records for <strong>{deleteAttModal.name}</strong> recorded today?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteAttModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm">Cancel</button>
              <button onClick={() => handleDeleteTodayAttendance(deleteAttModal.rollNumber)}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setSelectedStudent(null); setStudentStats(null); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl"><FaTimes /></button>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-[#1E2A78] flex items-center justify-center text-white font-black text-2xl">
                {selectedStudent.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-800">{selectedStudent.name}</h2>
                <p className="text-sm text-gray-500">{selectedStudent.rollNumber}</p>
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{selectedStudent.className}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                ["Course",   selectedStudent.course   || "—"],
                ["Semester", selectedStudent.semester  ? `Sem ${selectedStudent.semester}` : "—"],
                ["Phone",    selectedStudent.phone    || "—"],
                ["Email",    selectedStudent.email    || "—"],
                ["Age",      selectedStudent.age      || "—"],
                ["Enrolled", new Date(selectedStudent.enrolledAt).toLocaleDateString("en-IN", { day:"numeric",month:"short",year:"numeric" })],
              ].map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{k}</p>
                  <p className="text-sm font-semibold text-gray-700 mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            {studentStats ? (
              <div className="bg-[#1E2A78]/5 rounded-2xl p-4 mb-4">
                <h3 className="font-bold text-gray-800 text-sm mb-3">Attendance Stats (Precise)</h3>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { val: `${studentStats.overallPercent}%`, label: "Overall", color: studentStats.overallPercent >= 75 ? "text-green-600" : studentStats.overallPercent >= 50 ? "text-yellow-600" : "text-red-500" },
                    { val: studentStats.totalAttended, label: "Attended", color: "text-[#1E2A78]" },
                    { val: studentStats.totalScheduled, label: "Scheduled", color: "text-gray-600" },
                  ].map(({ val, label, color }) => (
                    <div key={label} className="text-center">
                      <p className={`text-2xl font-black ${color}`}>{val}</p>
                      <p className="text-xs text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {Object.entries(studentStats.subjectStats || {}).map(([subj, data]) => (
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
                className="w-full mb-4 py-2.5 rounded-xl bg-[#1E2A78] text-white text-sm font-semibold">
                Load Detailed Stats
              </button>
            )}
            <h3 className="font-bold text-gray-800 text-sm mb-2">Recent (last 10)</h3>
            <div className="space-y-1.5 mb-4">
              {attendance.filter(l => l.rollNumber === selectedStudent.rollNumber).slice(0, 10).map((log, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-xs text-gray-600">{new Date(log.recognizedAt).toLocaleDateString("en-IN")}</span>
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{log.period}</span>
                  <span className="text-xs text-gray-400">{new Date(log.recognizedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
            {/* HOD Actions */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setDeleteAttModal({ rollNumber: selectedStudent.rollNumber, name: selectedStudent.name })}
                className="flex-1 py-2 rounded-xl bg-orange-100 text-orange-700 text-xs font-semibold hover:bg-orange-200 transition">
                🗓 Delete Today's Attendance
              </button>
              <button onClick={() => handleDeleteStudent(selectedStudent.rollNumber, selectedStudent.name)}
                className="flex-1 py-2 rounded-xl bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 transition">
                🗑 Delete Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {editTeacher && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Edit Teacher — {editTeacher.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Name</label>
                <input type="text" value={editTeacher.name}
                  onChange={e => setEditTeacher({ ...editTeacher, name: e.target.value })}
                  className={ic} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  Auto-Detected Subjects (from Timetable)
                </label>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  {editTeacher.subjects?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {editTeacher.subjects.map(s => (
                        <span key={s} className="bg-[#1E2A78] text-white text-xs px-2 py-1 rounded-full font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No subjects assigned yet</p>
                  )}
                  <p className="text-xs text-gray-600 mt-2">
                    📅 Subjects are automatically detected from the timetable. Assign this teacher to periods in the <strong>Timetable tab</strong> to update.
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  Auto-Detected Classes (from Timetable)
                </label>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  {editTeacher.classes?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {editTeacher.classes.map(c => (
                        <span key={c} className="bg-green-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No classes assigned yet</p>
                  )}
                  <p className="text-xs text-gray-600 mt-2">
                    📅 Classes are automatically detected from the timetable. Assign this teacher to periods in the <strong>Timetable tab</strong> to update.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditTeacher(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm">Cancel</button>
              <button onClick={handleUpdateTeacher}
                className="flex-1 py-2.5 rounded-xl bg-[#1E2A78] text-white font-bold text-sm">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#1E2A78] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-white font-black text-sm">HOD</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm">HOD Portal</p>
            <p className="text-blue-300 text-xs">{dept} Department</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/70 text-xs hidden sm:block">Welcome, {hodInfo.name}</span>
          <button onClick={() => { localStorage.removeItem("hodToken"); localStorage.removeItem("hodInfo"); navigate("/hod-login"); }}
            className="px-3 py-1.5 text-xs bg-red-600/80 text-white rounded-lg hover:bg-red-700 transition font-medium">
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-[#1E2A78] px-6 pb-0 flex gap-1 border-t border-white/10 overflow-x-auto">
        {[
          { id: "overview",   label: "Overview"    },
          { id: "timetable",  label: "Timetable"   },
          { id: "teachers",   label: "Teachers"    },
          { id: "students",   label: "Students"    },
          { id: "addstudent", label: "Add Student" },
          { id: "subjects",   label: "Subjects"    },
          { id: "attendance", label: "Attendance"  },
          { id: "substitutes", label: "Substitutes" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition whitespace-nowrap ${
              activeTab === tab.id ? "bg-white text-[#1E2A78]" : "text-white/70 hover:text-white hover:bg-white/10"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-6xl mx-auto p-5">

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              {[
                { label: "Teachers", value: teachers.length, color: "text-[#1E2A78]" },
                { label: "Students", value: students.length, color: "text-green-600" },
                { label: "Today Present", value: new Set(attendance.filter(l => new Date(l.recognizedAt).toLocaleDateString() === today).map(l => l.rollNumber)).size, color: "text-blue-600" },
                { label: "Subjects", value: deptSubjects.length, color: "text-purple-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-2xl p-5 shadow-sm">
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">{label}</p>
                  <p className={`text-4xl font-black ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-[#1E2A78] to-blue-600 rounded-2xl p-5 mb-5 text-white">
              <h2 className="font-bold text-sm mb-3">Your Department Authority ({dept})</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: "📅", label: "Set Timetables", desc: "For all dept classes" },
                  { icon: "👨‍🏫", label: "Manage Teachers", desc: "Create, edit, assign" },
                  { icon: "👤", label: "Add Students", desc: "Enroll with face" },
                  { icon: "📊", label: "Attendance", desc: "Delete if wrong" },
                ].map(({ icon, label, desc }) => (
                  <div key={label} className="bg-white/10 rounded-xl p-3">
                    <div className="text-xl mb-1">{icon}</div>
                    <p className="text-xs font-bold">{label}</p>
                    <p className="text-xs text-white/60 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-bold text-gray-800 text-sm mb-4">Today's Attendance by Class</h2>
              {deptClasses.length > 0 ? (
                <div className="space-y-2">
                  {deptClasses.map(cls => {
                    const clsStudents = students.filter(s => s.className === cls);
                    const clsPresent  = new Set(attendance.filter(l => l.className === cls && new Date(l.recognizedAt).toLocaleDateString() === today).map(l => l.rollNumber)).size;
                    const pct = clsStudents.length > 0 ? Math.round((clsPresent / clsStudents.length) * 100) : 0;
                    return (
                      <div key={cls} className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-gray-600 w-44 flex-shrink-0 truncate">{cls}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all ${pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-28 text-right flex-shrink-0">
                          {clsPresent}/{clsStudents.length} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-4">No classes configured for {dept}</p>
              )}
            </div>
          </>
        )}

        {/* ── TIMETABLE EDITOR ── */}
        {activeTab === "timetable" && (
          <>
            {periods.length === 0 && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
                <FaExclamationTriangle className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-800 text-sm">⏰ No Period Time-Slots Yet</p>
                  <p className="text-amber-700 text-xs mt-0.5">
                    The admin needs to configure period start/end times first (Period Settings). Once done, you can build timetables here.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <h2 className="font-bold text-gray-800 text-sm mb-1">Select Class to Edit Timetable</h2>
              <p className="text-xs text-gray-400 mb-3">
                All {dept} classes shown below — select one to set its weekly schedule.
                Attendance will be automatically recorded based on this timetable.
              </p>
              {/* ✅ FIX: Shows ALL dept classes from courses.js */}
              <div className="flex flex-wrap gap-2 mb-3">
                {deptClasses.map(c => (
                  <button key={c} onClick={() => setSelectedClass(c)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      selectedClass === c ? "bg-[#1E2A78] text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {c}
                  </button>
                ))}
                {deptClasses.length === 0 && (
                  <p className="text-xs text-gray-400">No classes found for {dept} department.</p>
                )}
              </div>

              {periods.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400 font-semibold w-full mb-1">Time slots (configured by admin):</span>
                  {periods.map((p, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-mono">
                      P{i + 1}: {pad(p.startHour)}:{pad(p.startMinute)}–{pad(p.endHour)}:{pad(p.endMinute)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {clashWarning && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
                <FaExclamationTriangle className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-700 text-sm">Teacher Clash Detected</p>
                  <p className="text-red-600 text-xs mt-0.5">{clashWarning}</p>
                  <p className="text-red-500 text-xs mt-1">This teacher is already booked at this time for another class. Choose a different teacher.</p>
                </div>
              </div>
            )}

            {!selectedClass ? (
              <div className="bg-white rounded-2xl p-12 text-center">
                <div className="text-5xl mb-4">📅</div>
                <p className="text-gray-500 font-semibold">Select a class above to edit its timetable</p>
                <p className="text-gray-400 text-xs mt-1">All {deptClasses.length} classes in {dept} are available</p>
              </div>
            ) : periods.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center">
                <div className="text-5xl mb-4">⏰</div>
                <p className="text-gray-400 text-sm">Period time-slots must be configured by admin first</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {DAYS.map(day => (
                    <div key={day} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      <div className="bg-[#1E2A78] px-5 py-3 flex items-center justify-between">
                        <h3 className="font-bold text-white text-sm">{day}</h3>
                        <div className="flex gap-2">
                          <button onClick={() => copyDayToAll(day)}
                            className="text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition">
                            Copy to all
                          </button>
                          <button onClick={() => clearDay(day)}
                            className="text-xs text-red-300 hover:text-white bg-white/10 hover:bg-red-500/40 px-3 py-1.5 rounded-lg transition">
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {(currentTimetable[day] || periods.map((_, i) => ({ slot: i, subject: "", teacher: "", room: "" }))).map((slot, i) => {
                          const p = periods[i];
                          return (
                            <div key={i} className={`border-2 rounded-xl p-3 transition ${
                              slot.subject ? "border-[#1E2A78]/20 bg-blue-50/40" : "border-dashed border-gray-200 bg-gray-50/40"
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-[#1E2A78] bg-[#1E2A78]/10 px-2 py-0.5 rounded-lg">P{i + 1}</span>
                                {p && <span className="text-xs text-gray-400 font-mono">{pad(p.startHour)}:{pad(p.startMinute)}</span>}
                              </div>
                              {/* Subject dropdown — from dept subjects */}
                              <select value={slot.subject || ""} onChange={e => updateSlot(day, i, "subject", e.target.value)}
                                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1E2A78] bg-white mb-1.5">
                                <option value="">— Free / No Class —</option>
                                {deptSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              {/* Teacher dropdown — from dept teachers */}
                              <select value={slot.teacher || ""} onChange={e => updateSlot(day, i, "teacher", e.target.value)}
                                className={`w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none bg-white mb-1.5 ${
                                  slot.teacher && clashWarning.includes(slot.teacher) ? "border-red-400" : "border-gray-200 focus:border-[#1E2A78]"
                                }`}>
                                <option value="">— No teacher —</option>
                                {teachers.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                              </select>
                              <input type="text" value={slot.room || ""} onChange={e => updateSlot(day, i, "room", e.target.value)}
                                placeholder="Room (e.g. CR-101)"
                                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1E2A78] bg-white" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={saveTimetable} disabled={savingTT || !!clashWarning}
                  className="w-full mt-4 py-4 bg-gradient-to-r from-[#1E2A78] to-blue-600 text-white rounded-2xl font-bold text-sm hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                  <FaSave />
                  {savingTT ? "Saving..." : `Save Timetable for ${selectedClass}`}
                </button>
              </>
            )}
          </>
        )}

        {/* ── TEACHERS ── */}
        {activeTab === "teachers" && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <h2 className="font-bold text-gray-800 text-sm mb-4">Add New Teacher Account</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {[
                  { key: "name",     placeholder: "Full name",         type: "text"     },
                  { key: "username", placeholder: "Username",          type: "text"     },
                  { key: "email",    placeholder: "Email address",     type: "email"    },
                  { key: "password", placeholder: "Password (min 6)",  type: "password" },
                ].map(({ key, placeholder, type }) => (
                  <input key={key} type={type} value={teacherForm[key]}
                    onChange={e => setTeacherForm({ ...teacherForm, [key]: e.target.value })}
                    className={ic} placeholder={placeholder} />
                ))}
                <div className="sm:col-span-2">
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <span className="text-2xl">📅</span>
                    <div>
                      <p className="text-sm font-bold text-blue-800">Assignments are automatic from Timetable</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Just create the account — subjects and classes will be auto-detected from the timetable when you assign this teacher to periods in the Timetable tab. No manual selection needed here.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={handleCreateTeacher}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1E2A78] to-blue-600 text-white font-bold text-sm hover:opacity-90 transition">
                <FaPlus className="inline mr-2" />Create Teacher Account
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-bold text-gray-800 text-sm mb-4">
                All Teachers — {dept} ({teachers.length})
              </h2>
              <div className="space-y-3">
                {teachers.map(t => (
                  <div key={t._id} className="border-2 border-gray-100 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#1E2A78] flex items-center justify-center text-white font-black">
                          {t.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{t.name}</p>
                          <p className="text-xs text-gray-400">{t.email} · @{t.username}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => setEditTeacher({ ...t })}
                          className="p-2 rounded-lg text-blue-500 hover:bg-blue-50"><FaEdit size={13} /></button>
                        <button onClick={async () => {
                          if (!window.confirm(`Delete teacher ${t.name}?`)) return;
                          await fetch(`http://localhost:5001/api/hod/teachers/${t._id}`, { method: "DELETE" });
                          showToast("Teacher deleted", "success"); fetchAll();
                        }} className="p-2 rounded-lg text-red-500 hover:bg-red-50"><FaTrash size={13} /></button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {t.subjects?.map(s => (
                        <span key={s} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{s}</span>
                      ))}
                      {t.classes?.map(c => (
                        <span key={c} className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">{c}</span>
                      ))}
                      {!t.subjects?.length && !t.classes?.length && (
                        <span className="text-xs text-gray-300">No subjects or classes assigned</span>
                      )}
                    </div>
                  </div>
                ))}
                {!teachers.length && <p className="text-center py-8 text-gray-400 text-sm">No teachers added yet. Create one above.</p>}
              </div>
            </div>
          </>
        )}

        {/* ── STUDENTS ── */}
        {activeTab === "students" && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="font-bold text-gray-800 text-sm">{dept} Students ({filteredStudents.length})</h2>
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                <input type="text" value={searchStudent} onChange={e => setSearchStudent(e.target.value)}
                  className="border-2 border-gray-100 rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none focus:border-[#1E2A78] w-64"
                  placeholder="Search by name or roll number..." />
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
                    const tPer = getTodayPeriodsCount(student.rollNumber);
                    return (
                      <tr key={student._id} className="hover:bg-blue-50 transition cursor-pointer"
                        onClick={() => { setSelectedStudent(student); setStudentStats(null); }}>
                        <td className="px-4 py-3 font-semibold text-gray-800">{student.name}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">{student.rollNumber}</td>
                        <td className="px-4 py-3">
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">{student.className || "—"}</span>
                        </td>
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
                  {!filteredStudents.length && (
                    <tr><td colSpan="5" className="text-center py-10 text-gray-400 text-sm">No students found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ADD STUDENT ── */}
        {activeTab === "addstudent" && (
          <div className="bg-white rounded-2xl shadow-sm p-6 max-w-2xl">
            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-6">
              {[{ num: 1, label: "Details", step: "form" }, { num: 2, label: "Face", step: "face" }, { num: 3, label: "Done", step: "done" }].map((s, i) => {
                const order = { form: 1, face: 2, done: 3 };
                const curr  = order[addStudentStep];
                const active = order[s.step] <= curr;
                return (
                  <React.Fragment key={s.num}>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${active ? "bg-[#1E2A78] text-white" : "bg-gray-200 text-gray-400"}`}>
                        {curr > order[s.step] ? "✓" : s.num}
                      </div>
                      <span className={`text-xs font-semibold hidden sm:block ${active ? "text-[#1E2A78]" : "text-gray-400"}`}>{s.label}</span>
                    </div>
                    {i < 2 && <div className={`flex-1 h-0.5 rounded ${curr > order[s.step] ? "bg-[#1E2A78]" : "bg-gray-200"}`} />}
                  </React.Fragment>
                );
              })}
            </div>

            {addStudentStep === "form" && (
              <>
                <h2 className="font-bold text-gray-800 text-sm mb-1">Add New Student</h2>
                <p className="text-xs text-gray-400 mb-4">Department: <strong>{dept}</strong></p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "name",       placeholder: "Full name",         type: "text"     },
                    { key: "rollNumber", placeholder: "Roll number",       type: "text"     },
                    { key: "age",        placeholder: "Age",               type: "number"   },
                    { key: "phone",      placeholder: "Phone number",      type: "tel"      },
                    { key: "email",      placeholder: "Email (for login)", type: "email"    },
                    { key: "password",   placeholder: "Password (min 6)",  type: "password" },
                  ].map(({ key, placeholder, type }) => (
                    <div key={key}>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block capitalize">
                        {key.replace("rollNumber", "Roll Number")}
                      </label>
                      <input type={type} value={addStudentForm[key]}
                        onChange={e => {
                          setAddStudentForm({ ...addStudentForm, [key]: e.target.value });
                          setAddStudentErrors(prev => ({ ...prev, [key]: "" }));
                        }}
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

                  {/* Auto-computed class preview */}
                  {derivedClassName && (
                    <div className="sm:col-span-2">
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 flex items-center gap-3">
                        <span className="text-xl">📚</span>
                        <div>
                          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Class will be assigned as:</p>
                          <p className="text-lg font-black text-[#1E2A78]">{derivedClassName}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <button onClick={handleAddStudentSave} disabled={addStudentLoading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1E2A78] to-blue-600 text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2">
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
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span>Photos</span>
                    <span className="font-bold">{captureCount}/5</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-[#1E2A78] transition-all" style={{ width: `${(captureCount / 5) * 100}%` }} />
                  </div>
                </div>
                <div className="bg-black rounded-2xl overflow-hidden mb-4" style={{ height: "260px" }}>
                  <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} width="640" height="480" className="hidden" />
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={captureStudentFace} disabled={addStudentLoading}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-blue-700 to-[#1E2A78] text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50">
                    <FaCamera />
                    {addStudentLoading ? "Saving..." : `Take Photo ${captureCount + 1} of 5`}
                  </button>
                  <button onClick={() => setAddStudentStep("done")}
                    className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50">
                    Skip face — enroll later
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
                <p className="text-xs text-[#1E2A78] font-bold mb-5">Class: {derivedClassName}</p>
                <button onClick={resetAddStudent}
                  className="w-full max-w-xs py-3 rounded-xl bg-gradient-to-r from-[#1E2A78] to-blue-600 text-white font-bold text-sm hover:opacity-90 transition">
                  Add Another Student
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── SUBJECTS ── */}
        {activeTab === "subjects" && (
          <div className="bg-white rounded-2xl shadow-sm p-5 max-w-2xl">
            <h2 className="font-bold text-gray-800 text-sm mb-1">{dept} Department Subjects</h2>
            <p className="text-xs text-gray-400 mb-4">
              These subjects appear in timetable slots and teacher assignment. Default subjects are pre-loaded from system.
            </p>
            <div className="flex gap-2 mb-5">
              <input type="text" value={newSubject} onChange={e => setNewSubject(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddSubject()}
                className={`flex-1 ${ic}`} placeholder="Type new subject and press Enter" />
              <button onClick={handleAddSubject}
                className="px-5 py-2.5 rounded-xl bg-[#1E2A78] text-white font-bold text-sm hover:bg-blue-800 transition">
                Add
              </button>
            </div>
            {deptSubjects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {deptSubjects.map(subject => (
                  <div key={subject} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FaBook className="text-[#1E2A78] text-xs flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-700">{subject}</span>
                    </div>
                    <button onClick={() => handleRemoveSubject(subject)}
                      className="text-red-400 hover:text-red-600 transition p-1"><FaTimes size={12} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <FaBook className="text-gray-300 text-4xl mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Loading default subjects...</p>
              </div>
            )}
          </div>
        )}

        {/* ── SUBSTITUTES ── */}
        {activeTab === "substitutes" && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-bold text-gray-800 text-sm mb-1 flex items-center gap-2">
              <FaExchangeAlt className="text-[#1E2A78]" />
              Teacher Substitutes & Coverage
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Mark teachers as absent and assign substitute teachers for scheduled classes
            </p>
            <button onClick={() => setShowSubstituteManager(true)}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#1E2A78] to-blue-600 text-white font-bold text-sm hover:opacity-90 transition inline-flex items-center gap-2">
              <FaExchangeAlt />
              Open Substitute Manager
            </button>
          </div>
        )}

        {/* ── ATTENDANCE ── */}
        {activeTab === "attendance" && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold text-gray-800 text-sm">{dept} Department Attendance Records</h2>
                <p className="text-xs text-gray-400">Use the filters to view attendance for a specific date or weekday.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <label className="text-xs text-gray-500">Date</label>
                <input type="date" value={attendanceDate}
                  onChange={e => setAttendanceDate(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1E2A78] bg-white" />
                {attendanceDate && (
                  <button onClick={() => setAttendanceDate("")}
                    className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs hover:bg-gray-50 transition">
                    All Dates
                  </button>
                )}
                <label className="text-xs text-gray-500">Day</label>
                <select value={attendanceDay}
                  onChange={e => setAttendanceDay(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1E2A78] bg-white">
                  <option value="All">All Days</option>
                  {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border-separate border-spacing-y-1.5 text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 rounded-l-lg">Name</th>
                    <th className="text-left px-4 py-3">Roll No</th>
                    <th className="text-left px-4 py-3">Class</th>
                    <th className="text-left px-4 py-3">Subject</th>
                    <th className="text-left px-4 py-3">Time</th>
                    <th className="text-left px-4 py-3 rounded-r-lg">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.filter(log => {
                      const logDate = new Date(log.recognizedAt).toISOString().slice(0, 10);
                      const logDay = new Date(log.recognizedAt).toLocaleDateString("en-US", { weekday: "long" });
                      return (
                        (!attendanceDate || attendanceDate === logDate) &&
                        (attendanceDay === "All" || attendanceDay === logDay)
                      );
                    }).slice(0, 50).map((log, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{log.name}</td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">{log.rollNumber}</td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">{log.className || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{log.period}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(log.recognizedAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setDeleteAttModal({ rollNumber: log.rollNumber, name: log.name })}
                          title="Delete today's attendance for this student"
                          className="text-orange-500 hover:text-orange-700 text-base">
                          🗓
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!attendance.filter(log => {
                    const logDate = new Date(log.recognizedAt).toISOString().slice(0, 10);
                    const logDay = new Date(log.recognizedAt).toLocaleDateString("en-US", { weekday: "long" });
                    return (!attendanceDate || attendanceDate === logDate) &&
                      (attendanceDay === "All" || attendanceDay === logDay);
                  }).length && (
                    <tr><td colSpan="6" className="text-center py-10 text-gray-400 text-sm">No attendance records yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
      
      {/* Substitute Manager Modal */}
      {showSubstituteManager && (
        <SubstituteManager
          dept={dept}
          hodUsername={hodInfo.username}
          teachers={teachers}
          periods={periods}
          timetable={allDeptTimetables}
          onClose={() => setShowSubstituteManager(false)}
        />
      )}
    </div>
  );
};

export default HODDashboard;