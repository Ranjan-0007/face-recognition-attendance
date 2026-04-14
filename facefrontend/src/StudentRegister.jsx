import "./App.css";
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEPARTMENTS, COURSES_BY_DEPARTMENT, getSemesters } from "./courses";
import { FaCamera, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";

function buildClassName(course, semester) {
  if (!course || !semester) return "";
  return `${course} Sem ${semester}`;
}

const StudentRegister = () => {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState("login");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ msg: "", type: "" });
  const [form, setForm] = useState({
    name: "", rollNumber: "", age: "", department: "",
    course: "", semester: "", phone: "",
    email: "", password: "", confirmPassword: ""
  });
  const [errors, setErrors] = useState({});
  const [captureCount, setCaptureCount] = useState(0);
  const [cameraError, setCameraError] = useState("");
  const [registeredRollNumber, setRegisteredRollNumber] = useState("");
  const [registrationFailed, setRegistrationFailed] = useState(false);
  const [failReason, setFailReason] = useState("");
  const TARGET_CAPTURES = 5;
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 4500);
  };

  useEffect(() => {
    if (step === 2) startCamera();
    return () => { if (step !== 2) stopCamera(); };
  }, [step]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraError("");
    } catch {
      setCameraError("Camera access denied. Please allow camera permission.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const rollbackRegistration = async (rollNumber, email) => {
    try {
      await fetch("http://localhost:5001/api/student/rollback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNumber, email }),
      });
    } catch { }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev, [name]: value,
      ...(name === "department" ? { course: "", semester: "" } : {}),
      ...(name === "course" ? { semester: "" } : {}),
    }));
    setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const derivedClassName = buildClassName(form.course, form.semester);

  const validateStep1 = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.rollNumber.trim()) e.rollNumber = "Roll number is required";
    if (!form.age.trim()) e.age = "Age is required";
    if (!form.department) e.department = "Department is required";
    if (!form.course) e.course = "Course is required";
    if (!form.semester) e.semester = "Semester is required";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    if (!form.email.trim()) e.email = "Email is required";
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email address";
    if (!form.password) e.password = "Password is required";
    if (form.password.length < 6) e.password = "Minimum 6 characters";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validateStep1()) return;
    setLoading(true);
    setRegistrationFailed(false);
    setFailReason("");
    let authCreated = false;
    const currentRoll = form.rollNumber.trim();
    const currentEmail = form.email.trim().toLowerCase();
    try {
      const authRes = await fetch("http://localhost:5001/api/student/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), email: currentEmail, password: form.password, rollNumber: currentRoll }),
      });
      const authData = await authRes.json();
      if (!authRes.ok) { showToast(authData.message || "Registration failed.", "error"); setLoading(false); return; }
      authCreated = true;

      const profileRes = await fetch("http://localhost:5001/api/students", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(), rollNumber: currentRoll, age: form.age.trim(),
          department: form.department, course: form.course,
          className: derivedClassName, semester: form.semester,
          phone: form.phone.trim(), email: currentEmail
        }),
      });
      const profileData = await profileRes.json();
      if (!profileRes.ok) {
        await rollbackRegistration(currentRoll, currentEmail);
        authCreated = false;
        setRegistrationFailed(true);
        setFailReason(profileData.message || "Profile could not be saved. Roll number may already exist.");
        setLoading(false); return;
      }
      setRegisteredRollNumber(currentRoll);
      showToast("Account created! Now capture your face photos.", "success");
      setStep(2);
    } catch (err) {
      if (authCreated) await rollbackRegistration(currentRoll, currentEmail);
      setRegistrationFailed(true);
      setFailReason("Cannot connect to server on port 5001.");
    }
    setLoading(false);
  };

  const captureOnce = async () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    setLoading(true);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg");
    try {
      const response = await fetch("http://localhost:5002/enroll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNumber: registeredRollNumber, image: imageData }),
      });
      const result = await response.json();
      if (!response.ok) { showToast(result.message || "Photo capture failed.", "error"); setLoading(false); return; }
      const newCount = captureCount + 1;
      setCaptureCount(newCount);
      if (newCount >= TARGET_CAPTURES) { stopCamera(); showToast("All photos captured!", "success"); setStep(3); }
      else showToast(`Photo ${newCount}/${TARGET_CAPTURES} saved!`, "info");
    } catch { showToast("Cannot connect to face server on port 5002.", "error"); }
    setLoading(false);
  };

  const skipFaceCapture = () => { stopCamera(); setStep(3); showToast("Registration complete.", "info"); };

  const handleLogin = async () => {
    const e = {};
    if (!form.email.trim()) e.email = "Email required";
    if (!form.password) e.password = "Password required";
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5001/api/student/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message, "error"); setLoading(false); return; }
      localStorage.setItem("studentToken", data.token);
      localStorage.setItem("studentInfo", JSON.stringify(data.student));
      showToast("Login successful!", "success");
      setTimeout(() => navigate("/student-dashboard"), 800);
    } catch { showToast("Login failed. Check server connection.", "error"); }
    setLoading(false);
  };

  const startOver = () => {
    setStep(1); setCaptureCount(0); setRegistrationFailed(false); setFailReason("");
    setRegisteredRollNumber(""); setErrors({});
    setForm({ name: "", rollNumber: "", age: "", department: "", course: "", semester: "", phone: "", email: "", password: "", confirmPassword: "" });
    stopCamera();
  };

  const availableCourses = form.department ? COURSES_BY_DEPARTMENT[form.department] || [] : [];
  const availableSemesters = form.course ? getSemesters(form.course) : [];

  const ic = (field) =>
    `w-full rounded-xl px-4 py-2.5 text-sm border-2 transition focus:outline-none focus:ring-2 focus:ring-blue-300 ${errors[field] ? "border-red-400 bg-red-50" : "border-gray-200 bg-gray-50"}`;

  const StepBar = () => (
    <div className="flex items-center gap-2 mb-6">
      {[{ num: 1, label: "Your Details" }, { num: 2, label: "Face Photo" }, { num: 3, label: "Done" }].map((s, i) => (
        <React.Fragment key={s.num}>
          <div className="flex items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step > s.num ? "bg-green-600 text-white" : step === s.num ? "bg-[#1E2A78] text-white" : "bg-gray-100 text-gray-400"}`}>
              {step > s.num ? "✓" : s.num}
            </div>
            <span className={`text-xs font-semibold hidden sm:block ${step >= s.num ? "text-[#1E2A78]" : "text-gray-400"}`}>{s.label}</span>
          </div>
          {i < 2 && <div className={`flex-1 h-0.5 rounded ${step > s.num ? "bg-green-600" : "bg-gray-200"}`} />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E2A78] via-[#2a3a9a] to-[#0f1c55] flex items-center justify-center p-4">
      {toast.msg && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-xs leading-snug ${toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-gray-800"}`}>{toast.msg}</div>
      )}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">
        <div className="lg:w-2/5 bg-gradient-to-b from-[#1E2A78] to-[#2a3a9a] p-8 flex flex-col justify-between text-white">
          <div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6"><span className="text-white font-black text-lg">GN</span></div>
            <h1 className="text-3xl font-black leading-tight mb-3">Student<br /><span className="text-yellow-300">Portal</span></h1>
            <p className="text-blue-200 text-sm leading-relaxed">Guru Nanak Dev University College — Face Recognition Attendance System</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-5 mt-8">
            <p className="text-xs text-blue-200 uppercase tracking-widest font-semibold mb-3">Registration steps</p>
            {[
              { n: "1", text: "Fill in your personal and academic details" },
              { n: "2", text: "Capture 5 face photos for recognition" },
              { n: "3", text: "Done — mark attendance using face recognition" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 mb-3">
                <div className="w-5 h-5 rounded-full bg-yellow-300 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-[#1E2A78] font-black text-xs">{item.n}</span></div>
                <span className="text-sm text-blue-100">{item.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 text-xs text-blue-300">Are you an admin? <Link to="/signin" className="text-yellow-300 underline font-semibold">Admin login →</Link></div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto max-h-screen">
          {step === 1 && (
            <div className="flex gap-2 mb-6">
              {["login", "register"].map(mode => (
                <button key={mode} onClick={() => { setAuthMode(mode); setErrors({}); setRegistrationFailed(false); }}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition capitalize ${authMode === mode ? "bg-[#1E2A78] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {mode === "login" ? "Login" : "Register"}
                </button>
              ))}
            </div>
          )}

          {/* LOGIN */}
          {authMode === "login" && step === 1 && (
            <>
              <h2 className="text-xl font-black text-gray-800 mb-1">Welcome back</h2>
              <p className="text-sm text-gray-400 mb-6">Enter your credentials to view attendance</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Email</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} className={ic("email")} placeholder="your@email.com" />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Password</label>
                  <input type="password" name="password" value={form.password} onChange={handleChange} className={ic("password")} placeholder="••••••••" />
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>
                <button onClick={handleLogin} disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1E2A78] to-blue-600 text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-60 mt-2">
                  {loading ? "Logging in..." : "Login to Student Portal"}
                </button>
              </div>
            </>
          )}

          {/* REGISTER STEP 1 */}
          {authMode === "register" && step === 1 && (
            <>
              <h2 className="text-xl font-black text-gray-800 mb-1">Create your account</h2>
              <p className="text-sm text-gray-400 mb-4">Fill in all details carefully</p>
              <StepBar />
              {registrationFailed && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-5">
                  <div className="flex items-start gap-3">
                    <FaExclamationTriangle className="text-red-500 text-xl flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-700 text-sm mb-1">Registration Failed</p>
                      <p className="text-red-600 text-xs leading-relaxed mb-2">{failReason}</p>
                      <p className="text-red-500 text-xs">All partial data removed. Fix your information and try again.</p>
                    </div>
                  </div>
                  <button onClick={startOver} className="mt-4 w-full py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition">Start Registration Again</button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Full Name</label>
                  <input type="text" name="name" value={form.name} onChange={handleChange} className={ic("name")} placeholder="Your full name as per college records" />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Roll Number</label>
                  <input type="text" name="rollNumber" value={form.rollNumber} onChange={handleChange} className={ic("rollNumber")} placeholder="e.g. 2023CS001" />
                  {errors.rollNumber && <p className="text-xs text-red-500 mt-1">{errors.rollNumber}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Age</label>
                  <input type="number" name="age" value={form.age} onChange={handleChange} className={ic("age")} placeholder="Your age" min="15" max="40" />
                  {errors.age && <p className="text-xs text-red-500 mt-1">{errors.age}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Department</label>
                  <select name="department" value={form.department} onChange={handleChange} className={ic("department")}>
                    <option value="">Select your department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Course</label>
                  <select name="course" value={form.course} onChange={handleChange} className={ic("course")} disabled={!form.department}>
                    <option value="">{form.department ? "Select your course" : "Select department first"}</option>
                    {availableCourses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.course && <p className="text-xs text-red-500 mt-1">{errors.course}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                    Semester {form.course && <span className="ml-1 text-blue-400 normal-case font-normal">({getSemesters(form.course).length} total)</span>}
                  </label>
                  <select name="semester" value={form.semester} onChange={handleChange} className={ic("semester")} disabled={!form.course}>
                    <option value="">{form.course ? "Select your current semester" : "Select course first"}</option>
                    {availableSemesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
                  </select>
                  {errors.semester && <p className="text-xs text-red-500 mt-1">{errors.semester}</p>}
                </div>
                {/* Auto-computed class preview */}
                {derivedClassName && (
                  <div className="sm:col-span-2">
                    <div className="flex items-center gap-3 bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-2.5">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Class (auto-assigned)</p>
                        <p className="text-base font-black text-[#1E2A78]">{derivedClassName}</p>
                      </div>
                      <span className="ml-auto text-xs text-blue-400">Based on Course + Semester</span>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Phone</label>
                  <input type="tel" name="phone" value={form.phone} onChange={handleChange} className={ic("phone")} placeholder="10-digit mobile number" />
                  {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Email</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} className={ic("email")} placeholder="your@email.com" />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Password</label>
                  <input type="password" name="password" value={form.password} onChange={handleChange} className={ic("password")} placeholder="Minimum 6 characters" />
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Confirm Password</label>
                  <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} className={ic("confirmPassword")} placeholder="Retype your password" />
                  {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
                </div>
                <div className="sm:col-span-2">
                  <button onClick={handleRegister} disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1E2A78] to-blue-600 text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-60">
                    {loading ? "Creating account..." : "Continue to Face Capture →"}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STEP 2: FACE */}
          {authMode === "register" && step === 2 && (
            <>
              <h2 className="text-xl font-black text-gray-800 mb-1">Capture your face</h2>
              <p className="text-sm text-gray-400 mb-4">Take {TARGET_CAPTURES} photos for attendance recognition</p>
              <StepBar />
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Photos captured</span>
                  <span className="font-bold text-[#1E2A78]">{captureCount} / {TARGET_CAPTURES}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="h-3 rounded-full bg-gradient-to-r from-blue-600 to-[#1E2A78] transition-all duration-500" style={{ width: `${(captureCount / TARGET_CAPTURES) * 100}%` }} />
                </div>
              </div>
              {cameraError ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center mb-4">
                  <FaExclamationTriangle className="text-red-500 text-3xl mx-auto mb-3" />
                  <p className="text-red-600 font-semibold text-sm mb-2">Camera Error</p>
                  <p className="text-red-500 text-xs mb-4">{cameraError}</p>
                  <button onClick={startCamera} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium">Try Again</button>
                </div>
              ) : (
                <div className="bg-black rounded-2xl overflow-hidden mb-4" style={{ height: "260px" }}>
                  <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} width="640" height="480" className="hidden" />
                </div>
              )}
              <div className="bg-blue-50 rounded-xl p-3 mb-4 text-xs text-blue-700">
                <p className="font-semibold mb-1">Tips:</p>
                <ul className="list-disc ml-4 space-y-0.5">
                  <li>Look directly at camera</li><li>Good face lighting</li>
                  <li>Slightly turn head between captures</li><li>Remove glasses if possible</li>
                </ul>
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={captureOnce} disabled={loading || !!cameraError}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-blue-700 to-[#1E2A78] text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50">
                  <FaCamera /> {loading ? "Saving photo..." : `Take Photo ${captureCount + 1} of ${TARGET_CAPTURES}`}
                </button>
                <button onClick={skipFaceCapture} className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50">
                  Skip — enroll face through admin later
                </button>
              </div>
            </>
          )}

          {/* STEP 3: SUCCESS */}
          {authMode === "register" && step === 3 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6">
                <FaCheckCircle className="text-green-600 text-5xl" />
              </div>
              <h2 className="text-2xl font-black text-gray-800 mb-2">Registration Complete!</h2>
              <p className="text-sm text-gray-500 mb-4 max-w-xs leading-relaxed">
                {captureCount >= TARGET_CAPTURES ? `All ${TARGET_CAPTURES} face photos captured — you can now mark attendance.` : "Account created! Ask admin to enroll your face for attendance."}
              </p>
              {captureCount >= TARGET_CAPTURES ? (
                <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-3 mb-6 text-sm text-green-700 font-semibold flex items-center gap-2">
                  <FaCheckCircle /> {captureCount} face photos captured
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-3 mb-6 text-sm text-yellow-700 flex items-start gap-2 text-left max-w-xs">
                  <span>⚠️</span><span>Face not enrolled — recognition won't work until admin enrolls your face.</span>
                </div>
              )}
              <button onClick={() => { setAuthMode("login"); setStep(1); setCaptureCount(0); setRegisteredRollNumber(""); setForm({ name:"",rollNumber:"",age:"",department:"",course:"",semester:"",phone:"",email:"",password:"",confirmPassword:"" }); }}
                className="w-full max-w-xs py-3 rounded-xl bg-gradient-to-r from-[#1E2A78] to-blue-600 text-white font-bold text-sm hover:opacity-90 transition">
                Login Now →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentRegister;
