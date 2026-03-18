const API_URL = "/homes/default";
const HOUSE_TOKEN_KEY = "shareLiving.houseToken";
const HOUSE_NAME_KEY = "shareLiving.houseName";
const HOUSE_ID_KEY = "shareLiving.houseId";

let currentPeople = [];
let currentLivingGroups = [];
let currentFoodAddWeekStart = getMonday(new Date());
let currentFoodSummaryWeekStart = getMonday(new Date());
let currentOverviewView = "week";
let currentOverviewDate = getMonday(new Date());
let currentOverviewEvents = [];

function showSection(id) {
    document.querySelectorAll("section").forEach((section) => {
        section.style.display = "none";
    });
    const element = document.getElementById(id);
    if (element) {
        element.style.display = "block";
    }

    if (id === "overview" && getHouseToken()) {
        loadOverviewData();
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

function fillPersonSelect(selectId, includeEmpty = false, emptyLabel = "Person auswählen") {
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

function createCookingGroupOptions(selectedValue = "") {
    const selected = String(selectedValue || "");
    let options = '<option value="">Ganzes Haus</option>';
    currentLivingGroups.forEach((group) => {
        const isSelected = String(group.id) === selected ? " selected" : "";
        options += `<option value="${group.id}"${isSelected}>${group.name}</option>`;
    });
    return options;
}

function renderLivingGroups() {
    const list = document.getElementById("living-groups-list");
    list.innerHTML = "";

    if (!currentLivingGroups.length) {
        list.innerHTML = "<li>Noch keine Wohngruppen.</li>";
        return;
    }

    currentLivingGroups.forEach((group) => {
        const item = document.createElement("li");
        item.textContent = group.name;
        list.appendChild(item);
    });

    const select = document.getElementById("person-living-group");
    select.innerHTML = '<option value="">Keine Wohngruppe</option>';
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
        list.innerHTML = "<li>Noch keine Personen.</li>";
        document.getElementById("current-person-status").innerText = "Füge zuerst eine Person hinzu, um Wäsche und Essen zu nutzen.";
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
        : "Wähle eine aktuelle Person für schnellere Einträge.";
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
    document.getElementById("active-house-label").innerText = `Angemeldet als: ${houseName}`;
}

async function handleSuccessfulAuth(auth) {
    setAuthState(auth);
    applyLoggedInState();
    const loaded = await loadHouseData();
    if (!loaded) {
        return;
    }
    await renderActiveFoodViews();
    showSection("home");
}

async function createHouse() {
    const houseName = document.getElementById("create-house-name").value.trim();
    const password = document.getElementById("create-house-password").value;
    const status = document.getElementById("create-house-status");
    status.innerText = "";

    if (!houseName || !password) {
        status.innerText = "Bitte Hausname und Passwort eingeben.";
        return;
    }

    const response = await fetch(`${API_URL}/auth/house/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ house_name: houseName, password }),
    });

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Haus konnte nicht erstellt werden: ${error}`;
        return;
    }

    await handleSuccessfulAuth(await response.json());
    status.innerText = "Haus erstellt.";
}

async function loginHouse() {
    const houseName = document.getElementById("login-house-name").value.trim();
    const password = document.getElementById("login-house-password").value;
    const status = document.getElementById("login-house-status");
    status.innerText = "";

    if (!houseName || !password) {
        status.innerText = "Bitte Hausname und Passwort eingeben.";
        return;
    }

    const response = await fetch(`${API_URL}/auth/house/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ house_name: houseName, password }),
    });

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Anmeldung fehlgeschlagen: ${error}`;
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
    showSection("home");
}

function handleCurrentPersonChange() {
    const select = document.getElementById("current-person-select");
    setSelectedPersonId(select.value);
    syncPersonSelectors();
    renderPeople();
    renderActiveFoodViews();
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
        status.innerText = `Wohngruppe konnte nicht hinzugefügt werden: ${error}`;
        return;
    }

    input.value = "";
    status.innerText = "Wohngruppe hinzugefügt.";
    await loadHouseData();
    await renderActiveFoodViews();
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
        status.innerText = `Person konnte nicht hinzugefügt werden: ${error}`;
        return;
    }

    nameInput.value = "";
    groupSelect.value = "";
    status.innerText = "Person hinzugefügt.";
    await loadHouseData();
    await renderActiveFoodViews();
}

function pad2(value) {
    return String(value).padStart(2, "0");
}

function cloneDate(date) {
    return new Date(date.getTime());
}

function formatDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function isToday(dateValue) {
    return dateValue === formatDate(new Date());
}

function formatDateTimeLocal(date) {
    return `${formatDate(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function getMonday(date) {
    const monday = cloneDate(date);
    monday.setHours(0, 0, 0, 0);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
    return monday;
}

function addDays(date, days) {
    const copy = cloneDate(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

function formatWeekLabel(weekStart) {
    const weekEnd = addDays(weekStart, 6);
    return `${formatDate(weekStart)} bis ${formatDate(weekEnd)}`;
}

function getWeekDates(weekStart = getMonday(new Date())) {
    const dates = [];
    for (let i = 0; i < 7; i += 1) {
        dates.push(formatDate(addDays(weekStart, i)));
    }
    return dates;
}

function getIsoWeekNumber(date) {
    const target = cloneDate(date);
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
    const week1 = new Date(target.getFullYear(), 0, 4);
    return 1 + Math.round(
        ((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
}

function getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getMonthGridStart(date) {
    return getMonday(getMonthStart(date));
}

function getMonthGridEnd(date) {
    const monthEnd = getMonthEnd(date);
    const day = monthEnd.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    return addDays(monthEnd, diff);
}

function getDateRangeForOverview() {
    if (currentOverviewView === "week") {
        const start = getMonday(currentOverviewDate);
        const end = addDays(start, 6);
        return { start, end };
    }

    return {
        start: getMonthGridStart(currentOverviewDate),
        end: getMonthGridEnd(currentOverviewDate),
    };
}

function getOverviewRangeLabel() {
    if (currentOverviewView === "week") {
        const weekStart = getMonday(currentOverviewDate);
        return `KW ${getIsoWeekNumber(weekStart)} · ${formatWeekLabel(weekStart)}`;
    }

    return currentOverviewDate.toLocaleDateString("de-CH", {
        month: "long",
        year: "numeric",
    });
}

function getOverviewFilterState() {
    return {
        food: document.getElementById("overview-filter-food").checked,
        laundry: document.getElementById("overview-filter-laundry").checked,
        guestroom: document.getElementById("overview-filter-guestroom").checked,
    };
}

function getOverviewEventsForDate(dateValue) {
    const filters = getOverviewFilterState();
    return currentOverviewEvents.filter((event) => {
        if (event.date !== dateValue) {
            return false;
        }
        if (event.type === "food" && !filters.food) {
            return false;
        }
        if (event.type === "laundry" && !filters.laundry) {
            return false;
        }
        if (event.type === "guestroom" && !filters.guestroom) {
            return false;
        }
        return true;
    });
}

function buildFoodEvents(foodEntries) {
    const groupedEntries = new Map();

    foodEntries.forEach((entry) => {
        const key = `${entry.date}|${entry.meal_type}|${entry.cooking_group_name || "house"}`;
        if (!groupedEntries.has(key)) {
            groupedEntries.set(key, {
                type: "food",
                date: entry.date,
                mealType: entry.meal_type,
                cookingGroupName: entry.cooking_group_name || "Ganzes Haus",
                cooks: [],
                totalPeople: 0,
            });
        }

        const item = groupedEntries.get(key);
        if (entry.cooks) {
            item.cooks.push(entry.person_name);
        }
        if (entry.eats) {
            item.totalPeople += 1 + Number(entry.guests || 0);
        }
    });

    return Array.from(groupedEntries.values()).map((entry) => ({
        type: "food",
        date: entry.date,
        title: `${formatMealLabel(entry.mealType)} · ${entry.cookingGroupName}`,
        subtitle: `${entry.cooks.length ? entry.cooks.join(", ") : "Kein Koch"} · ${entry.totalPeople} Personen`,
    }));
}

function buildLaundryEvents(laundryEntries) {
    return laundryEntries.map((entry) => ({
        type: "laundry",
        date: entry.date,
        title: `${entry.start_time.slice(0, 5)}–${entry.end_time.slice(0, 5)}`,
        subtitle: entry.person_name,
    }));
}

function getDurationDays(startValue, endValue) {
    const startAt = new Date(startValue);
    const endAt = new Date(endValue);
    const startDay = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate());
    const endDay = new Date(endAt.getFullYear(), endAt.getMonth(), endAt.getDate());
    const diffDays = Math.round((endDay.getTime() - startDay.getTime()) / 86400000) + 1;
    return Math.max(diffDays, 1);
}

function buildGuestroomEvents(guestroomEntries, startDate, endDate) {
    const events = [];
    const rangeStart = new Date(`${startDate}T00:00:00`);
    const rangeEnd = new Date(`${endDate}T23:59:59`);

    guestroomEntries.forEach((entry) => {
        const startAt = new Date(entry.start_at);
        const endAt = new Date(entry.end_at);
        if (endAt < rangeStart || startAt > rangeEnd) {
            return;
        }

        let cursor = new Date(startAt);
        cursor.setHours(0, 0, 0, 0);
        const lastDay = new Date(endAt);
        lastDay.setHours(0, 0, 0, 0);

        while (cursor <= lastDay) {
            events.push({
                type: "guestroom",
                date: formatDate(cursor),
                title: entry.guest_name,
                subtitle: "",
            });
            cursor = addDays(cursor, 1);
        }
    });

    return events;
}

function formatDateTime(value) {
    if (!value) {
        return "";
    }
    return value.replace("T", " ").replace(":00", "");
}

function createOverviewEventHtml(event) {
    return `
        <div class="calendar-event calendar-event--${event.type}">
            <strong>${event.title}</strong>
            <span>${event.subtitle}</span>
        </div>
    `;
}

function renderOverviewWeek() {
    const calendar = document.getElementById("overview-calendar");
    const weekStart = getMonday(currentOverviewDate);
    const weekDates = getWeekDates(weekStart);

    calendar.className = "overview-calendar overview-calendar--week";
    calendar.innerHTML = weekDates.map((dateValue) => {
        const date = new Date(`${dateValue}T00:00:00`);
        const dayLabel = date.toLocaleDateString("de-CH", { weekday: "long" });
        const events = getOverviewEventsForDate(dateValue);

        return `
            <div class="calendar-day-card${isToday(dateValue) ? " calendar-day-card--today" : ""}">
                <div class="calendar-day-header">
                    <strong>${dayLabel}</strong>
                    <span>${dateValue}</span>
                </div>
                <div class="calendar-day-events">
                    ${events.length ? events.map(createOverviewEventHtml).join("") : '<p class="calendar-empty">Keine Einträge</p>'}
                </div>
            </div>
        `;
    }).join("");
}

function renderOverviewMonth() {
    const calendar = document.getElementById("overview-calendar");
    const range = getDateRangeForOverview();
    const days = [];
    const weekdayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    let cursor = new Date(range.start);

    while (cursor <= range.end) {
        days.push(formatDate(cursor));
        cursor = addDays(cursor, 1);
    }

    calendar.className = "overview-calendar overview-calendar--month";
    calendar.innerHTML = `
        ${weekdayLabels.map((label) => `<div class="calendar-weekday">${label}</div>`).join("")}
        ${days.map((dateValue) => {
        const date = new Date(`${dateValue}T00:00:00`);
        const isCurrentMonth = date.getMonth() === currentOverviewDate.getMonth();
        const events = getOverviewEventsForDate(dateValue);

        return `
            <div class="calendar-month-cell${isCurrentMonth ? "" : " calendar-month-cell--muted"}${isToday(dateValue) ? " calendar-month-cell--today" : ""}">
                <div class="calendar-month-date">${date.getDate()}</div>
                <div class="calendar-day-events">
                    ${events.length ? events.map(createOverviewEventHtml).join("") : '<p class="calendar-empty">Keine Einträge</p>'}
                </div>
            </div>
        `;
    }).join("")}
    `;
}

function renderOverviewCalendar() {
    document.getElementById("overview-range-label").innerText = getOverviewRangeLabel();
    document.getElementById("overview-week-button").classList.toggle("is-active", currentOverviewView === "week");
    document.getElementById("overview-month-button").classList.toggle("is-active", currentOverviewView === "month");

    if (currentOverviewView === "week") {
        renderOverviewWeek();
    } else {
        renderOverviewMonth();
    }
}

async function loadOverviewData() {
    const status = document.getElementById("overview-status");
    const range = getDateRangeForOverview();
    const startDate = formatDate(range.start);
    const endDate = formatDate(range.end);
    status.innerText = "";

    const [foodResponse, laundryResponse, guestroomResponse] = await Promise.all([
        apiFetch(`/api/food?start_date=${startDate}&end_date=${endDate}`),
        apiFetch("/api/laundry"),
        apiFetch("/api/guestroom"),
    ]);

    if (!foodResponse.ok || !laundryResponse.ok || !guestroomResponse.ok) {
        status.innerText = "Übersicht konnte nicht geladen werden.";
        return;
    }

    const foodEntries = await foodResponse.json();
    const laundryEntries = await laundryResponse.json();
    const guestroomEntries = await guestroomResponse.json();

    currentOverviewEvents = [
        ...buildFoodEvents(foodEntries),
        ...buildLaundryEvents(
            laundryEntries.filter((entry) => entry.date >= startDate && entry.date <= endDate)
        ),
        ...buildGuestroomEvents(guestroomEntries, startDate, endDate),
    ];

    renderOverviewCalendar();
}

function setOverviewView(view) {
    currentOverviewView = view;
    loadOverviewData();
}

function changeOverviewRange(offset) {
    if (currentOverviewView === "week") {
        currentOverviewDate = addDays(currentOverviewDate, offset * 7);
    } else {
        currentOverviewDate = new Date(
            currentOverviewDate.getFullYear(),
            currentOverviewDate.getMonth() + offset,
            1,
        );
    }
    loadOverviewData();
}

function goToTodayOverview() {
    currentOverviewDate = currentOverviewView === "week"
        ? getMonday(new Date())
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    loadOverviewData();
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
        status.innerText = "Bitte Person, Datum, Start- und Endzeit auswählen.";
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
        status.innerText = `Buchung konnte nicht gespeichert werden: ${error}`;
        return;
    }

    status.innerText = "Buchung gespeichert.";
    showLaundryList();
}

async function loadLaundry() {
    const status = document.getElementById("laundry-list-status");
    const tableBody = document.querySelector("#laundry-table tbody");
    status.innerText = "";
    tableBody.innerHTML = "";

    const response = await apiFetch("/api/laundry");
    if (!response.ok) {
        status.innerText = "Wäschebuchungen konnten nicht geladen werden.";
        return;
    }

    const data = await response.json();
    if (!data.length) {
        status.innerText = "Noch keine Buchungen.";
        return;
    }

    data.forEach((booking) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${booking.person_name}</td>
            <td>${booking.date}</td>
            <td>${booking.start_time.slice(0, 5)}</td>
            <td>${booking.end_time.slice(0, 5)}</td>
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

function getMealRowsForWeek(weekStart) {
    const rows = [];
    const weekDates = getWeekDates(weekStart);
    weekDates.forEach((dateValue, index) => {
        rows.push({ date: dateValue, mealType: "lunch" });
        rows.push({ date: dateValue, mealType: "dinner" });
        if (index === 6) {
            rows.push({ date: dateValue, mealType: "brunch" });
        }
    });
    return rows;
}

function getFoodEntriesMap(entries, personId) {
    const entryMap = new Map();
    entries
        .filter((entry) => String(entry.person_id) === String(personId))
        .forEach((entry) => {
            entryMap.set(`${entry.date}|${entry.meal_type}`, entry);
        });
    return entryMap;
}

function formatMealLabel(mealType) {
    if (mealType === "lunch") {
        return "Mittagessen";
    }
    if (mealType === "brunch") {
        return "Brunch";
    }
    return "Abendessen";
}

function renderFoodWeekTable(entries) {
    const personId = document.getElementById("food-person-select").value || getSelectedPersonId();
    const tbody = document.querySelector("#food-add-table tbody");
    const status = document.getElementById("food-add-status");
    const weekRows = getMealRowsForWeek(currentFoodAddWeekStart);
    const entryMap = getFoodEntriesMap(entries, personId);

    document.getElementById("food-add-week-label").innerText = formatWeekLabel(currentFoodAddWeekStart);
    tbody.innerHTML = "";
    status.innerText = currentPeople.length ? "" : "Füge zuerst eine Person hinzu, bevor du Essen planst.";

    weekRows.forEach((rowData) => {
        const entry = entryMap.get(`${rowData.date}|${rowData.mealType}`);
        const row = document.createElement("tr");
        row.dataset.date = rowData.date;
        row.dataset.mealType = rowData.mealType;
        row.innerHTML = `
            <td>${rowData.date}</td>
            <td>${formatMealLabel(rowData.mealType)}</td>
            <td><input class="food-eats" type="checkbox" ${entry?.eats ? "checked" : ""}></td>
            <td><input class="food-cooks" type="checkbox" ${entry?.cooks ? "checked" : ""}></td>
            <td><input class="food-cook-helper" type="checkbox" ${entry?.cook_helper ? "checked" : ""}></td>
            <td><input class="food-guests" type="number" min="0" step="1" value="${entry?.guests ?? 0}"></td>
            <td><input class="food-leftovers" type="checkbox" ${entry?.take_leftovers_next_day ? "checked" : ""} ${rowData.mealType !== "lunch" ? "disabled" : ""}></td>
            <td><input class="food-time" type="time" value="${entry?.eating_time ?? getDefaultMealTime(rowData.mealType)}"></td>
            <td><select class="food-cooking-group">${createCookingGroupOptions(entry?.cooking_group_id)}</select></td>
            <td><input class="food-notes" type="text" value="${entry?.notes ?? ""}" placeholder="kommt später, vegan"></td>
        `;
        tbody.appendChild(row);
    });
}

async function loadFoodWeekForAdd() {
    const weekDates = getWeekDates(currentFoodAddWeekStart);
    const response = await apiFetch(`/api/food?start_date=${weekDates[0]}&end_date=${weekDates[weekDates.length - 1]}`);
    if (!response.ok) {
        document.getElementById("food-add-status").innerText = "Essenswoche konnte nicht geladen werden.";
        return;
    }
    renderFoodWeekTable(await response.json());
}

function changeFoodAddWeek(offset) {
    currentFoodAddWeekStart = addDays(currentFoodAddWeekStart, offset * 7);
    loadFoodWeekForAdd();
}

function goToTodayFoodAdd() {
    currentFoodAddWeekStart = getMonday(new Date());
    loadFoodWeekForAdd();
}

async function saveFoodWeek() {
    const personId = document.getElementById("food-person-select").value || getSelectedPersonId();
    const status = document.getElementById("food-add-status");
    status.innerText = "";

    if (!personId) {
        status.innerText = "Bitte eine Person auswählen.";
        return;
    }

    const rows = Array.from(document.querySelectorAll("#food-add-table tbody tr"));
    for (const row of rows) {
        const payload = {
            person_id: Number(personId),
            date: row.dataset.date,
            meal_type: row.dataset.mealType,
            eats: row.querySelector(".food-eats").checked,
            cooks: row.querySelector(".food-cooks").checked,
            cook_helper: row.querySelector(".food-cook-helper").checked,
            guests: Number(row.querySelector(".food-guests").value || "0"),
            take_leftovers_next_day: row.querySelector(".food-leftovers").checked,
            eating_time: row.querySelector(".food-time").value || getDefaultMealTime(row.dataset.mealType),
            cooking_group_id: row.querySelector(".food-cooking-group").value
                ? Number(row.querySelector(".food-cooking-group").value)
                : null,
            notes: row.querySelector(".food-notes").value.trim(),
        };

        const response = await apiFetch("/api/food", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.text();
            status.innerText = `Woche konnte nicht gespeichert werden: ${error}`;
            return;
        }
    }

    status.innerText = "Woche gespeichert.";
    await loadFoodWeekForAdd();
}

function showFoodAdd() {
    document.getElementById("food-add").style.display = "block";
    document.getElementById("food-summary").style.display = "none";
    syncPersonSelectors();
    if (getHouseToken()) {
        loadFoodWeekForAdd();
    }
}

function buildSummaryRows(entries) {
    const tbody = document.querySelector("#food-summary-table tbody");
    const status = document.getElementById("food-summary-status");
    tbody.innerHTML = "";
    document.getElementById("food-summary-week-label").innerText = formatWeekLabel(currentFoodSummaryWeekStart);
    status.innerText = "";

    const entriesByMeal = new Map();
    entries.forEach((entry) => {
        const key = `${entry.date}|${entry.meal_type}`;
        if (!entriesByMeal.has(key)) {
            entriesByMeal.set(key, []);
        }
        entriesByMeal.get(key).push(entry);
    });

    getMealRowsForWeek(currentFoodSummaryWeekStart).forEach((mealRow) => {
        const key = `${mealRow.date}|${mealRow.mealType}`;
        const mealEntries = entriesByMeal.get(key) || [];

        if (!mealEntries.length) {
            const emptyRow = document.createElement("tr");
            emptyRow.innerHTML = `
                <td>${mealRow.date}</td>
                <td>${formatMealLabel(mealRow.mealType)}</td>
                <td>—</td>
                <td>—</td>
                <td>Nein</td>
                <td>Nein</td>
                <td>Nein</td>
                <td>0</td>
                <td>Nein</td>
                <td>${getDefaultMealTime(mealRow.mealType)}</td>
                <td>—</td>
            `;
            tbody.appendChild(emptyRow);
            return;
        }

        mealEntries.forEach((entry) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${entry.date}</td>
                <td>${formatMealLabel(entry.meal_type)}</td>
                <td>${entry.person_name}</td>
                <td>${entry.cooking_group_name || "Ganzes Haus"}</td>
                <td>${entry.eats ? "Ja" : "Nein"}</td>
                <td>${entry.cooks ? "Ja" : "Nein"}</td>
                <td>${entry.cook_helper ? "Ja" : "Nein"}</td>
                <td>${entry.guests}</td>
                <td>${entry.take_leftovers_next_day ? "Ja" : "Nein"}</td>
                <td>${entry.eating_time}</td>
                <td>${entry.notes || "—"}</td>
            `;
            tbody.appendChild(row);
        });
    });
}

