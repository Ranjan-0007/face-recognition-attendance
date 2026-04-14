import "./App.css";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import { DEPARTMENTS, CLASSES_BY_DEPARTMENT, TIME_SLOTS } from "./courses";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const subjectColors = [
  "bg-blue-50 text-blue-800", "bg-purple-50 text-purple-800",
  "bg-green-50 text-green-800", "bg-orange-50 text-orange-800",
  "bg-pink-50 text-pink-800",  "bg-cyan-50 text-cyan-800",
  "bg-yellow-50 text-yellow-800", "bg-red-50 text-red-800",
];

const getSubjectColor = (subject) => {
  if (!subject) return "bg-gray-50 text-gray-400";
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  return subjectColors[Math.abs(hash) % subjectColors.length];
};

const TimetableGrid = ({ timetable, loading, selectedDay, now }) => {
  const currentH = now.getHours(), currentM = now.getMinutes();
  const isCurrentSlot = (ts) => {
    const afterStart = currentH > ts.startHour || (currentH === ts.startHour && currentM >= ts.startMinute);
    const beforeEnd  = currentH < ts.endHour   || (currentH === ts.endHour   && currentM <  ts.endMinute);
    return afterStart && beforeEnd;
  };

  const days = selectedDay ? [selectedDay] : DAYS;

  if (loading) return <div className="bg-white rounded-2xl p-10 text-center text-gray-400 text-sm">Loading timetable...</div>;

  const hasData = Object.keys(timetable).length > 0;
  if (!hasData) return (
    <div className="bg-white rounded-2xl p-10 text-center">
      <p className="text-gray-400 text-sm">No timetable configured for this class yet.</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-[#1E2A78]">
              <th className="text-left px-4 py-3 text-white font-semibold w-28">Time</th>
              {days.map(d => (
                <th key={d} className={`px-3 py-3 text-center font-semibold ${
                  d === now.toLocaleDateString("en-IN", { weekday: "long" })
                    ? "text-yellow-300" : "text-white"
                }`}>{d.slice(0, 3)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((ts, i) => {
              const isCurrent = isCurrentSlot(ts);
              return (
                <tr key={ts.slot} className={`border-t border-gray-50 ${isCurrent ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  <td className={`px-4 py-3 font-mono whitespace-nowrap ${isCurrent ? "font-bold text-[#1E2A78]" : "text-gray-400"}`}>
                    <div>{ts.start}</div>
                    <div className="text-gray-300">to {ts.end}</div>
                    {isCurrent && <div className="text-xs text-blue-600 font-bold mt-0.5">● Now</div>}
                  </td>
                  {days.map(d => {
                    const slot = (timetable[d] || [])[i] || {};
                    return (
                      <td key={d} className="px-2 py-2 text-center">
                        {slot.subject ? (
                          <div className={`rounded-xl px-2 py-2 ${getSubjectColor(slot.subject)}`}>
                            <p className="font-bold text-xs leading-tight">{slot.subject}</p>
                            {slot.teacher && <p className="text-xs opacity-70 mt-0.5">{slot.teacher}</p>}
                            {slot.room    && <p className="text-xs opacity-60">{slot.room}</p>}
                          </div>
                        ) : (
                          <span className="text-gray-200 text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Timetable = () => {
  const [timetable, setTimetable]         = useState({});
  const [loading, setLoading]             = useState(false);
  const [selectedDept, setSelectedDept]   = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDay, setSelectedDay]     = useState("");
  const now = new Date();

  const studentToken = localStorage.getItem("studentToken");
  const adminToken   = localStorage.getItem("adminToken");
  const isStudent    = !!studentToken;
  const isAdmin      = !!adminToken && !studentToken;
  const studentInfo  = isStudent
    ? (() => { try { return JSON.parse(localStorage.getItem("studentInfo") || "{}"); } catch { return {}; } })()
    : null;

  // Auto-select student's own class
  useEffect(() => {
    if (isStudent && studentInfo?.className) {
      setSelectedClass(studentInfo.className);
      setSelectedDept(studentInfo.department || "");
    }
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    fetch(`http://localhost:5001/api/timetable/${encodeURIComponent(selectedClass)}`)
      .then(r => r.json())
      .then(data => { setTimetable(data?.slots || {}); setLoading(false); })
      .catch(() => { setTimetable({}); setLoading(false); });
  }, [selectedClass]);

  const classes = selectedDept ? CLASSES_BY_DEPARTMENT[selectedDept] || [] : [];

  const todayName = now.toLocaleDateString("en-IN", { weekday: "long" });

  // ── STUDENT VIEW ──────────────────────────────
  if (isStudent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1E2A78] to-white">
        <div className="bg-[#1E2A78] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-white font-black">GN</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm">Class Timetable</p>
              <p className="text-blue-300 text-xs">Guru Nanak Dev University College</p>
            </div>
          </div>
          <Link to="/student-dashboard">
            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition">
              ← Dashboard
            </button>
          </Link>
        </div>

        <div className="max-w-5xl mx-auto p-5">
          {studentInfo?.name && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1E2A78] flex items-center justify-center text-white font-black">
                {studentInfo.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-gray-800 text-sm">{studentInfo.name}</p>
                <p className="text-xs text-gray-400">
                  {studentInfo.course}
                  {studentInfo.semester && ` · Sem ${studentInfo.semester}`}
                  {studentInfo.className && ` · ${studentInfo.className}`}
                </p>
              </div>
            </div>
          )}

          {/* Day filter */}
          <div className="flex gap-2 flex-wrap mb-4">
            <button onClick={() => setSelectedDay("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!selectedDay ? "bg-[#1E2A78] text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
              All Days
            </button>
            {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(d => (
              <button key={d} onClick={() => setSelectedDay(d === selectedDay ? "" : d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectedDay === d ? "bg-[#1E2A78] text-white"
                  : d === todayName ? "bg-blue-100 text-blue-700"
                  : "bg-white text-gray-600 hover:bg-gray-100"
                }`}>
                {d.slice(0, 3)}
                {d === todayName && <span className="ml-1 text-xs">●</span>}
              </button>
            ))}
          </div>

          <TimetableGrid timetable={timetable} loading={loading} selectedDay={selectedDay} now={now} />
          <p className="text-xs text-gray-400 mt-3 text-center">Contact admin to update timetable.</p>
        </div>
      </div>
    );
  }

  // ── ADMIN VIEW ────────────────────────────────
  if (isAdmin) {
    return (
      <div className="min-h-screen p-4 bg-split">
        <div className="flex flex-col lg:flex-row gap-6">
          <Sidebar />
          <div className="flex-1">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-white mb-6 gap-4">
              <div>
                <p className="text-sm opacity-80">Pages / Timetable</p>
                <h1 className="text-xl font-bold">College Timetable</h1>
              </div>
              <Link to="/period-settings">
                <button className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm font-semibold transition">
                  Edit Timetable →
                </button>
              </Link>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <h2 className="text-gray-800 font-bold text-sm mb-4">Select Department & Class</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Department</label>
                  <select value={selectedDept}
                    onChange={e => { setSelectedDept(e.target.value); setSelectedClass(""); }}
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E2A78]">
                    <option value="">All Departments</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Class</label>
                  <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E2A78]">
                    <option value="">Select class</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Day</label>
                  <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)}
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E2A78]">
                    <option value="">All Days</option>
                    {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {selectedClass ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-gray-800 font-bold text-sm">{selectedClass} — {selectedDay || "Full Week"}</h2>
                  <Link to="/period-settings">
                    <button className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 bg-blue-50 rounded-lg">
                      Edit this timetable →
                    </button>
                  </Link>
                </div>
                <TimetableGrid timetable={timetable} loading={loading} selectedDay={selectedDay} now={now} />
              </>
            ) : (
              <div className="bg-white rounded-2xl p-10 text-center">
                <p className="text-gray-400 text-sm">Select a department and class to view timetable</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Not logged in
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1E2A78] to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-sm w-full">
        <h2 className="font-black text-gray-800 text-xl mb-2">Timetable</h2>
        <p className="text-gray-500 text-sm mb-6">Please log in to view the timetable.</p>
        <div className="flex flex-col gap-3">
          <Link to="/student-register">
            <button className="w-full py-2.5 rounded-xl bg-[#1E2A78] text-white font-bold text-sm hover:opacity-90 transition">Student Login</button>
          </Link>
          <Link to="/signin">
            <button className="w-full py-2.5 rounded-xl border-2 border-[#1E2A78] text-[#1E2A78] font-bold text-sm hover:bg-blue-50 transition">Admin Login</button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Timetable;