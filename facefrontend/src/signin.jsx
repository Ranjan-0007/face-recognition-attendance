import React, { useState } from "react";
import { Link } from "react-router-dom";

const Signin = () => {
  const [authMode, setAuthMode] = useState("login");

  const handleSignup = async () => {
    const username = document.querySelector("#signup-username").value;
    const email    = document.querySelector("#signup-email").value;
    const password = document.querySelector("#signup-password").value;
    const retype   = document.querySelector("#signup-retype").value;
    if (password !== retype) { alert("Passwords do not match!"); return; }
    try {
      const response = await fetch("http://localhost:5001/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await response.json();
      if (response.ok) alert("Signup successful! Please login.");
      else alert(data.message);
    } catch { alert("Something went wrong!"); }
  };

  const handleSignin = async () => {
    const email    = document.querySelector("#signin-email").value;
    const password = document.querySelector("#signin-password").value;
    try {
      const response = await fetch("http://localhost:5001/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("adminToken", data.token);
        localStorage.setItem("adminInfo", JSON.stringify(data.admin));
        window.location.href = "/dashboard";
      } else {
        alert(data.message);
      }
    } catch { alert("Signin failed!"); }
  };

  return (
    <div className="mx-auto flex h-screen max-w-lg flex-col md:max-w-none md:flex-row md:pr-10">
      {/* Left panel */}
      <div className="max-w-[50rem] rounded-3xl bg-gradient-to-t from-blue-700 via-blue-700 to-blue-600 px-4 py-10 text-white sm:px-10 md:m-6 md:mr-8">
        <p className="mb-20 font-bold tracking-wider">College Admin Panel</p>
        <p className="mb-4 text-3xl font-bold md:text-4xl md:leading-snug">
          Welcome to <br />
          <span className="text-yellow-300">Guru Nanak Dev University College</span>
        </p>
        <p className="mb-10 font-semibold leading-relaxed text-gray-200">
          Admin Panel — Manage the entire college
        </p>
        <div className="bg-blue-600/80 rounded-2xl px-6 py-5 space-y-3">
          <p className="text-yellow-300 font-semibold text-sm">Other portals:</p>
          <Link to="/hod-login">
            <div className="bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3
              cursor-pointer transition flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">HOD Portal</p>
                <p className="text-blue-200 text-xs">Department management</p>
              </div>
              <span className="text-white/60">→</span>
            </div>
          </Link>
          <Link to="/teacher-login">
            <div className="bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3
              cursor-pointer transition flex items-center justify-between mt-2">
              <div>
                <p className="text-white font-bold text-sm">Teacher Portal</p>
                <p className="text-blue-200 text-xs">Subject attendance</p>
              </div>
              <span className="text-white/60">→</span>
            </div>
          </Link>
          <Link to="/student-register">
            <div className="bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3
              cursor-pointer transition flex items-center justify-between mt-2">
              <div>
                <p className="text-white font-bold text-sm">Student Portal</p>
                <p className="text-blue-200 text-xs">View your attendance</p>
              </div>
              <span className="text-white/60">→</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full flex items-center justify-center">
        <div className="px-4 py-20 w-full max-w-sm">
          <h2 className="mb-2 text-3xl font-bold">
            {authMode === "login" ? "Admin Login" : "Admin Signup"}
          </h2>
          <div className="mb-6 flex gap-2">
            {["login","signup"].map(mode => (
              <div key={mode} onClick={() => setAuthMode(mode)}
                className={`flex w-32 items-center justify-center rounded-xl
                  px-4 py-3 font-medium cursor-pointer capitalize ${
                  authMode === mode
                    ? "bg-blue-200 text-blue-800"
                    : "bg-gray-50 text-gray-700"
                }`}>
                {mode}
              </div>
            ))}
          </div>

          {authMode === "login" ? (
            <>
              <p className="mb-1 font-medium text-gray-500">Email</p>
              <div className="mb-4">
                <input type="text" id="signin-email"
                  className="w-full rounded-md border-2 border-gray-300 px-4 py-2"
                  placeholder="Enter admin email" />
              </div>
              <p className="mb-1 font-medium text-gray-500">Password</p>
              <div className="mb-6">
                <input type="password" id="signin-password"
                  className="w-full rounded-md border-2 border-gray-300 px-4 py-2"
                  placeholder="Enter password" />
              </div>
              <button onClick={handleSignin}
                className="w-full rounded-xl bg-gradient-to-r from-blue-700
                  to-blue-600 px-8 py-3 font-bold text-white hover:opacity-90">
                Sign In as Admin
              </button>
            </>
          ) : (
            <>
              {[
                { id: "signup-username", label: "Username", type: "text" },
                { id: "signup-email",    label: "Email",    type: "email" },
                { id: "signup-password", label: "Password", type: "password" },
                { id: "signup-retype",   label: "Retype Password", type: "password" },
              ].map(({ id, label, type }) => (
                <div key={id} className="mb-4">
                  <p className="mb-1 font-medium text-gray-500">{label}</p>
                  <input type={type} id={id}
                    className="w-full rounded-md border-2 border-gray-300 px-4 py-2"
                    placeholder={`Enter ${label.toLowerCase()}`} />
                </div>
              ))}
              <button onClick={handleSignup}
                className="w-full rounded-xl bg-gradient-to-r from-blue-700
                  to-blue-600 px-8 py-3 font-bold text-white hover:opacity-90">
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Signin;