async function loadFoodSummary() {
    const weekDates = getWeekDates(currentFoodSummaryWeekStart);
    const response = await apiFetch(`/api/food?start_date=${weekDates[0]}&end_date=${weekDates[weekDates.length - 1]}`);
    if (!response.ok) {
        document.getElementById("food-summary-status").innerText = "Essensübersicht konnte nicht geladen werden.";
        return;
    }
    buildSummaryRows(await response.json());
}

function changeFoodSummaryWeek(offset) {
    currentFoodSummaryWeekStart = addDays(currentFoodSummaryWeekStart, offset * 7);
    loadFoodSummary();
}

function goToTodayFoodSummary() {
    currentFoodSummaryWeekStart = getMonday(new Date());
    loadFoodSummary();
}

function showFoodSummary() {
    document.getElementById("food-add").style.display = "none";
    document.getElementById("food-summary").style.display = "block";
    loadFoodSummary();
}

async function renderActiveFoodViews() {
    if (document.getElementById("food-add").style.display !== "none") {
        await loadFoodWeekForAdd();
    }
    if (document.getElementById("food-summary").style.display !== "none") {
        await loadFoodSummary();
    }
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
        status.innerText = "Bitte alle Felder ausfüllen.";
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
        status.innerText = `Buchung konnte nicht gespeichert werden: ${error}`;
        return;
    }

    status.innerText = "Buchung gespeichert.";
    showGuestroomList();
}

