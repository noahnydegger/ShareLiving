const API_URL = "/homes/default";
const HOUSE_TOKEN_KEY = "shareLiving.houseToken";
const HOUSE_NAME_KEY = "shareLiving.houseName";
const HOUSE_ID_KEY = "shareLiving.houseId";

let currentPeople = [];
let currentLivingGroups = [];

function showSection(id) {
    document.querySelectorAll("section").forEach((section) => {
        section.style.display = "none";
    });
    const element = document.getElementById(id);
    if (element) {
        element.style.display = "block";
    }
}

function getHouseToken() {
    return localStorage.getItem(HOUSE_TOKEN_KEY) || "";
}

function getActiveHouseId() {
    return localStorage.getItem(HOUSE_ID_KEY) || "";
}

function getSelectedPersonStorageKey() {
    const houseId = getActiveHouseId();
    return houseId ? `shareLiving.selectedPerson.${houseId}` : "shareLiving.selectedPerson";
}

function getSelectedPersonId() {
    return localStorage.getItem(getSelectedPersonStorageKey()) || "";
}

function setSelectedPersonId(personId) {
    const key = getSelectedPersonStorageKey();
    if (!personId) {
        localStorage.removeItem(key);
        return;
    }
    localStorage.setItem(key, String(personId));
}

function setAuthState(auth) {
    localStorage.setItem(HOUSE_TOKEN_KEY, auth.token);
    localStorage.setItem(HOUSE_NAME_KEY, auth.house_name);
    localStorage.setItem(HOUSE_ID_KEY, String(auth.house_id));
}

function clearAuthState() {
    localStorage.removeItem(HOUSE_TOKEN_KEY);
    localStorage.removeItem(HOUSE_NAME_KEY);
    localStorage.removeItem(HOUSE_ID_KEY);
}

async function apiFetch(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = getHouseToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        logoutHouse();
    }

    return response;
}

function setAuthVisibility(isLoggedIn) {
    document.querySelectorAll("[data-auth-only]").forEach((element) => {
        element.style.display = isLoggedIn ? "" : "none";
    });
    document.getElementById("auth-panels").style.display = isLoggedIn ? "none" : "grid";
    document.getElementById("house-dashboard").style.display = isLoggedIn ? "block" : "none";
}

function fillPersonSelect(selectId, includeEmpty = false, emptyLabel = "Select a person") {
    const select = document.getElementById(selectId);
    if (!select) {
        return;
    }

    const selectedValue = select.value || getSelectedPersonId();
    select.innerHTML = "";

    if (includeEmpty) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = emptyLabel;
        select.appendChild(option);
    }

    currentPeople.forEach((person) => {
        const option = document.createElement("option");
        option.value = String(person.id);
        option.textContent = person.living_group_name
            ? `${person.name} (${person.living_group_name})`
            : person.name;
        select.appendChild(option);
    });

    if (selectedValue && currentPeople.some((person) => String(person.id) === String(selectedValue))) {
        select.value = String(selectedValue);
    } else if (!includeEmpty && currentPeople.length) {
        select.value = String(currentPeople[0].id);
    }
}

function syncPersonSelectors() {
    fillPersonSelect("current-person-select", true);
    fillPersonSelect("laundry-person-select");
    fillPersonSelect("food-person-select");
    fillPersonSelect("guestroom-person-select");
}

function fillCookingGroupSelect() {
    const select = document.getElementById("food-cooking-group");
    if (!select) {
        return;
    }

    select.innerHTML = '<option value="">Whole house</option>';
    currentLivingGroups.forEach((group) => {
        const option = document.createElement("option");
        option.value = String(group.id);
        option.textContent = group.name;
        select.appendChild(option);
    });
}

function renderLivingGroups() {
    const list = document.getElementById("living-groups-list");
    list.innerHTML = "";

    if (!currentLivingGroups.length) {
        list.innerHTML = "<li>No living groups yet.</li>";
        return;
    }

    currentLivingGroups.forEach((group) => {
        const item = document.createElement("li");
        item.textContent = group.name;
        list.appendChild(item);
    });

    const select = document.getElementById("person-living-group");
    select.innerHTML = '<option value="">No living group</option>';
    currentLivingGroups.forEach((group) => {
        const option = document.createElement("option");
        option.value = String(group.id);
        option.textContent = group.name;
        select.appendChild(option);
    });
}

