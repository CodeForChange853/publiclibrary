// controllers/bookController.js
const Book = require('../models/book');

exports.getAllBooks = async (req, res) => {
    try {
        const [books] = await Book.getAll();
        res.status(200).json(books);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.addBook = async (req, res) => {
    const { isbn, title, author, category } = req.body;
    
    // Basic Validation
    if (!isbn || !title || !author) {
        return res.status(400).json({ message: 'Please provide ISBN, Title, and Author' });
    }

    try {
        // Check if ISBN exists
        const existingBook = await Book.findByISBN(isbn);
        if (existingBook) {
            return res.status(400).json({ message: 'Book with this ISBN already exists' });
        }

        await Book.add(isbn, title, author, category);
        res.status(201).json({ message: 'Book added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Database Error' });
    }
};