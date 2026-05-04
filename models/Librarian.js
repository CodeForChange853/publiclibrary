// models/Librarian.js
const db = require('../config/db');

class Librarian {
    // Find a librarian by username for login verification
    static async findByUsername(username) {
        const sql = 'SELECT id, username, password_hash, full_name FROM librarians WHERE username = ?';
        const [rows] = await db.execute(sql, [username]);
        return rows[0]; // Return the first matching row (the librarian object)
    }
    // (Other methods like update, delete, getById would go here)
}

module.exports = Librarian;