function renderPeople() {
    const list = document.getElementById("people-list");
    list.innerHTML = "";

    if (!currentPeople.length) {
        list.innerHTML = "<li>No people yet.</li>";
        document.getElementById("current-person-status").innerText = "Add a person to use laundry and food.";
        return;
    }

    currentPeople.forEach((person) => {
        const item = document.createElement("li");
        item.textContent = person.living_group_name
            ? `${person.name} - ${person.living_group_name}`
            : person.name;
        list.appendChild(item);
    });

    document.getElementById("current-person-status").innerText = getSelectedPersonId()
        ? ""
        : "Select a current person for quicker service entries.";
}

async function loadHouseData() {
    const [groupsResponse, peopleResponse] = await Promise.all([
        apiFetch("/api/living-groups"),
        apiFetch("/api/people"),
    ]);

    if (!groupsResponse.ok || !peopleResponse.ok) {
        return false;
    }

    currentLivingGroups = await groupsResponse.json();
    currentPeople = await peopleResponse.json();

    renderLivingGroups();
    renderPeople();
    syncPersonSelectors();
    fillCookingGroupSelect();

    const selectedPersonId = getSelectedPersonId();
    if (selectedPersonId && !currentPeople.some((person) => String(person.id) === String(selectedPersonId))) {
        setSelectedPersonId("");
        syncPersonSelectors();
    }

    return true;
}

function applyLoggedInState() {
    const houseName = localStorage.getItem(HOUSE_NAME_KEY) || "";
    setAuthVisibility(true);
    document.getElementById("active-house-label").innerText = `Logged in as: ${houseName}`;
}

async function handleSuccessfulAuth(auth) {
    setAuthState(auth);
    applyLoggedInState();
    const loaded = await loadHouseData();
    if (!loaded) {
        return;
    }
    showSection("home");
}

async function createHouse() {
    const houseName = document.getElementById("create-house-name").value.trim();
    const password = document.getElementById("create-house-password").value;
    const status = document.getElementById("create-house-status");
    status.innerText = "";

    if (!houseName || !password) {
        status.innerText = "Enter a house name and password.";
        return;
    }

    const response = await fetch(`${API_URL}/auth/house/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ house_name: houseName, password }),
    });

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Failed to create house: ${error}`;
        return;
    }

    await handleSuccessfulAuth(await response.json());
    status.innerText = "House created.";
}

async function loginHouse() {
    const houseName = document.getElementById("login-house-name").value.trim();
    const password = document.getElementById("login-house-password").value;
    const status = document.getElementById("login-house-status");
    status.innerText = "";

    if (!houseName || !password) {
        status.innerText = "Enter a house name and password.";
        return;
    }

    const response = await fetch(`${API_URL}/auth/house/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ house_name: houseName, password }),
    });

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Login failed: ${error}`;
        return;
    }

    await handleSuccessfulAuth(await response.json());
}

function logoutHouse() {
    setSelectedPersonId("");
    clearAuthState();
    currentPeople = [];
    currentLivingGroups = [];
    setAuthVisibility(false);
    renderLivingGroups();
    renderPeople();
    syncPersonSelectors();
    fillCookingGroupSelect();
    showSection("home");
}

function handleCurrentPersonChange() {
    const select = document.getElementById("current-person-select");
    setSelectedPersonId(select.value);
    syncPersonSelectors();
    renderPeople();
}

