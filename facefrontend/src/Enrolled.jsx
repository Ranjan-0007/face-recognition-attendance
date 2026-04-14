import "./App.css";
import axios from "axios";
import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { FaTrash, FaSearch, FaKey, FaUserPlus } from "react-icons/fa";
import { Link } from "react-router-dom";

const Enrolled = () => {
  const [students, setStudents]                     = useState([]);
  const [periodLogs, setPeriodLogs]                 = useState([]);
  const [search, setSearch]                         = useState("");
  const [selectedStudent, setSelectedStudent]       = useState(null);
  const [confirmDelete, setConfirmDelete]           = useState(null);
  const [passwordModal, setPasswordModal]           = useState(null);
  const [newPassword, setNewPassword]               = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [toastMsg, setToastMsg]                     = useState("");
  const [toastType, setToastType]                   = useState("info");
  const [loading, setLoading]                       = useState(false);

  const showToast = (msg, type = "info") => {
    setToastMsg(msg); setToastType(type);
    setTimeout(() => setToastMsg(""), 3500);
  };

  const fetchAll = async () => {
    try {
      const [studentsRes, periodRes] = await Promise.all([
        axios.get("http://localhost:5001/api/students"),
        axios.get("http://localhost:5001/api/periodwise-attendance"),
      ]);
      setStudents(
        Array.isArray(studentsRes.data) ? studentsRes.data : []
      );
      setPeriodLogs(
        Array.isArray(periodRes.data) ? periodRes.data : []
      );
    } catch (err) {
      console.error("Fetch error:", err);
      showToast("Failed to load data. Is the server running?", "error");
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const todayDate = new Date().toLocaleDateString();

  // Did this student mark any period today?
  const getTodayStatus = (rollNumber) => {
    if (!rollNumber) return "Absent";
    return periodLogs.some(log =>
      log.rollNumber === rollNumber &&
      new Date(log.recognizedAt).toLocaleDateString() === todayDate
    ) ? "Present" : "Absent";
  };

  // How many periods did they attend today?
  const getTodayPeriods = (rollNumber) => {
    if (!rollNumber) return 0;
    return periodLogs.filter(log =>
      log.rollNumber === rollNumber &&
      new Date(log.recognizedAt).toLocaleDateString() === todayDate
    ).length;
  };

  // Overall attendance % — unique days present / total unique days recorded
  const getAttendancePercent = (rollNumber) => {
    if (!rollNumber) return 0;
    const studentLogs = periodLogs.filter(l => l.rollNumber === rollNumber);
    if (studentLogs.length === 0) return 0;
    const presentDays = new Set(
      studentLogs.map(l => new Date(l.recognizedAt).toLocaleDateString())
    ).size;
    const totalDays = new Set(
      periodLogs.map(l => new Date(l.recognizedAt).toLocaleDateString())
    ).size;
    if (totalDays === 0) return 0;
    return Math.round((presentDays / totalDays) * 100);
  };

  const handleDelete = async (rollNumber) => {
    try {
      const res = await fetch(
        `http://localhost:5001/api/students/${encodeURIComponent(rollNumber)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Student deleted", "success");
        setConfirmDelete(null);
        setSelectedStudent(null);
        fetchAll();
      } else {
        showToast(data.message || "Failed to delete", "error");
      }
    } catch {
      showToast("Failed to delete student.", "error");
    }
  };

  const handleSetPassword = async () => {
    if (!newPassword.trim())
      return showToast("Password cannot be empty", "error");
    if (newPassword.length < 6)
      return showToast("Minimum 6 characters", "error");
    if (newPassword !== confirmNewPassword)
      return showToast("Passwords do not match", "error");

    setLoading(true);
    try {
      const res = await fetch(
        "http://localhost:5001/api/admin/set-student-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rollNumber: passwordModal.rollNumber, newPassword
          }),
        }
      );
      const data = await res.json();

      if (res.ok) {
        showToast(data.message, "success");
        setPasswordModal(null);
        setNewPassword("");
        setConfirmNewPassword("");
      } else if (res.status === 404) {
        const createRes = await fetch(
          "http://localhost:5001/api/admin/create-student-account",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rollNumber: passwordModal.rollNumber,
              password: newPassword
            }),
          }
        );
        const createData = await createRes.json();
        if (createRes.ok) {
          showToast(createData.message, "success");
          setPasswordModal(null);
          setNewPassword("");
          setConfirmNewPassword("");
        } else {
          showToast(createData.message || "Failed", "error");
        }
      } else {
        showToast(data.message || "Failed to set password", "error");
      }
    } catch {
      showToast("Server error.", "error");
    }
    setLoading(false);
  };

  const displayedStudents = search
    ? students.filter(s =>
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
        s.course?.toLowerCase().includes(search.toLowerCase()) ||
        s.department?.toLowerCase().includes(search.toLowerCase())
      )
    : students;

  return (
    <div className="min-h-screen p-4 bg-split relative">

      {toastMsg && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl
          shadow-lg text-sm font-medium text-white max-w-xs ${
          toastType === "success" ? "bg-green-600"
          : toastType === "error" ? "bg-red-600"
          : "bg-[#1E2A78]"
        }`}>
          {toastMsg}
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center
          justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md
            shadow-2xl relative">
            <button onClick={() => setSelectedStudent(null)}
              className="absolute top-4 right-4 text-gray-400
                hover:text-black text-xl font-bold">
              &times;
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#1E2A78] flex
                items-center justify-center text-white font-black text-xl">
                {selectedStudent.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {selectedStudent.name}
                </h2>
                <p className="text-xs text-gray-400">
                  Enrolled {new Date(selectedStudent.enrolledAt)
                    .toLocaleDateString("en-IN", {
                      day:"numeric", month:"short", year:"numeric"
                    })}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {[
                ["Roll Number", selectedStudent.rollNumber],
                ["Age",         selectedStudent.age        || "—"],
                ["Department",  selectedStudent.department || "—"],
                ["Course",      selectedStudent.course     || "—"],
                ["Class",       selectedStudent.className  || "—"],
                ["Semester",    selectedStudent.semester
                  ? `Semester ${selectedStudent.semester}` : "—"],
                ["Phone",       selectedStudent.phone      || "—"],
                ["Email",       selectedStudent.email      || "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b
                  pb-1.5 border-gray-100">
                  <span className="text-gray-400 font-medium">{k}</span>
                  <span className="font-semibold text-gray-700">{v}</span>
                </div>
              ))}
              <div className="flex justify-between border-b pb-1.5
                border-gray-100">
                <span className="text-gray-400 font-medium">
                  Today's Status
                </span>
                <span className={`font-bold ${
                  getTodayStatus(selectedStudent.rollNumber) === "Present"
                    ? "text-green-600" : "text-red-500"
                }`}>
                  {getTodayStatus(selectedStudent.rollNumber)}
                  {getTodayStatus(selectedStudent.rollNumber) === "Present" && (
                    <span className="ml-1 text-xs font-normal text-gray-400">
                      ({getTodayPeriods(selectedStudent.rollNumber)} periods)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-medium">
                  Overall Attendance
                </span>
                <span className="font-bold text-[#1E2A78]">
                  {getAttendancePercent(selectedStudent.rollNumber)}%
                </span>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setPasswordModal(selectedStudent);
                  setSelectedStudent(null);
                  setNewPassword("");
                  setConfirmNewPassword("");
                }}
                className="flex-1 flex items-center justify-center gap-2
                  py-2.5 rounded-xl bg-blue-600 text-white text-sm
                  font-semibold hover:bg-blue-700 transition">
                <FaKey size={12} /> Set Password
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(selectedStudent);
                  setSelectedStudent(null);
                }}
                className="flex-1 flex items-center justify-center gap-2
                  py-2.5 rounded-xl bg-red-600 text-white text-sm
                  font-semibold hover:bg-red-700 transition">
                <FaTrash size={12} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center
          justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-1">
              Set Student Password
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              For <strong>{passwordModal.name}</strong> ({passwordModal.rollNumber})
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl
              p-3 mb-4 text-xs text-blue-700">
              Share this password with the student so they can login.
              If they have no account yet, one will be created automatically.
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500
                  uppercase tracking-wide mb-1 block">
                  New Password
                </label>
                <input type="password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl
                    px-4 py-2.5 text-sm focus:outline-none
                    focus:border-[#1E2A78]"
                  placeholder="Min 6 characters" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500
                  uppercase tracking-wide mb-1 block">
                  Confirm Password
                </label>
                <input type="password" value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl
                    px-4 py-2.5 text-sm focus:outline-none
                    focus:border-[#1E2A78]"
                  placeholder="Retype password" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => {
                setPasswordModal(null);
                setNewPassword("");
                setConfirmNewPassword("");
              }}
                className="flex-1 py-2.5 rounded-xl bg-gray-100
                  text-gray-700 font-medium text-sm
                  hover:bg-gray-200 transition">
                Cancel
              </button>
              <button onClick={handleSetPassword} disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-[#1E2A78]
                  text-white font-bold text-sm hover:bg-blue-800
                  transition disabled:opacity-60">
                {loading ? "Setting..." : "Set Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center
          justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm
            shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex
              items-center justify-center mx-auto mb-4">
              <FaTrash className="text-red-500 text-xl" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              Delete Student?
            </h2>
            <p className="text-sm text-gray-500 mb-2">
              This will permanently remove{" "}
              <strong>{confirmDelete.name}</strong>.
            </p>
            <p className="text-xs text-red-500 bg-red-50 rounded-xl
              px-3 py-2 mb-5">
              Their login account and all attendance records will also be
              deleted. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirmDelete(null)}
                className="px-6 py-2.5 rounded-xl bg-gray-100
                  text-gray-700 font-medium text-sm
                  hover:bg-gray-200 transition">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.rollNumber)}
                className="px-6 py-2.5 rounded-xl bg-red-600 text-white
                  font-bold text-sm hover:bg-red-700 transition">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <Sidebar />
        <div className="flex-1">

          <div className="flex flex-col md:flex-row justify-between
            items-start md:items-center text-white mb-6 gap-4">
            <div>
              <p className="text-sm opacity-80">Pages / Enrolled</p>
              <h1 className="text-xl font-bold">Enrolled Students</h1>
            </div>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2
                text-gray-400 text-sm" />
              <input type="text"
                placeholder="Search by name, roll no, course..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="text-gray-900 placeholder:text-gray-400
                  rounded-xl bg-white px-4 py-2 pl-9 w-72 text-sm
                  shadow-sm focus:outline-none" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-800 font-bold text-sm">
                All Students
                <span className="ml-2 text-xs font-normal text-gray-400">
                  ({displayedStudents.length} shown)
                </span>
              </h2>
              <Link to="/Addstudent">
                <button className="flex items-center gap-1.5 px-4 py-2
                  bg-[#1E2A78] text-white rounded-xl text-xs font-semibold
                  hover:bg-[#16239D] transition">
                  <FaUserPlus size={11} /> Add Student
                </button>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border-separate
                border-spacing-y-1.5 text-sm">
                <thead>
                  <tr className="bg-[#F7F7F7] text-gray-500 text-xs
                    uppercase tracking-wide">
                    <th className="text-left px-4 py-3 rounded-l-lg">Name</th>
                    <th className="text-left px-4 py-3">Roll Number</th>
                    <th className="text-left px-4 py-3">Department</th>
                    <th className="text-left px-4 py-3">Course</th>
                    <th className="text-left px-4 py-3">Semester</th>
                    <th className="text-left px-4 py-3">Attendance %</th>
                    <th className="text-left px-4 py-3">Today</th>
                    <th className="text-left px-4 py-3 rounded-r-lg">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedStudents.length > 0
                    ? displayedStudents.map(student => {
                      const status   = getTodayStatus(student.rollNumber);
                      const todayPer = getTodayPeriods(student.rollNumber);
                      const percent  = getAttendancePercent(student.rollNumber);
                      return (
                        <tr key={student._id || student.rollNumber}
                          className="hover:bg-[#f0f4f8] transition cursor-pointer"
                          onClick={() => setSelectedStudent(student)}>
                          <td className="px-4 py-3 font-semibold text-gray-800">
                            {student.name}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono
                            text-gray-500">
                            {student.rollNumber}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {student.department || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-blue-50 text-blue-700
                              px-2 py-0.5 rounded-full text-xs font-medium">
                              {student.course}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-purple-50 text-purple-700
                              px-2 py-0.5 rounded-full text-xs font-medium">
                              {student.semester
                                ? `Sem ${student.semester}` : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100
                                rounded-full h-1.5 w-16">
                                <div className={`h-1.5 rounded-full ${
                                  percent >= 75 ? "bg-green-500"
                                  : percent >= 50 ? "bg-yellow-400"
                                  : "bg-red-400"
                                }`}
                                  style={{
                                    width: `${Math.min(percent, 100)}%`
                                  }} />
                              </div>
                              <span className="text-xs font-semibold
                                text-gray-600">
                                {percent}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-1
                              rounded-full ${
                              status === "Present"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-600"
                            }`}>
                              {status === "Present"
                                ? `✓ ${todayPer} period${todayPer > 1 ? "s" : ""}`
                                : "Absent"}
                            </span>
                          </td>
                          <td className="px-4 py-3"
                            onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => {
                                  setPasswordModal(student);
                                  setNewPassword("");
                                  setConfirmNewPassword("");
                                }}
                                className="p-2 rounded-lg text-blue-500
                                  hover:bg-blue-50 transition"
                                title="Set password">
                                <FaKey size={11} />
                              </button>
                              <button
                                onClick={() => setConfirmDelete(student)}
                                className="p-2 rounded-lg text-red-500
                                  hover:bg-red-50 transition"
                                title="Delete student">
                                <FaTrash size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                    : (
                      <tr>
                        <td colSpan="8" className="text-center py-12
                          text-gray-400 text-sm">
                          {search
                            ? "No students match your search."
                            : "No students enrolled yet."}
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Enrolled;