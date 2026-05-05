// controllers/userController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Librarian = require('../models/Librarian');

const JWT_SECRET = process.env.JWT_SECRET || 'your_development_secret_key';

// --- AUTHENTICATION ---

exports.login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const librarian = await Librarian.findByUsername(username);
        if (!librarian) return res.status(401).json({ message: 'Invalid Credentials' });

        const isMatch = await bcrypt.compare(password, librarian.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid Credentials' });

        const token = jwt.sign(
            { id: librarian.id, username: librarian.username, name: librarian.full_name },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.status(200).json({ message: 'Login successful', token, user: { id: librarian.id, name: librarian.full_name } });
    } catch (error) {
        // 1. Force Vercel to print the exact error to the logs
        console.error("🔥 LOGIN CRASH REPORT:", error);

        // 2. Send the exact error message directly to the website browser
        res.status(500).json({
            message: 'Server Error during authentication',
            details: error.message
        });
    }
};

// --- USER MANAGEMENT ---

exports.registerUser = async (req, res) => {
    try {
        // 1. Destructure with default values of null
        const {
            full_name,
            user_type,
            contact_number,
            email = null, // Defaults to null if missing from frontend
            age = null,   // Defaults to null if missing from frontend
            address = null,
            profile_picture = null
        } = req.body;

        const year = new Date().getFullYear();
        const libraryId = `${year}-${Math.floor(1000 + Math.random() * 9000)}`;

        // 2. The SQL query stays the same, but it will now receive null instead of "undefined"
        const sql = `INSERT INTO users (full_name, user_type, contact_number, email, age, address, profile_picture, student_id) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        await db.execute(sql, [
            full_name,
            user_type,
            contact_number,
            email,
            age,
            address,
            profile_picture,
            libraryId
        ]);

        res.status(201).json({ message: 'User registered successfully', libraryId });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ message: 'Database error', error: error.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const { search } = req.query;
        let sql = 'SELECT * FROM users';
        let params = [];

        if (search) {
            sql += ' WHERE full_name LIKE ? OR email LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        const [users] = await db.execute(sql + ' ORDER BY created_at DESC', params);
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        // Included email and age in the update logic
        const { full_name, user_type, contact_number, email, age, address, student_id } = req.body;

        const sql = `UPDATE users SET full_name=?, user_type=?, contact_number=?, email=?, age=?, address=?, student_id=? WHERE id=?`;
        const [result] = await db.execute(sql, [full_name, user_type, contact_number, email, age, address, student_id, id]);

        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating user' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user' });
    }
};