import "./App.css";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const HODLogin = () => {
  const navigate  = useNavigate();
  const [form, setForm]     = useState({ email: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!form.email || !form.password) {
      setError("Both fields are required"); return;
    }
    setLoading(true); setError("");
    try {
      const res  = await fetch("http://localhost:5001/api/hod/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); setLoading(false); return; }
      localStorage.setItem("hodToken", data.token);
      localStorage.setItem("hodInfo",  JSON.stringify(data.hod));
      navigate("/hod-dashboard");
    } catch {
      setError("Cannot connect to server.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E2A78] to-blue-900
      flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#1E2A78] rounded-2xl flex items-center
            justify-center mx-auto mb-4">
            <span className="text-white font-black text-xl">HOD</span>
          </div>
          <h1 className="text-2xl font-black text-gray-800">HOD Portal</h1>
          <p className="text-sm text-gray-400 mt-1">
            Guru Nanak Dev University College
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3
            mb-4 text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase
              tracking-wide mb-1 block">Email</label>
            <input type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5
                text-sm focus:outline-none focus:border-[#1E2A78]"
              placeholder="HOD email address" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase
              tracking-wide mb-1 block">Password</label>
            <input type="password" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5
                text-sm focus:outline-none focus:border-[#1E2A78]"
              placeholder="••••••••" />
          </div>
          <button onClick={handleLogin} disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1E2A78]
              to-blue-600 text-white font-bold text-sm hover:opacity-90
              transition disabled:opacity-60">
            {loading ? "Logging in..." : "Login as HOD"}
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-2 text-center text-sm text-gray-400">
          <Link to="/signin" className="text-[#1E2A78] font-semibold hover:underline">
            ← Admin Login
          </Link>
          <Link to="/teacher-login" className="text-blue-500 hover:underline text-xs">
            Teacher Login →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HODLogin;