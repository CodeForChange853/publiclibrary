const mysql = require('mysql2');
require('dotenv').config(); // Load password from .env file

// Connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 23284,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'defaultdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // <--- THIS IS THE MISSING PIECE FOR AIVEN --->
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool.promise();