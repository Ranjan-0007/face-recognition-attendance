import React from "react";
import { Navigate } from "react-router-dom";

export const AdminRoute = ({ children }) => {
  const isAdmin = !!localStorage.getItem("adminToken");
  if (!isAdmin) return <Navigate to="/signin" replace />;
  return children;
};

export const StudentRoute = ({ children }) => {
  const isStudent = !!localStorage.getItem("studentToken");
  if (!isStudent) return <Navigate to="/student-register" replace />;
  return children;
};