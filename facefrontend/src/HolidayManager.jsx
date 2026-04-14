import "./App.css";
import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { FaTrash, FaCalendarAlt, FaPlus, FaGlobe, FaStar, FaUniversity } from "react-icons/fa";

const HOLIDAY_TYPES = [
  { value: "national",  label: "National Holiday",  color: "bg-orange-100 text-orange-700",   icon: "🇮🇳" },
  { value: "religious", label: "Religious Holiday",  color: "bg-purple-100 text-purple-700",  icon: "🙏" },
  { value: "college",   label: "College Holiday",    color: "bg-blue-100 text-blue-700",      icon: "🏫" },
  { value: "exam",      label: "Exam / No Classes",  color: "bg-red-100 text-red-700",        icon: "📝" },
];

// Pre-filled common Indian college holidays
const PRESET_HOLIDAYS = [
  { date: "", name: "Republic Day",        type: "national",  description: "National holiday - January 26" },
  { date: "", name: "Independence Day",    type: "national",  description: "National holiday - August 15" },
  { date: "", name: "Gandhi Jayanti",      type: "national",  description: "National holiday - October 2" },
  { date: "", name: "Diwali",              type: "religious", description: "Festival of Lights" },
  { date: "", name: "Holi",               type: "religious", description: "Festival of Colors" },
  { date: "", name: "Eid al-Fitr",         type: "religious", description: "Eid holiday" },
  { date: "", name: "Gurpurab",            type: "religious", description: "Guru Nanak Jayanti" },
  { date: "", name: "Dussehra",            type: "religious", description: "Vijayadashami" },
  { date: "", name: "Summer Vacation",     type: "college",   description: "College summer break" },
  { date: "", name: "Winter Vacation",     type: "college",   description: "College winter break" },
  { date: "", name: "Mid-Sem Exam Week",   type: "exam",      description: "Mid semester examinations" },
  { date: "", name: "End-Sem Exam Week",   type: "exam",      description: "End semester examinations" },
];

