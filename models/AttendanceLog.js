const db = require('../config/db');

class AttendanceLog {
  // FR2 & FR3: Log a new check-in
  static async checkIn(userId, librarianId, purpose) {
      const sql = `
        INSERT INTO attendance_log 
        (user_id, librarian_id, check_in_time, status, visit_purpose)
        VALUES (?, ?, NOW(), 'Checked In', ?)
      `;
      return db.execute(sql, [userId, librarianId, purpose]);
    }

  // ... rest of your code (checkOut, getAll) remains the same
  static async checkOut(logId) {
    const sql = `
      UPDATE attendance_log
      SET check_out_time = NOW(), status = 'Checked Out'
      WHERE id = ?
    `;
    return db.execute(sql, [logId]);
  }

  static async getAll() {
    return db.execute('SELECT * FROM attendance_log ORDER BY check_in_time DESC');
  }

  static async updatePurpose(logId, newPurpose) {
    const sql = `UPDATE attendance_log SET visit_purpose = ? WHERE id = ?`;
    return db.execute(sql, [newPurpose, logId]);
  }
}



module.exports = AttendanceLog;