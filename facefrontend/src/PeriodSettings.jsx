import "./App.css";
import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import {
  DEPARTMENTS,
  CLASSES_BY_DEPARTMENT,
  TIME_SLOTS,
  DEFAULT_SUBJECTS_BY_DEPARTMENT
} from "./courses";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const emptySlots = () =>
  TIME_SLOTS.map(ts => ({ slot: ts.slot, subject: "", room: "" }));

const PeriodSettings = () => {
  const [selectedDept,  setSelectedDept]  = useState(DEPARTMENTS[0]);
  const [selectedClass, setSelectedClass] = useState("");
  const [timetable,     setTimetable]     = useState({});
  const [saving,        setSaving]        = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [toast,         setToast]         = useState({ msg: "", type: "" });

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 3000);
  };

  const classes  = CLASSES_BY_DEPARTMENT[selectedDept] || [];
  const subjects = DEFAULT_SUBJECTS_BY_DEPARTMENT[selectedDept] || [];

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    fetch(`http://localhost:5001/api/timetable/${encodeURIComponent(selectedClass)}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.slots && Object.keys(data.slots).length > 0) {
          setTimetable(data.slots);
        } else {
          const slots = {};
          DAYS.forEach(day => { slots[day] = emptySlots(); });
          setTimetable(slots);
        }
        setLoading(false);
      })
      .catch(() => {
        const slots = {};
        DAYS.forEach(day => { slots[day] = emptySlots(); });
        setTimetable(slots);
        setLoading(false);
      });
  }, [selectedClass]);

  const updateSlot = (day, slotIndex, field, value) => {
    setTimetable(prev => ({
      ...prev,
      [day]: prev[day].map((s, i) =>
        i === slotIndex ? { ...s, [field]: value } : s
      )
    }));
  };

  const clearDay = (day) => {
    setTimetable(prev => ({ ...prev, [day]: emptySlots() }));
  };

  const copyDayToAll = (fromDay) => {
    setTimetable(prev => {
      const newTT = { ...prev };
      DAYS.forEach(day => {
        if (day !== fromDay)
          newTT[day] = (prev[fromDay] || emptySlots()).map(s => ({ ...s }));
      });
      return newTT;
    });
    showToast(`Copied ${fromDay} to all days`, "success");
  };

  const saveTimetable = async () => {
    if (!selectedClass) return showToast("Please select a class first", "error");
    setSaving(true);
    try {
      const res = await fetch("http://localhost:5001/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ className: selectedClass, department: selectedDept, slots: timetable }),
      });
      const data = await res.json();
      if (res.ok) showToast(`Timetable saved for ${selectedClass}!`, "success");
      else        showToast(data.message || "Failed to save", "error");
    } catch { showToast("Server error", "error"); }
    setSaving(false);
  };

  return (
    <div className="min-h-screen p-4 bg-split">
      {toast.msg && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
          toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-[#1E2A78]"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <Sidebar />
        <div className="flex-1">

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-white mb-6 gap-4">
            <div>
              <p className="text-sm opacity-80">Pages / Period Settings</p>
              <h1 className="text-xl font-bold">College Timetable Manager</h1>
              <p className="text-xs opacity-70 mt-0.5">Add subjects for every period, every class</p>
            </div>
            <button onClick={saveTimetable} disabled={saving || !selectedClass}
              className="px-6 py-2.5 bg-white text-[#1E2A78] rounded-xl text-sm font-bold hover:bg-gray-100 transition disabled:opacity-50 shadow-md">
              {saving ? "Saving..." : "💾 Save Timetable"}
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
            <h2 className="text-gray-800 font-bold text-sm mb-4">Step 1 — Select Department & Class</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Department</label>
                <select value={selectedDept}
                  onChange={e => { setSelectedDept(e.target.value); setSelectedClass(""); setTimetable({}); }}
                  className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E2A78]">
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Class / Section</label>
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                  className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E2A78]">
                  <option value="">— Select a class —</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {classes.map(c => (
                <button key={c} onClick={() => setSelectedClass(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectedClass === c ? "bg-[#1E2A78] text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
            <h2 className="text-gray-800 font-bold text-sm mb-3">College Time Slots</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {TIME_SLOTS.map(ts => (
                <div key={ts.slot} className="bg-[#1E2A78]/5 border border-[#1E2A78]/10 rounded-xl p-3 text-center">
                  <p className="text-xs font-bold text-[#1E2A78]">{ts.label}</p>
                  <p className="text-sm font-black text-[#1E2A78] mt-1">{ts.start}</p>
                  <p className="text-xs text-gray-400">to {ts.end}</p>
                </div>
              ))}
            </div>
          </div>

          {!selectedClass ? (
            <div className="bg-white rounded-2xl p-12 text-center">
              <div className="text-5xl mb-4">📅</div>
              <p className="text-gray-500 font-semibold">Select a department and class above</p>
              <p className="text-gray-400 text-sm mt-1">Then add subjects for each period and day</p>
            </div>
          ) : loading ? (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400">Loading timetable...</div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-700">
                <p className="font-bold mb-1">How to use:</p>
                <p>For each day, select a subject from the dropdown for each period slot. Use "Copy to all days" to replicate a day's schedule.</p>
              </div>

              {DAYS.map(day => (
                <div key={day} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="bg-[#1E2A78] px-5 py-3 flex items-center justify-between">
                    <h3 className="font-bold text-white text-sm">{day}</h3>
                    <div className="flex gap-2">
                      <button onClick={() => copyDayToAll(day)}
                        className="text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition font-medium">
                        Copy to all days
                      </button>
                      <button onClick={() => clearDay(day)}
                        className="text-xs text-red-300 hover:text-white bg-white/10 hover:bg-red-500/40 px-3 py-1.5 rounded-lg transition font-medium">
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {(timetable[day] || emptySlots()).map((slot, i) => {
                        const ts = TIME_SLOTS[i] || TIME_SLOTS[0];
                        return (
                          <div key={i} className={`border-2 rounded-xl p-3 transition ${
                            slot.subject ? "border-[#1E2A78]/20 bg-blue-50/50" : "border-dashed border-gray-200 bg-gray-50/50"
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-[#1E2A78] bg-[#1E2A78]/10 px-2 py-0.5 rounded-lg">P{ts.slot}</span>
                              <span className="text-xs text-gray-400 font-mono">{ts.start}–{ts.end}</span>
                            </div>
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Subject</label>
                            <select value={slot.subject}
                              onChange={e => updateSlot(day, i, "subject", e.target.value)}
                              className="w-full text-xs border-2 border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:border-[#1E2A78] bg-white mb-2">
                              <option value="">— Free / No Class —</option>
                              <optgroup label={`${selectedDept} Subjects`}>
                                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                              </optgroup>
                              <optgroup label="Common Subjects">
                                <option value="General Punjabi">General Punjabi</option>
                                <option value="General English">General English</option>
                                <option value="Environmental Studies (EVS)">Environmental Studies (EVS)</option>
                                <option value="DAB (Disaster Awareness)">DAB (Disaster Awareness)</option>
                                <option value="Library / Self Study">Library / Self Study</option>
                                <option value="Sports / Games">Sports / Games</option>
                                <option value="Practical / Lab">Practical / Lab</option>
                              </optgroup>
                            </select>
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Room</label>
                            <input type="text" value={slot.room || ""}
                              onChange={e => updateSlot(day, i, "room", e.target.value)}
                              className="w-full text-xs border-2 border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:border-[#1E2A78] bg-white"
                              placeholder="e.g. CR.101, Lab 1" />
                            {slot.subject && (
                              <p className="text-xs text-[#1E2A78] font-medium mt-2 leading-tight">{slot.subject}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={saveTimetable} disabled={saving}
                className="w-full py-4 bg-gradient-to-r from-[#1E2A78] to-blue-600 text-white rounded-2xl font-bold text-sm hover:opacity-90 transition disabled:opacity-60 shadow-md">
                {saving ? "Saving..." : `Save Timetable for ${selectedClass}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PeriodSettings;
