const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db');
const bookRoutes = require('./routes/bookRoutes');
const loanRoutes = require('./routes/loanRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public')); // <--- IMPORTANT: Serves your HTML file

// API Routes
app.use('/api/users', require('./routes/userRoutes')); 
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/books', bookRoutes);
app.use('/api/circulation', loanRoutes);

// Start Server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    const [rows] = await db.execute('SELECT 1');
    console.log('Database connection successful: Linked to PLALS DB');
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }
});