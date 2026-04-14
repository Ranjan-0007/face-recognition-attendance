const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const bodyParser = require('body-parser');
const bcrypt     = require("bcrypt");
const jwt        = require("jsonwebtoken");
const fs         = require('fs');
const path       = require('path');
const dotenv     = require('dotenv');

// Load local server env first; if not found, try root project env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoURI   = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "gnduc_secret_2024";

if (!mongoURI) {
  console.error('ERROR: MONGO_URI is not set. Create a .env file based on .env.example.');
  process.exit(1);
}

const app  = express();
const PORT = 5001;

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

mongoose.connect(mongoURI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err.message));

// ── SCHEMAS ──────────────────────────────────────────────────────

const studentSchema = new mongoose.Schema({
  name:        String,
  rollNumber:  { type: String, unique: true },
  age:         String,
  department:  String,
  course:      String,
  className:   String,
  semester:    String,
  phone:       String,
  email:       String,
  enrolledAt:  { type: Date, default: Date.now }
});
const Student = mongoose.model('Student', studentSchema);

const studentAccountSchema = new mongoose.Schema({
  name:       String,
  rollNumber: { type: String, unique: true },
  email:      { type: String, unique: true },
  password:   String,
  createdAt:  { type: Date, default: Date.now }
});
const StudentAccount = mongoose.model('StudentAccount', studentAccountSchema);

const periodwiseSchema = new mongoose.Schema({
  rollNumber:   String,
  name:         String,
  course:       String,
  className:    String,
  semester:     String,
  department:   String,
  period:       String,
  recognizedAt: { type: Date, default: Date.now },
  confirmed:    { type: Boolean, default: false },
  confirmedAt:  Date,
  confirmedBy:  String
});
const PeriodwiseAttendanceLog = mongoose.model('PeriodwiseAttendanceLog', periodwiseSchema);

const adminSchema = new mongoose.Schema({
  username: String,
  email:    { type: String, unique: true },
  password: String
});
const Admin = mongoose.model("Admin", adminSchema);

const hodSchema = new mongoose.Schema({
  name:       String,
  username:   { type: String, unique: true },
  email:      { type: String, unique: true },
  password:   String,
  department: String,
  createdAt:  { type: Date, default: Date.now }
});
const HOD = mongoose.model("HOD", hodSchema);

const teacherSchema = new mongoose.Schema({
  name:        String,
  username:    { type: String, unique: true },
  email:       { type: String, unique: true },
  password:    String,
  department:  String,
  subjects:    [String],
  classes:     [String],
  createdBy:   String,
  createdAt:   { type: Date, default: Date.now }
});
const Teacher = mongoose.model("Teacher", teacherSchema);

const periodSettingsSchema = new mongoose.Schema({
  periods: [{
    name:        String,
    subject:     String,
    startHour:   Number,
    startMinute: Number,
    endHour:     Number,
    endMinute:   Number,
    courses:     [String]
  }],
  updatedAt: { type: Date, default: Date.now }
});
const PeriodSettings = mongoose.model('PeriodSettings', periodSettingsSchema);

