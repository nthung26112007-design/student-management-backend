const bcrypt = require("bcrypt");
const db = require("./db");

async function reset() {
    const adminHash = await bcrypt.hash("admin123", 10);
    const teacherHash = await bcrypt.hash("teacher123", 10);

    db.query("UPDATE users SET password = ? WHERE username = 'admin'", [adminHash], (err) => {
        if (err) console.error("Lỗi admin:", err);
        else console.log("✅ Reset password admin xong!");
    });

    db.query("UPDATE users SET password = ? WHERE username = 'teacher'", [teacherHash], (err) => {
        if (err) console.error("Lỗi teacher:", err);
        else console.log("✅ Reset password teacher xong!");
        process.exit();
    });
}

reset();