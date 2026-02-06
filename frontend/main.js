const API_URL = "http://127.0.0.1:8000";

/*
    Section navigation
*/
function showSection(id) {
    document.querySelectorAll("section").forEach(s => {
        s.style.display = "none";
    });
    const el = document.getElementById(id);
    if (el) {
        el.style.display = "block";
    }
}

/*
    Manual username helpers
*/
function getStoredUsername() {
    return localStorage.getItem("manualUsername") || "";
}

function setStoredUsername(username) {
    localStorage.setItem("manualUsername", username);
}

function syncUsernameInputs(value) {
    const laundryInput = document.getElementById("laundry-username");
    const dinnerInput = document.getElementById("dinner-username");
    if (laundryInput) {
        laundryInput.value = value;
    }
    if (dinnerInput) {
        dinnerInput.value = value;
    }
}

function readUsername(inputId) {
    const input = document.getElementById(inputId);
    return input ? input.value.trim() : "";
}

/*
    Laundry
*/
function showLaundryAdd() {
    document.getElementById("laundry-add").style.display = "block";
    document.getElementById("laundry-list").style.display = "none";
}

function showLaundryList() {
    document.getElementById("laundry-add").style.display = "none";
    document.getElementById("laundry-list").style.display = "block";
    loadLaundry();
}

function formatDuration(minutes) {
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (remainder === 0) {
        return `${hours} h`;
    }
    return `${hours} h ${remainder} min`;
}

async function addLaundryBooking() {
    const username = readUsername("laundry-username");
    const date = document.getElementById("laundry-date").value;
    const start = document.getElementById("laundry-start").value;
    const end = document.getElementById("laundry-end").value;
    const status = document.getElementById("laundry-add-status");
    status.innerText = "";

    if (!username || !date || !start || !end) {
        status.innerText = "Please fill in name, date, start, and end time.";
        return;
    }

    const response = await fetch(`${API_URL}/api/laundry`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            username: username,
            date: date,
            start_time: start,
            end_time: end,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        status.innerText = `Failed to save booking: ${errorText}`;
        return;
    }

    status.innerText = "Booking saved.";
    showLaundryList();
}

async function loadLaundry() {
    const status = document.getElementById("laundry-list-status");
    const tableBody = document.querySelector("#laundry-table tbody");
    status.innerText = "";
    tableBody.innerHTML = "";

    const response = await fetch(`${API_URL}/api/laundry`);

    if (!response.ok) {
        status.innerText = "Failed to load laundry bookings.";
        return;
    }

    const data = await response.json();
    if (!data.length) {
        status.innerText = "No bookings yet.";
        return;
    }

    data.forEach((booking) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${booking.user}</td>
            <td>${booking.date}</td>
            <td>${booking.start_time}</td>
            <td>${booking.end_time}</td>
            <td>${formatDuration(booking.duration_minutes)}</td>
        `;
        tableBody.appendChild(row);
    });
}

/*
    Dinner
*/
async function loadDinner() {
    const username = readUsername("dinner-username");
    const output = document.getElementById("dinner-output");
    if (!username) {
        output.innerText = "Enter a username first.";
        return;
    }

    const response = await fetch(
        `${API_URL}/api/dinner?username=${encodeURIComponent(username)}`
    );

    if (!response.ok) {
        output.innerText = "Failed to load dinner data.";
        return;
    }

    const data = await response.json();
    output.innerText = JSON.stringify(data, null, 2);
}

/*
    Initialize UI on page load
*/
document.addEventListener("DOMContentLoaded", () => {
    showSection("home");
    const stored = getStoredUsername();
    if (stored) {
        syncUsernameInputs(stored);
    }

    showLaundryAdd();

    ["laundry-username", "dinner-username"].forEach((id) => {
        const input = document.getElementById(id);
        if (!input) {
            return;
        }
        input.addEventListener("input", (event) => {
            const value = event.target.value;
            setStoredUsername(value);
            syncUsernameInputs(value);
        });
    });
});