const timetableSchema = new mongoose.Schema({
  className:    { type: String, unique: true },
  department:   String,
  createdByHOD: String,
  slots:        { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt:    { type: Date, default: Date.now }
});
const Timetable = mongoose.model('Timetable', timetableSchema);

const deptSubjectsSchema = new mongoose.Schema({
  department: { type: String, unique: true },
  subjects:   [String],
  updatedAt:  { type: Date, default: Date.now }
});
const DeptSubjects = mongoose.model('DeptSubjects', deptSubjectsSchema);

// ── HOLIDAY SCHEMA ─────────────────────────────────────────────────
const holidaySchema = new mongoose.Schema({
  date:        { type: String, unique: true }, // "YYYY-MM-DD"
  name:        String,                          // "Diwali", "Republic Day"
  description: String,
  type:        { type: String, enum: ['national', 'religious', 'college', 'exam'], default: 'college' },
  createdBy:   String,
  createdAt:   { type: Date, default: Date.now }
});
const Holiday = mongoose.model('Holiday', holidaySchema);

// ── SUBSTITUTE TEACHER SCHEMA ──────────────────────────────────────
const substituteSchema = new mongoose.Schema({
  date:              String,   // "YYYY-MM-DD"
  originalTeacher:   String,
  substituteTeacher: String,   // null = class cancelled
  className:         String,
  slotIndex:         Number,
  subject:           String,
  department:        String,
  reason:            String,
  createdByHOD:      String,
  createdAt:         { type: Date, default: Date.now }
});
const SubstituteRecord = mongoose.model('SubstituteRecord', substituteSchema);

// ── HELPERS ───────────────────────────────────────────────────────

// College working days — Sunday is a holiday, Saturday is optional
const WORKING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function getPeriods() {
  const doc = await PeriodSettings.findOne().sort({ updatedAt: -1 });
  if (doc && doc.periods.length) return doc.periods;
  // Default periods if none configured
  return [
    { name:"Period 1", subject:"Period 1", startHour:9,  startMinute:15, endHour:10, endMinute:15 },
    { name:"Period 2", subject:"Period 2", startHour:10, startMinute:15, endHour:11, endMinute:15 },
    { name:"Period 3", subject:"Period 3", startHour:11, startMinute:15, endHour:12, endMinute:15 },
    { name:"Period 4", subject:"Period 4", startHour:12, startMinute:15, endHour:13, endMinute:15 },
    { name:"Period 5", subject:"Period 5", startHour:13, startMinute:15, endHour:14, endMinute:15 },
    { name:"Period 6", subject:"Period 6", startHour:14, startMinute:15, endHour:15, endMinute:15 },
    { name:"Period 7", subject:"Period 7", startHour:15, startMinute:15, endHour:16, endMinute:15 },
  ];
}

async function getPeriodForStudent(currentTime, className) {
  const h    = currentTime.getHours();
  const m    = currentTime.getMinutes();
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const day  = days[currentTime.getDay()];
  const currentTotalMin = h * 60 + m;

  // ✅ Sunday check
  if (day === "Sunday") {
    return { status: 'no_period', subject: null, reason: 'Sunday — college holiday' };
  }

  // ✅ Check DB holidays (Diwali, Republic Day, etc.)
  const todayStr = currentTime.toISOString().split('T')[0]; // "YYYY-MM-DD"
  const holiday  = await Holiday.findOne({ date: todayStr });
  if (holiday) {
    return {
      status: 'no_period', subject: null,
      reason: `Holiday: ${holiday.name}`,
      holidayName: holiday.name
    };
  }

  const globalPeriods = await getPeriods();

  if (className) {
    try {
      const ttDoc = await Timetable.findOne({ className });
      if (ttDoc && ttDoc.slots && ttDoc.slots[day]) {
        const daySlots = ttDoc.slots[day];
        for (let i = 0; i < globalPeriods.length; i++) {
          const p             = globalPeriods[i];
          const startTotalMin = p.startHour * 60 + p.startMinute;
          const endTotalMin   = p.endHour * 60 + p.endMinute;
          if (currentTotalMin >= startTotalMin && currentTotalMin < endTotalMin) {
            const slot = daySlots[i];
            if (!slot || !slot.subject || slot.subject.trim() === "" ||
                slot.subject === "Free / No Class" ||
                slot.subject === "Library / Self Study") {
              return { status: 'no_period', subject: null };
            }
            const minutesSinceStart = currentTotalMin - startTotalMin;
            if (minutesSinceStart > 15) {
              return {
                status: 'late', subject: slot.subject, minutesSinceStart,
                startHour: p.startHour, startMinute: p.startMinute,
                endHour: p.endHour, endMinute: p.endMinute
              };
            }
            return {
              status: 'ok', subject: slot.subject,
              teacher: slot.teacher || "", room: slot.room || "",
              startHour: p.startHour, startMinute: p.startMinute,
              endHour: p.endHour, endMinute: p.endMinute
            };
          }
        }
        return { status: 'no_period', subject: null };
      }
    } catch (err) { console.error("[PERIOD] error:", err); }
  }

  // Fallback: global periods (no class-specific timetable)
  for (const p of globalPeriods) {
    const startTotalMin = p.startHour * 60 + p.startMinute;
    const endTotalMin   = p.endHour * 60 + p.endMinute;
    if (currentTotalMin >= startTotalMin && currentTotalMin < endTotalMin) {
      const minutesSinceStart = currentTotalMin - startTotalMin;
      if (minutesSinceStart > 15) {
        return {
          status: 'late', subject: p.subject, minutesSinceStart,
          startHour: p.startHour, startMinute: p.startMinute,
          endHour: p.endHour, endMinute: p.endMinute
        };
      }
      return {
        status: 'ok', subject: p.subject,
        startHour: p.startHour, startMinute: p.startMinute,
        endHour: p.endHour, endMinute: p.endMinute
      };
    }
  }
  return { status: 'no_period', subject: null };
}

async function getNextPeriodForStudent(currentTime, className) {
  const h   = currentTime.getHours(), m = currentTime.getMinutes();
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const day  = days[currentTime.getDay()];
  const currentTotalMin = h * 60 + m;

  // ✅ FIX: No next period on Sunday
  if (day === "Sunday") return null;

  // Check DB holidays
  const todayStr2 = currentTime.toISOString().split('T')[0];
  const holiday2  = await Holiday.findOne({ date: todayStr2 });
  if (holiday2) return null;

  const globalPeriods = await getPeriods();

  if (className) {
    try {
      const ttDoc = await Timetable.findOne({ className });
      if (ttDoc && ttDoc.slots && ttDoc.slots[day]) {
        const daySlots = ttDoc.slots[day];
        for (let i = 0; i < globalPeriods.length; i++) {
          const p             = globalPeriods[i];
          const startTotalMin = p.startHour * 60 + p.startMinute;
          if (startTotalMin > currentTotalMin) {
            const slot = daySlots[i];
            if (slot?.subject && slot.subject.trim() !== "" && slot.subject !== "Free / No Class") {
              return {
                subject: slot.subject, room: slot.room || "", teacher: slot.teacher || "",
                startHour: p.startHour, startMinute: p.startMinute,
                endHour: p.endHour, endMinute: p.endMinute
              };
            }
          }
        }
      }
    } catch { /* silent */ }
  }

  for (const p of globalPeriods) {
    if ((p.startHour * 60 + p.startMinute) > currentTotalMin) {
      return {
        subject: p.subject,
        startHour: p.startHour, startMinute: p.startMinute,
        endHour: p.endHour, endMinute: p.endMinute
      };
    }
  }
  return null;
}

// ── TIMETABLE API ─────────────────────────────────────────────────

app.get('/api/timetable/:className', async (req, res) => {
  try {
    const doc = await Timetable.findOne({ className: decodeURIComponent(req.params.className) });
    res.json(doc || { className: req.params.className, slots: {} });
  } catch { res.status(500).json({ message: "Failed to fetch timetable" }); }
});

app.post('/api/timetable', async (req, res) => {
  const { className, department, slots, createdByHOD } = req.body;
  if (!className) return res.status(400).json({ message: "className required" });
  try {
    await Timetable.findOneAndUpdate(
      { className },
      { className, department, slots, createdByHOD: createdByHOD || "", updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ message: "Timetable saved successfully" });
  } catch { res.status(500).json({ message: "Failed to save timetable" }); }
});

app.get('/api/timetables', async (req, res) => {
  try {
    const { department } = req.query;
    const query = department ? { department } : {};
    const selectFields = department ? 'className department slots' : 'className department updatedAt createdByHOD';
    res.json(await Timetable.find(query).select(selectFields));
  } catch { res.status(500).json({ message: "Failed to fetch timetables" }); }
});

app.post('/api/timetable/check-clash', async (req, res) => {
  const { teacherName, day, slotIndex, excludeClassName } = req.body;
  if (!teacherName || day === undefined || slotIndex === undefined)
    return res.status(400).json({ message: "teacherName, day, slotIndex required" });
  try {
    const query = excludeClassName ? { className: { $ne: excludeClassName } } : {};
    const allTimetables = await Timetable.find(query);
    for (const tt of allTimetables) {
      const daySlots = tt.slots?.[day] || [];
      const slot     = daySlots[slotIndex];
      if (slot?.teacher && slot.teacher === teacherName) {
        return res.json({
          clash: true,
          message: `${teacherName} is already assigned to "${tt.className}" at this slot on ${day}`
        });
      }
    }
    res.json({ clash: false });
  } catch { res.status(500).json({ message: "Clash check failed" }); }
});

app.get('/api/teacher-timetable/:teacherName', async (req, res) => {
  try {
    const teacherName   = decodeURIComponent(req.params.teacherName);
    const allTimetables = await Timetable.find();
    const DAYS          = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const schedule      = {};
    DAYS.forEach(day => { schedule[day] = []; });

    for (const tt of allTimetables) {
      DAYS.forEach(day => {
        const daySlots = tt.slots?.[day] || [];
        daySlots.forEach((slot, i) => {
          if (slot?.teacher === teacherName && slot.subject) {
            schedule[day].push({
              slotIndex: i, subject: slot.subject,
              room: slot.room || "", className: tt.className,
              department: tt.department
            });
          }
        });
      });
    }
    res.json({ teacherName, schedule });
  } catch { res.status(500).json({ message: "Failed to fetch teacher timetable" }); }
});

// ── PERIODS API ───────────────────────────────────────────────────

app.get('/api/periods', async (req, res) => {
  try { res.json(await getPeriods()); }
  catch { res.status(500).json({ message: "Failed to fetch periods" }); }
});

app.post('/api/periods', async (req, res) => {
  const { periods } = req.body;
  if (!Array.isArray(periods)) return res.status(400).json({ message: "periods must be array" });
  try {
    await PeriodSettings.deleteMany({});
    await new PeriodSettings({ periods, updatedAt: new Date() }).save();
    res.json({ message: "Periods saved" });
  } catch { res.status(500).json({ message: "Failed to save periods" }); }
});

// ── DEPARTMENT SUBJECTS ───────────────────────────────────────────

app.get('/api/dept-subjects/:department', async (req, res) => {
  try {
    const dept = decodeURIComponent(req.params.department);
    const doc  = await DeptSubjects.findOne({ department: dept });
    if (!doc || !doc.subjects?.length) {
      return res.json({ department: dept, subjects: [], isDefault: true });
    }
    res.json(doc);
  } catch { res.status(500).json({ message: "Failed to fetch subjects" }); }
});

app.post('/api/dept-subjects', async (req, res) => {
  const { department, subjects } = req.body;
  if (!department) return res.status(400).json({ message: "department required" });
  try {
    await DeptSubjects.findOneAndUpdate(
      { department },
      { department, subjects, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ message: "Subjects updated" });
  } catch { res.status(500).json({ message: "Failed to update subjects" }); }
});

// ── FACE MANAGEMENT ───────────────────────────────────────────────

app.delete('/api/student/face/:rollNumber', async (req, res) => {
  const { rollNumber } = req.params;
  try {
    const facesPath = path.join(__dirname, '..', 'python-face-api', 'faces', rollNumber);
    if (fs.existsSync(facesPath)) {
      fs.rmSync(facesPath, { recursive: true, force: true });
      res.json({ message: "Face photos deleted. You can re-enroll now." });
    } else {
      res.json({ message: "No face photos found to delete." });
    }
  } catch (err) {
    console.error("Face delete error:", err);
    res.status(500).json({ message: "Failed to delete face photos" });
  }
});

app.get('/api/student/face-status/:rollNumber', async (req, res) => {
  const { rollNumber } = req.params;
  try {
    const facesPath = path.join(__dirname, '..', 'python-face-api', 'faces', rollNumber);
    const exists    = fs.existsSync(facesPath);
    let count       = 0;
    if (exists) {
      count = fs.readdirSync(facesPath).filter(f => f.endsWith('.jpg')).length;
    }
    res.json({ enrolled: exists && count > 0, photoCount: count });
  } catch {
    res.json({ enrolled: false, photoCount: 0 });
  }
});

// ── STUDENT ROUTES ────────────────────────────────────────────────

app.post('/api/students', async (req, res) => {
  const { name, rollNumber, age, department, course, className, semester, phone, email } = req.body;
  if (!name || !rollNumber || !course)
    return res.status(400).json({ message: "Name, roll number and course are required" });

  // ✅ Auto-compute className from course + semester
  const finalClassName = (course && semester) ? `${course} Sem ${semester}` : (className || "");

  try {
    const existingByRoll = await Student.findOne({ rollNumber: rollNumber.trim() });
    if (existingByRoll)
      return res.status(409).json({ message: `Roll number "${rollNumber}" already exists. Use a different one.` });

    if (email && email.trim()) {
      const existingByEmail = await Student.findOne({ email: email.trim() });
      if (existingByEmail)
        return res.status(409).json({ message: `Email "${email}" is already registered.` });
    }

    await new Student({
      name: name.trim(), rollNumber: rollNumber.trim(), age, department,
      course, className: finalClassName, semester, phone,
      email: email ? email.trim() : ""
    }).save();
    res.status(200).json({ message: "Student saved!", className: finalClassName });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Roll number or email already exists." });
    }
    console.error(err);
    res.status(500).json({ message: "Failed to save student" });
  }
});

