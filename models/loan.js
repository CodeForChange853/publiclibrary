// models/Loan.js
const db = require('../config/db');

class Loan {
    // Get all active loans (Joined with users and books to get names)
    static async getActiveLoans() {
        const sql = `
            SELECT loans.id, users.full_name, books.title, loans.due_date 
            FROM loans
            JOIN users ON loans.user_id = users.id
            JOIN books ON loans.book_id = books.id
            WHERE loans.status = 'Active'
        `;
        return db.execute(sql);
    }

    // Issue a book (Create loan)
    static async issue(userId, bookId) {
        // Set due date to 7 days from now
        const sql = `
            INSERT INTO loans (user_id, book_id, due_date) 
            VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))
        `;
        return db.execute(sql, [userId, bookId]);
    }

    // Return a book
    static async returnBook(loanId) {
        const sql = `
            UPDATE loans 
            SET status = 'Returned', return_date = NOW() 
            WHERE id = ?
        `;
        return db.execute(sql, [loanId]);
    }
    
    // Get Loan Details (Needed to find which book to mark as 'Available')
    static async getById(loanId) {
        const sql = 'SELECT * FROM loans WHERE id = ?';
        const [rows] = await db.execute(sql, [loanId]);
        return rows[0];
    }
    // 1. Get Top 5 Most Borrowed Books
    static async getTrendingBooks() {
        const sql = `
            SELECT books.title, books.author, COUNT(loans.id) as borrow_count 
            FROM loans
            JOIN books ON loans.book_id = books.id
            GROUP BY books.id
            ORDER BY borrow_count DESC
            LIMIT 5
        `;
        // Replace 'db.execute' with your specific database query method if different
        const [rows] = await db.execute(sql); 
        return rows;
    }

    // 2. Get Overdue Loans (Active loans past their due date)
    static async getOverdueAlerts() {
        const sql = `
            SELECT loans.id, users.full_name, books.title, loans.due_date 
            FROM loans
            JOIN users ON loans.user_id = users.id
            JOIN books ON loans.book_id = books.id
            WHERE loans.status = 'Active' AND loans.due_date < NOW()
            ORDER BY loans.due_date ASC
            LIMIT 5
        `;
        const [rows] = await db.execute(sql);
        return rows;
    }
}


module.exports = Loan;