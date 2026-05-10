// models/Book.js
const db = require('../config/db');

class Book {
    // Get all books
    static async getAll() {
        return db.execute('SELECT * FROM books ORDER BY title ASC');
    }

    // Add a new book
    static async add(isbn, title, author, category) {
        const sql = 'INSERT INTO books (isbn, title, author, category) VALUES (?, ?, ?, ?)';
        return db.execute(sql, [isbn, title, author, category]);
    }

    // Find a book by ISBN (Useful for the Issue form)
    static async findByISBN(isbn) {
        const sql = 'SELECT * FROM books WHERE isbn = ?';
        const [rows] = await db.execute(sql, [isbn]);
        return rows[0];
    }

    // Update status (e.g., when borrowed or returned)
    static async updateStatus(id, status) {
        return db.execute('UPDATE books SET status = ? WHERE id = ?', [status, id]);
    }

    static async updateBook(originalIsbn, newIsbn, title, author) {
        const sql = 'UPDATE books SET isbn = ?, title = ?, author = ? WHERE isbn = ?';
        return db.execute(sql, [newIsbn, title, author, originalIsbn]);
    }
}

module.exports = Book;