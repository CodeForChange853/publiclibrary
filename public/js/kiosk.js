const API_URL = '/api';

// --- STATE MANAGEMENT ---
let currentMode = 'checkin';
let inputMethod = 'scan';
let html5QrCode = null; // Changed from html5QrcodeScanner

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadRecentLogs();
    setInterval(loadRecentLogs, 30000);

    // Initialize UI
    setGlobalMode('checkin');
    setInputMethod('scan');

    // Start Scanner Automatically
    initScanner();
});

// --- 1. GLOBAL MODE SWITCHER ---
function setGlobalMode(mode) {
    currentMode = mode;
    const tabCheckIn = document.getElementById('tab-mode-checkin');
    const tabCheckOut = document.getElementById('tab-mode-checkout');
    const checkInFields = document.getElementById('checkInFields');
    const actionBtn = document.getElementById('actionBtn');

    if (mode === 'checkin') {
        tabCheckIn.className = "flex-1 py-5 transition-all bg-white text-blue-700 border-b-4 border-blue-600 flex items-center justify-center gap-2 relative";
        tabCheckOut.className = "flex-1 py-5 transition-all text-slate-400 hover:text-slate-600 border-b-4 border-transparent flex items-center justify-center gap-2";
        checkInFields.style.display = 'block';
        actionBtn.innerText = "Check In Now";
        actionBtn.className = "w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg shadow-blue-200 bg-blue-600 hover:bg-blue-700 transition transform active:scale-95 flex items-center justify-center gap-2";
    } else {
        tabCheckIn.className = "flex-1 py-5 transition-all text-slate-400 hover:text-slate-600 border-b-4 border-transparent flex items-center justify-center gap-2";
        tabCheckOut.className = "flex-1 py-5 transition-all bg-orange-50 text-orange-600 border-b-4 border-orange-500 flex items-center justify-center gap-2";
        checkInFields.style.display = 'none';
        actionBtn.innerText = "Check Out Now";
        actionBtn.className = "w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg shadow-orange-200 bg-orange-500 hover:bg-orange-600 transition transform active:scale-95 flex items-center justify-center gap-2";
    }
}

// --- 2. INPUT METHOD TOGGLE ---
function setInputMethod(method) {
    inputMethod = method;
    const viewScan = document.getElementById('view-scan');
    const viewManual = document.getElementById('view-manual');
    const btnScan = document.getElementById('btn-method-scan');
    const btnManual = document.getElementById('btn-method-manual');

    if (method === 'scan') {
        viewScan.classList.remove('hidden');
        viewManual.classList.add('hidden');
        btnScan.className = "method-btn active w-40 py-2 rounded-full border-2 text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2";
        btnManual.className = "method-btn inactive w-40 py-2 rounded-full border-2 text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 hover:border-blue-300";

        // Resume scanning if hidden previously
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.resume();
        }
    } else {
        viewScan.classList.add('hidden');
        viewManual.classList.remove('hidden');
        btnScan.className = "method-btn inactive w-40 py-2 rounded-full border-2 text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 hover:border-blue-300";
        btnManual.className = "method-btn active w-40 py-2 rounded-full border-2 text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2";

        // Pause scanning to save resources
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.pause();
        }
    }
}

// --- 3. AUTO-START SCANNER LOGIC (NEW) ---
function initScanner() {
    // 1. Create instance (Note: We use Html5Qrcode, NOT Html5QrcodeScanner)
    html5QrCode = new Html5Qrcode("reader");

    // 2. Get Cameras and Start
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            const cameraId = devices[0].id; // Use the first camera found

            html5QrCode.start(
                cameraId,
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                },
                (decodedText, decodedResult) => {
                    onScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // Ignore frame read errors (common while scanning)
                }
            ).catch(err => {
                console.error("Failed to start camera", err);
                document.getElementById('scan-status').innerText = "Camera Error: " + err;
            });
        } else {
            document.getElementById('scan-status').innerText = "No Camera Found";
        }
    }).catch(err => {
        console.error("Camera permission error", err);
        document.getElementById('scan-status').innerText = "Permission Denied";
    });
}

// SUCCESS HANDLER
function onScanSuccess(decodedText) {
    // 1. Play Beep
    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    audio.play().catch(e => console.log("Audio play failed", e)); // Catch audio errors

    // 2. Pause to prevent double-scanning
    html5QrCode.pause();

    // 3. UI Feedback
    const statusText = document.getElementById('scan-status');
    statusText.innerText = "Processing ID: " + decodedText;
    statusText.className = "text-xs font-bold text-orange-500 bg-orange-50 px-3 py-1 rounded-full animate-pulse";

    // 4. Send to Backend
    processQRLogin(decodedText);
}

// --- 4. BACKEND API CALLS ---

