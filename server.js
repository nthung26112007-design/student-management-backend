require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

require("./db");

const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/students");
const gradeRoutes = require("./routes/grades");
const semesterRoutes = require("./routes/semesters");
const courseRoutes = require("./routes/courses");

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/courses", courseRoutes);

app.get("/", (req, res) => {
    res.send("Backend running OK");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
