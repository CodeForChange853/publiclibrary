const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const db = require('../config/db'); 

// Existing Routes
router.post('/checkin', attendanceController.checkIn);
router.post('/checkout', attendanceController.checkOut);
router.get('/history', attendanceController.getHistory);
router.post('/manual-checkin', attendanceController.manualCheckIn); 
router.get('/walkins', attendanceController.getWalkIns);

// --- NEW ROUTE: QR SCAN HANDLING ---
router.post('/scan', async (req, res) => {
    const { user_id, mode } = req.body; // 'checkin' or 'checkout'

    // Clean the input (remove whitespace)
    const cleanId = user_id ? user_id.toString().trim() : '';

    if (!cleanId) {
        return res.status(400).json({ success: false, message: "Invalid QR Code." });
    }

    try {
        // 1. FIX: Search Logic
        // First, assume it's a Library ID (String format like '2025-xxxx')
        let sql = "SELECT * FROM users WHERE student_id = ?";
        let [users] = await db.query(sql, [cleanId]);

        // If not found, try searching by internal ID (Integer) ONLY if cleanId is a pure number
        if (users.length === 0 && /^\d+$/.test(cleanId)) {
            sql = "SELECT * FROM users WHERE id = ?";
            [users] = await db.query(sql, [cleanId]);
        }
        
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: `User ID '${cleanId}' not found.` });
        }

        const user = users[0];

        // 2. Logic for CHECK-IN
        if (mode === 'checkin') {
            
            // Check if already checked in
            const [existing] = await db.query(
                "SELECT * FROM attendance_log WHERE user_id = ? AND status = 'Checked In'",
                [user.id]
            );

            if (existing.length > 0) {
                return res.json({ 
                    success: false, 
                    message: `Welcome back, ${user.full_name}! You are already checked in.` 
                });
            }

            // Check for overdue books (Safe check)
            let alertMsg = "";
            try {
                const [loans] = await db.query(
                    "SELECT * FROM loans WHERE user_id = ? AND status = 'Active' AND due_date < NOW()", 
                    [user.id]
                );
                if (loans.length > 0) alertMsg = " (Warning: Overdue books!)";
            } catch (e) {
                // Ignore if loans table doesn't exist yet
            }

            // Insert Log
            await db.query(
                "INSERT INTO attendance_log (user_id, check_in_time, status, visit_purpose) VALUES (?, NOW(), 'Checked In', 'Quick Scan')", 
                [user.id]
            );

            return res.json({ 
                success: true, 
                message: `Welcome, ${user.full_name}!${alertMsg}` 
            });
        } 
        
        // 3. Logic for CHECK-OUT
        else {
            // Find the last active check-in for this user
            const [activeLog] = await db.query(
                "SELECT * FROM attendance_log WHERE user_id = ? AND status = 'Checked In'",
                [user.id]
            );

            if (activeLog.length === 0) {
                return res.json({ 
                    success: false, 
                    message: `Hi ${user.full_name}, you are not currently checked in.` 
                });
            }

            // Close the specific session
            await db.query(
                "UPDATE attendance_log SET check_out_time = NOW(), status = 'Checked Out' WHERE id = ?",
                [activeLog[0].id]
            );

            return res.json({ 
                success: true, 
                message: `Goodbye, ${user.full_name}!` 
            });
        }

    } catch (error) {
        console.error("QR Scan Error:", error);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

module.exports = router;