app.get('/api/students', async (req, res) => {
  try {
    const { department, className, semester } = req.query;
    const query = {};
    if (department) query.department = department;
    if (className)  query.className  = className;
    if (semester)   query.semester   = semester;
    res.json(await Student.find(query).sort({ enrolledAt: -1 }));
  } catch { res.status(500).json({ message: "Failed to fetch students" }); }
});

app.delete('/api/students/:rollNumber', async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const deleted = await Student.findOneAndDelete({ rollNumber });
    if (!deleted) return res.status(404).json({ message: "Student not found" });
    await StudentAccount.findOneAndDelete({ rollNumber });
    await PeriodwiseAttendanceLog.deleteMany({ rollNumber });
    res.json({ message: `Student ${deleted.name} deleted.` });
  } catch { res.status(500).json({ message: "Failed to delete student" }); }
});

// ── STUDENT AUTH ──────────────────────────────────────────────────

app.post('/api/student/register', async (req, res) => {
  const { name, email, password, rollNumber } = req.body;
  if (!name || !email || !password || !rollNumber)
    return res.status(400).json({ message: "All fields required" });
  try {
    const existing = await StudentAccount.findOne({ $or: [{ email }, { rollNumber }] });
    if (existing) return res.status(409).json({ message: "Email or roll number already registered" });
    const hashed = await bcrypt.hash(password, 10);
    await new StudentAccount({ name, email, password: hashed, rollNumber }).save();
    res.status(201).json({ message: "Registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/student/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "All fields required" });
  try {
    const account = await StudentAccount.findOne({ email });
    if (!account) return res.status(404).json({
      message: "Account not found. Contact your admin or HOD."
    });
    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) return res.status(401).json({ message: "Incorrect password" });

    const profile = await Student.findOne({ rollNumber: account.rollNumber });
    if (!profile) {
      await StudentAccount.findOneAndDelete({ rollNumber: account.rollNumber });
      return res.status(403).json({ message: "Profile removed. Contact admin." });
    }

    const token = jwt.sign(
      { id: account._id, rollNumber: account.rollNumber, name: account.name },
      JWT_SECRET, { expiresIn: "12h" }
    );
    res.status(200).json({
      message: "Login successful", token,
      student: {
        name: account.name, email: account.email,
        rollNumber: account.rollNumber,
        course: profile.course || "", className: profile.className || "",
        semester: profile.semester || "", department: profile.department || "",
        phone: profile.phone || "", age: profile.age || "",
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/student/change-password', async (req, res) => {
  const { rollNumber, currentPassword, newPassword } = req.body;
  if (!rollNumber || !currentPassword || !newPassword)
    return res.status(400).json({ message: "All fields required" });
  if (newPassword.length < 6) return res.status(400).json({ message: "Minimum 6 characters" });
  try {
    const account = await StudentAccount.findOne({ rollNumber });
    if (!account) return res.status(404).json({ message: "Account not found" });
    const isMatch = await bcrypt.compare(currentPassword, account.password);
    if (!isMatch) return res.status(401).json({ message: "Current password incorrect" });
    account.password = await bcrypt.hash(newPassword, 10);
    await account.save();
    res.json({ message: "Password changed!" });
  } catch { res.status(500).json({ message: "Server error" }); }
});

app.post('/api/admin/set-student-password', async (req, res) => {
  const { rollNumber, newPassword } = req.body;
  if (!rollNumber || !newPassword) return res.status(400).json({ message: "Fields required" });
  if (newPassword.length < 6) return res.status(400).json({ message: "Min 6 chars" });
  try {
    const account = await StudentAccount.findOne({ rollNumber });
    if (!account) return res.status(404).json({ message: "No login account found." });
    account.password = await bcrypt.hash(newPassword, 10);
    await account.save();
    res.json({ message: `Password updated for ${account.name}` });
  } catch { res.status(500).json({ message: "Server error" }); }
});

app.post('/api/admin/create-student-account', async (req, res) => {
  const { rollNumber, password } = req.body;
  if (!rollNumber || !password) return res.status(400).json({ message: "Fields required" });
  try {
    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ message: "Student profile not found." });
    const existing = await StudentAccount.findOne({ rollNumber });
    if (existing) {
      existing.password = await bcrypt.hash(password, 10);
      await existing.save();
      return res.json({ message: `Account updated for ${student.name}` });
    }
    const hashed = await bcrypt.hash(password, 10);
    await new StudentAccount({
      name: student.name,
      email: student.email || `${rollNumber}@gnduc.edu.in`,
      password: hashed, rollNumber
    }).save();
    res.status(201).json({ message: `Login account created for ${student.name}` });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Account with this email already exists." });
    }
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/student/rollback', async (req, res) => {
  const { rollNumber, email } = req.body;
  try {
    if (email)      await StudentAccount.findOneAndDelete({ email });
    if (rollNumber) await Student.findOneAndDelete({ rollNumber });
    res.json({ message: "Rollback done" });
  } catch { res.status(500).json({ message: "Rollback failed" }); }
});

// ── ADMIN AUTH ────────────────────────────────────────────────────

app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: "All fields required" });
  try {
    const existing = await Admin.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });
    const hashed = await bcrypt.hash(password, 10);
    await new Admin({ username, email, password: hashed }).save();
    res.status(201).json({ message: "Admin created" });
  } catch { res.status(500).json({ message: "Server error" }); }
});

