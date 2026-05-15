const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    const auth = req.headers["authorization"];

    if (!auth) return res.status(401).json("No token");

    const token = auth.split(" ")[1];

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || "secret");
        next();
    } catch (err) {
        return res.status(403).json("Invalid token");
    }
};

const verifyAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json("Admin only");
    }
    next();
};

module.exports = { verifyToken, verifyAdmin };