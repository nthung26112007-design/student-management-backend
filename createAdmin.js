const bcrypt = require("bcrypt");
const db = require("./db");

bcrypt.hash("123admin", 10, (err, hash) => {
    db.query(
        "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
        ["admin", hash, "admin"],
        (err) => {
            if (err) console.log(err);
            else console.log("Admin created");
        }
    );
});
