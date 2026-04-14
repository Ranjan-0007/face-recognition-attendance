import "./App.css";
import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import { FaCamera, FaCheckCircle, FaUserPlus } from "react-icons/fa";
import {
  DEPARTMENTS, COURSES_BY_DEPARTMENT, getSemesters
} from "./courses";

/* ─── className auto-builder ───────────────────────────────────────
   BCA + Semester 3  →  "BCA Sem 3"
   B.Com + Semester 2  →  "B.Com Sem 2"
   This mirrors how CLASSES_BY_DEPARTMENT is built in courses.js      */
function buildClassName(course, semester) {
  if (!course || !semester) return "";
  return `${course} Sem ${semester}`;
}

const Addstudent = () => {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  const [student, setStudent] = useState({
    name:"", rollNumber:"", age:"", department:"",
    course:"", semester:"", phone:"", email:"", password:""
  });
  const [captureCount, setCaptureCount]   = useState(0);
  const [isEnrolling, setIsEnrolling]     = useState(false);
  const [cameraReady, setCameraReady]     = useState(false);
  const [toastMsg, setToastMsg]           = useState("");
  const [toastType, setToastType]         = useState("info");
  const [errors, setErrors]               = useState({});
  const [enrollStep, setEnrollStep]       = useState("form"); // form | face | done
  const [checkingRoll, setCheckingRoll]   = useState(false);
  const [rollExists, setRollExists]       = useState(false);
  const TARGET_CAPTURES = 5;

  const showToast = (msg, type = "info") => {
    setToastMsg(msg); setToastType(type);
    setTimeout(() => setToastMsg(""), 4000);
  };

  // Start camera when entering face step
  useEffect(() => {
    if (enrollStep !== "face") return;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video:true });
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraReady(true);
      } catch { showToast("Camera access denied", "error"); }
    };
    startCamera();
    return () => {
      if (videoRef.current?.srcObject)
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    };
  }, [enrollStep]);

  // Auto-derive className whenever course or semester changes
  const derivedClassName = buildClassName(student.course, student.semester);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStudent(prev => ({
      ...prev, [name]: value,
      ...(name === "department" ? { course:"", semester:"" } : {}),
      ...(name === "course"     ? { semester:"" }             : {}),
    }));
    setErrors(prev => ({ ...prev, [name]:"" }));
    if (name === "rollNumber") {
      setRollExists(false);
      setErrors(prev => ({ ...prev, rollNumber:"" }));
    }
  };

  // Check roll number uniqueness on blur
  const handleRollBlur = async () => {
    if (!student.rollNumber.trim()) return;
    setCheckingRoll(true);
    try {
      const res  = await fetch(`http://localhost:5001/api/students`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const exists = data.some(s => s.rollNumber === student.rollNumber.trim());
        setRollExists(exists);
        if (exists)
          setErrors(prev => ({ ...prev, rollNumber:`Roll number "${student.rollNumber}" already exists` }));
        else
          setErrors(prev => ({ ...prev, rollNumber:"" }));
      }
    } catch { /* silent */ }
    setCheckingRoll(false);
  };

  const validate = () => {
    const e = {};
    if (!student.name.trim())       e.name       = "Required";
    if (!student.rollNumber.trim()) e.rollNumber  = "Required";
    if (rollExists)                 e.rollNumber  = `Roll number "${student.rollNumber}" already exists`;
    if (!student.department)        e.department  = "Required";
    if (!student.course)            e.course      = "Required";
    if (!student.semester)          e.semester    = "Required";
    if (!student.phone.trim())      e.phone       = "Required";
    if (!student.email.trim())      e.email       = "Required";
    if (!/\S+@\S+\.\S+/.test(student.email)) e.email = "Invalid email";
    if (!student.password)          e.password    = "Required";
    if (student.password.length < 6) e.password   = "Min 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Step 1 — save profile + create account, then go to face capture
  const handleSaveStudent = async () => {
    if (!validate()) return;
    setIsEnrolling(true);
    try {
      // Save profile (server also checks for duplicate rollNumber)
      const profileRes = await fetch("http://localhost:5001/api/students", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ ...student, className:derivedClassName }),
      });
      const profileData = await profileRes.json();
      if (!profileRes.ok) {
        showToast(profileData.message, "error");
        if (profileData.message?.toLowerCase().includes("roll")) {
          setErrors(prev => ({ ...prev, rollNumber:profileData.message }));
          setRollExists(true);
        }
        setIsEnrolling(false);
        return;
      }

      // Create login account
      const accRes = await fetch("http://localhost:5001/api/admin/create-student-account", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ rollNumber:student.rollNumber, password:student.password }),
      });
      const accData = await accRes.json();
      if (!accRes.ok) {
        // Rollback the student profile since account creation failed
        await fetch("http://localhost:5001/api/student/rollback", {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body:JSON.stringify({ rollNumber:student.rollNumber }),
        });
        showToast(accData.message, "error");
        setIsEnrolling(false);
        return;
      }

      showToast("Student saved! Now capture face photos.", "success");
      setEnrollStep("face");
    } catch {
      showToast("Server error. Check connection.", "error");
    }
    setIsEnrolling(false);
  };

  // Step 2 — capture face photo
  const captureOnce = async () => {
    if (!cameraReady) return;
    setIsEnrolling(true);
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg");

    try {
      const res = await fetch("http://localhost:5002/enroll", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ rollNumber:student.rollNumber, image:imageData }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast(result.message, "error");
        setIsEnrolling(false);
        return;
      }
      const newCount = captureCount + 1;
      setCaptureCount(newCount);
      if (newCount >= TARGET_CAPTURES) {
        showToast("All captures done! Enrollment complete.", "success");
        setEnrollStep("done");
      } else {
        showToast(`Photo ${newCount}/${TARGET_CAPTURES} saved!`, "info");
      }
    } catch {
      showToast("Cannot connect to face server (port 5002).", "error");
    }
    setIsEnrolling(false);
  };

  const skipFace = () => {
    showToast("Student added without face. Can be enrolled later.", "info");
    setEnrollStep("done");
  };

  const resetForm = () => {
    setStudent({ name:"", rollNumber:"", age:"", department:"", course:"", semester:"", phone:"", email:"", password:"" });
    setCaptureCount(0);
    setEnrollStep("form");
    setErrors({});
    setCameraReady(false);
    setRollExists(false);
  };

  const availableCourses   = student.department ? COURSES_BY_DEPARTMENT[student.department] || [] : [];
  const availableSemesters = student.course ? getSemesters(student.course) : [];

  const ic = (field) =>
    `w-full placeholder:text-gray-400 rounded-xl px-4 py-2.5 text-sm border-2
    transition focus:outline-none focus:ring-2 focus:ring-blue-200 bg-[#F7F7F7] ${
    errors[field] ? "border-red-400 bg-red-50" : "border-transparent"
  }`;

  return (
    <div className="min-h-screen p-4 bg-split">
      {toastMsg && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg
          text-sm font-medium text-white max-w-xs ${
          toastType==="success"?"bg-green-600":toastType==="error"?"bg-red-600":"bg-[#1E2A78]"
        }`}>
          {toastMsg}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <Sidebar />
        <div className="flex-1">
          <div className="text-white mb-6">
            <p className="text-sm opacity-80">Pages / Add Student</p>
            <h1 className="text-xl font-bold">Enroll New Student</h1>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-6">
            {[
              { num:1, label:"Student Details", step:"form" },
              { num:2, label:"Face Capture",    step:"face" },
              { num:3, label:"Done",            step:"done" },
            ].map((s, i) => {
              const stepOrder = { form:1, face:2, done:3 };
              const current   = stepOrder[enrollStep];
              const active    = stepOrder[s.step] <= current;
              return (
                <React.Fragment key={s.num}>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-8 h-8 rounded-full flex items-center
                      justify-center text-xs font-bold transition ${
                      active ? "bg-white text-[#1E2A78]" : "bg-white/20 text-white/50"
                    }`}>
                      {current > stepOrder[s.step] ? "✓" : s.num}
                    </div>
                    <span className={`text-xs font-semibold hidden sm:block ${
                      active ? "text-white" : "text-white/50"
                    }`}>{s.label}</span>
                  </div>
                  {i < 2 && (
                    <div className={`flex-1 h-0.5 rounded ${
                      current > stepOrder[s.step] ? "bg-white" : "bg-white/20"
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* ── STEP 1: FORM ── */}
          {enrollStep === "form" && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-gray-800 font-bold mb-5 text-sm">Student Information</h2>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">

                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Full Name</label>
                  <input type="text" name="name" value={student.name}
                    onChange={handleChange} className={ic("name")}
                    placeholder="Student's full name" />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>

                {/* Roll Number with duplicate check */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Roll Number</label>
                  <div className="relative">
                    <input type="text" name="rollNumber" value={student.rollNumber}
                      onChange={handleChange} onBlur={handleRollBlur}
                      className={ic("rollNumber")}
                      placeholder="e.g. 2023CS001" />
                    {checkingRoll && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">checking…</span>
                    )}
                    {!checkingRoll && student.rollNumber && !errors.rollNumber && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-xs">✓</span>
                    )}
                  </div>
                  {errors.rollNumber && <p className="text-xs text-red-500 mt-1">{errors.rollNumber}</p>}
                </div>

                {/* Age */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Age</label>
                  <input type="number" name="age" value={student.age}
                    onChange={handleChange} className={ic("age")}
                    placeholder="Age" />
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Phone</label>
                  <input type="tel" name="phone" value={student.phone}
                    onChange={handleChange} className={ic("phone")}
                    placeholder="10-digit mobile" />
                  {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Email</label>
                  <input type="email" name="email" value={student.email}
                    onChange={handleChange} className={ic("email")}
                    placeholder="student@email.com" />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Password (for login)</label>
                  <input type="password" name="password" value={student.password}
                    onChange={handleChange} className={ic("password")}
                    placeholder="Min 6 chars" />
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>

                {/* Department */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Department</label>
                  <select name="department" value={student.department}
                    onChange={handleChange} className={ic("department")}>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department}</p>}
                </div>

                {/* Course */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Course</label>
                  <select name="course" value={student.course}
                    onChange={handleChange} className={ic("course")}
                    disabled={!student.department}>
                    <option value="">{student.department ? "Select course" : "Select dept first"}</option>
                    {availableCourses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.course && <p className="text-xs text-red-500 mt-1">{errors.course}</p>}
                </div>

                {/* Semester */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                    Semester
                    {student.course && (
                      <span className="ml-2 text-blue-400 normal-case font-normal">
                        ({getSemesters(student.course).length} total)
                      </span>
                    )}
                  </label>
                  <select name="semester" value={student.semester}
                    onChange={handleChange} className={ic("semester")}
                    disabled={!student.course}>
                    <option value="">{student.course ? "Select semester" : "Select course first"}</option>
                    {availableSemesters.map(s => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                  {errors.semester && <p className="text-xs text-red-500 mt-1">{errors.semester}</p>}
                </div>

                {/* Auto-computed Class preview */}
                {derivedClassName && (
                  <div className="sm:col-span-2">
                    <div className="flex items-center gap-2 bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-2.5">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Class (auto):</span>
                      <span className="text-sm font-bold text-[#1E2A78]">{derivedClassName}</span>
                      <span className="text-xs text-blue-500 ml-auto">Computed from Course + Semester</span>
                    </div>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <button onClick={handleSaveStudent} disabled={isEnrolling || rollExists}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1E2A78] to-blue-600
                      text-white font-bold text-sm hover:opacity-90 transition
                      disabled:opacity-60 flex items-center justify-center gap-2">
                    <FaUserPlus />
                    {isEnrolling ? "Saving..." : "Save Student & Continue to Face Capture →"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: FACE CAPTURE ── */}
          {enrollStep === "face" && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-gray-800 font-bold mb-2 text-sm">
                Face Capture for {student.name}
              </h2>
              <p className="text-xs text-gray-400 mb-4">
                Roll No: {student.rollNumber} · Class: {derivedClassName}
              </p>

              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Photos captured</span>
                  <span className="font-bold text-[#1E2A78]">{captureCount} / {TARGET_CAPTURES}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="h-3 rounded-full bg-gradient-to-r from-blue-600 to-[#1E2A78] transition-all duration-500"
                    style={{ width:`${(captureCount/TARGET_CAPTURES)*100}%` }} />
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-5">
                <div className="w-full lg:w-1/2 rounded-2xl overflow-hidden bg-black" style={{ height:"320px" }}>
                  <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} width="640" height="480" className="hidden" />
                </div>
                <div className="w-full lg:w-1/2 flex flex-col justify-center gap-4">
                  <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-800">
                    <p className="font-semibold mb-2">Tips for best accuracy:</p>
                    <ul className="text-xs text-blue-700 list-disc ml-4 space-y-1">
                      <li>Look directly at camera</li>
                      <li>Good lighting on face</li>
                      <li>Slightly turn head between captures</li>
                      <li>Remove glasses if possible</li>
                    </ul>
                  </div>
                  <button onClick={captureOnce} disabled={isEnrolling || !cameraReady}
                    className="flex items-center justify-center gap-2 w-full rounded-xl
                      bg-gradient-to-r from-blue-700 to-[#1E2A78] py-3 font-bold
                      text-white hover:opacity-90 transition disabled:opacity-50">
                    <FaCamera />
                    {isEnrolling ? "Capturing…" : `Take Photo ${captureCount+1} of ${TARGET_CAPTURES}`}
                  </button>
                  <button onClick={skipFace}
                    className="w-full py-2.5 rounded-xl border-2 border-gray-200
                      text-gray-500 text-sm font-medium hover:bg-gray-50">
                    Skip — enroll face later
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: DONE ── */}
          {enrollStep === "done" && (
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
              <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                <FaCheckCircle className="text-green-600 text-5xl" />
              </div>
              <h2 className="text-2xl font-black text-gray-800 mb-2">Enrollment Complete!</h2>
              <p className="text-sm text-gray-500 mb-4">{student.name} has been enrolled successfully.</p>
              <div className="bg-gray-50 rounded-2xl p-4 inline-block mb-6 text-left">
                <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Summary</p>
                {[
                  ["Name",        student.name],
                  ["Roll Number", student.rollNumber],
                  ["Department",  student.department],
                  ["Course",      student.course],
                  ["Class",       derivedClassName],
                  ["Face Photos", captureCount >= TARGET_CAPTURES
                    ? `${captureCount} captured ✓`
                    : "Not enrolled (can be done later)"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-4 text-sm mb-1">
                    <span className="text-gray-400 w-28 flex-shrink-0">{k}:</span>
                    <span className="font-semibold text-gray-700">{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={resetForm}
                className="w-full max-w-xs py-3 rounded-xl bg-gradient-to-r
                  from-[#1E2A78] to-blue-600 text-white font-bold text-sm
                  hover:opacity-90 transition">
                Enroll Another Student
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Addstudent;