async function createLivingGroup() {
    const input = document.getElementById("living-group-name");
    const status = document.getElementById("living-group-status");
    status.innerText = "";

    const response = await apiFetch("/api/living-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: input.value.trim() }),
    });

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Failed to add living group: ${error}`;
        return;
    }

    input.value = "";
    status.innerText = "Living group added.";
    await loadHouseData();
}

async function createPerson() {
    const nameInput = document.getElementById("person-name");
    const groupSelect = document.getElementById("person-living-group");
    const status = document.getElementById("person-status");
    status.innerText = "";

    const payload = {
        name: nameInput.value.trim(),
        living_group_id: groupSelect.value ? Number(groupSelect.value) : null,
    };

    const response = await apiFetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Failed to add person: ${error}`;
        return;
    }

    nameInput.value = "";
    groupSelect.value = "";
    status.innerText = "Person added.";
    await loadHouseData();
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
        const date = new Date(base);
        date.setDate(base.getDate() + i);
        dates.push(formatDate(date));
    }
    return dates;
}

function showLaundryAdd() {
    document.getElementById("laundry-add").style.display = "block";
    document.getElementById("laundry-list").style.display = "none";
    syncPersonSelectors();
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
    return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}

async function addLaundryBooking() {
    const personId = document.getElementById("laundry-person-select").value;
    const date = document.getElementById("laundry-date").value;
    const start = document.getElementById("laundry-start").value;
    const end = document.getElementById("laundry-end").value;
    const status = document.getElementById("laundry-add-status");
    status.innerText = "";

    if (!personId || !date || !start || !end) {
        status.innerText = "Please choose a person, date, start, and end time.";
        return;
    }

    const response = await apiFetch("/api/laundry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            person_id: Number(personId),
            date,
            start_time: start,
            end_time: end,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Failed to save booking: ${error}`;
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

    const response = await apiFetch("/api/laundry");
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
            <td>${booking.person_name}</td>
            <td>${booking.date}</td>
            <td>${booking.start_time}</td>
            <td>${booking.end_time}</td>
            <td>${formatDuration(booking.duration_minutes)}</td>
        `;
        tableBody.appendChild(row);
    });
}

function getDefaultMealTime(mealType) {
    if (mealType === "lunch") {
        return "12:30";
    }
    if (mealType === "brunch") {
        return "09:30";
    }
    return "19:00";
}

function isSunday(dateValue) {
    if (!dateValue) {
        return false;
    }
    return new Date(`${dateValue}T00:00:00`).getDay() === 0;
}

function setFoodFormDefaults() {
    const mealType = document.getElementById("food-meal-type").value;
    document.getElementById("food-time").value = getDefaultMealTime(mealType);
    document.getElementById("food-leftovers-row").style.display = mealType === "lunch" ? "block" : "none";
    if (mealType !== "lunch") {
        document.getElementById("food-leftovers").checked = false;
    }
}

function updateBrunchAvailability() {
    const dateValue = document.getElementById("food-date").value;
    const mealSelect = document.getElementById("food-meal-type");
    const brunchOption = mealSelect.querySelector('option[value="brunch"]');
    const brunchAllowed = isSunday(dateValue);
    brunchOption.disabled = !brunchAllowed;

    if (!brunchAllowed && mealSelect.value === "brunch") {
        mealSelect.value = "lunch";
    }
}

function handleFoodDateChange() {
    updateBrunchAvailability();
    setFoodFormDefaults();
}

function handleFoodMealChange() {
    setFoodFormDefaults();
}

function initializeFoodForm() {
    document.getElementById("food-date").value = formatDate(new Date());
    document.getElementById("food-meal-type").value = "dinner";
    document.getElementById("food-eats").checked = false;
    document.getElementById("food-cooks").checked = false;
    document.getElementById("food-cook-helper").checked = false;
    document.getElementById("food-guests").value = "0";
    document.getElementById("food-leftovers").checked = false;
    document.getElementById("food-cooking-group").value = "";
    document.getElementById("food-notes").value = "";
    handleFoodDateChange();
}

function showFoodAdd() {
    document.getElementById("food-add").style.display = "block";
    document.getElementById("food-summary").style.display = "none";
    syncPersonSelectors();
    fillCookingGroupSelect();
    handleFoodDateChange();
}

function showFoodSummary() {
    document.getElementById("food-add").style.display = "none";
    document.getElementById("food-summary").style.display = "block";
    loadFoodSummary();
}

