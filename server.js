require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

// DB (giữ nếu bạn cần)
require("./db");

const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/students");
const gradeRoutes = require("./routes/grades");

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// =======================
// ROUTES (ĐÃ FIX GỌN LẠI)
// =======================
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/grades", gradeRoutes);

// Test server
app.get("/", (req, res) => {
    res.send("Backend running OK");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});