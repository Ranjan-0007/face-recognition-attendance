import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Front            from './frontpage';
import Dashboard        from './dashboard';
import Addstudent       from './Addstudent';
import Enrolled         from './Enrolled';
import Signin           from './signin';
import Period           from './period';
import StudentRegister  from './StudentRegister';
import StudentDashboard from './StudentDashboard';
import Timetable        from './Timetable';
import PeriodSettings   from './PeriodSettings';
import HODLogin         from './HODLogin';
import HODDashboard     from './HODDashboard';
import TeacherLogin     from './TeacherLogin';
import TeacherDashboard from './TeacherDashboard';
import HolidayManager   from './HolidayManager';
import CourseManager    from './CourseManager';
import { AdminRoute, StudentRoute } from './ProtectedRoute';
import ErrorBoundary    from './ErrorBoundary';

const HODRoute = ({ children }) => {
  const token = localStorage.getItem("hodToken");
  if (!token) { window.location.href = "/hod-login"; return null; }
  return children;
};

const TeacherRoute = ({ children }) => {
  const token = localStorage.getItem("teacherToken");
  if (!token) { window.location.href = "/teacher-login"; return null; }
  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/"                  element={<Front />} />
          <Route path="/signin"            element={<Signin />} />
          <Route path="/student-register"  element={<StudentRegister />} />
          <Route path="/hod-login"         element={<HODLogin />} />
          <Route path="/teacher-login"     element={<TeacherLogin />} />

          {/* Student */}
          <Route path="/student-dashboard" element={
            <StudentRoute><StudentDashboard /></StudentRoute>
          } />
          <Route path="/timetable" element={<Timetable />} />

          {/* Admin */}
          <Route path="/dashboard"       element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="/Addstudent"      element={<AdminRoute><Addstudent /></AdminRoute>} />
          <Route path="/Enrolled"        element={<AdminRoute><Enrolled /></AdminRoute>} />
          <Route path="/Period"          element={<AdminRoute><Period /></AdminRoute>} />
          <Route path="/period-settings" element={<AdminRoute><PeriodSettings /></AdminRoute>} />
          {/* ✅ NEW: Holiday Calendar — admin manages college holidays */}
          <Route path="/holidays"        element={<AdminRoute><HolidayManager /></AdminRoute>} />
          {/* ✅ NEW: Course Management — admin creates courses and adds semesters */}
          <Route path="/courses"         element={<AdminRoute><CourseManager /></AdminRoute>} />

          {/* HOD */}
          <Route path="/hod-dashboard"     element={<HODRoute><HODDashboard /></HODRoute>} />

          {/* Teacher */}
          <Route path="/teacher-dashboard" element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;