app.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });
    const token = jwt.sign(
      { id: admin._id, username: admin.username, email: admin.email, role: "admin" },
      JWT_SECRET, { expiresIn: "8h" }
    );
    res.status(200).json({
      message: "Signin successful", token,
      admin: { username: admin.username, email: admin.email }
    });
  } catch { res.status(500).json({ message: "Server error" }); }
});

// ── HOD ROUTES ────────────────────────────────────────────────────

// Both routes do the same — new dashboard uses /api/admin/hods POST
app.post('/api/admin/hods', async (req, res) => {
  const { name, username, email, password, department } = req.body;
  if (!name || !username || !email || !password || !department)
    return res.status(400).json({ message: "All fields required" });
  try {
    const existing = await HOD.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(409).json({ message: "Email or username already exists" });
    const hashed = await bcrypt.hash(password, 10);
    await new HOD({ name, username, email, password: hashed, department }).save();
    res.status(201).json({ message: `HOD "${name}" created for ${department}` });
  } catch { res.status(500).json({ message: "Server error" }); }
});

app.post('/api/admin/create-hod', async (req, res) => {
  const { name, username, email, password, department } = req.body;
  if (!name || !username || !email || !password || !department)
    return res.status(400).json({ message: "All fields required" });
  try {
    const existing = await HOD.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(409).json({ message: "Email or username exists" });
    const hashed = await bcrypt.hash(password, 10);
    await new HOD({ name, username, email, password: hashed, department }).save();
    res.status(201).json({ message: `HOD "${name}" created for ${department}` });
  } catch { res.status(500).json({ message: "Server error" }); }
});

