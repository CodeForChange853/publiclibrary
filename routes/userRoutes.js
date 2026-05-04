// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// --- AUTHENTICATION ---
router.post('/login', userController.login);

// --- USER MANAGEMENT ---
router.get('/', userController.getAllUsers);           // Get/Search users
router.post('/add', userController.registerUser);      // Create user
router.put('/:id', userController.updateUser);         // Update user
router.delete('/:id', userController.deleteUser);      // Delete user

module.exports = router;