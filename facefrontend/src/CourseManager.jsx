import React, { useState, useEffect } from "react";
import axios from "axios";
import "./CourseManager.css";
import { API_BASE } from './config/api';

const CourseManager = () => {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    courseName: "",
    semesters: "",
  });
  const [editingCourse, setEditingCourse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const DEPARTMENTS = [
    "Computer Science",
    "Commerce",
    "Management",
    "Journalism & Media",
    "Punjabi",
    "Information Technology",
    "Electronics & Communication",
    "Science",
    "Arts & Humanities",
    "Engineering",
  ];

  const API_URL = `${API_BASE}/api/admin`;

  useEffect(() => {
    setDepartments(DEPARTMENTS);
  }, []);

  useEffect(() => {
    if (selectedDept) {
      loadCourses();
    }
  }, [selectedDept]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/courses/${selectedDept}`);
      setCourses(response.data.courses || []);
      setError("");
    } catch (err) {
      console.error("Error loading courses:", err);
      setError("Failed to load courses");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCourse = async (e) => {
    e.preventDefault();
    if (!formData.courseName.trim() || !formData.semesters) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("adminToken");
      
      if (editingCourse) {
        // Update existing course - use old name and new values
        await axios.put(`${API_URL}/courses`, {
          department: selectedDept,
          oldCourseName: editingCourse.name,
          courseName: formData.courseName,
          semesters: parseInt(formData.semesters),
          token,
        });
        setMessage("Course updated successfully!");
      } else {
        // Create new course
        await axios.post(`${API_URL}/courses`, {
          department: selectedDept,
          courseName: formData.courseName,
          semesters: parseInt(formData.semesters),
          token,
        });
        setMessage("Course created successfully!");
      }

      setFormData({ courseName: "", semesters: "" });
      setEditingCourse(null);
      setShowForm(false);
      await loadCourses();
      setError("");
    } catch (err) {
      console.error("Error saving course:", err);
      setError(err.response?.data?.message || "Failed to save course");
      setMessage("");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCourse = (course) => {
    setEditingCourse(course);
    setFormData({
      courseName: course.name,
      semesters: course.semesters.toString(),
    });
    setShowForm(true);
  };

  const handleDeleteCourse = async (courseName) => {
    if (!window.confirm(`Are you sure you want to delete "${courseName}"?`)) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("adminToken");
      await axios.delete(`${API_URL}/courses`, {
        data: {
          department: selectedDept,
          courseName,
          token,
        },
      });
      setMessage("Course deleted successfully!");
      await loadCourses();
      setError("");
    } catch (err) {
      console.error("Error deleting course:", err);
      setError(err.response?.data?.message || "Failed to delete course");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({ courseName: "", semesters: "" });
    setEditingCourse(null);
  };

  return (
    <div className="course-manager">
      <div className="cm-header">
        <h2>Course Management</h2>
        <p>Create and manage courses for each department</p>
      </div>

      {message && <div className="cm-success">{message}</div>}
      {error && <div className="cm-error">{error}</div>}

      <div className="cm-container">
        {/* Department Selector */}
        <div className="cm-section">
          <label className="cm-label">Select Department:</label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="cm-select"
          >
            <option value="">-- Choose Department --</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {selectedDept && (
          <>
            {/* Add Course Button */}
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="cm-btn cm-btn-primary"
              >
                + Add New Course
              </button>
            )}

            {/* Add/Edit Course Form */}
            {showForm && (
              <div className="cm-form-container">
                <h3>{editingCourse ? "Edit Course" : "Add New Course"}</h3>
                <form onSubmit={handleAddCourse} className="cm-form">
                  <div className="cm-form-group">
                    <label>Course Name:</label>
                    <input
                      type="text"
                      value={formData.courseName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          courseName: e.target.value,
                        })
                      }
                      placeholder="e.g., BTech AI, B.Com (Hons)"
                      className="cm-input"
                    />
                  </div>

                  <div className="cm-form-group">
                    <label>Number of Semesters:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.semesters}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          semesters: e.target.value,
                        })
                      }
                      placeholder="e.g., 6, 8"
                      className="cm-input"
                    />
                  </div>

                  <div className="cm-form-actions">
                    <button
                      type="submit"
                      disabled={loading}
                      className="cm-btn cm-btn-success"
                    >
                      {loading ? "Saving..." : "Save Course"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="cm-btn cm-btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Courses List */}
            <div className="cm-courses-section">
              <h3>Courses in {selectedDept}</h3>
              {loading && !courses.length ? (
                <p className="cm-loading">Loading courses...</p>
              ) : courses.length === 0 ? (
                <p className="cm-empty">
                  No courses found. Click "Add New Course" to create one.
                </p>
              ) : (
                <div className="cm-courses-grid">
                  {courses.map((course, index) => (
                    <div key={index} className="cm-course-card">
                      <div className="cm-course-info">
                        <h4>{course.name}</h4>
                        <p className="cm-course-sems">
                          {course.semesters} Semesters
                        </p>
                      </div>
                      <div className="cm-course-actions">
                        <button
                          onClick={() => handleEditCourse(course)}
                          className="cm-btn-icon cm-btn-edit"
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteCourse(course.name)
                          }
                          className="cm-btn-icon cm-btn-delete"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CourseManager;
