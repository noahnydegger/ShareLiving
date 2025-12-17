const API_URL = "http://127.0.0.1:8000";

function showSection(id) {
    document.querySelectorAll("section").forEach(s => s.style.display = "none");
    document.getElementById(id).style.display = "block";
}

function getToken() {
    return localStorage.getItem("token");
}

function setLoggedIn(username) {
    document.getElementById("login").style.display = "none";
    document.getElementById("user-info").innerText = `Logged in as ${username}`;
    document.getElementById("logout-btn").style.display = "inline";
}

function setLoggedOut() {
    document.getElementById("login").style.display = "block";
    document.getElementById("user-info").innerText = "";
    document.getElementById("logout-btn").style.display = "none";
}

async function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const response = await fetch(`${API_URL}/auth/jwt/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password }),
    });

    if (!response.ok) {
        document.getElementById("login-status").innerText = "Login failed";
        return;
    }

    const data = await response.json();
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("username", username);
    setLoggedIn(username);
}

function logout() {
    localStorage.clear();
    setLoggedOut();
    showSection("home");
}