// controllers/attendanceController.js
const db = require('../config/db');

// QR Check-In (Registered Users Only)
exports.checkIn = async (req, res) => {

    try {
        const { first_name, last_name, address, contact_number, librarian_id, visit_purpose } = req.body;
        const fullName = `${first_name} ${last_name}`.trim();

        // Standard Registered User Logic
        let [userResult] = await db.execute("SELECT id FROM users WHERE full_name = ?", [fullName]);
        let userId;

        if (userResult.length > 0) {
            userId = userResult[0].id;
        } else {
            // Only create 'User' if it's via the Registration/QR flow, NOT manual walk-in
            const [insertResult] = await db.execute(
                "INSERT INTO users (full_name, address, contact_number, user_type) VALUES (?, ?, ?, 'Visitor')",
                [fullName, address || '', contact_number || '']
            );
            userId = insertResult.insertId;
        }

        const [existing] = await db.execute("SELECT * FROM attendance_log WHERE user_id = ? AND status = 'Checked In'", [userId]);
        if (existing.length > 0) return res.status(400).json({ message: `Welcome back! You are already checked in.` });

        await db.execute(
            "INSERT INTO attendance_log (user_id, librarian_id, check_in_time, status, visit_purpose) VALUES (?, ?, NOW(), 'Checked In', ?)",
            [userId, librarian_id || null, visit_purpose || null]
        );

        res.status(201).json({ message: 'Check-in successful' });
    } catch (error) {
        console.error("Check-in Error:", error);
        res.status(500).json({ message: 'Error during check-in' });
    }
};

// --- 2. NEW FUNCTIONS (For Walk-In Separation) ---

// Manual Check-In (Saves to 'walk_in_visitors' ONLY)
exports.manualCheckIn = async (req, res) => {
    try {
        const { first_name, last_name, address, contact_number, visit_purpose } = req.body;

        // Validation
        if (!first_name || !last_name) {
            return res.status(400).json({ message: 'Name is required' });
        }

        // Insert directly into the separate table
        const sql = `
            INSERT INTO walk_in_visitors 
            (first_name, last_name, address, contact_number, visit_purpose, status, check_in_time)
            VALUES (?, ?, ?, ?, ?, 'Checked In', NOW())
        `;

        await db.execute(sql, [first_name, last_name, address || '', contact_number || '', visit_purpose || 'General']);

        res.status(201).json({ message: 'Walk-in Check-in Successful' });

    } catch (error) {
        console.error("Manual Check-in Error:", error);
        res.status(500).json({ message: 'Error processing walk-in.' });
    }
};

// Get Walk-In History (For Admin Dashboard)
exports.getWalkIns = async (req, res) => {
    try {
        // Fetch all walk-ins, newest first
        const [rows] = await db.execute("SELECT * FROM walk_in_visitors ORDER BY check_in_time DESC");
        res.json(rows);
    } catch (error) {
        console.error("Fetch Walk-in Error:", error);
        res.status(500).json({ message: 'Error fetching walk-in data' });
    }
};

// Unified Check-Out (Handles both Registered AND Walk-ins)
exports.checkOut = async (req, res) => {
    try {
        // Case A: Admin clicking "Check Out" on Walk-in Table (passes ID and type)
        if (req.body.type === 'walk-in' && req.body.id) {
            await db.execute("UPDATE walk_in_visitors SET check_out_time = NOW(), status = 'Checked Out' WHERE id = ?", [req.body.id]);
            return res.json({ message: 'Walk-in visitor checked out.' });
        }

        if (req.body.log_id) {
            await db.execute("UPDATE attendance_log SET check_out_time = NOW(), status = 'Checked Out' WHERE id = ?", [req.body.log_id]);
            return res.json({ message: 'Member checked out.' });
        }

        // Case B: Kiosk Manual Type Check-out
        const { first_name, last_name } = req.body;
        
        // 1. Try to find in Registered Users Log first
        if (req.body.user_id) {
            // Existing logic for ID-based checkout...
             const [activeLog] = await db.execute("SELECT id FROM attendance_log WHERE user_id = ? AND status = 'Checked In' LIMIT 1", [req.body.user_id]);
             if (activeLog.length > 0) {
                 await db.execute("UPDATE attendance_log SET check_out_time = NOW(), status = 'Checked Out' WHERE id = ?", [activeLog[0].id]);
                 return res.json({ message: 'Check-out successful (Member)' });
             }
        } 
        
        // 2. Fallback: Search by Name in BOTH tables if no ID provided (Manual Kiosk Typing)
        if (first_name && last_name) {
             const fullName = `${first_name} ${last_name}`.trim();
             
             // Check Registered Users
             const [user] = await db.execute("SELECT id FROM users WHERE full_name = ?", [fullName]);
             if (user.length > 0) {
                 const [log] = await db.execute("SELECT id FROM attendance_log WHERE user_id = ? AND status = 'Checked In'", [user[0].id]);
                 if (log.length > 0) {
                     await db.execute("UPDATE attendance_log SET check_out_time = NOW(), status = 'Checked Out' WHERE id = ?", [log[0].id]);
                     return res.json({ message: 'Check-out successful (Member)' });
                 }
             }

             // Check Walk-In Visitors
             const [walkIn] = await db.execute(
                 "SELECT id FROM walk_in_visitors WHERE first_name = ? AND last_name = ? AND status = 'Checked In'",
                 [first_name, last_name]
             );

             if (walkIn.length > 0) {
                 await db.execute("UPDATE walk_in_visitors SET check_out_time = NOW(), status = 'Checked Out' WHERE id = ?", [walkIn[0].id]);
                 return res.json({ message: 'Check-out successful (Walk-in)' });
             }
        }

        return res.status(404).json({ message: 'No active check-in found for this name.' });

    } catch (error) {
        console.error("Check-out Error:", error);
        res.status(500).json({ message: 'Error during check-out' });
    }
};

// Existing History function (keeps working for registered users)
exports.getHistory = async (req, res) => {
  try {
    // We select ID and TYPE so the frontend knows which table to update
    const sql = `
      SELECT 
        a.id AS session_id,        -- The specific ID of this visit
        'registered' AS visitor_type, -- Flag for frontend
        u.full_name, 
        a.status, 
        a.check_in_time, 
        a.check_out_time,
        a.visit_purpose
      FROM attendance_log a
      JOIN users u ON a.user_id = u.id

      UNION ALL

      SELECT 
        id AS session_id,          -- The specific ID of this visit
        'walk-in' AS visitor_type, -- Flag for frontend
        CONCAT(first_name, ' ', last_name) as full_name, 
        status, 
        check_in_time, 
        check_out_time,
        visit_purpose
      FROM walk_in_visitors

      ORDER BY check_in_time DESC
      LIMIT 50
    `;
    
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (error) {
    console.error("History Error:", error);
    res.status(500).json({ message: 'Error fetching history' });
  }
};