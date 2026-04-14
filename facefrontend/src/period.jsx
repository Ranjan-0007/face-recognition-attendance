import "./App.css";
import React, { useEffect, useState, useMemo } from "react";
import { FaFileExcel, FaSearch, FaFilter, FaSync } from "react-icons/fa";
import Sidebar from "./Sidebar";
import { DEPARTMENTS, CLASSES_BY_DEPARTMENT } from "./courses";

const Period = () => {
  const [attendanceData, setAttendanceData]       = useState([]);
  const [allTimetables, setAllTimetables]         = useState([]);
  const [loading, setLoading]                     = useState(true);
  const [refreshing, setRefreshing]               = useState(false);
  const [searchText, setSearchText]               = useState("");
  const [filterPeriod, setFilterPeriod]           = useState("");
  const [filterDate, setFilterDate]               = useState("");
  const [filterDept, setFilterDept]               = useState("");
  const [filterClass, setFilterClass]             = useState("");
  const [filterSemester, setFilterSemester]       = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions]     = useState(false);
  const [currentPage, setCurrentPage]             = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchAll = async () => {
    try {
      // ✅ Fetch attendance + ALL timetables from DB (not global periods)
      const [attRes, ttListRes] = await Promise.all([
        fetch("http://localhost:5001/api/periodwise-attendance"),
        fetch("http://localhost:5001/api/timetables"),
      ]);
      const attData    = await attRes.json();
      const ttListData = await ttListRes.json();

      setAttendanceData(Array.isArray(attData) ? attData : []);

      // Fetch full slots for each timetable
      if (Array.isArray(ttListData) && ttListData.length > 0) {
        const fullTimetables = await Promise.all(
          ttListData.map(async (tt) => {
            try {
              const res  = await fetch(
                `http://localhost:5001/api/timetable/${encodeURIComponent(tt.className)}`
              );
              const data = await res.json();
              return { className: tt.className, department: tt.department, slots: data?.slots || {} };
            } catch { return { className: tt.className, slots: {} }; }
          })
        );
        setAllTimetables(fullTimetables);
      } else {
        setAllTimetables([]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleRefresh = () => { setRefreshing(true); fetchAll(); };

  // ✅ Subjects ONLY from teacher-saved timetables — no fixed/global periods
  const allSubjects = useMemo(() => {
    const subjects = new Set();

    // From all timetables saved by admin/teacher
    allTimetables.forEach(tt => {
      Object.values(tt.slots || {}).forEach(daySlots => {
        if (Array.isArray(daySlots)) {
          daySlots.forEach(slot => {
            if (slot?.subject &&
                slot.subject.trim() !== "" &&
                slot.subject !== "Free / No Class" &&
                slot.subject !== "— Free / No Class —" &&
                slot.subject !== "Library / Self Study" &&
                slot.subject !== "Sports / Games" &&
                slot.subject !== "Practical / Lab" &&
                slot.subject !== "General Punjabi" &&
                slot.subject !== "Business Punjabi" &&
                slot.subject !== "General English") {
              subjects.add(slot.subject);
            }
          });
        }
      });
    });

    // Also include subjects that already appear in attendance records
    // (in case timetable was changed after recording)
    attendanceData.forEach(l => {
      if (l.period && l.period.trim() !== "") subjects.add(l.period);
    });

    return Array.from(subjects).sort();
  }, [allTimetables, attendanceData]);

  // Today's count per subject
  const todayStr = new Date().toLocaleDateString();
  const getTodayCount = (subject) =>
    attendanceData.filter(log =>
      log.period === subject &&
      new Date(log.recognizedAt).toLocaleDateString() === todayStr
    ).length;

  // All-time count per subject
  const getAllTimeCount = (subject) =>
    attendanceData.filter(log => log.period === subject).length;

  // Search suggestions
  const handleSearchChange = (val) => {
    setSearchText(val);
    setCurrentPage(1);
    if (!val.trim()) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const q = val.toLowerCase();
    const suggestions = [
      ...new Set([
        ...attendanceData
          .filter(l =>
            l.name?.toLowerCase().includes(q) ||
            l.rollNumber?.toLowerCase().includes(q) ||
            l.period?.toLowerCase().includes(q) ||
            l.className?.toLowerCase().includes(q)
          )
          .slice(0, 5)
          .map(l => l.name),
        ...attendanceData
          .filter(l => l.rollNumber?.toLowerCase().includes(q))
          .slice(0, 3)
          .map(l => l.rollNumber),
      ])
    ].filter(Boolean).slice(0, 6);
    setSearchSuggestions(suggestions);
    setShowSuggestions(suggestions.length > 0);
  };

  // Filtered data
  const filteredData = useMemo(() => {
    return attendanceData.filter(log => {
      const q           = searchText.toLowerCase().trim();
      const searchMatch = !q ||
        log.name?.toLowerCase().includes(q) ||
        log.rollNumber?.toLowerCase().includes(q) ||
        log.period?.toLowerCase().includes(q) ||
        log.className?.toLowerCase().includes(q) ||
        log.course?.toLowerCase().includes(q);

      const periodMatch   = !filterPeriod   || log.period     === filterPeriod;
      const deptMatch     = !filterDept     || log.department === filterDept;
      const classMatch    = !filterClass    || log.className  === filterClass;
      const semesterMatch = !filterSemester || log.semester   === filterSemester;
      const dateMatch     = !filterDate     ||
        new Date(log.recognizedAt).toISOString().split("T")[0] === filterDate;

      return searchMatch && periodMatch && deptMatch &&
             classMatch && semesterMatch && dateMatch;
    });
  }, [attendanceData, searchText, filterPeriod, filterDept,
      filterClass, filterSemester, filterDate]);

  const totalPages    = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const clearFilters = () => {
    setSearchText(""); setFilterPeriod(""); setFilterDate("");
    setFilterDept(""); setFilterClass(""); setFilterSemester("");
    setCurrentPage(1); setShowSuggestions(false);
  };

  const hasActiveFilters = searchText || filterPeriod || filterDate ||
    filterDept || filterClass || filterSemester;

  const classesForDept = filterDept
    ? CLASSES_BY_DEPARTMENT[filterDept] || [] : [];

  const exportCSV = () => {
    const headers = ["Name","Roll Number","Class","Department","Subject","Time"];
    const rows    = filteredData.map(l => [
      l.name,
      l.rollNumber || l.usn,
      l.className  || "",
      l.department || "",
      l.period,
      new Date(l.recognizedAt).toLocaleString("en-IN")
    ]);
    const csv  = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `period_attendance_${
      new Date().toLocaleDateString("en-IN").replace(/\//g, "-")
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const todayName = new Date().toLocaleDateString("en-IN", { weekday: "long" });

  // ✅ Today's subjects from timetables for TODAY's day only
  const todaySubjects = useMemo(() => {
    const subjects = new Set();
    allTimetables.forEach(tt => {
      const daySlots = tt.slots?.[todayName] || [];
      if (Array.isArray(daySlots)) {
        daySlots.forEach(slot => {
          if (slot?.subject &&
              slot.subject.trim() !== "" &&
              slot.subject !== "Free / No Class" &&
              slot.subject !== "— Free / No Class —" &&
              slot.subject !== "Library / Self Study" &&
              slot.subject !== "Sports / Games" &&
              slot.subject !== "Practical / Lab") {
            subjects.add(slot.subject);
          }
        });
      }
    });
    return Array.from(subjects).sort();
  }, [allTimetables, todayName]);

  return (
    <div className="min-h-screen p-4 bg-split">
      <div className="flex flex-col lg:flex-row gap-6">
        <Sidebar />

        <div className="flex-1">

          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start
            md:items-center text-white mb-6 gap-4">
            <div>
              <p className="text-sm opacity-80">Pages / Period Wise</p>
              <h1 className="text-xl font-bold">Period-wise Attendance</h1>
              <p className="text-xs opacity-60 mt-0.5">
                Subjects fetched from teacher-configured class timetables
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleRefresh} disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white/20
                  hover:bg-white/30 text-white rounded-xl text-sm font-medium
                  transition disabled:opacity-50">
                <FaSync className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
              <button onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600
                  text-white rounded-xl text-sm font-medium hover:bg-green-700 transition">
                <FaFileExcel /> Export CSV
              </button>
            </div>
          </div>

          {/* ✅ Today's subject cards — from timetable only */}
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-gray-800 font-bold text-sm">
                Today's Attendance
                <span className="ml-2 text-xs font-normal text-gray-400">
                  — {todayName}
                </span>
              </h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                From teacher timetable
              </span>
            </div>

            {todaySubjects.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm font-medium">
                  No subjects scheduled for today
                </p>
                <p className="text-gray-300 text-xs mt-1">
                  Admin needs to set up timetables in Period Settings
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {todaySubjects.map(subject => {
                  const count    = getTodayCount(subject);
                  const isActive = filterPeriod === subject;
                  return (
                    <div key={subject}
                      onClick={() => {
                        setFilterPeriod(isActive ? "" : subject);
                        setCurrentPage(1);
                      }}
                      className={`p-3 rounded-xl cursor-pointer border-2
                        transition-all ${
                        isActive
                          ? "border-[#1E2A78] bg-blue-50 shadow-md scale-105"
                          : "border-gray-100 bg-gray-50 hover:border-gray-300 hover:shadow-sm"
                      }`}>
                      <p className="text-xs font-bold text-gray-700 leading-tight
                        line-clamp-2 mb-2">
                        {subject}
                      </p>
                      <div className="flex items-end gap-1">
                        <span className="text-2xl font-black text-[#1E2A78]">
                          {count}
                        </span>
                        <span className="text-xs text-gray-400 mb-0.5">present</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* All-time subject summary */}
          {allSubjects.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <h2 className="text-gray-800 font-bold text-sm mb-3">
                All Subjects (All Time)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {allSubjects.map(subject => {
                  const total    = getAllTimeCount(subject);
                  const isActive = filterPeriod === subject;
                  return (
                    <div key={subject}
                      onClick={() => {
                        setFilterPeriod(isActive ? "" : subject);
                        setCurrentPage(1);
                      }}
                      className={`p-2.5 rounded-xl cursor-pointer border-2
                        transition-all text-center ${
                        isActive
                          ? "border-[#1E2A78] bg-blue-50"
                          : "border-gray-100 bg-gray-50 hover:border-gray-200"
                      }`}>
                      <p className="text-xs font-semibold text-gray-600 leading-tight
                        line-clamp-2 mb-1">
                        {subject}
                      </p>
                      <p className="text-lg font-black text-[#1E2A78]">{total}</p>
                      <p className="text-xs text-gray-400">total</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search + Filters */}
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <FaFilter className="text-[#1E2A78] text-sm" />
              <h2 className="text-gray-800 font-bold text-sm">Search & Filter</h2>
              {hasActiveFilters && (
                <button onClick={clearFilters}
                  className="ml-auto text-xs text-red-500 hover:text-red-700
                    font-medium px-3 py-1 bg-red-50 rounded-lg transition">
                  Clear All
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

              {/* Search */}
              <div className="relative sm:col-span-2 lg:col-span-1">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2
                  text-gray-400 text-xs" />
                <input type="text" value={searchText}
                  onChange={e => handleSearchChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onFocus={() =>
                    searchText && setShowSuggestions(searchSuggestions.length > 0)
                  }
                  className="w-full border-2 border-gray-100 rounded-xl pl-9 pr-4
                    py-2.5 text-sm focus:outline-none focus:border-[#1E2A78]"
                  placeholder="Search name, roll number, subject..." />
                {showSuggestions && (
                  <div className="absolute top-full left-0 right-0 bg-white border
                    border-gray-200 rounded-xl shadow-lg z-20 mt-1 overflow-hidden">
                    {searchSuggestions.map((s, i) => (
                      <div key={i}
                        onMouseDown={() => {
                          setSearchText(s);
                          setShowSuggestions(false);
                          setCurrentPage(1);
                        }}
                        className="px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50
                          hover:text-[#1E2A78] cursor-pointer border-b border-gray-50
                          last:border-0">
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject filter — from timetable subjects only */}
              <div>
                <select value={filterPeriod}
                  onChange={e => { setFilterPeriod(e.target.value); setCurrentPage(1); }}
                  className="w-full border-2 border-gray-100 rounded-xl px-3
                    py-2.5 text-sm focus:outline-none focus:border-[#1E2A78]">
                  <option value="">All Subjects</option>
                  {allSubjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Date filter */}
              <div>
                <input type="date" value={filterDate}
                  onChange={e => { setFilterDate(e.target.value); setCurrentPage(1); }}
                  className="w-full border-2 border-gray-100 rounded-xl px-3
                    py-2.5 text-sm focus:outline-none focus:border-[#1E2A78]" />
              </div>

              {/* Department filter */}
              <div>
                <select value={filterDept}
                  onChange={e => {
                    setFilterDept(e.target.value);
                    setFilterClass("");
                    setCurrentPage(1);
                  }}
                  className="w-full border-2 border-gray-100 rounded-xl px-3
                    py-2.5 text-sm focus:outline-none focus:border-[#1E2A78]">
                  <option value="">All Departments</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Class filter */}
              <div>
                <select value={filterClass}
                  onChange={e => { setFilterClass(e.target.value); setCurrentPage(1); }}
                  className="w-full border-2 border-gray-100 rounded-xl px-3
                    py-2.5 text-sm focus:outline-none focus:border-[#1E2A78]"
                  disabled={!filterDept}>
                  <option value="">
                    {filterDept ? "All Classes" : "Select dept first"}
                  </option>
                  {classesForDept.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Semester filter */}
              <div>
                <select value={filterSemester}
                  onChange={e => { setFilterSemester(e.target.value); setCurrentPage(1); }}
                  className="w-full border-2 border-gray-100 rounded-xl px-3
                    py-2.5 text-sm focus:outline-none focus:border-[#1E2A78]">
                  <option value="">All Semesters</option>
                  {[1,2,3,4,5,6,7,8].map(s => (
                    <option key={s} value={String(s)}>Semester {s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active filter tags */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                {searchText && (
                  <span className="flex items-center gap-1 text-xs bg-blue-100
                    text-blue-700 px-2 py-1 rounded-full font-medium">
                    Search: "{searchText}"
                    <button onClick={() => setSearchText("")}
                      className="ml-1 hover:text-red-500 font-bold">×</button>
                  </span>
                )}
                {filterPeriod && (
                  <span className="flex items-center gap-1 text-xs bg-purple-100
                    text-purple-700 px-2 py-1 rounded-full font-medium">
                    Subject: {filterPeriod}
                    <button onClick={() => setFilterPeriod("")}
                      className="ml-1 hover:text-red-500 font-bold">×</button>
                  </span>
                )}
                {filterDate && (
                  <span className="flex items-center gap-1 text-xs bg-green-100
                    text-green-700 px-2 py-1 rounded-full font-medium">
                    Date: {filterDate}
                    <button onClick={() => setFilterDate("")}
                      className="ml-1 hover:text-red-500 font-bold">×</button>
                  </span>
                )}
                {filterDept && (
                  <span className="flex items-center gap-1 text-xs bg-orange-100
                    text-orange-700 px-2 py-1 rounded-full font-medium">
                    Dept: {filterDept}
                    <button onClick={() => setFilterDept("")}
                      className="ml-1 hover:text-red-500 font-bold">×</button>
                  </span>
                )}
                {filterClass && (
                  <span className="flex items-center gap-1 text-xs bg-cyan-100
                    text-cyan-700 px-2 py-1 rounded-full font-medium">
                    Class: {filterClass}
                    <button onClick={() => setFilterClass("")}
                      className="ml-1 hover:text-red-500 font-bold">×</button>
                  </span>
                )}
                {filterSemester && (
                  <span className="flex items-center gap-1 text-xs bg-pink-100
                    text-pink-700 px-2 py-1 rounded-full font-medium">
                    Sem: {filterSemester}
                    <button onClick={() => setFilterSemester("")}
                      className="ml-1 hover:text-red-500 font-bold">×</button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Attendance Table */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-800 font-bold text-sm">
                {filterPeriod
                  ? `${filterPeriod} Attendance`
                  : "All Period Attendance"}
                <span className="ml-2 text-xs font-normal text-gray-400">
                  ({filteredData.length} records)
                </span>
              </h2>
              {filteredData.length > ITEMS_PER_PAGE && (
                <span className="text-xs text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Loading attendance data...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto border-separate
                  border-spacing-y-1.5 text-sm">
                  <thead>
                    <tr className="bg-[#F7F7F7] text-gray-500 text-xs
                      uppercase tracking-wide">
                      <th className="text-left px-4 py-3 rounded-l-lg">Name</th>
                      <th className="text-left px-4 py-3">Roll Number</th>
                      <th className="text-left px-4 py-3">Class</th>
                      <th className="text-left px-4 py-3">Subject</th>
                      <th className="text-left px-4 py-3 rounded-r-lg">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.length > 0 ? paginatedData.map((log, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {log.name}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">
                          {log.rollNumber || log.usn}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5
                            rounded-full text-xs font-medium">
                            {log.className || log.course || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-purple-50 text-purple-700 px-2 py-0.5
                            rounded-full text-xs font-medium">
                            {log.period}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {new Date(log.recognizedAt).toLocaleString("en-IN", {
                            day: "numeric", month: "short",
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5" className="text-center py-12
                          text-gray-400 text-sm">
                          {hasActiveFilters
                            ? "No records match your filters."
                            : "No attendance records found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4
                border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(
                    currentPage * ITEMS_PER_PAGE, filteredData.length
                  )} of {filteredData.length}
                </span>
                <div className="flex gap-1 flex-wrap">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200
                      text-xs font-medium disabled:opacity-40 transition">
                    Prev
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page = i + 1;
                    if (totalPages > 5 && currentPage > 3)
                      page = currentPage - 2 + i;
                    if (page > totalPages) return null;
                    return (
                      <button key={page} onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium
                          transition ${
                          currentPage === page
                            ? "bg-[#1E2A78] text-white"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                        }`}>
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() =>
                      setCurrentPage(p => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200
                      text-xs font-medium disabled:opacity-40 transition">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Period;