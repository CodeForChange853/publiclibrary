const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');

// The new route we added
router.get('/dashboard-stats', loanController.getDashboardStats);

// Your existing routes
router.get('/active', loanController.getActiveLoans);
router.post('/issue', loanController.issueBook);
router.post('/return', loanController.returnBook);

module.exports = router;