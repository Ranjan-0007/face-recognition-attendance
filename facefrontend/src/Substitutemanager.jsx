import "./App.css";
import React, { useState, useEffect } from "react";
import { FaTrash, FaUserTie, FaExclamationTriangle, FaCheckCircle, FaTimes } from "react-icons/fa";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const SubstituteManager = ({ dept, hodUsername, teachers, periods, timetable, onClose }) => {
  const [substitutes,     setSubstitutes]     = useState([]);
  const [selectedDate,    setSelectedDate]    = useState(new Date().toISOString().split("T")[0]);
  const [selectedClass,   setSelectedClass]   = useState("");
  const [selectedSlot,    setSelectedSlot]    = useState(null);
  const [substituteTeacher, setSubstituteTeacher] = useState("");
  const [reason,          setReason]          = useState("");
  const [loading,         setLoading]         = useState(false);
  const [toast,           setToast]           = useState({ msg: "", type: "" });

  // Get list of all classes with timetable
  const deptClasses = Object.keys(timetable);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  };

  const fetchSubstitutes = async () => {
    try {
      const res  = await fetch(`http://localhost:5001/api/substitutes?date=${selectedDate}&department=${encodeURIComponent(dept)}`);
      const data = await res.json();
      setSubstitutes(Array.isArray(data) ? data : []);
    } catch { console.error("Failed to fetch substitutes"); }
  };

  useEffect(() => { fetchSubstitutes(); }, [selectedDate]);

  const getDayOfWeek = (dateStr) => {
    const d    = new Date(dateStr + "T00:00:00");
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    return days[d.getDay()];
  };

  const dayOfWeek = getDayOfWeek(selectedDate);
  const isSunday  = dayOfWeek === "Sunday";

  // Get timetable slots for selected class on the selected day
  const classSlots = selectedClass && timetable[selectedClass]
    ? (timetable[selectedClass][dayOfWeek] || [])
    : [];

  const handleAssign = async () => {
    if (!selectedClass || selectedSlot === null) {
      showToast("Select class and period slot", "error"); return;
    }
    const slot = classSlots[selectedSlot];
    if (!slot?.teacher) {
      showToast("No teacher assigned to this slot in the timetable", "error"); return;
    }

    setLoading(true);
    try {
      const res  = await fetch("http://localhost:5001/api/substitutes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date:              selectedDate,
          originalTeacher:   slot.teacher,
          substituteTeacher: substituteTeacher || null,
          className:         selectedClass,
          slotIndex:         selectedSlot,
          subject:           slot.subject,
          department:        dept,
          reason,
          createdByHOD:      hodUsername,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setSelectedSlot(null); setSubstituteTeacher(""); setReason("");
        fetchSubstitutes();
      } else showToast(data.message, "error");
    } catch { showToast("Server error", "error"); }
    setLoading(false);
  };

  const handleRemove = async (id) => {
    try {
      const res  = await fetch(`http://localhost:5001/api/substitutes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) { showToast(data.message, "success"); fetchSubstitutes(); }
      else showToast(data.message, "error");
    } catch { showToast("Server error", "error"); }
  };

  const pad = n => String(n).padStart(2, "0");
  const ic  = "w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E2A78] bg-gray-50";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {toast.msg && (
          <div className={`fixed top-5 right-5 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-xs ${
            toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-[#1E2A78]"
          }`}>{toast.msg}</div>
        )}

        {/* Header */}
        <div className="bg-[#1E2A78] rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-sm">Substitute Teacher Manager</h2>
            <p className="text-blue-300 text-xs">{dept} — Mark teacher absent & assign substitute</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-white/70 hover:text-white p-1">
              <FaTimes />
            </button>
          )}
        </div>

        <div className="p-5">
          {/* Date selector */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5 flex flex-wrap gap-4 items-center">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Select Date</label>
              <input type="date" value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="border-2 border-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1E2A78] bg-white" />
            </div>
            <div className="text-sm">
              <p className="text-gray-400 text-xs">Day of week</p>
              <p className={`font-bold ${isSunday ? "text-orange-500" : "text-gray-700"}`}>
                {dayOfWeek} {isSunday && "— Holiday"}
              </p>
            </div>
          </div>

          {isSunday ? (
            <div className="text-center py-8">
              <span className="text-5xl">🏖️</span>
              <p className="text-gray-400 text-sm mt-3">Sunday is a holiday — no classes scheduled</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Left — Add substitute */}
              <div>
                <h3 className="font-bold text-gray-700 text-sm mb-3">Assign Substitute</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Class</label>
                    <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSlot(null); }} className={ic}>
                      <option value="">Select class</option>
                      {deptClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {selectedClass && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                        Period Slot — {dayOfWeek}
                      </label>
                      <div className="space-y-2">
                        {classSlots.length === 0 ? (
                          <p className="text-xs text-gray-400 py-2">No slots configured for {dayOfWeek}</p>
                        ) : classSlots.map((slot, i) => {
                          const p = periods[i];
                          if (!slot?.subject || !slot?.teacher) return null;
                          const isSelected = selectedSlot === i;
                          const alreadySubbed = substitutes.find(s => s.className === selectedClass && s.slotIndex === i);
                          return (
                            <button key={i} onClick={() => setSelectedSlot(i)}
                              className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-xs transition ${
                                isSelected ? "border-[#1E2A78] bg-[#1E2A78]/5"
                                : alreadySubbed ? "border-orange-200 bg-orange-50"
                                : "border-gray-100 hover:border-gray-300"
                              }`}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-bold text-[#1E2A78] mr-2">P{i+1}</span>
                                  {p && <span className="text-gray-400 font-mono mr-2">{pad(p.startHour)}:{pad(p.startMinute)}</span>}
                                  <span className="font-semibold text-gray-700">{slot.subject}</span>
                                </div>
                                {alreadySubbed ? (
                                  <span className="text-orange-600 font-bold text-xs">⚠ Substituted</span>
                                ) : (
                                  <span className="text-gray-400">{slot.teacher}</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedSlot !== null && (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                          Substitute Teacher (leave blank = cancel class)
                        </label>
                        <select value={substituteTeacher} onChange={e => setSubstituteTeacher(e.target.value)} className={ic}>
                          <option value="">❌ Cancel class (no substitute)</option>
                          {teachers
                            .filter(t => t.name !== classSlots[selectedSlot]?.teacher)
                            .map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Reason (optional)</label>
                        <input type="text" value={reason} placeholder="e.g. Teacher is sick, on leave..."
                          onChange={e => setReason(e.target.value)} className={ic} />
                      </div>
                      <button onClick={handleAssign} disabled={loading}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1E2A78] to-blue-600 text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-60">
                        {loading ? "Saving..."
                          : substituteTeacher
                          ? `Assign ${substituteTeacher} as Substitute`
                          : "Mark Class as Cancelled"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Right — Today's substitutes list */}
              <div>
                <h3 className="font-bold text-gray-700 text-sm mb-3">
                  Substitutes for {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  <span className="ml-2 text-xs font-normal text-gray-400">({substitutes.length})</span>
                </h3>

                {substitutes.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-2xl">
                    <FaUserTie className="text-gray-300 text-3xl mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No substitutes assigned yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {substitutes.map(sub => {
                      const p = periods[sub.slotIndex];
                      return (
                        <div key={sub._id} className={`border-2 rounded-xl p-4 ${
                          sub.substituteTeacher ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-xs font-bold text-[#1E2A78] bg-[#1E2A78]/10 px-2 py-0.5 rounded-lg">
                                  P{sub.slotIndex + 1}{p ? ` · ${pad(p.startHour)}:${pad(p.startMinute)}` : ""}
                                </span>
                                <span className="text-xs font-semibold text-gray-700">{sub.className}</span>
                              </div>
                              <p className="text-xs font-semibold text-gray-800 mb-1">{sub.subject}</p>
                              <div className="flex items-center gap-1 text-xs">
                                <span className="text-gray-500 line-through">{sub.originalTeacher}</span>
                                <span className="text-gray-400">→</span>
                                {sub.substituteTeacher ? (
                                  <span className="text-green-700 font-bold">{sub.substituteTeacher}</span>
                                ) : (
                                  <span className="text-red-600 font-bold">CLASS CANCELLED</span>
                                )}
                              </div>
                              {sub.reason && <p className="text-xs text-gray-400 mt-1 italic">"{sub.reason}"</p>}
                            </div>
                            <button onClick={() => handleRemove(sub._id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                              <FaTrash size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubstituteManager;