// public/script.js

const API_URL = '/api';

// --- GLOBAL UTILITY FUNCTIONS ---

// 1. Authentication Status Check & Enforcer
function checkAuthentication() {
    // This check is the primary gate: if no token, redirect.
    if (!localStorage.getItem('authToken')) {
        // Send user to the login page if they access the dashboard directly without a token
        window.location.href = 'login.html';
        return false;
    }
    // Update the sidebar name (optional but good UX)
    const userName = localStorage.getItem('userName') || 'Librarian';
    const profileNameEl = document.querySelector('.p-4.border-t .text-sm.font-bold');
    if (profileNameEl) profileNameEl.innerText = userName;

    return true;
}

// 2. Utility to handle authenticated fetching (REQUIRED FOR FR1)
async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('authToken');

    // Ensure Content-Type is set for POST/PUT requests
    options.headers = {
        ...options.headers,
        'x-auth-token': token, // Attach the token to the header
        'Content-Type': 'application/json',
    };

    const response = await fetch(url, options);

    // If API returns 401 (Unauthorized/Expired Token), force logout
    if (response.status === 401) {
        // Clear stored credentials and redirect to login
        localStorage.removeItem('authToken');
        localStorage.removeItem('userName');
        window.location.href = 'login.html';
        return;
    }

    return response;
}

// 3. Handle Logout
function handleLogout() {
    showConfirm("Are you sure you want to log out?", () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userName');
        window.location.href = 'login.html';
    });
}

// 1. Fetch History on Load
document.addEventListener('DOMContentLoaded', () => {
    // Check auth status immediately
    if (!checkAuthentication()) return;

    // Continue with data loading only if authenticated
    loadHistory();
    loadHotLists();
    loadBooks(); // Pre-load book data for filtering
    loadLoans(); // Pre-load loan data

    const newUserForm = document.getElementById('newUserForm');
    if (newUserForm) {
        newUserForm.addEventListener('submit', handleAddUser);

    }

});

// 2. Function to Load Attendance History (UPDATED to use authenticatedFetch)
// --- GLOBAL VARIABLES FOR PAGINATION & FILTERING ---
let allAttendanceData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 5;
let allBooksData = [];

