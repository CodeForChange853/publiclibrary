// controllers/loanController.js
const Loan = require('../models/loan');
const Book = require('../models/book');
const db = require('../config/db');

// 1. Get Active Loans
exports.getActiveLoans = async (req, res) => {
    try {
        const [loans] = await Loan.getActiveLoans();
        res.status(200).json(loans);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// 2. Issue a Book
exports.issueBook = async (req, res) => {
    const { user_id, isbn } = req.body; // Frontend sends ISBN, not book_id (easier for barcode scanners)

    try {
        const [users] = await db.query("SELECT id FROM users WHERE student_id = ?", [user_id]);
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'User ID not found in database.' });
        }
        const internalUserId = users[0].id; 
        const book = await Book.findByISBN(isbn);
        
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        if (book.status !== 'Available') {
            return res.status(400).json({ message: 'Book is currently borrowed or lost' });
        }
        await Loan.issue(internalUserId, book.id); 
        await Book.updateStatus(book.id, 'Borrowed');

        res.status(201).json({ message: 'Book issued successfully' });

    } catch (error) {
        console.error("Issue Book Error:", error);
        res.status(500).json({ message: 'Transaction Failed' });
    }
};
// 3. Return a Book
exports.returnBook = async (req, res) => {
    const { loan_id } = req.body;

    try {
        // Step A: Get loan details to find out which book was borrowed
        const loan = await Loan.getById(loan_id);
        
        if (!loan) {
            return res.status(404).json({ message: 'Loan record not found' });
        }

        // Step B: Mark loan as returned
        await Loan.returnBook(loan_id);

        // Step C: Make book available again
        await Book.updateStatus(loan.book_id, 'Available');

        res.status(200).json({ message: 'Book returned successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Return Failed' });
    }
};
exports.getDashboardStats = async (req, res) => {
    try {
        // Run both database queries in parallel for better performance
        const [trending, overdue] = await Promise.all([
            Loan.getTrendingBooks(),
            Loan.getOverdueAlerts()
        ]);
        
        res.status(200).json({
            success: true,
            data: { trending, overdue }
        });
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ success: false, message: 'Failed to load dashboard statistics.' });
    }
};