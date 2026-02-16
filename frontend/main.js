const API_URL = "/homes/default";

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
    const guestroomInput = document.getElementById("guestroom-responsible");
    if (laundryInput) {
        laundryInput.value = value;
    }
    if (dinnerInput) {
        dinnerInput.value = value;
    }
    if (guestroomInput) {
        guestroomInput.value = value;
    }
}

function readUsername(inputId) {
    const input = document.getElementById(inputId);
    return input ? input.value.trim() : "";
}

function pad2(value) {
    return String(value).padStart(2, "0");
}

function formatDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getWeekDates() {
    const dates = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i += 1) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        dates.push(formatDate(d));
    }
    return dates;
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
function showDinnerAdd() {
    document.getElementById("dinner-add").style.display = "block";
    document.getElementById("dinner-summary").style.display = "none";
}

function showDinnerSummary() {
    document.getElementById("dinner-add").style.display = "none";
    document.getElementById("dinner-summary").style.display = "block";
    loadDinnerSummary();
}

function renderDinnerForm() {
    const tbody = document.querySelector("#dinner-form-table tbody");
    tbody.innerHTML = "";
    getWeekDates().forEach((date) => {
        const row = document.createElement("tr");
        row.dataset.date = date;
        row.innerHTML = `
            <td>${date}</td>
            <td><input class="dinner-eats" type="checkbox"></td>
            <td><input class="dinner-cooks" type="checkbox"></td>
            <td><input class="dinner-guests" type="number" min="0" step="1" value="0"></td>
        `;
        tbody.appendChild(row);
    });
}

async function submitDinnerAttendance() {
    const username = readUsername("dinner-username");
    const status = document.getElementById("dinner-add-status");
    status.innerText = "";

    if (!username) {
        status.innerText = "Please enter a name.";
        return;
    }

    const rows = document.querySelectorAll("#dinner-form-table tbody tr");
    const days = Array.from(rows).map((row) => {
        const eats = row.querySelector(".dinner-eats").checked;
        const cooks = row.querySelector(".dinner-cooks").checked;
        let guests = parseInt(row.querySelector(".dinner-guests").value || "0", 10);
        if (!eats) {
            guests = 0;
        }
        return {
            date: row.dataset.date,
            eats: eats,
            cooks: eats ? cooks : false,
            guests: guests < 0 ? 0 : guests,
        };
    });

    const response = await fetch(`${API_URL}/api/dinner/attendance`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            username: username,
            days: days,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        status.innerText = `Failed to save attendance: ${errorText}`;
        return;
    }

    status.innerText = "Attendance saved.";
    showDinnerSummary();
}

async function loadDinnerSummary() {
    const status = document.getElementById("dinner-summary-status");
    const tbody = document.querySelector("#dinner-summary-table tbody");
    status.innerText = "";
    tbody.innerHTML = "";

    const response = await fetch(`${API_URL}/api/dinner/summary`);
    if (!response.ok) {
        status.innerText = "Failed to load attendance summary.";
        return;
    }

    const data = await response.json();
    if (!data.days.length) {
        status.innerText = "No attendance data yet.";
        return;
    }

    data.days.forEach((day) => {
        const row = document.createElement("tr");
        const cooks = day.cooks.length ? day.cooks.join(", ") : "—";
        row.innerHTML = `
            <td>${day.date}</td>
            <td>${cooks}</td>
            <td>${day.total_people}</td>
        `;
        tbody.appendChild(row);
    });
}

/*
    Guestroom
*/
function showGuestroomAdd() {
    document.getElementById("guestroom-add").style.display = "block";
    document.getElementById("guestroom-list").style.display = "none";
}

function showGuestroomList() {
    document.getElementById("guestroom-add").style.display = "none";
    document.getElementById("guestroom-list").style.display = "block";
    loadGuestroomBookings();
}

async function addGuestroomBooking() {
    const responsible = readUsername("guestroom-responsible");
    const guestName = document.getElementById("guestroom-guest").value.trim();
    const startAt = document.getElementById("guestroom-start").value;
    const endAt = document.getElementById("guestroom-end").value;
    const status = document.getElementById("guestroom-add-status");
    status.innerText = "";

    if (!responsible || !guestName || !startAt || !endAt) {
        status.innerText = "Please fill in all fields.";
        return;
    }

    const response = await fetch(`${API_URL}/api/guestroom`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            responsible_name: responsible,
            guest_name: guestName,
            start_at: startAt,
            end_at: endAt,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        status.innerText = `Failed to save booking: ${errorText}`;
        return;
    }

    status.innerText = "Booking saved.";
    showGuestroomList();
}

function formatDateTime(value) {
    if (!value) {
        return "";
    }
    return value.replace("T", " ").replace(":00", "");
}

async function loadGuestroomBookings() {
    const status = document.getElementById("guestroom-list-status");
    const tableBody = document.querySelector("#guestroom-table tbody");
    status.innerText = "";
    tableBody.innerHTML = "";

    const response = await fetch(`${API_URL}/api/guestroom`);
    if (!response.ok) {
        status.innerText = "Failed to load guestroom bookings.";
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
            <td>${booking.responsible_name}</td>
            <td>${booking.guest_name}</td>
            <td>${formatDateTime(booking.start_at)}</td>
            <td>${formatDateTime(booking.end_at)}</td>
            <td>${formatDuration(booking.duration_minutes)}</td>
        `;
        tableBody.appendChild(row);
    });
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
    showDinnerAdd();
    renderDinnerForm();
    showGuestroomAdd();

    ["laundry-username", "dinner-username", "guestroom-responsible"].forEach((id) => {
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