async function loadHistory() {
    try {
        // Change: Use authenticatedFetch
        const response = await authenticatedFetch(`${API_URL}/attendance/history`);

        if (!response || !response.ok) {
            throw new Error("Failed to load history.");
        }

        const data = await response.json();

        // Save data to global variable
        allAttendanceData = data;

        updateDashboardMetrics(data);
        applyFilters();

    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Helper: Separate Metrics Logic
function updateDashboardMetrics(data) {
    const activeCountEl = document.getElementById('activeCount');
    const totalTodayEl = document.getElementById('totalTodayCount');
    const capacityBar = document.getElementById('capacityBar');
    const capacityText = document.getElementById('capacityText');
    const LIBRARY_CAPACITY = 50;

    if (data) {
        const activeUsers = data.filter(log => log.status === 'Checked In');
        if (activeCountEl) activeCountEl.innerText = activeUsers.length;

        if (capacityBar) {
            const utilization = Math.min((activeUsers.length / LIBRARY_CAPACITY) * 100, 100);
            capacityBar.style.width = `${utilization}%`;
            if (capacityText) capacityText.innerText = `${activeUsers.length}/${LIBRARY_CAPACITY} Seats`;
        }

        const todayString = new Date().toDateString();
        const todaysLogs = data.filter(log => new Date(log.check_in_time).toDateString() === todayString);
        if (totalTodayEl) totalTodayEl.innerText = todaysLogs.length;

        // --- PEAK HOUR LOGIC ---
        let hourlyCounts = {};
        todaysLogs.forEach(log => {
            const hour = new Date(log.check_in_time).getHours();
            hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
        });

        let peakHour = '-';
        let maxCount = 0;

        for (const hour in hourlyCounts) {
            if (hourlyCounts[hour] > maxCount) {
                maxCount = hourlyCounts[hour];
                peakHour = `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
            }
        }

        const peakHourDisplay = document.getElementById('peakHourDisplay');
        if (peakHourDisplay) peakHourDisplay.innerText = peakHour;
    }
}

async function loadHotLists() {
    try {
        // Fetch real data from your backend
        const response = await authenticatedFetch(`${API_URL}/circulation/dashboard-stats`);

        if (!response || !response.ok) {
            console.error("Failed to load hot lists.");
            return;
        }

        const result = await response.json();

        // If successful, pass the database results to your render functions
        if (result.success) {
            renderTrending(result.data.trending);
            renderOverdue(result.data.overdue);
        }
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
    }
}

function renderTrending(books) {
    const container = document.getElementById('trending-container');
    if (!container) return;

    if (!books || books.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400 italic text-center py-6">Not enough data to show trends.</p>';
        return;
    }

    const html = books.map((book, index) => `
        <div class="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition px-2 rounded-lg">
            <div class="flex items-center gap-3">
                <div class="w-6 text-center text-sm font-bold ${index < 3 ? 'text-slate-800' : 'text-slate-400'}">#${index + 1}</div>
                <div>
                    <p class="text-sm font-bold text-slate-700 leading-tight">${book.title}</p>
                    <p class="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">${book.author || 'Unknown Author'}</p>
                </div>
            </div>
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase">
                ${book.borrow_count} borrows
            </span>
        </div>
    `).join('');

    container.innerHTML = `<div class="flex flex-col">${html}</div>`;
}

function renderOverdue(loans) {
    const container = document.getElementById('overdue-container');
    if (!container) return;

    if (!loans || loans.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-6 text-green-600 bg-green-50/50 rounded-lg border border-green-100">
                <i class="ph ph-check-circle text-2xl mb-1 opacity-70"></i>
                <p class="text-xs font-bold uppercase tracking-wide">All clear! No overdue items.</p>
            </div>`;
        return;
    }

    const html = loans.map(loan => {
        const due = new Date(loan.due_date);
        const now = new Date();
        const diffDays = Math.ceil(Math.abs(now - due) / (1000 * 60 * 60 * 24));

        return `
        <div class="mb-3 p-3 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100/50 transition">
            <div class="flex justify-between items-start mb-1.5">
                <span class="text-sm font-bold text-slate-800">${loan.full_name}</span>
                <span class="text-[10px] font-bold text-red-600 bg-white px-2 py-0.5 rounded border border-red-200 uppercase tracking-wide">${diffDays} days late</span>
            </div>
            <p class="text-xs text-slate-600 truncate flex items-center gap-1">
                <i class="ph ph-book text-slate-400"></i>
                <span class="font-medium text-slate-700">${loan.title}</span>
            </p>
        </div>
    `}).join('');

    container.innerHTML = `<div class="flex flex-col">${html}</div>`;
}

// 3. Filter Logic (Search + Dropdown)
function applyFilters() {
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    const addressEl = document.getElementById('newUserAddress');
    const address = addressEl ? addressEl.value : '';
    filteredData = allAttendanceData.filter(log => {
        const matchesName = log.full_name.toLowerCase().includes(searchQuery);

        let matchesStatus = true;
        if (statusFilter === 'active') matchesStatus = log.status === 'Checked In';
        if (statusFilter === 'completed') matchesStatus = log.status !== 'Checked In';

        let matchesDate = true;
        if (dateFilter) {
            const logDate = new Date(log.check_in_time).toLocaleDateString('en-CA');
            matchesDate = logDate === dateFilter;
        }

        return matchesName && matchesStatus && matchesDate;
    });

    currentPage = 1;
    renderTable();
}

// 4. Render Table (Pagination Logic)
// public/js/script.js - Update renderTable()

function renderTable() {
    const tableBody = document.getElementById('attendanceTableBody');
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (!tableBody) return;
    tableBody.innerHTML = '';

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filteredData.slice(start, end);

    pageData.forEach(log => {
        const row = document.createElement('tr');

        const checkInTime = new Date(log.check_in_time);
        const now = new Date();
        const diffInHours = (now - checkInTime) / (1000 * 60 * 60);

        let rowClass = "hover:bg-slate-50 transition border-b border-slate-50";
        let timeClass = "text-slate-500";

        if (log.status === 'Checked In') {
            if (diffInHours > 8) {
                rowClass = "bg-red-50 hover:bg-red-100 transition border-b border-red-100";
                timeClass = "text-red-600 font-bold";
            } else if (diffInHours > 5) {
                rowClass = "bg-orange-50 hover:bg-orange-100 transition border-b border-orange-100";
            }
        }

        row.className = rowClass;

        const timeIn = new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const statusBadge = log.status === 'Checked In'
            ? '<span class="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">Active</span>'
            : '<span class="bg-slate-100 text-slate-500 px-2 py-1 rounded-full text-xs font-bold">Completed</span>';

        const actionBtn = log.status === 'Checked In'
            ? `
                <div class="flex gap-2">
                    <button onclick="openEditModal(${log.session_id}, '${log.visit_purpose || ''}')" class="text-blue-500 hover:bg-blue-50 p-1 rounded transition" title="Edit Purpose">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    <button onclick="confirmCheckOut(${log.session_id}, '${log.visitor_type}')" class="text-red-500 hover:bg-red-50 px-3 py-1 rounded-lg font-medium border border-red-200 text-xs">
                        Check Out
                    </button>
                </div>
              `
            : '<span class="text-slate-400">-</span>';

        row.innerHTML = `
            <td class="p-4 font-medium text-slate-700">
                ${log.full_name} 
                <span class="text-[10px] text-slate-400 block uppercase">${log.visitor_type}</span>
            </td>
            <td class="p-4 text-slate-600">
                ${log.visit_purpose || 'General'}
            </td>
            <td class="p-4">${statusBadge}</td>
            <td class="p-4 ${timeClass}">
                ${timeIn}
                ${diffInHours > 8 ? '<span class="block text-[10px] text-red-500 font-bold">OVERDUE</span>' : ''}
            </td>
            <td class="p-4">${actionBtn}</td>
        `;
        tableBody.appendChild(row);
    });

    const totalItems = filteredData.length;
    if (pageInfo) pageInfo.innerText = `${start + 1}-${Math.min(end, totalItems)} of ${totalItems}`;
}

// 5. Change Page Function
function changePage(direction) {
    currentPage += direction;
    renderTable();
}


function confirmCheckOut(id, type) {
    showConfirm("Confirm Check-Out?", () => {
        handleCheckOut(id, type);
    });
}

async function handleCheckOut(id, type) {
    try {
        let payload = {};

        // If it's a walk-in, we use the logic we created for the "Walk-in Visitors" page
        if (type === 'walk-in') {
            payload = {
                type: 'walk-in',
                id: id
            };
        }
        // If it's a registered user, we treat the ID as the LOG ID (which we aliased as session_id in the SQL)
        else {

            payload = { type: 'walk-in', id: id };
        }


        // Actually, the cleanest fix is to send:
        if (type === 'registered') {

            payload = { log_id: id };
        }

        // Send the checkout request
        const response = await authenticatedFetch(`${API_URL}/attendance/checkout`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (response && response.ok) {
            showSuccess("Checked out successfully!");
            loadHistory();
        } else {
            const data = response ? await response.json() : {};
            showError(data.message || "Check-out failed.");
        }
    } catch (error) {
        console.error("Check-out error:", error);
        showError("Server error during check-out.");
    }
}



// 7. Navigation Logic (NO CHANGE)
function showSection(sectionName) {
    const sections = ['dashboard', 'users', 'circulation', 'books'];
    const buttons = ['dashboardBtn', 'usersBtn', 'circulationBtn', 'booksBtn'];

    sections.forEach(sec => {
        const el = document.getElementById(sec + 'Section');
        if (el) el.classList.add('hidden');
    });

    buttons.forEach(btn => {
        const el = document.getElementById(btn);
        if (el) {
            el.classList.remove('bg-blue-50', 'text-blue-600');
            el.classList.add('text-slate-600', 'hover:bg-slate-50');
        }
    });

    const activeSection = document.getElementById(sectionName + 'Section');
    if (activeSection) activeSection.classList.remove('hidden');

    const activeBtn = document.getElementById(sectionName + 'Btn');
    if (activeBtn) {
        activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-50');
        activeBtn.classList.add('bg-blue-50', 'text-blue-600');
    }

    if (sectionName === 'dashboard') loadHistory(); loadHotLists();
    if (sectionName === 'users') loadUsers();
    if (sectionName === 'circulation') loadLoans();
    if (sectionName === 'books') loadBooks();
}

// 8. Load Users (UPDATED to use authenticatedFetch)
let allUsersData = [];
async function loadUsers(searchQuery = '') {
    try {
        const url = searchQuery ? `${API_URL}/users?search=${searchQuery}` : `${API_URL}/users`;
        // Change: Use authenticatedFetch
        const response = await authenticatedFetch(url);

        if (!response || !response.ok) {
            throw new Error("Failed to load users.");
        }

        const users = await response.json();

        allUsersData = users;
        const tableBody = document.getElementById('usersTableBody');
        tableBody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');
            row.className = "hover:bg-slate-50 transition border-b border-slate-100";

            const displayId = user.student_id || user.id;

            row.innerHTML = `
    <td class="p-4 text-slate-400 font-mono text-xs">#${displayId}</td>
    <td class="p-4 font-bold text-slate-700 flex items-center gap-3">
        <img src="${user.profile_picture || 'https://via.placeholder.com/40'}" class="w-8 h-8 rounded-full object-cover border border-slate-200">
        ${user.full_name}
    </td>
    <td class="p-4"><span class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold uppercase">${user.user_type}</span></td>
    <td class="p-4 text-slate-500 text-sm">${user.contact_number || '-'}</td>
        <button onclick="prepareIDPrint(${user.id})" class="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition border border-blue-200">
            <i class="ph ph-identification-card text-lg"></i>
        </button>
        <button onclick="deleteUser(${user.id})" class="text-red-400 hover:bg-red-50 p-2 rounded-lg transition">
            <i class="ph ph-trash text-lg"></i>
        </button>
    </td>
`;
            tableBody.appendChild(row);
        });
    } catch (error) { console.error(error); }
}

// New Helper to find user and print (NO CHANGE)
function prepareIDPrint(dbId) {
    const user = allUsersData.find(u => u.id === dbId);
    if (user) {
        generateIDCard(user.student_id || user.id, user.full_name, user.user_type, user.profile_picture);
    }
}

// 9. Add New User (UPDATED to use authenticatedFetch)
// public/script.js


// 2. FIXED: handleAddUser Function
async function handleAddUser(event) {
    event.preventDefault(); // Stop page from refreshing

    // 1. Capture DOM values INSIDE the function
    const nameInput = document.getElementById('newUserName');
    const typeInput = document.getElementById('newUserType');
    const contactInput = document.getElementById('newUserContact');
    //const addressInput = document.getElementById('newUserAddress'); //uncomment after implementing address field

    if (!nameInput || !typeInput) return;

    const name = nameInput.value;
    const type = typeInput.value;
    const contact = contactInput.value;
    //const address = addressInput ? addressInput.value : ''; //uncomment after implementing address field


    // 2. Handle Photo/Base64 logic
    const photoRadio = document.querySelector('input[name="idType"]:checked');
    const isPhotoFormat = photoRadio ? photoRadio.value === 'photo' : false;
    const fileInput = document.getElementById('newUserPhoto');
    let base64Image = null;

    if (isPhotoFormat && fileInput && fileInput.files.length > 0) {
        try {
            base64Image = await toBase64(fileInput.files[0]);
        } catch (err) {
            console.error("Image error:", err);
        }
    }

    try {
        // 3. Send payload to Backend
        const response = await authenticatedFetch(`${API_URL}/users/add`, {
            method: 'POST',
            body: JSON.stringify({
                full_name: name,
                user_type: type,
                contact_number: contact,
                address: null, //change null to "address" after implementing address field
                email: null,
                age: null,
                profile_picture: base64Image
            })
        });

        if (response && response.ok) {
            showSuccess(`User Registered Successfully!`);
            toggleModal('addUserModal');

            // Clear inputs
            nameInput.value = '';
            contactInput.value = '';
            //if (addressInput) addressInput.value = ''; //uncomment after implementing address field

            if (fileInput) fileInput.value = '';

            loadUsers(); // Refresh the table
        } else {
            const data = await response.json();
            showError(data.message || 'Error registering user');
        }
    } catch (error) {
        console.error('Registration failed:', error);
        showError("Server error. Check your connection.");
    }
}
// Helper: Convert File to Base64 (NO CHANGE)
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// 10. Delete User (UPDATED to use authenticatedFetch)
function confirmDeleteUser(id) {
    showConfirm("Are you sure you want to delete this user?", () => {
        deleteUser(id);
    });
}

async function deleteUser(id) {
    try {
        // Change: Use authenticatedFetch
        const response = await authenticatedFetch(`${API_URL}/users/${id}`, { method: 'DELETE' });

        if (!response) return;

        if (response.ok) loadUsers();
        else showError('Could not delete user');
    } catch (error) {
        console.error('Delete error:', error);
        showError('Server error. Could not delete user.');
    }
}

// UI Utilities (NO CHANGE)
function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.toggle('hidden');
}

// 11. Export to CSV Function (NO CHANGE - Does not hit API)
function exportToCSV() {
    if (filteredData.length === 0) {
        showError("No data to export");
        return;
    }

    const headers = ["Visitor Name", "Purpose", "Status", "Check-In Time", "Check-Out Time"];

    const rows = filteredData.map(log => {
        const timeIn = new Date(log.check_in_time).toLocaleString();
        const timeOut = log.check_out_time ? new Date(log.check_out_time).toLocaleString() : '-';

        const cleanName = `"${log.full_name}"`;
        const cleanPurpose = `"${log.visit_purpose || 'General'}"`;

        return [cleanName, cleanPurpose, log.status, timeIn, timeOut].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const today = new Date().toLocaleDateString('en-CA');
    link.setAttribute("href", url);
    link.setAttribute("download", `library_report_${today}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 12. Handle Check Out All (UPDATED to use authenticatedFetch)
async function handleCheckOutAll() {
    const activeUsers = allAttendanceData.filter(log => log.status === 'Checked In');

    if (activeUsers.length === 0) {
        showError("No active visitors to check out."); // <-- Updated
        return;
    }

    showConfirm(`Are you sure you want to force check-out ${activeUsers.length} visitors?`, async () => {
        let successCount = 0;

        for (const user of activeUsers) {
            try {
                await authenticatedFetch(`${API_URL}/attendance/checkout`, {
                    method: 'POST',
                    body: JSON.stringify({ user_id: user.user_id })
                });
                successCount++;
            } catch (err) {
                console.error(err);
            }
        }

        showSuccess(`Successfully checked out ${successCount} visitors.`); // <-- Updated
        loadHistory();
    });
}

// 13. Edit Visit Details (NO CHANGE - Assumes backend is secured)
function openEditModal(id, currentPurpose) {
    document.getElementById('editLogId').value = id;
    document.getElementById('editPurposeInput').value = currentPurpose || 'General';
    document.getElementById('editModal').classList.remove('hidden');
}

// 14. Save Edit (UPDATED to use authenticatedFetch)
async function saveEdit() {
    const id = document.getElementById('editLogId').value;
    const newPurpose = document.getElementById('editPurposeInput').value;

    try {
        // Change: Use authenticatedFetch
        const response = await authenticatedFetch(`${API_URL}/attendance/update`, {
            method: 'POST',
            body: JSON.stringify({ id: id, purpose: newPurpose })
        });

        if (!response) return;

        if (response.ok) {
            document.getElementById('editModal').classList.add('hidden');
            loadHistory();
        } else {
            showError('Failed to update purpose');
        }
    } catch (error) {
        console.error('Update error:', error);
        showError('Server error updating purpose.');
    }
}

// --- BOOK INVENTORY FUNCTIONS ---

// 15. Load Books (UPDATED to use authenticatedFetch)
async function loadBooks() {
    try {
        // Change: Use authenticatedFetch
        const response = await authenticatedFetch(`${API_URL}/books`);

        if (!response || !response.ok) {
            throw new Error("Failed to load books.");
        }

        const data = await response.json();

        allBooksData = data;
        renderBookTable(data);
    } catch (error) {
        console.error('Error loading books:', error);
    }
}

// 16. Render Book Table (Helper) (NO CHANGE)
function renderBookTable(books) {
    const tableBody = document.getElementById('booksTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    books.forEach(book => {
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 transition border-b border-slate-100";

        let statusBadge = '<span class="bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs font-bold">Unknown</span>';
        if (book.status === 'Available') statusBadge = '<span class="bg-green-50 text-green-600 px-2 py-1 rounded text-xs font-bold border border-green-100">Available</span>';
        if (book.status === 'Borrowed') statusBadge = '<span class="bg-orange-50 text-orange-600 px-2 py-1 rounded text-xs font-bold border border-orange-100">Borrowed</span>';
        if (book.status === 'Lost') statusBadge = '<span class="bg-red-50 text-red-600 px-2 py-1 rounded text-xs font-bold border border-red-100">Lost</span>';

        row.innerHTML = `
            <td class="p-4 font-mono text-slate-500 text-xs">${book.isbn}</td>
            <td class="p-4 font-bold text-slate-700">${book.title}</td>
            <td class="p-4 text-slate-600">${book.author}</td>
            <td class="p-4">${statusBadge}</td>
            <td class="p-4">
                <button onclick="openEditBookModal('${book.isbn}')" class="text-blue-500 hover:text-blue-700 transition">
                    <i class="ph ph-pencil-simple text-lg"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// 17. Filter Books (Search Bar) (NO CHANGE)
function filterBooks(query) {
    const lowerQuery = query.toLowerCase();
    const filtered = allBooksData.filter(book =>
        book.title.toLowerCase().includes(lowerQuery) ||
        book.author.toLowerCase().includes(lowerQuery) ||
        book.isbn.includes(query)
    );
    renderBookTable(filtered);
}

// 18. Add New Book (UPDATED to use authenticatedFetch)
async function handleAddBook(event) {
    event.preventDefault();

    const isbn = document.getElementById('newBookIsbn').value;
    const title = document.getElementById('newBookTitle').value;
    const author = document.getElementById('newBookAuthor').value;
    const category = document.getElementById('newBookCategory').value;

    try {
        // Change: Use authenticatedFetch
        const response = await authenticatedFetch(`${API_URL}/books/add`, {
            method: 'POST',
            body: JSON.stringify({ isbn, title, author, category })
        });

        if (!response) return;

        if (response.ok) {
            toggleModal('addBookModal');

            document.getElementById('newBookTitle').value = '';
            document.getElementById('newBookAuthor').value = '';
            document.getElementById('newBookIsbn').value = '';

            showSuccess('Book Added Successfully!');

            loadBooks();
        } else {
            const data = await response.json();
            showError(data.message || 'Error adding book');
        }
    } catch (error) {
        showError('Server error while adding book.');
    }
}

// --- EDIT BOOK LOGIC ---

// 1. Open the modal and populate it with existing data
function openEditBookModal(isbn) {
    // Find the book from our globally stored array
    const book = allBooksData.find(b => b.isbn === isbn);
    if (!book) return;

    // Populate the form fields
    document.getElementById('editBookOriginalIsbn').value = book.isbn; // Keep track of the original
    document.getElementById('editBookIsbn').value = book.isbn;
    document.getElementById('editBookTitle').value = book.title;
    document.getElementById('editBookAuthor').value = book.author;

    // Show the modal
    toggleModal('editBookModal');
}

// 2. Handle the form submission to save changes
async function handleUpdateBook(event) {
    event.preventDefault();

    const originalIsbn = document.getElementById('editBookOriginalIsbn').value;
    const newIsbn = document.getElementById('editBookIsbn').value;
    const title = document.getElementById('editBookTitle').value;
    const author = document.getElementById('editBookAuthor').value;

    try {
        // We use PUT for updates. Ensure your backend route matches this.
        const response = await authenticatedFetch(`${API_URL}/books/update`, {
            method: 'PUT',
            body: JSON.stringify({
                original_isbn: originalIsbn,
                isbn: newIsbn,
                title: title,
                author: author
            })
        });

        if (!response) return;

        if (response.ok) {
            toggleModal('editBookModal');
            showSuccess('Book Updated Successfully!');
            loadBooks(); // Refresh the table to show the new data
        } else {
            const data = await response.json();
            showError(data.message || 'Error updating book');
        }
    } catch (error) {
        console.error('Error updating book:', error);
        showError('Server error while updating book.');
    }
}

// --- CIRCULATION FUNCTIONS ---

// 19. Load Active Loans (UPDATED to use authenticatedFetch)
async function loadLoans() {
    try {
        // Change: Use authenticatedFetch
        const response = await authenticatedFetch(`${API_URL}/circulation/active`);

        if (!response || !response.ok) {
            throw new Error("Failed to load loans.");
        }

        const loans = await response.json();

        const tableBody = document.getElementById('loansTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        if (loans.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">No active loans</td></tr>';
            return;
        }

        loans.forEach(loan => {
            const row = document.createElement('tr');
            row.className = "hover:bg-slate-50 transition border-b border-slate-100";

            const dueDate = new Date(loan.due_date);
            const isOverdue = new Date() > dueDate;
            const dateClass = isOverdue ? "text-red-600 font-bold" : "text-slate-600";
            const dateText = dueDate.toLocaleDateString() + (isOverdue ? " (Overdue)" : "");

            row.innerHTML = `
                <td class="p-4 font-medium text-slate-700">${loan.full_name}</td>
                <td class="p-4 text-slate-600 italic">${loan.title}</td>
                <td class="p-4 ${dateClass}">${dateText}</td>
                <td class="p-4">
                    <button onclick="handleReturnBook(${loan.id})" class="text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-lg text-xs font-bold border border-green-200 transition">
                        Mark Returned
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading loans:', error);
    }
}

// 20. Issue Book (Handle Form Submit) (UPDATED to use authenticatedFetch)
async function handleIssueBook(event) {
    event.preventDefault();
    const userId = document.getElementById('issueUserId').value;
    const isbn = document.getElementById('issueIsbn').value;

    try {
        // Change: Use authenticatedFetch
        const response = await authenticatedFetch(`${API_URL}/circulation/issue`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, isbn: isbn })
        });

        if (!response) return;

        const result = await response.json();

        if (response.ok) {
            showSuccess('Book Issued Successfully!');

            document.getElementById('issueUserId').value = '';
            document.getElementById('issueIsbn').value = '';
            loadLoans();
        } else {
            showError(result.message || 'Error issuing book');
        }
    } catch (error) {
        console.error('Issue error:', error);
    }
}

// 21. Handle Return Book (UPDATED to use authenticatedFetch)
function handleReturnBook(loanId) {
    showConfirm("Confirm return of this book?", async () => {
        try {
            // Change: Use authenticatedFetch
            const response = await authenticatedFetch(`${API_URL}/circulation/return`, {
                method: 'POST',
                body: JSON.stringify({ loan_id: loanId })
            });

            if (!response) return;

            if (response.ok) {
                showSuccess('Book Returned Successfully');
                loadLoans();
            } else {
                showError('Error returning book');
            }
        } catch (error) {
            console.error('Return error:', error);
            showError('Server error processing return.');
        }
    });
}

// --- MODAL UTILITIES (NO CHANGE) ---

// 1. Success Modal Helper
function showSuccess(message) {
    const modal = document.getElementById('successModal');
    const msg = document.getElementById('successMessageText');
    if (modal && msg) {
        msg.innerText = message;
        modal.classList.remove('hidden');
    }
}

function showError(message) {
    const modal = document.getElementById('errorModal');
    const msg = document.getElementById('errorMessageText');
    if (modal && msg) {
        msg.innerText = message;
        modal.classList.remove('hidden');
    }
}

// 2. Confirmation Modal Helper
let pendingConfirmAction = null;

function showConfirm(message, callback) {
    const modal = document.getElementById('confirmModal');
    const msg = document.getElementById('confirmMessageText');
    const yesBtn = document.getElementById('confirmYesBtn');

    if (modal && msg && yesBtn) {
        msg.innerText = message;
        pendingConfirmAction = callback;

        yesBtn.onclick = function () {
            if (pendingConfirmAction) pendingConfirmAction();
            closeConfirm();
        };

        modal.classList.remove('hidden');
    }
}

function closeConfirm() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.add('hidden');
}

// --- ID CARD GENERATION (UPDATED FOR DYNAMIC LAYOUT & LARGER QR) ---

function getIdCardHTML(id, name, type, qrImage, userImage) {
    const hasPhoto = userImage && userImage.length > 10; // Check if valid base64 exists

    // LAYOUT LOGIC:
    // If Photo: Image takes left side, Text middle, QR right.
    // If No Photo: Text takes left large area, QR takes right large area.

    let contentHtml = '';

    if (hasPhoto) {
        // --- OPTION 1: WITH PHOTO ---
        contentHtml = `
            <div class="flex items-center p-4 gap-3 relative h-full">
                <img src="${userImage}" class="w-20 h-20 rounded-lg object-cover border-2 border-slate-100 shadow-sm z-10 bg-white">
                
                <div class="relative z-10 flex-1 min-w-0">
                    <h2 class="text-sm font-extrabold text-slate-800 leading-tight uppercase truncate mb-1">${name}</h2>
                    <span class="inline-block bg-blue-50 text-blue-700 border border-blue-100 text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        ${type}
                    </span>
                    <p class="text-[9px] text-slate-400 mt-2 font-mono font-medium">ID: #${String(id)}</p>
                </div>

                <div class="relative z-10 w-20 h-20 bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex-shrink-0">
                    <img src="${qrImage}" class="w-full h-full object-contain">
                </div>
            </div>
        `;
    } else {
        // --- OPTION 2: NO PHOTO (TEXT ONLY) ---
        contentHtml = `
            <div class="flex items-center justify-between p-6 h-full relative">
                <div class="relative z-10 flex-1 pr-4">
                    <h2 class="text-xl font-extrabold text-slate-800 leading-tight uppercase mb-2 tracking-tight">${name}</h2>
                    <span class="inline-block bg-blue-600 text-white border border-blue-700 text-xs font-bold px-3 py-1 rounded uppercase tracking-wider shadow-sm">
                        ${type} MEMBER
                    </span>
                    <p class="text-sm text-slate-400 mt-4 font-mono font-bold tracking-widest">ID: #${String(id)}</p>
                </div>

                <div class="relative z-10 w-28 h-28 bg-white p-1.5 rounded-xl border-2 border-slate-200 shadow-md flex-shrink-0">
                    <img src="${qrImage}" class="w-full h-full object-contain">
                </div>
            </div>
        `;
    }

    return `
    <html>
    <head>
        <title>Print ID - ${name}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/@phosphor-icons/web"></script>
        <style>
            @media print {
                body { -webkit-print-color-adjust: exact; }
                .no-print { display: none; }
            }
            .id-card {
                width: 85.6mm;
                height: 53.98mm;
                overflow: hidden;
                position: relative;
                background: white;
                border: 1px solid #cbd5e1;
            }
            /* Background Watermark */
            .watermark {
                position: absolute;
                right: -20px;
                bottom: -30px;
                font-size: 8rem;
                color: #f1f5f9;
                transform: rotate(-12deg);
                z-index: 0;
                pointer-events: none;
            }
        </style>
    </head>
    <body class="bg-slate-100 flex items-center justify-center min-h-screen p-10">
        
        <div class="id-card rounded-xl shadow-2xl flex flex-col font-sans bg-white">
            
            <div class="h-12 bg-gradient-to-r from-blue-700 to-blue-600 flex items-center px-4 gap-3 shrink-0 z-20 relative shadow-sm">
                <div class="text-white text-xl flex items-center"><i class="ph-fill ph-books"></i></div>
                <div>
                    <h1 class="text-white font-bold text-[10px] leading-none tracking-tight">PUBLIC LIBRARY</h1>
                    <p class="text-blue-200 text-[7px] uppercase tracking-[0.2em] mt-0.5 font-medium">Calbayog City</p>
                </div>
            </div>

            <div class="flex-1 relative">
                <i class="ph-fill ph-books watermark"></i>
                ${contentHtml}
            </div>
            
            <div class="h-1.5 bg-blue-600 w-full shrink-0 z-20"></div>
        </div>

        <div class="fixed bottom-10 flex gap-4 no-print">
            <button onclick="window.print()" class="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-blue-700 transition">
                <i class="ph-bold ph-printer"></i> Print ID
            </button>
            <button onclick="window.close()" class="bg-white text-slate-600 px-6 py-2 rounded-full font-bold shadow hover:bg-slate-50 transition">
                Close
            </button>
        </div>

    </body>
    </html>
    `;
}

function generateIDCard(id, name, type, userImage) {
    const qrContainer = document.createElement('div');

    // Increased Resolution for sharper print
    new QRCode(qrContainer, {
        text: id.toString(),
        width: 300,  // Increased from 150 to 300 for high quality
        height: 300,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    setTimeout(() => {
        const imgElement = qrContainer.querySelector('img');
        if (imgElement && imgElement.src) {
            const qrImage = imgElement.src;
            const printWindow = window.open('', '', 'width=700,height=500');
            printWindow.document.write(getIdCardHTML(id, name, type, qrImage, userImage));
            printWindow.document.close();
        }
    }, 100);
}

// Helper to toggle photo input visibility
function togglePhotoField(show) {
    const field = document.getElementById('photoUploadField');
    const input = document.getElementById('newUserPhoto');

    if (show) {
        field.style.display = 'block';
        field.style.opacity = '1';
    } else {
        field.style.display = 'none';
        field.style.opacity = '0';
        input.value = ''; // Clear file if switching to basic
    }
}

function showSection(sectionName) {
    // Add 'walkin' to the lists
    const sections = ['dashboard', 'users', 'circulation', 'books', 'walkin'];
    const buttons = ['dashboardBtn', 'usersBtn', 'circulationBtn', 'booksBtn', 'walkinBtn'];

    // ... (rest of standard toggle logic remains the same) ...
    sections.forEach(sec => {
        const el = document.getElementById(sec + 'Section');
        if (el) el.classList.add('hidden');
    });

    buttons.forEach(btn => {
        const el = document.getElementById(btn);
        if (el) {
            el.classList.remove('bg-blue-50', 'text-blue-600');
            el.classList.add('text-slate-600', 'hover:bg-slate-50');
        }
    });

    const activeSection = document.getElementById(sectionName + 'Section');
    if (activeSection) activeSection.classList.remove('hidden');

    const activeBtn = document.getElementById(sectionName + 'Btn');
    if (activeBtn) {
        activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-50');
        activeBtn.classList.add('bg-blue-50', 'text-blue-600');
    }

    // Load specific data
    if (sectionName === 'dashboard') loadHistory();
    if (sectionName === 'users') loadUsers();
    if (sectionName === 'circulation') loadLoans();
    if (sectionName === 'books') loadBooks();
    if (sectionName === 'walkin') loadWalkIns(); // <--- NEW CALL
}

// 2. NEW FUNCTION: Load Walk-In Data
let allWalkIns = [];

async function loadWalkIns() {
    try {
        const response = await authenticatedFetch(`${API_URL}/attendance/walkins`);
        if (!response || !response.ok) return;

        allWalkIns = await response.json();
        renderWalkinTable(allWalkIns);
    } catch (error) {
        console.error("Error loading walk-ins", error);
    }
}

// 3. NEW FUNCTION: Render Walk-In Table
function renderWalkinTable(data) {
    const tbody = document.getElementById('walkinTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-400">No walk-in visitors recorded.</td></tr>';
        return;
    }

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100";

        const timeIn = new Date(row.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const statusBadge = row.status === 'Checked In'
            ? '<span class="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">Active</span>'
            : '<span class="bg-slate-100 text-slate-500 px-2 py-1 rounded-full text-xs font-bold">Left</span>';

        // Action Button: Only show "Check Out" if they are currently Checked In
        const actionBtn = row.status === 'Checked In'
            ? `<button onclick="handleWalkinCheckOut(${row.id})" class="text-red-600 hover:bg-red-50 border border-red-200 px-3 py-1 rounded-lg text-xs font-bold transition">Check Out</button>`
            : '<span class="text-slate-300">-</span>';

        // Visual ID distinction: Prefix with "W-"
        tr.innerHTML = `
            <td class="p-4 font-mono text-slate-400 text-xs">W-${row.id}</td>
            <td class="p-4 font-bold text-slate-700">${row.first_name} ${row.last_name}</td>
            <td class="p-4 text-slate-600">${row.visit_purpose}</td>
            <td class="p-4 text-xs text-slate-500">
                <div>${row.contact_number || '-'}</div>
                <div class="text-[10px] text-slate-400">${row.address || ''}</div>
            </td>
            <td class="p-4 font-mono text-xs">${timeIn}</td>
            <td class="p-4">${statusBadge}</td>
            <td class="p-4">${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 4. NEW FUNCTION: Handle Admin Manual Check-out for Walk-ins
async function handleWalkinCheckOut(id) {
    // <-- Updated to use your custom confirm modal
    showConfirm("Check out this visitor?", async () => {
        try {
            const response = await authenticatedFetch(`${API_URL}/attendance/checkout`, {
                method: 'POST',
                body: JSON.stringify({
                    type: 'walk-in',
                    id: id
                })
            });

            if (response.ok) {
                loadWalkIns();
                showSuccess("Visitor Checked Out");
            } else {
                showError("Failed to check out walk-in visitor.");
            }
        } catch (error) {
            console.error(error);
            showError("Server error during check out.");
        }
    });
}

// 5. NEW FUNCTION: Search Filter for Walk-ins
function filterWalkIns(query) {
    const lower = query.toLowerCase();
    const filtered = allWalkIns.filter(w =>
        w.first_name.toLowerCase().includes(lower) ||
        w.last_name.toLowerCase().includes(lower)
    );
    renderWalkinTable(filtered);
}