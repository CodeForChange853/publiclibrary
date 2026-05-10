const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');

router.get('/', bookController.getAllBooks);
router.post('/add', bookController.addBook);
router.put('/update', bookController.updateBook);

module.exports = router;