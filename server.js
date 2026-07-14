require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

// ===== CORS middleware - must be at the very top =====
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5000',
    'http://localhost:51493',
    'http://localhost:64493',
    'http://localhost:51284',
    'http://localhost',
    'https://hungntmb.id.vn',
    'https://www.hungntmb.id.vn',
    '*'
];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Allow if origin is in allowed list or if it's a localhost origin
    if (origin && (allowedOrigins.includes(origin) || origin.startsWith('http://localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, Accept, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

const db = require("./db");

const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/students");
const gradeRoutes = require("./routes/grades");
const semesterRoutes = require("./routes/semesters");
const courseRoutes = require("./routes/courses");
const attendanceRoutes = require("./routes/attendance");
const feeRoutes = require("./routes/fees");
const scheduleRoutes = require("./routes/schedules");
const profileRoutes = require("./routes/profile");
const diagnosticsRoutes = require("./routes/diagnostics");
const classRoutes = require("./routes/classes");
const statsRoutes = require("./routes/stats");

app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/diagnostics", diagnosticsRoutes);
app.use("/api/stats", statsRoutes);

app.get("/", (req, res) => {
    res.send("Backend running OK");
});

app.get("/api/health", (req, res) => {
    db.query("SELECT 1 AS ok", (err) => {
        if (err) {
            return res.status(503).json({
                ok: false,
                database: false,
                message: "Máy chủ hoạt động nhưng chưa kết nối được cơ sở dữ liệu",
                serverTime: new Date().toISOString(),
            });
        }
        return res.json({
            ok: true,
            database: true,
            serverTime: new Date().toISOString(),
        });
    });
});

app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ message: "Lỗi máy chủ", error: err.message });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
