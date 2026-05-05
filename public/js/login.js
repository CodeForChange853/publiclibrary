const API_URL = '/api';

async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    const messageEl = document.getElementById('loginMessage');

    loginBtn.disabled = true;
    messageEl.classList.add('hidden');
    messageEl.innerText = '';

    try {
        const response = await fetch(`${API_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (response.ok) {
            // SUCCESS: Save the token and redirect to the dashboard
            localStorage.setItem('authToken', result.token);
            // Optional: Save user name for dashboard greeting
            localStorage.setItem('userName', result.user.name);

            // Redirect to the secured dashboard
            window.location.href = 'index.html';

        } else {
            // FAILURE
            const errorMsg = result.details ? `${result.message} - ${result.details}` : result.message;
            messageEl.innerText = errorMsg || 'Login failed. Check username and password.';
            messageEl.classList.remove('hidden');
        }

    } catch (error) {
        messageEl.innerText = 'Server error. Could not connect to API.';
        messageEl.classList.remove('hidden');
        console.error('Login Fetch Error:', error);
    } finally {
        loginBtn.disabled = false;
    }
}