app.get('/api/admin/hods', async (req, res) => {
  try { res.json(await HOD.find().select('-password').sort({ createdAt: -1 })); }
  catch { res.status(500).json({ message: "Failed to fetch HODs" }); }
});

app.delete('/api/admin/hods/:id', async (req, res) => {
  try {
    await HOD.findByIdAndDelete(req.params.id);
    res.json({ message: "HOD deleted" });
  } catch { res.status(500).json({ message: "Failed to delete HOD" }); }
});

app.post('/api/hod/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const hod = await HOD.findOne({ email });
    if (!hod) return res.status(404).json({ message: "HOD account not found" });
    const isMatch = await bcrypt.compare(password, hod.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });
    const token = jwt.sign(
      { id: hod._id, username: hod.username, name: hod.name, department: hod.department, role: "hod" },
      JWT_SECRET, { expiresIn: "8h" }
    );
    res.json({
      message: "Login successful", token,
      hod: { name: hod.name, username: hod.username, email: hod.email, department: hod.department }
    });
  } catch { res.status(500).json({ message: "Server error" }); }
});

// ── TEACHER ROUTES ────────────────────────────────────────────────

app.post('/api/hod/create-teacher', async (req, res) => {
  const { name, username, email, password, department, subjects, classes, createdBy } = req.body;
  if (!name || !username || !email || !password || !department)
    return res.status(400).json({ message: "All fields required" });
  try {
    const existing = await Teacher.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(409).json({ message: "Email or username already exists" });
    const hashed = await bcrypt.hash(password, 10);
    await new Teacher({
      name, username, email, password: hashed,
      department, subjects: subjects || [], classes: classes || [],
      createdBy: createdBy || ""
    }).save();
    res.status(201).json({ message: `Teacher "${name}" created successfully` });
  } catch { res.status(500).json({ message: "Server error" }); }
});

app.get('/api/hod/teachers', async (req, res) => {
  try {
    const { department } = req.query;
    const query = department ? { department } : {};
    res.json(await Teacher.find(query).select('-password').sort({ createdAt: -1 }));
  } catch { res.status(500).json({ message: "Failed to fetch teachers" }); }
});

app.get('/api/admin/teachers', async (req, res) => {
  try { res.json(await Teacher.find().select('-password').sort({ createdAt: -1 })); }
  catch { res.status(500).json({ message: "Failed to fetch teachers" }); }
});

app.put('/api/hod/teachers/:id', async (req, res) => {
  try {
    const { subjects, classes, name } = req.body;
    await Teacher.findByIdAndUpdate(req.params.id, { subjects, classes, name });
    res.json({ message: "Teacher updated" });
  } catch { res.status(500).json({ message: "Failed to update" }); }
});

app.delete('/api/hod/teachers/:id', async (req, res) => {
  try {
    await Teacher.findByIdAndDelete(req.params.id);
    res.json({ message: "Teacher deleted" });
  } catch { res.status(500).json({ message: "Failed to delete" }); }
});