async function saveFoodEntry() {
    const personId = document.getElementById("food-person-select").value;
    const date = document.getElementById("food-date").value;
    const mealType = document.getElementById("food-meal-type").value;
    const status = document.getElementById("food-add-status");
    status.innerText = "";

    if (!personId || !date || !mealType) {
        status.innerText = "Please choose a person, date, and meal.";
        return;
    }

    if (mealType === "brunch" && !isSunday(date)) {
        status.innerText = "Brunch can only be saved on Sundays.";
        return;
    }

    const response = await apiFetch("/api/food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            person_id: Number(personId),
            date,
            meal_type: mealType,
            eats: document.getElementById("food-eats").checked,
            cooks: document.getElementById("food-cooks").checked,
            cook_helper: document.getElementById("food-cook-helper").checked,
            guests: Number(document.getElementById("food-guests").value || "0"),
            take_leftovers_next_day: document.getElementById("food-leftovers").checked,
            eating_time: document.getElementById("food-time").value,
            cooking_group_id: document.getElementById("food-cooking-group").value
                ? Number(document.getElementById("food-cooking-group").value)
                : null,
            notes: document.getElementById("food-notes").value.trim(),
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Failed to save food entry: ${error}`;
        return;
    }

    status.innerText = "Food entry saved.";
    showFoodSummary();
}

async function loadFoodSummary() {
    const status = document.getElementById("food-summary-status");
    const tbody = document.querySelector("#food-summary-table tbody");
    status.innerText = "";
    tbody.innerHTML = "";

    const weekDates = getWeekDates();
    const response = await apiFetch(`/api/food/summary?start_date=${weekDates[0]}&end_date=${weekDates[weekDates.length - 1]}`);
    if (!response.ok) {
        status.innerText = "Failed to load food summary.";
        return;
    }

    const data = await response.json();
    if (!data.items.length) {
        status.innerText = "No food entries yet.";
        return;
    }

    data.items.forEach((item) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${item.date}</td>
            <td>${item.meal_type}</td>
            <td>${item.cooks.length ? item.cooks.join(", ") : "—"}</td>
            <td>${item.total_eaters}</td>
        `;
        tbody.appendChild(row);
    });
}

function showGuestroomAdd() {
    document.getElementById("guestroom-add").style.display = "block";
    document.getElementById("guestroom-list").style.display = "none";
    syncPersonSelectors();
}

function showGuestroomList() {
    document.getElementById("guestroom-add").style.display = "none";
    document.getElementById("guestroom-list").style.display = "block";
    loadGuestroomBookings();
}

function getPersonNameById(personId) {
    const person = currentPeople.find((entry) => String(entry.id) === String(personId));
    return person ? person.name : "";
}

async function addGuestroomBooking() {
    const personId = document.getElementById("guestroom-person-select").value;
    const guestName = document.getElementById("guestroom-guest").value.trim();
    const startAt = document.getElementById("guestroom-start").value;
    const endAt = document.getElementById("guestroom-end").value;
    const status = document.getElementById("guestroom-add-status");
    status.innerText = "";

    if (!personId || !guestName || !startAt || !endAt) {
        status.innerText = "Please fill in all fields.";
        return;
    }

    const response = await apiFetch("/api/guestroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            responsible_name: getPersonNameById(personId),
            guest_name: guestName,
            start_at: startAt,
            end_at: endAt,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Failed to save booking: ${error}`;
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

    const response = await apiFetch("/api/guestroom");
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

document.addEventListener("DOMContentLoaded", async () => {
    showSection("home");
    setAuthVisibility(false);
    showLaundryAdd();
    showFoodAdd();
    initializeFoodForm();
    showGuestroomAdd();
    renderLivingGroups();
    renderPeople();
    syncPersonSelectors();
    fillCookingGroupSelect();

    if (getHouseToken()) {
        applyLoggedInState();
        const loaded = await loadHouseData();
        if (!loaded) {
            logoutHouse();
        }
    }
});