async function loadGuestroomBookings() {
    const status = document.getElementById("guestroom-list-status");
    const tableBody = document.querySelector("#guestroom-table tbody");
    status.innerText = "";
    tableBody.innerHTML = "";

    const response = await apiFetch("/api/guestroom");
    if (!response.ok) {
        status.innerText = "Gästebuchungen konnten nicht geladen werden.";
        return;
    }

    const data = await response.json();
    if (!data.length) {
        status.innerText = "Noch keine Buchungen.";
        return;
    }

    data.forEach((booking) => {
        const row = document.createElement("tr");
        const durationDays = getDurationDays(booking.start_at, booking.end_at);
        row.innerHTML = `
            <td>${booking.responsible_name}</td>
            <td>${booking.guest_name}</td>
            <td>${formatDateTime(booking.start_at)}</td>
            <td>${formatDateTime(booking.end_at)}</td>
            <td>${durationDays} ${durationDays === 1 ? "Tag" : "Tage"}</td>
        `;
        tableBody.appendChild(row);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("food-person-select").addEventListener("change", () => {
        loadFoodWeekForAdd();
    });

    showSection("home");
    setAuthVisibility(false);
    showLaundryAdd();
    showFoodAdd();
    showGuestroomAdd();
    renderLivingGroups();
    renderPeople();
    syncPersonSelectors();

    if (getHouseToken()) {
        applyLoggedInState();
        const loaded = await loadHouseData();
        if (!loaded) {
            logoutHouse();
        } else {
            await renderActiveFoodViews();
            await loadOverviewData();
        }
    }
});