app.post('/api/teacher/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const teacher = await Teacher.findOne({ email });
    if (!teacher) return res.status(404).json({ message: "Teacher account not found" });
    const isMatch = await bcrypt.compare(password, teacher.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });
    const token = jwt.sign(
      {
        id: teacher._id, username: teacher.username, name: teacher.name,
        department: teacher.department, subjects: teacher.subjects,
        classes: teacher.classes, role: "teacher"
      },
      JWT_SECRET, { expiresIn: "8h" }
    );
    res.json({
      message: "Login successful", token,
      teacher: {
        name: teacher.name, username: teacher.username, email: teacher.email,
        department: teacher.department, subjects: teacher.subjects, classes: teacher.classes
      }
    });
  } catch { res.status(500).json({ message: "Server error" }); }
});

// ── PERIOD-WISE ATTENDANCE ────────────────────────────────────────

app.get('/api/periodwise-attendance', async (req, res) => {
  try {
    const { rollNumber, department, className, period, confirmed, today, date } = req.query;
    const query = {};
    if (rollNumber) query.rollNumber = rollNumber;
    if (department) query.department = department;
    if (className)  query.className  = className;
    if (period)     query.period     = period;
    if (confirmed !== undefined) query.confirmed = confirmed === 'true';
    if (date) {
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(dateStart);
      dateEnd.setDate(dateStart.getDate() + 1);
      query.recognizedAt = { $gte: dateStart, $lt: dateEnd };
    } else if (today === 'true') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const tomorrow = new Date(todayStart);
      tomorrow.setDate(todayStart.getDate() + 1);
      query.recognizedAt = { $gte: todayStart, $lt: tomorrow };
    }
    res.json(await PeriodwiseAttendanceLog.find(query).sort({ recognizedAt: -1 }));
  } catch { res.status(500).json({ message: "Failed to fetch logs" }); }
});

