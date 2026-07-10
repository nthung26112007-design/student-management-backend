const mysql = require('mysql2');
require('dotenv').config();

const pool = process.env.DATABASE_URL
  ? mysql.createPool(process.env.DATABASE_URL)
  : mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

pool.getConnection((err, connection) => {
  if (err) {
    console.log('DB error:', err);
  } else {
    console.log('MySQL connected');
    connection.release();
  }
});

module.exports = pool;