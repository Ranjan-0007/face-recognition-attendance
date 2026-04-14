import "./App.css";
import {
  FaUserGraduate, FaClipboardList, FaUsers,
  FaFileExcel, FaChartBar, FaTrash, FaUserTie,
  FaCalendarAlt, FaEye, FaLock
} from "react-icons/fa";
import axios from "axios";
import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { DEPARTMENTS, CLASSES_BY_DEPARTMENT } from "./courses";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const Dashboard = () => {
  const [periodLogs,     setPeriodLogs]     = useState([]);
  const [students,       setStudents]       = useState([]);
  const [hods,           setHods]           = useState([]);
  const [allTeachers,    setAllTeachers]    = useState([]);
  const [periods,        setPeriods]        = useState([]);
  const [currentPage,    setCurrentPage]    = useState(1);
  const [itemsPerPage]                      = useState(8);
  const [selectedDept,   setSelectedDept]   = useState("All");
  const [selectedClass,  setSelectedClass]  = useState("All");
  const [selectedDate,   setSelectedDate]   = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("All");
  const [activeAdminTab, setActiveAdminTab] = useState("attendance");
  const [hodForm,        setHodForm]        = useState({
    name: "", username: "", email: "", password: "", department: ""
  });
  const [toastMsg,      setToastMsg]      = useState("");

  // Timetable viewer state
  const [viewDept,       setViewDept]      = useState("");
  const [viewClass,      setViewClass]     = useState("");
  const [viewTimetable,  setViewTimetable] = useState(null);
  const [loadingTT,      setLoadingTT]     = useState(false);

  const today = new Date().toLocaleDateString();

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  const fetchAll = async () => {
    try {
      const [logsRes, studRes, hodRes, teachRes, perRes] = await Promise.all([
        axios.get("http://localhost:5001/api/periodwise-attendance"),
        axios.get("http://localhost:5001/api/students"),
        fetch("http://localhost:5001/api/admin/hods"),
        fetch("http://localhost:5001/api/admin/teachers"),
        fetch("http://localhost:5001/api/periods"),
      ]);
      setPeriodLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
      setStudents(Array.isArray(studRes.data)   ? studRes.data : []);
      const hodData   = await hodRes.json();
      const teachData = await teachRes.json();
      const perData   = await perRes.json();
      setHods(Array.isArray(hodData)    ? hodData    : []);
      setAllTeachers(Array.isArray(teachData) ? teachData : []);
      setPeriods(Array.isArray(perData) ? perData : []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchAll(); }, []);

  // Load timetable for view (read-only)
  const handleViewTimetable = async () => {
    if (!viewClass) return showToast("Select a class to view timetable.");
    setLoadingTT(true);
    try {
      const res  = await fetch(
        `http://localhost:5001/api/timetable/${encodeURIComponent(viewClass)}`
      );
      const data = await res.json();
      setViewTimetable(data?.slots || null);
    } catch {
      setViewTimetable(null);
      showToast("Could not load timetable for this class.");
    }
    setLoadingTT(false);
  };

  // Handle HOD creation
  const handleCreateHOD = async () => {
    const { name, username, email, password, department } = hodForm;
    if (!name || !username || !email || !password || !department) {
      return showToast("All fields required.");
    }
    try {
      const res  = await fetch("http://localhost:5001/api/admin/hods", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(hodForm),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        setHodForm({ name:"",username:"",email:"",password:"",department:"" });
        fetchAll();
      } else {
        showToast(data.message);
      }
    } catch { showToast("Server error"); }
  };

  const handleDeleteHOD = async (id, name) => {
    if (!window.confirm(`Delete HOD ${name}?`)) return;
    try {
      const res  = await fetch(`http://localhost:5001/api/admin/hods/${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      showToast(data.message);
      fetchAll();
    } catch { showToast("Server error"); }
  };

  // Derived stats
  const presentTodayRolls = [
    ...new Set(
      periodLogs
        .filter(l => new Date(l.recognizedAt).toLocaleDateString() === today)
        .map(l => l.rollNumber)
    )
  ];

  const allSubjects = [
    ...new Set(periodLogs.map(l => l.period).filter(Boolean))
  ].sort();

  const getLast7DaysData = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const label   = d.toLocaleDateString("en-IN", { weekday:"short", day:"numeric" });
      const dateStr = d.toLocaleDateString();
      const uniqueStudents = new Set(
        periodLogs
          .filter(l => new Date(l.recognizedAt).toLocaleDateString() === dateStr)
          .map(l => l.rollNumber)
      ).size;
      days.push({
        day: label, Present: uniqueStudents,
        Absent: Math.max(0, students.length - uniqueStudents)
      });
    }
    return days;
  };

  const deptStats = DEPARTMENTS.map(dept => {
    const deptStudents = students.filter(s => s.department === dept).length;
    const deptPresent  = new Set(
      periodLogs.filter(l => {
        const st = students.find(s => s.rollNumber === l.rollNumber);
        return st?.department === dept &&
          new Date(l.recognizedAt).toLocaleDateString() === today;
      }).map(l => l.rollNumber)
    ).size;
    return { dept: dept.split(" ")[0], students: deptStudents, present: deptPresent };
  }).filter(d => d.students > 0);

  const classesForDept = selectedDept !== "All"
    ? CLASSES_BY_DEPARTMENT[selectedDept] || [] : [];

  const filteredLogs = periodLogs.filter(l => {
    const st         = students.find(s => s.rollNumber === l.rollNumber);
    const deptMatch  = selectedDept   === "All" || st?.department === selectedDept;
    const classMatch = selectedClass  === "All" || l.className    === selectedClass;
    const perMatch   = selectedPeriod === "All" || l.period       === selectedPeriod;
    const dateMatch  = !selectedDate  ||
      new Date(l.recognizedAt).toISOString().split("T")[0] === selectedDate;
    return deptMatch && classMatch && perMatch && dateMatch;
  });

  const totalPages  = Math.ceil(filteredLogs.length / itemsPerPage);
  const currentLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportCSV = () => {
    const headers = ["Name","Roll Number","Class","Department","Subject/Period","Time"];
    const rows = filteredLogs.map(l => [
      l.name, l.rollNumber, l.className || "",
      l.department || "", l.period,
      new Date(l.recognizedAt).toLocaleString()
    ]);
    const csv  = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `attendance_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported!");
  };

  const pad = n => String(n).padStart(2, "0");
  const ic  = "border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E2A78] bg-gray-50";

  const viewClassesForDept = viewDept ? CLASSES_BY_DEPARTMENT[viewDept] || [] : [];

  return (
    <div className="min-h-screen p-4 bg-split">
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-[#1E2A78] text-white
          px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toastMsg}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <Sidebar />
        <div className="flex-1">

          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start
            md:items-center text-white mb-6 gap-4">
            <div>
              <p className="text-sm opacity-80">Pages / Dashboard</p>
              <h1 className="text-xl font-bold">College Dashboard</h1>
              <p className="text-xs opacity-60 mt-0.5">
                Admin view — attendance reports, HOD management, read-only timetables
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {["attendance","timetables","staff"].map(t => (
                <button key={t} onClick={() => setActiveAdminTab(t)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold
                    transition capitalize ${
                    activeAdminTab === t
                      ? "bg-white text-[#1E2A78]"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}>
                  {t === "attendance" ? "Attendance"
                   : t === "timetables" ? "View Timetables"
                   : "HOD & Teachers"}
                </button>
              ))}
              {activeAdminTab === "attendance" && (
                <button onClick={exportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600
                    text-white rounded-xl text-sm font-medium hover:bg-green-700 transition">
                  <FaFileExcel /> Export CSV
                </button>
              )}
            </div>
          </div>

          {/* ── ATTENDANCE TAB ── */}
          {activeAdminTab === "attendance" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                {[
                  { icon:<FaUserGraduate/>, bg:"bg-green-100", color:"text-green-600", label:"Total Students", sub:"All departments", value:students.length },
                  { icon:<FaClipboardList/>, bg:"bg-blue-100", color:"text-blue-600", label:"Students Today", sub:"At least 1 period", value:presentTodayRolls.length },
                  { icon:<FaUsers/>, bg:"bg-red-100", color:"text-red-600", label:"Absent Today", sub:"No period marked", value:Math.max(0, students.length - presentTodayRolls.length) },
                ].map(({ icon, bg, color, label, sub, value }) => (
                  <div key={label} className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                      <div className={`w-9 h-9 ${bg} ${color} flex items-center justify-center rounded-lg mb-2`}>{icon}</div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">{label}</p>
                      <p className={`${color} text-xs font-semibold mt-0.5`}>{sub}</p>
                    </div>
                    <h3 className="text-5xl font-bold text-gray-800">{value}</h3>
                  </div>
                ))}
              </div>

              <div className="flex flex-col lg:flex-row gap-5 mb-5">
                <div className="bg-white rounded-2xl shadow-sm p-5 w-full lg:w-1/2">
                  <div className="flex items-center gap-2 mb-4">
                    <FaChartBar className="text-[#1E2A78]" />
                    <h2 className="text-gray-800 font-bold text-sm">Last 7 Days</h2>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={getLast7DaysData()} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="day" tick={{ fontSize:10 }} />
                      <YAxis tick={{ fontSize:10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize:11 }} />
                      <Bar dataKey="Present" fill="#1E2A78" radius={[4,4,0,0]} />
                      <Bar dataKey="Absent"  fill="#FCA5A5" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-5 w-full lg:w-1/2">
                  <h2 className="text-gray-800 font-bold text-sm mb-4">Department-wise Today</h2>
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {deptStats.length > 0 ? deptStats.map(d => (
                      <div key={d.dept} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-24 flex-shrink-0 font-medium">{d.dept}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-[#1E2A78] transition-all"
                            style={{ width: d.students > 0 ? `${(d.present/d.students)*100}%` : "0%" }} />
                        </div>
                        <span className="text-xs text-gray-500 w-16 text-right">{d.present}/{d.students}</span>
                      </div>
                    )) : (
                      <p className="text-gray-400 text-xs text-center py-4">No department data yet</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Attendance Table with filters */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-gray-800 font-bold text-sm">
                    Period Attendance Logs
                    <span className="ml-2 text-xs font-normal text-gray-400">({filteredLogs.length} records)</span>
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <select value={selectedDept} onChange={e => { setSelectedDept(e.target.value); setSelectedClass("All"); setCurrentPage(1); }}
                      className="border px-3 py-1.5 rounded-lg text-xs">
                      <option value="All">All Depts</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {selectedDept !== "All" && (
                      <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setCurrentPage(1); }}
                        className="border px-3 py-1.5 rounded-lg text-xs">
                        <option value="All">All Classes</option>
                        {classesForDept.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                    <select value={selectedPeriod} onChange={e => { setSelectedPeriod(e.target.value); setCurrentPage(1); }}
                      className="border px-3 py-1.5 rounded-lg text-xs">
                      <option value="All">All Subjects</option>
                      {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input type="date" value={selectedDate}
                      onChange={e => { setSelectedDate(e.target.value); setCurrentPage(1); }}
                      className="border px-3 py-1.5 rounded-lg text-xs" />
                    <button onClick={() => { setSelectedDept("All"); setSelectedClass("All"); setSelectedPeriod("All"); setSelectedDate(""); setCurrentPage(1); }}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium">
                      Clear
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto border-separate border-spacing-y-1.5 text-sm">
                    <thead>
                      <tr className="bg-[#F7F7F7] text-gray-500 text-xs uppercase tracking-wide">
                        <th className="text-left px-4 py-3 rounded-l-lg">Name</th>
                        <th className="text-left px-4 py-3">Roll Number</th>
                        <th className="text-left px-4 py-3">Class</th>
                        <th className="text-left px-4 py-3">Subject</th>
                        <th className="text-left px-4 py-3 rounded-r-lg">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentLogs.length > 0 ? currentLogs.map((l, i) => (
                        <tr key={i} className="hover:bg-[#f0f4f8] transition">
                          <td className="px-4 py-3 font-medium">{l.name}</td>
                          <td className="px-4 py-3 text-xs font-mono text-gray-500">{l.rollNumber}</td>
                          <td className="px-4 py-3">
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">{l.className || "—"}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium">{l.period}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{new Date(l.recognizedAt).toLocaleString()}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan="5" className="text-center py-8 text-gray-400 text-sm">No records found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-gray-400">
                      {(currentPage-1)*itemsPerPage+1}–{Math.min(currentPage*itemsPerPage, filteredLogs.length)} of {filteredLogs.length}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1}
                        className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-xs">Prev</button>
                      <span className="px-3 py-1 rounded-lg bg-[#1E2A78] text-white text-xs">{currentPage}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages}
                        className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-xs">Next</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── VIEW TIMETABLES TAB (read-only) ── */}
          {activeAdminTab === "timetables" && (
            <div className="space-y-5">
              {/* Notice banner */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <FaLock className="text-amber-500 flex-shrink-0 mt-0.5 text-lg" />
                <div>
                  <p className="font-bold text-amber-800 text-sm">View-Only Access</p>
                  <p className="text-amber-700 text-xs mt-0.5">
                    Timetables are created and managed exclusively by HODs from their department portal.
                    As admin, you can view any class timetable but cannot edit it.
                  </p>
                </div>
              </div>

              {/* Selector */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FaCalendarAlt className="text-[#1E2A78]" />
                  <h2 className="font-bold text-gray-800 text-sm">Browse Class Timetables</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Department</label>
                    <select value={viewDept} onChange={e => { setViewDept(e.target.value); setViewClass(""); setViewTimetable(null); }}
                      className={ic}>
                      <option value="">Select department</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Class</label>
                    <select value={viewClass} onChange={e => { setViewClass(e.target.value); setViewTimetable(null); }}
                      className={ic} disabled={!viewDept}>
                      <option value="">{viewDept ? "Select class" : "Select dept first"}</option>
                      {viewClassesForDept.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button onClick={handleViewTimetable} disabled={!viewClass || loadingTT}
                      className="w-full py-2.5 rounded-xl bg-[#1E2A78] text-white font-bold text-sm
                        hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                      <FaEye />
                      {loadingTT ? "Loading..." : "View Timetable"}
                    </button>
                  </div>
                </div>

                {/* Timetable display */}
                {viewTimetable && (
                  <>
                    <div className="flex items-center justify-between mb-3 pt-3 border-t border-gray-100">
                      <h3 className="font-bold text-gray-700 text-sm">{viewClass} — Weekly Timetable</h3>
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full font-semibold">
                        Set by HOD · {viewDept}
                      </span>
                    </div>

                    {/* Time-slot header */}
                    {periods.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {periods.map((p, i) => (
                          <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-mono">
                            P{i+1}: {pad(p.startHour)}:{pad(p.startMinute)}–{pad(p.endHour)}:{pad(p.endMinute)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-[#1E2A78]">
                            <th className="text-left px-4 py-3 text-white font-semibold w-24">Day</th>
                            {periods.map((p, i) => (
                              <th key={i} className="px-3 py-3 text-center text-white font-semibold whitespace-nowrap min-w-28">
                                P{i+1}
                                <div className="text-white/60 text-xs font-normal mt-0.5">
                                  {pad(p.startHour)}:{pad(p.startMinute)}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {DAYS.map((day, di) => {
                            const daySlots = viewTimetable[day] || [];
                            const isToday  = day === new Date().toLocaleDateString("en-IN", { weekday:"long" });
                            return (
                              <tr key={day} className={`border-t border-gray-100 ${isToday ? "bg-blue-50/40" : di%2===0 ? "bg-white" : "bg-gray-50/30"}`}>
                                <td className={`px-4 py-3 font-bold text-xs whitespace-nowrap ${isToday ? "text-[#1E2A78]" : "text-gray-500"}`}>
                                  {day.slice(0,3)}{isToday && <span className="ml-1 text-blue-500">●</span>}
                                </td>
                                {periods.map((_, i) => {
                                  const slot = daySlots[i] || {};
                                  return (
                                    <td key={i} className="px-2 py-2 text-center">
                                      {slot.subject ? (
                                        <div className="rounded-lg px-2 py-1.5 border border-gray-200 bg-white">
                                          <p className="font-semibold text-gray-700 text-xs leading-tight line-clamp-2">{slot.subject}</p>
                                          {slot.teacher && <p className="text-blue-600 text-xs mt-0.5">{slot.teacher}</p>}
                                          {slot.room    && <p className="text-gray-400 text-xs">{slot.room}</p>}
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

                {viewTimetable === null && viewClass && !loadingTT && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No timetable has been set by the HOD for this class yet.
                  </div>
                )}
              </div>

              {/* Coverage overview */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h2 className="font-bold text-gray-800 text-sm mb-4">HOD Timetable Coverage by Department</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DEPARTMENTS.map(dept => {
                    const hod          = hods.find(h => h.department === dept);
                    const deptClasses  = CLASSES_BY_DEPARTMENT[dept] || [];
                    const teacherCount = allTeachers.filter(t => t.department === dept).length;
                    return (
                      <div key={dept} className={`flex items-center justify-between rounded-xl px-4 py-3 border-2 ${hod ? "border-green-200 bg-green-50" : "border-gray-100 bg-gray-50"}`}>
                        <div>
                          <p className="text-sm font-semibold text-gray-700">{dept}</p>
                          {hod ? (
                            <p className="text-xs text-green-600 font-medium">HOD: {hod.name}</p>
                          ) : (
                            <p className="text-xs text-gray-400">No HOD assigned</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">{deptClasses.length} classes · {teacherCount} teachers</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${hod ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                          {hod ? "✓ HOD Active" : "⚠ Vacant"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── HOD & TEACHERS TAB ── */}
          {activeAdminTab === "staff" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon:<FaUserTie/>, bg:"bg-[#1E2A78]/10", color:"text-[#1E2A78]", label:"Total HODs", sub:"Department heads", value:hods.length },
                  { icon:<FaUserGraduate/>, bg:"bg-green-100", color:"text-green-600", label:"Total Teachers", sub:"Across all depts", value:allTeachers.length },
                  { icon:<FaUsers/>, bg:"bg-purple-100", color:"text-purple-600", label:"Depts with HOD", sub:`Out of ${DEPARTMENTS.length} total`, value:new Set(hods.map(h=>h.department)).size },
                ].map(({ icon, bg, color, label, sub, value }) => (
                  <div key={label} className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                      <div className={`w-9 h-9 ${bg} ${color} flex items-center justify-center rounded-lg mb-2`}>{icon}</div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">{label}</p>
                      <p className={`${color} text-xs mt-0.5`}>{sub}</p>
                    </div>
                    <h3 className="text-5xl font-bold text-gray-800">{value}</h3>
                  </div>
                ))}
              </div>

              {/* Create HOD */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h2 className="text-gray-800 font-bold text-sm mb-1">Create HOD Account</h2>
                <p className="text-xs text-gray-400 mb-4">
                  HODs manage their department: create teachers, set timetables, add students, manage subjects.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                  {[
                    { key:"name",     placeholder:"Full name",        type:"text"     },
                    { key:"username", placeholder:"Username",         type:"text"     },
                    { key:"email",    placeholder:"Email address",    type:"email"    },
                    { key:"password", placeholder:"Password (min 6)", type:"password" },
                  ].map(({ key, placeholder, type }) => (
                    <input key={key} type={type} value={hodForm[key]}
                      onChange={e => setHodForm({ ...hodForm, [key]: e.target.value })}
                      className={`placeholder:text-gray-400 ${ic}`}
                      placeholder={placeholder} />
                  ))}
                  <select value={hodForm.department}
                    onChange={e => setHodForm({ ...hodForm, department: e.target.value })}
                    className={ic}>
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <button onClick={handleCreateHOD}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1E2A78] to-blue-600
                    text-white font-bold text-sm hover:opacity-90 transition">
                  Create HOD Account
                </button>
              </div>

              {/* HODs list */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h2 className="text-gray-800 font-bold text-sm mb-4">
                  All HODs <span className="ml-1 text-xs font-normal text-gray-400">({hods.length})</span>
                </h2>
                {hods.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {hods.map(hod => (
                      <div key={hod._id}
                        className="flex items-center justify-between border-2 border-gray-100 rounded-2xl p-4 hover:border-[#1E2A78]/20 transition">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-[#1E2A78] flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                            {hod.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{hod.name}</p>
                            <p className="text-xs text-gray-400">{hod.email}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="bg-[#1E2A78]/10 text-[#1E2A78] text-xs font-semibold px-2 py-0.5 rounded-full">{hod.department}</span>
                              <span className="text-xs text-gray-400">@{hod.username}</span>
                            </div>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteHOD(hod._id, hod.name)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                          <FaTrash size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <FaUserTie className="text-gray-300 text-5xl mx-auto mb-3" />
                    <p className="text-gray-400 text-sm font-medium">No HODs created yet</p>
                    <p className="text-gray-300 text-xs mt-1">Create an HOD account above and assign them a department</p>
                  </div>
                )}
              </div>

              {/* All Teachers (view-only) */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-gray-800 font-bold text-sm">All Teachers</h2>
                  <span className="text-xs font-normal text-gray-400">({allTeachers.length})</span>
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                    <FaLock size={10} /> Managed by HODs
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  Teachers are created and managed by HODs. Admin has view-only access here.
                </p>
                {allTeachers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-auto border-separate border-spacing-y-1.5 text-sm">
                      <thead>
                        <tr className="bg-[#F7F7F7] text-gray-500 text-xs uppercase tracking-wide">
                          <th className="text-left px-4 py-3 rounded-l-lg">Name</th>
                          <th className="text-left px-4 py-3">Username</th>
                          <th className="text-left px-4 py-3">Department</th>
                          <th className="text-left px-4 py-3">Subjects</th>
                          <th className="text-left px-4 py-3 rounded-r-lg">Classes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allTeachers.map(t => (
                          <tr key={t._id} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                  {t.name?.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold text-gray-800">{t.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">@{t.username}</td>
                            <td className="px-4 py-3">
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{t.department}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {t.subjects?.slice(0,3).map(s => (
                                  <span key={s} className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-xs">{s}</span>
                                ))}
                                {(t.subjects?.length||0)>3 && <span className="text-xs text-gray-400">+{t.subjects.length-3}</span>}
                                {!t.subjects?.length && <span className="text-xs text-gray-300">None</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {t.classes?.slice(0,2).map(c => (
                                  <span key={c} className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full text-xs">{c}</span>
                                ))}
                                {(t.classes?.length||0)>2 && <span className="text-xs text-gray-400">+{t.classes.length-2}</span>}
                                {!t.classes?.length && <span className="text-xs text-gray-300">None</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <FaUserGraduate className="text-gray-300 text-5xl mx-auto mb-3" />
                    <p className="text-gray-400 text-sm font-medium">No teachers added yet</p>
                    <p className="text-gray-300 text-xs mt-1">HODs create teachers from their portal</p>
                  </div>
                )}
              </div>

              {/* Dept coverage */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h2 className="text-gray-800 font-bold text-sm mb-4">Department HOD Coverage</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DEPARTMENTS.map(dept => {
                    const hod          = hods.find(h => h.department === dept);
                    const teacherCount = allTeachers.filter(t => t.department === dept).length;
                    return (
                      <div key={dept} className={`flex items-center justify-between rounded-xl px-4 py-3 border-2 ${hod ? "border-green-200 bg-green-50" : "border-gray-100 bg-gray-50"}`}>
                        <div>
                          <p className="text-sm font-semibold text-gray-700">{dept}</p>
                          {hod ? (
                            <p className="text-xs text-green-600 font-medium">HOD: {hod.name}</p>
                          ) : (
                            <p className="text-xs text-gray-400">No HOD assigned</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${hod ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                            {hod ? "✓ Assigned" : "⚠ Vacant"}
                          </span>
                          {teacherCount > 0 && (
                            <p className="text-xs text-gray-400 mt-1">{teacherCount} teacher{teacherCount>1?"s":""}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