app.post('/api/periodwise-attendance', async (req, res) => {
  const rollNumber     = req.body.rollNumber || req.body.usn;
  const { recognizedAt, period: manualPeriod } = req.body;
  if (!rollNumber) return res.status(400).json({ message: "Roll number required" });

  try {
    const student = await Student.findOne({ rollNumber: rollNumber.trim() });
    if (!student) return res.status(404).json({
      message: `Student "${rollNumber}" not found. Enroll the student first.`
    });

    const now = recognizedAt ? new Date(recognizedAt) : new Date();
    let periodName;

    if (manualPeriod) {
      // ✅ Manual entry — no time-window check
      periodName = manualPeriod;
    } else {
      // ✅ Auto (face recognition) — with Sunday check + 15-min window
      const result = await getPeriodForStudent(now, student.className);

      if (result.status === 'no_period') {
        const reason = result.reason || "No scheduled class at this time";
        const nextInfo = await getNextPeriodForStudent(now, student.className);
        return res.status(400).json({
          message: reason,
          nextPeriod: nextInfo
        });
      }
      if (result.status === 'late') {
        return res.status(400).json({
          message: `You are late! The 15-minute attendance window for "${result.subject}" has passed.`,
          status: 'late', subject: result.subject,
          startHour: result.startHour, startMinute: result.startMinute
        });
      }
      periodName = result.subject;
    }

    // Duplicate check: same student + same period + same calendar day
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(now); dayEnd.setHours(23, 59, 59, 999);

    const existingLog = await PeriodwiseAttendanceLog.findOne({
      rollNumber: rollNumber.trim(), period: periodName,
      recognizedAt: { $gte: dayStart, $lte: dayEnd }
    });
    if (existingLog)
      return res.status(400).json({
        message: `Attendance already recorded for "${periodName}" today`
      });

    const log = new PeriodwiseAttendanceLog({
      rollNumber: rollNumber.trim(), name: student.name, course: student.course,
      className: student.className || "", semester: student.semester || "",
      department: student.department || "", period: periodName, recognizedAt: now
    });
    await log.save();
    res.status(200).json({ message: `Attendance recorded for ${periodName}`, log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── DELETE ATTENDANCE (HOD authority) ────────────────────────────

app.delete('/api/attendance/student/:rollNumber/today', async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const result   = await PeriodwiseAttendanceLog.deleteMany({
      rollNumber, recognizedAt: { $gte: today, $lt: tomorrow }
    });
    res.json({ message: `Deleted ${result.deletedCount} record(s) for today`, deleted: result.deletedCount });
  } catch { res.status(500).json({ message: "Failed to delete attendance" }); }
});

app.delete('/api/attendance/:id', async (req, res) => {
  try {
    const log = await PeriodwiseAttendanceLog.findByIdAndDelete(req.params.id);
    if (!log) return res.status(404).json({ message: "Log not found" });
    res.json({ message: "Attendance record deleted" });
  } catch { res.status(500).json({ message: "Failed to delete" }); }
});

app.delete('/api/attendance/student/:rollNumber/all', async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const result = await PeriodwiseAttendanceLog.deleteMany({ rollNumber });
    res.json({ message: `Deleted all ${result.deletedCount} records for ${rollNumber}` });
  } catch { res.status(500).json({ message: "Failed to delete" }); }
});

app.post('/api/attendance/:id/confirm', async (req, res) => {
  try {
    const { teacherName } = req.body;
    const log = await PeriodwiseAttendanceLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: 'Attendance record not found' });
    if (log.confirmed) return res.json({ message: 'Already confirmed', log });

    log.confirmed = true;
    log.confirmedAt = new Date();
    log.confirmedBy = teacherName || '';
    await log.save();
    res.json({ message: 'Attendance confirmed', log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to confirm attendance' });
  }
});

app.post('/api/attendance/confirm-all', async (req, res) => {
  try {
    const { teacherName, date } = req.body;
    if (!teacherName) return res.status(400).json({ message: 'teacherName required' });

    const teacher = await Teacher.findOne({ name: teacherName });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    const targetDate = date ? new Date(date) : new Date();
    const todayStart = new Date(targetDate);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(todayStart.getDate() + 1);

    const allTimetables = await Timetable.find({ department: teacher.department });
    const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const subjectSet = new Set();
    const classSet = new Set();

    allTimetables.forEach(tt => {
      DAYS.forEach(day => {
        const daySlots = tt.slots?.[day] || [];
        daySlots.forEach(slot => {
          if (slot?.teacher === teacher.name && slot.subject) {
            subjectSet.add(slot.subject);
            classSet.add(tt.className);
          }
        });
      });
    });

    const subjects = [...subjectSet];
    const classes  = [...classSet];
    if (!subjects.length || !classes.length) {
      return res.status(400).json({ message: 'No timetable assignments found for this teacher today' });
    }

    const result = await PeriodwiseAttendanceLog.updateMany({
      department: teacher.department,
      className: { $in: classes },
      period: { $in: subjects },
      recognizedAt: { $gte: todayStart, $lt: tomorrow },
      confirmed: false
    }, {
      $set: {
        confirmed: true,
        confirmedAt: new Date(),
        confirmedBy: teacher.name
      }
    });

    res.json({ message: `Confirmed ${result.modifiedCount || result.nModified || 0} attendance records for today`, modifiedCount: result.modifiedCount || result.nModified || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to confirm all attendance' });
  }
});

// ── ATTENDANCE STATS ──────────────────────────────────────────────

app.get('/api/student/attendance-stats/:rollNumber', async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const logs = await PeriodwiseAttendanceLog.find({ rollNumber }).sort({ recognizedAt: -1 });

    let totalScheduledPerWeek = 0;
    const subjectScheduledPerWeek = {};
    const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

    if (student.className) {
      const ttDoc = await Timetable.findOne({ className: student.className });
      if (ttDoc && ttDoc.slots) {
        DAYS.forEach(day => {
          const daySlots = ttDoc.slots[day] || [];
          daySlots.forEach(slot => {
            if (slot?.subject && slot.subject.trim() !== "" &&
                slot.subject !== "Free / No Class" &&
                slot.subject !== "Library / Self Study") {
              totalScheduledPerWeek++;
              if (!subjectScheduledPerWeek[slot.subject])
                subjectScheduledPerWeek[slot.subject] = 0;
              subjectScheduledPerWeek[slot.subject]++;
            }
          });
        });
      }
    }

    const enrolledAt     = new Date(student.enrolledAt);
    const now            = new Date();
    const weeks          = Math.max(1, Math.floor((now - enrolledAt) / (7 * 24 * 60 * 60 * 1000)));
    const totalScheduled = totalScheduledPerWeek * weeks;

    const attendedBySubject = {};
    logs.forEach(l => {
      if (!attendedBySubject[l.period]) attendedBySubject[l.period] = 0;
      attendedBySubject[l.period]++;
    });

    const overallPercent = totalScheduled > 0
      ? Math.min(100, Math.round((logs.length / totalScheduled) * 100)) : 0;

    const subjectStats = {};
    const allSubjects = new Set([
      ...Object.keys(attendedBySubject),
      ...Object.keys(subjectScheduledPerWeek)
    ]);
    allSubjects.forEach(subject => {
      const attended  = attendedBySubject[subject] || 0;
      const perWeek   = subjectScheduledPerWeek[subject] || 1;
      const scheduled = perWeek * weeks;
      subjectStats[subject] = {
        attended, scheduled,
        percent: Math.min(100, Math.round((attended / scheduled) * 100))
      };
    });

    res.json({
      rollNumber, name: student.name, className: student.className,
      totalAttended: logs.length, totalScheduled, totalScheduledPerWeek,
      weeksEnrolled: weeks, overallPercent, subjectStats,
      logs: logs.slice(0, 50)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── STATS ─────────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  try {
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const presentTodayRolls = await PeriodwiseAttendanceLog.distinct('rollNumber', {
      recognizedAt: { $gte: today, $lt: tomorrow }
    });
    const [totalStudents, totalPeriodLogs] = await Promise.all([
      Student.countDocuments(),
      PeriodwiseAttendanceLog.countDocuments(),
    ]);
    res.json({
      totalStudents, presentToday: presentTodayRolls.length,
      absentToday: totalStudents - presentTodayRolls.length, totalPeriodLogs
    });
  } catch { res.status(500).json({ message: "Failed to fetch stats" }); }
});

// ── HOLIDAY API ───────────────────────────────────────────────────

// Get all holidays (sorted by date)
app.get('/api/holidays', async (req, res) => {
  try {
    const { year, month } = req.query;
    const query = {};
    if (year && month) {
      const paddedMonth = String(month).padStart(2, '0');
      query.date = { $regex: `^${year}-${paddedMonth}` };
    } else if (year) {
      query.date = { $regex: `^${year}` };
    }
    const holidays = await Holiday.find(query).sort({ date: 1 });
    res.json(holidays);
  } catch { res.status(500).json({ message: 'Failed to fetch holidays' }); }
});

// Check if a specific date is a holiday
app.get('/api/holidays/check/:date', async (req, res) => {
  try {
    const holiday = await Holiday.findOne({ date: req.params.date });
    res.json({ isHoliday: !!holiday, holiday: holiday || null });
  } catch { res.status(500).json({ message: 'Failed to check holiday' }); }
});

// Admin creates a holiday
app.post('/api/holidays', async (req, res) => {
  const { date, name, description, type, createdBy } = req.body;
  if (!date || !name) return res.status(400).json({ message: 'date and name are required' });
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return res.status(400).json({ message: 'date must be YYYY-MM-DD format' });
  // Cannot mark Sunday as holiday (already a holiday)
  const dayOfWeek = new Date(date).getDay();
  if (dayOfWeek === 0) return res.status(400).json({ message: 'Sunday is already a holiday' });
  try {
    const existing = await Holiday.findOne({ date });
    if (existing) return res.status(409).json({ message: `${existing.name} is already marked on this date` });
    const holiday = await new Holiday({ date, name, description, type: type || 'college', createdBy }).save();
    res.status(201).json({ message: `Holiday "${name}" added for ${date}`, holiday });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'A holiday already exists for this date' });
    res.status(500).json({ message: 'Failed to add holiday' });
  }
});

// Admin deletes a holiday
app.delete('/api/holidays/:id', async (req, res) => {
  try {
    const deleted = await Holiday.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Holiday not found' });
    res.json({ message: `Holiday "${deleted.name}" removed` });
  } catch { res.status(500).json({ message: 'Failed to delete holiday' }); }
});

// Get upcoming holidays (next 30 days)
app.get('/api/holidays/upcoming', async (req, res) => {
  try {
    const today    = new Date().toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const holidays = await Holiday.find({ date: { $gte: today, $lte: in30Days } }).sort({ date: 1 });
    res.json(holidays);
  } catch { res.status(500).json({ message: 'Failed to fetch upcoming holidays' }); }
});

// ── SUBSTITUTE TEACHER API ────────────────────────────────────────

// Get substitutes for a date/department
app.get('/api/substitutes', async (req, res) => {
  try {
    const { date, department } = req.query;
    const query = {};
    if (date)       query.date       = date;
    if (department) query.department = department;
    const subs = await SubstituteRecord.find(query).sort({ createdAt: -1 });
    res.json(subs);
  } catch { res.status(500).json({ message: 'Failed to fetch substitutes' }); }
});

// Get today's substitutes
app.get('/api/substitutes/today', async (req, res) => {
  try {
    const { department } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const query = { date: today };
    if (department) query.department = department;
    res.json(await SubstituteRecord.find(query));
  } catch { res.status(500).json({ message: 'Failed to fetch today substitutes' }); }
});

// HOD marks a teacher absent and assigns substitute (or cancels class)
app.post('/api/substitutes', async (req, res) => {
  const {
    date, originalTeacher, substituteTeacher,
    className, slotIndex, subject, department, reason, createdByHOD
  } = req.body;
  if (!date || !originalTeacher || !className || slotIndex === undefined || !department)
    return res.status(400).json({ message: 'date, originalTeacher, className, slotIndex, department required' });
  try {
    // Remove any existing substitute for this slot
    await SubstituteRecord.deleteOne({ date, className, slotIndex });
    const record = await new SubstituteRecord({
      date, originalTeacher,
      substituteTeacher: substituteTeacher || null, // null = cancelled
      className, slotIndex, subject, department,
      reason: reason || '',
      createdByHOD: createdByHOD || ''
    }).save();
    const msg = substituteTeacher
      ? `${substituteTeacher} assigned as substitute for ${className} Period ${slotIndex + 1}`
      : `Class cancelled for ${className} Period ${slotIndex + 1}`;
    res.status(201).json({ message: msg, record });
  } catch { res.status(500).json({ message: 'Failed to create substitute record' }); }
});

app.delete('/api/substitutes/:id', async (req, res) => {
  try {
    const deleted = await SubstituteRecord.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Substitute record not found' });
    res.json({ message: 'Substitute record deleted' });
  } catch (err) {
    console.error('Failed to delete substitute record:', err);
    res.status(500).json({ message: 'Failed to delete substitute record' });
  }
});

// ── TEACHER ME (fresh data with timetable-derived subjects/classes) ──

app.get('/api/teacher/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'teacher') {
      return res.status(403).json({ message: 'Not a teacher token' });
    }

    const teacher = await Teacher.findById(decoded.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    // Derive subjects and classes from timetable (source of truth)
    const allTimetables = await Timetable.find({ department: teacher.department });
    const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const subjectsSet = new Set();
    const classesSet = new Set();

    for (const tt of allTimetables) {
      DAYS.forEach(day => {
        const daySlots = tt.slots?.[day] || [];
        daySlots.forEach(slot => {
          if (slot?.teacher === teacher.name && slot.subject) {
            subjectsSet.add(slot.subject);
            classesSet.add(tt.className);
          }
        });
      });
    }

    const derivedSubjects = [...subjectsSet].sort();
    const derivedClasses = [...classesSet].sort();

    res.json({
      name: teacher.name,
      username: teacher.username,
      email: teacher.email,
      department: teacher.department,
      subjects: derivedSubjects,  // From timetable
      classes: derivedClasses     // From timetable
    });
  } catch (err) {
    console.error('Teacher me error:', err);
    res.status(500).json({ message: 'Failed to fetch teacher data' });
  }
});

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));