const HolidayManager = () => {
  const [holidays,    setHolidays]    = useState([]);
  const [form,        setForm]        = useState({ date: "", name: "", description: "", type: "college" });
  const [loading,     setLoading]     = useState(false);
  const [toast,       setToast]       = useState({ msg: "", type: "" });
  const [filterYear,  setFilterYear]  = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState("");
  const [showPresets, setShowPresets] = useState(false);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  };

  const fetchHolidays = async () => {
    try {
      let url = `http://localhost:5001/api/holidays?year=${filterYear}`;
      if (filterMonth) url += `&month=${filterMonth}`;
      const res  = await fetch(url);
      const data = await res.json();
      setHolidays(Array.isArray(data) ? data : []);
    } catch { showToast("Failed to load holidays", "error"); }
  };

  useEffect(() => { fetchHolidays(); }, [filterYear, filterMonth]);

  const handleAdd = async () => {
    if (!form.date || !form.name.trim()) {
      showToast("Date and name are required", "error"); return;
    }
    setLoading(true);
    try {
      const res  = await fetch("http://localhost:5001/api/holidays", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, createdBy: "admin" }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setForm({ date: "", name: "", description: "", type: "college" });
        fetchHolidays();
      } else showToast(data.message, "error");
    } catch { showToast("Server error", "error"); }
    setLoading(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove holiday: ${name}?`)) return;
    try {
      const res  = await fetch(`http://localhost:5001/api/holidays/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) { showToast(data.message, "success"); fetchHolidays(); }
      else showToast(data.message, "error");
    } catch { showToast("Server error", "error"); }
  };

  const handlePreset = (preset) => {
    setForm(prev => ({ ...prev, name: preset.name, description: preset.description, type: preset.type }));
    setShowPresets(false);
  };

  const getTypeInfo = (type) => HOLIDAY_TYPES.find(t => t.value === type) || HOLIDAY_TYPES[2];

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const today   = new Date().toISOString().split("T")[0];
  const ic      = "w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E2A78] bg-gray-50";
  const months  = [
    { v: "",   l: "All Months"  }, { v: "1",  l: "January"   }, { v: "2",  l: "February"  },
    { v: "3",  l: "March"      }, { v: "4",  l: "April"      }, { v: "5",  l: "May"        },
    { v: "6",  l: "June"       }, { v: "7",  l: "July"       }, { v: "8",  l: "August"     },
    { v: "9",  l: "September"  }, { v: "10", l: "October"    }, { v: "11", l: "November"   },
    { v: "12", l: "December"   },
  ];

  // Group holidays by month
  const grouped = holidays.reduce((acc, h) => {
    const month = h.date.substring(0, 7); // "YYYY-MM"
    if (!acc[month]) acc[month] = [];
    acc[month].push(h);
    return acc;
  }, {});

  return (
    <div className="min-h-screen p-4 bg-split">
      {toast.msg && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-xs ${
          toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-[#1E2A78]"
        }`}>{toast.msg}</div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <Sidebar />
        <div className="flex-1">
          <div className="text-white mb-6">
            <p className="text-sm opacity-80">Pages / Holiday Calendar</p>
            <h1 className="text-xl font-bold">Academic Holiday Calendar</h1>
            <p className="text-xs opacity-60 mt-0.5">
              Holidays added here are automatically excluded from attendance calculations
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left — Add Holiday Form */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h2 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
                  <FaPlus className="text-[#1E2A78]" /> Add Holiday
                </h2>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Date</label>
                    <input type="date" value={form.date} min="2024-01-01" max="2026-12-31"
                      onChange={e => setForm({ ...form, date: e.target.value })}
                      className={ic} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Holiday Name</label>
                    <div className="flex gap-2">
                      <input type="text" value={form.name} placeholder="e.g. Diwali, Holi..."
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className={ic} />
                      <button onClick={() => setShowPresets(!showPresets)}
                        className="px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold whitespace-nowrap transition">
                        Presets
                      </button>
                    </div>
                    {/* Preset suggestions */}
                    {showPresets && (
                      <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {PRESET_HOLIDAYS.map((p, i) => (
                          <button key={i} onClick={() => handlePreset(p)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-0">
                            <span>{getTypeInfo(p.type).icon}</span>
                            <div>
                              <p className="font-semibold text-gray-700">{p.name}</p>
                              <p className="text-gray-400">{p.description}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Type</label>
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={ic}>
                      {HOLIDAY_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Description (optional)</label>
                    <input type="text" value={form.description} placeholder="Short note..."
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      className={ic} />
                  </div>
                  <button onClick={handleAdd} disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1E2A78] to-blue-600 text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-60">
                    {loading ? "Adding..." : "Add Holiday"}
                  </button>
                </div>
              </div>

              {/* Info card */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
                <p className="font-bold text-amber-800 text-sm mb-2">📋 How holidays work</p>
                <ul className="text-xs text-amber-700 space-y-1.5 list-disc ml-4">
                  <li>Holidays are automatically skipped in attendance calculation</li>
                  <li>Students see upcoming holidays in their portal</li>
                  <li>Face recognition is disabled on holidays</li>
                  <li>Sunday is always a holiday (no need to add it)</li>
                </ul>
              </div>

              {/* Type legend */}
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="font-bold text-gray-700 text-xs mb-3 uppercase tracking-wide">Holiday Types</p>
                <div className="space-y-2">
                  {HOLIDAY_TYPES.map(t => (
                    <div key={t.value} className="flex items-center gap-2">
                      <span className="text-base">{t.icon}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.color}`}>{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — Calendar View */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <FaCalendarAlt className="text-[#1E2A78]" />
                    {filterYear} Academic Calendar
                    <span className="text-xs font-normal text-gray-400">({holidays.length} holidays)</span>
                  </h2>
                  <div className="flex gap-2">
                    <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none">
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                    </select>
                    <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none">
                      {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                    </select>
                  </div>
                </div>

                {holidays.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-4">📅</div>
                    <p className="text-gray-400 font-semibold">No holidays added for {filterYear}</p>
                    <p className="text-gray-300 text-xs mt-1">Add holidays using the form on the left</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {Object.entries(grouped).map(([monthKey, monthHolidays]) => {
                      const monthDate = new Date(monthKey + "-01");
                      const monthName = monthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
                      return (
                        <div key={monthKey}>
                          <p className="text-xs font-bold text-[#1E2A78] uppercase tracking-wide mb-2">{monthName}</p>
                          <div className="space-y-2">
                            {monthHolidays.map(h => {
                              const typeInfo = getTypeInfo(h.type);
                              const isPast   = h.date < today;
                              const isToday  = h.date === today;
                              return (
                                <div key={h._id} className={`flex items-center gap-4 p-3 rounded-xl border transition ${
                                  isToday ? "border-[#1E2A78] bg-[#1E2A78]/5"
                                  : isPast ? "border-gray-100 bg-gray-50 opacity-60"
                                  : "border-gray-100 bg-white hover:border-gray-200"
                                }`}>
                                  {/* Date badge */}
                                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center ${
                                    isToday ? "bg-[#1E2A78] text-white" : "bg-gray-100 text-gray-600"
                                  }`}>
                                    <span className="text-xs font-semibold">
                                      {new Date(h.date + "T00:00:00").toLocaleDateString("en-IN", { month: "short" })}
                                    </span>
                                    <span className="text-lg font-black leading-none">
                                      {new Date(h.date + "T00:00:00").getDate()}
                                    </span>
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-bold text-gray-800 text-sm">{typeInfo.icon} {h.name}</p>
                                      {isToday && <span className="text-xs bg-[#1E2A78] text-white px-2 py-0.5 rounded-full font-bold">Today</span>}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      {new Date(h.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                                      {h.description && ` · ${h.description}`}
                                    </p>
                                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full mt-1 inline-block ${typeInfo.color}`}>
                                      {typeInfo.label}
                                    </span>
                                  </div>

                                  <button onClick={() => handleDelete(h._id, h.name)}
                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                                    <FaTrash size={13} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HolidayManager;