async function processQRLogin(userId) {
    try {
        const response = await fetch(`${API_URL}/attendance/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                mode: currentMode
            })
        });

        const result = await response.json();

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: currentMode === 'checkin' ? 'Welcome!' : 'Goodbye!',
                text: result.message,
                timer: 2000,
                showConfirmButton: false
            });
            loadRecentLogs();
        } else {
            Swal.fire({ icon: 'warning', title: 'Scan Failed', text: result.message });
        }
    } catch (error) {
        console.error("Scan Error:", error);
    }

    // RESUME SCANNING after 2.5 seconds
    setTimeout(() => {
        html5QrCode.resume();
        const statusText = document.getElementById('scan-status');
        statusText.innerText = "Camera Active...";
        statusText.className = "text-xs font-bold text-blue-600 animate-pulse bg-blue-50 px-3 py-1 rounded-full";
    }, 2500);
}

// MANUAL FORM SUBMIT
// public/js/kiosk.js (Partial Update - Replace 'processKioskAttendance' function)

async function processKioskAttendance() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const address = document.getElementById('address').value.trim();
    const contact = document.getElementById('contactNumber').value.trim();
    const purpose = document.getElementById('visitPurpose').value;

    // Basic Validation
    if (!firstName || !lastName) {
        Swal.fire({ icon: 'warning', text: 'Please enter First and Last Name.' });
        return;
    }

    // Logic Split: Check-In vs Check-Out
    if (currentMode === 'checkin') {
        if (!address || !purpose) {
            Swal.fire({ icon: 'warning', text: 'Please fill in Address and Purpose.' });
            return;
        }

        // --- NEW ENDPOINT FOR MANUAL CHECK-IN ---
        const endpoint = '/attendance/manual-checkin';
        const payload = {
            first_name: firstName,
            last_name: lastName,
            address: address,
            contact_number: contact,
            visit_purpose: purpose
        };

        sendKioskRequest(endpoint, payload);

    } else {
        // --- CHECK-OUT LOGIC ---
        // Uses the unified checkOut endpoint which now checks both tables
        const endpoint = '/attendance/checkout';
        const payload = {
            first_name: firstName,
            last_name: lastName
        };

        sendKioskRequest(endpoint, payload);
    }
}

// Helper to avoid duplicate code
async function sendKioskRequest(endpoint, payload) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: result.message,
                timer: 2000,
                showConfirmButton: false
            });
            // Clear fields
            document.querySelectorAll('input, select').forEach(i => i.value = '');
            // Refresh table
            loadRecentLogs();
        } else {
            Swal.fire({ icon: 'error', text: result.message });
        }
    } catch (error) {
        console.error(error);
        Swal.fire({ icon: 'error', text: 'Server connection failed.' });
    }
}
// LOAD LOGS
function loadRecentLogs() {
    fetch(`${API_URL}/attendance/history`)
        .then(res => res.json())
        .then(data => {
            const tableBody = document.getElementById('kioskTableBody');
            if (!tableBody) return;
            tableBody.innerHTML = '';

            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="3" class="p-6 text-center text-slate-400 italic">No recent activity today.</td></tr>';
                return;
            }

            data.slice(0, 6).forEach(log => {
                const row = document.createElement('tr');
                const timeStr = new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const isCheckedIn = log.status === 'Checked In' || log.status === 'Active';
                const statusHtml = isCheckedIn
                    ? '<span class="text-green-600 font-bold text-[10px] bg-green-50 px-2 py-1 rounded-full border border-green-200 uppercase tracking-wide">IN</span>'
                    : '<span class="text-slate-500 font-bold text-[10px] bg-slate-100 px-2 py-1 rounded-full border border-slate-200 uppercase tracking-wide">OUT</span>';

                const nameParts = log.full_name.split(' ');
                const privacyName = nameParts.length > 1 ? `${nameParts[0].charAt(0)}. ${nameParts.slice(1).join(' ')}` : log.full_name;

                row.innerHTML = `
                    <td class="p-3 font-bold text-slate-700">${privacyName}</td>
                    <td class="p-3 text-right">${statusHtml}</td>
                    <td class="p-3 text-xs text-slate-400 text-right">${timeStr}</td>
                `;
                tableBody.appendChild(row);
            });
        })
        .catch(err => console.error(err));
} function loadRecentLogs() {
    fetch(`${API_URL}/attendance/history`)
        .then(res => res.json())
        .then(data => {
            const tableBody = document.getElementById('kioskTableBody');
            if (!tableBody) return;
            tableBody.innerHTML = '';

            if (data.length === 0) {
                // Note: colspan increased to 4
                tableBody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400 italic">No recent activity today.</td></tr>';
                return;
            }

            // Show top 6 entries
            data.slice(0, 6).forEach(log => {
                const row = document.createElement('tr');

                // Format Times
                const timeInStr = new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const timeOutStr = log.check_out_time
                    ? new Date(log.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '-';

                // Status Badge Logic
                const isCheckedIn = log.status === 'Checked In' || log.status === 'Active';
                const statusHtml = isCheckedIn
                    ? '<span class="text-green-600 font-bold text-[10px] bg-green-50 px-2 py-1 rounded-full border border-green-200 uppercase tracking-wide">IN</span>'
                    : '<span class="text-slate-400 font-bold text-[10px] bg-slate-100 px-2 py-1 rounded-full border border-slate-200 uppercase tracking-wide">OUT</span>';

                // Privacy Name (e.g., "Juan Dela Cruz" -> "Juan D. Cruz")
                const nameParts = log.full_name.split(' ');
                // Simple privacy filter: First name + Last Initial if long name
                const displayName = log.full_name;

                // Add CSS classes for the new 4th column
                row.innerHTML = `
                    <td class="p-3 font-bold text-slate-700">${displayName}</td>
                    <td class="p-3 text-center">${statusHtml}</td>
                    <td class="p-3 text-xs text-slate-500 text-right font-mono">${timeInStr}</td>
                    <td class="p-3 text-xs text-slate-400 text-right font-mono">${timeOutStr}</td>
                `;
                tableBody.appendChild(row);
            });
        })
        .catch(err => console.error(err));
}