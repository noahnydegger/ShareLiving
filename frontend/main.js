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
let currentFoodWeekEntries = [];
let editingLaundryBookingId = null;
let editingGuestroomBookingId = null;
let currentLaundryBookings = [];
let currentGuestroomBookings = [];

function getElement(id) {
    return document.getElementById(id);
}

function getOptionalElement(selector) {
    return document.querySelector(selector);
}

function getOptionalElements(selector) {
    return Array.from(document.querySelectorAll(selector));
}

function getOptionalChild(element, selector) {
    if (!element) {
        return null;
    }
    return element.querySelector(selector);
}

function setElementDisplay(id, value) {
    const element = getElement(id);
    if (element) {
        element.style.display = value;
    }
}

function showSection(id) {
    document.querySelectorAll("section").forEach((section) => {
        section.style.display = "none";
    });
    const element = getElement(id);
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
    setElementDisplay("auth-panels", isLoggedIn ? "none" : "grid");
    setElementDisplay("house-dashboard", isLoggedIn ? "block" : "none");
}

function fillPersonSelect(selectId, includeEmpty = false, emptyLabel = "Person auswählen") {
    const select = getElement(selectId);
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
    const list = getElement("living-groups-list");
    if (!list) {
        return;
    }
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

    const select = getElement("person-living-group");
    if (!select) {
        return;
    }
    select.innerHTML = '<option value="">Keine Wohngruppe</option>';
    currentLivingGroups.forEach((group) => {
        const option = document.createElement("option");
        option.value = String(group.id);
        option.textContent = group.name;
        select.appendChild(option);
    });
}

function renderPeople() {
    const list = getElement("people-list");
    const currentPersonStatus = getElement("current-person-status");
    if (!list || !currentPersonStatus) {
        return;
    }
    list.innerHTML = "";

    if (!currentPeople.length) {
        list.innerHTML = "<li>Noch keine Personen.</li>";
        currentPersonStatus.innerText = "Füge zuerst eine Person hinzu, um Wäsche und Essen zu nutzen.";
        return;
    }

    currentPeople.forEach((person) => {
        const item = document.createElement("li");
        item.textContent = person.living_group_name
            ? `${person.name} - ${person.living_group_name}`
            : person.name;
        list.appendChild(item);
    });

    currentPersonStatus.innerText = getSelectedPersonId()
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
    const activeHouseLabel = getElement("active-house-label");
    if (activeHouseLabel) {
        activeHouseLabel.innerText = `Angemeldet als: ${houseName}`;
    }
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
    const houseNameInput = getElement("create-house-name");
    const passwordInput = getElement("create-house-password");
    const status = getElement("create-house-status");
    if (!houseNameInput || !passwordInput || !status) {
        return;
    }
    const houseName = houseNameInput.value.trim();
    const password = passwordInput.value;
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
    const houseNameInput = getElement("login-house-name");
    const passwordInput = getElement("login-house-password");
    const status = getElement("login-house-status");
    if (!houseNameInput || !passwordInput || !status) {
        return;
    }
    const houseName = houseNameInput.value.trim();
    const password = passwordInput.value;
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
    const select = getElement("current-person-select");
    if (!select) {
        return;
    }
    setSelectedPersonId(select.value);
    syncPersonSelectors();
    renderPeople();
    renderActiveFoodViews();
}

async function createLivingGroup() {
    const input = getElement("living-group-name");
    const status = getElement("living-group-status");
    if (!input || !status) {
        return;
    }
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
    const nameInput = getElement("person-name");
    const groupSelect = getElement("person-living-group");
    const status = getElement("person-status");
    if (!nameInput || !groupSelect || !status) {
        return;
    }
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
        food: getElement("overview-filter-food")?.checked ?? true,
        laundry: getElement("overview-filter-laundry")?.checked ?? true,
        guestroom: getElement("overview-filter-guestroom")?.checked ?? true,
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
    const calendar = getElement("overview-calendar");
    if (!calendar) {
        return;
    }
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
    const calendar = getElement("overview-calendar");
    if (!calendar) {
        return;
    }
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
    const rangeLabel = getElement("overview-range-label");
    const weekButton = getElement("overview-week-button");
    const monthButton = getElement("overview-month-button");
    if (!rangeLabel || !weekButton || !monthButton) {
        return;
    }

    rangeLabel.innerText = getOverviewRangeLabel();
    weekButton.classList.toggle("is-active", currentOverviewView === "week");
    monthButton.classList.toggle("is-active", currentOverviewView === "month");

    if (currentOverviewView === "week") {
        renderOverviewWeek();
    } else {
        renderOverviewMonth();
    }
}

async function loadOverviewData() {
    const status = getElement("overview-status");
    if (!status) {
        return;
    }
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
    setElementDisplay("laundry-add", "block");
    setElementDisplay("laundry-list", "none");
    syncPersonSelectors();
    updateLaundryFormUi();
}

function startNewLaundryBooking() {
    resetLaundryForm();
    showLaundryAdd();
}

function showLaundryList() {
    setElementDisplay("laundry-add", "none");
    setElementDisplay("laundry-list", "block");
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

function updateLaundryFormUi() {
    const saveButton = getElement("laundry-save-button");
    const cancelButton = getElement("laundry-cancel-button");
    if (saveButton) {
        saveButton.innerText = editingLaundryBookingId ? "Änderungen speichern" : "Buchung speichern";
    }
    if (cancelButton) {
        cancelButton.style.display = editingLaundryBookingId ? "inline-block" : "none";
    }
}

function resetLaundryForm() {
    editingLaundryBookingId = null;
    const personSelect = getElement("laundry-person-select");
    const dateInput = getElement("laundry-date");
    const startInput = getElement("laundry-start");
    const endInput = getElement("laundry-end");
    const status = getElement("laundry-add-status");
    syncPersonSelectors();
    if (dateInput) {
        dateInput.value = "";
    }
    if (startInput) {
        startInput.value = "";
    }
    if (endInput) {
        endInput.value = "";
    }
    if (status) {
        status.innerText = "";
    }
    if (personSelect && !personSelect.value && currentPeople.length) {
        personSelect.value = String(currentPeople[0].id);
    }
    updateLaundryFormUi();
}

function editLaundryBooking(booking) {
    editingLaundryBookingId = booking.id;
    showLaundryAdd();
    const personSelect = getElement("laundry-person-select");
    const dateInput = getElement("laundry-date");
    const startInput = getElement("laundry-start");
    const endInput = getElement("laundry-end");
    const status = getElement("laundry-add-status");
    if (personSelect) {
        personSelect.value = String(booking.person_id);
    }
    if (dateInput) {
        dateInput.value = booking.date;
    }
    if (startInput) {
        startInput.value = booking.start_time.slice(0, 5);
    }
    if (endInput) {
        endInput.value = booking.end_time.slice(0, 5);
    }
    if (status) {
        status.innerText = "Buchung bearbeiten.";
    }
    updateLaundryFormUi();
}

function editLaundryBookingById(bookingId) {
    const booking = currentLaundryBookings.find((entry) => entry.id === bookingId);
    if (booking) {
        editLaundryBooking(booking);
    }
}

async function saveLaundryBooking() {
    const personSelect = getElement("laundry-person-select");
    const dateInput = getElement("laundry-date");
    const startInput = getElement("laundry-start");
    const endInput = getElement("laundry-end");
    const status = getElement("laundry-add-status");
    if (!personSelect || !dateInput || !startInput || !endInput || !status) {
        return;
    }
    const personId = personSelect.value;
    const date = dateInput.value;
    const start = startInput.value;
    const end = endInput.value;
    status.innerText = "";

    if (!personId || !date || !start || !end) {
        status.innerText = "Bitte Person, Datum, Start- und Endzeit auswählen.";
        return;
    }

    const response = await apiFetch(
        editingLaundryBookingId ? `/api/laundry/${editingLaundryBookingId}` : "/api/laundry",
        {
            method: editingLaundryBookingId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                person_id: Number(personId),
                date,
                start_time: start,
                end_time: end,
            }),
        },
    );

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Buchung konnte nicht gespeichert werden: ${error}`;
        return;
    }

    status.innerText = editingLaundryBookingId ? "Buchung aktualisiert." : "Buchung gespeichert.";
    resetLaundryForm();
    showLaundryList();
}

async function deleteLaundryBooking(bookingId) {
    const status = getElement("laundry-list-status");
    if (!window.confirm("Wäschebuchung wirklich löschen?")) {
        return;
    }
    const response = await apiFetch(`/api/laundry/${bookingId}`, { method: "DELETE" });
    if (!response.ok) {
        const error = await response.text();
        if (status) {
            status.innerText = `Buchung konnte nicht gelöscht werden: ${error}`;
        }
        return;
    }
    if (editingLaundryBookingId === bookingId) {
        resetLaundryForm();
    }
    loadLaundry();
}

async function loadLaundry() {
    const status = getElement("laundry-list-status");
    const tableBody = getOptionalElement("#laundry-table tbody");
    if (!status || !tableBody) {
        return;
    }
    status.innerText = "";
    tableBody.innerHTML = "";

    const response = await apiFetch("/api/laundry");
    if (!response.ok) {
        status.innerText = "Wäschebuchungen konnten nicht geladen werden.";
        return;
    }

    const data = await response.json();
    currentLaundryBookings = data;
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
            <td>
                <button type="button" onclick="editLaundryBookingById(${booking.id})">Bearbeiten</button>
                <button type="button" onclick="deleteLaundryBooking(${booking.id})">Löschen</button>
            </td>
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

function updateBrunchAvailability() {
    const dateInput = getElement("food-date");
    const mealSelect = getElement("food-meal-type");

    // Ensure elements exist before accessing properties
    if (!dateInput || !mealSelect) {
        return;
    }

    const brunchOption = mealSelect.querySelector('option[value="brunch"]');

    if (!brunchOption) {
        return;
    }

    const dateValue = dateInput.value;
    const brunchAllowed = isSunday(dateValue);

    brunchOption.disabled = !brunchAllowed;

    if (!brunchAllowed && mealSelect.value === "brunch") {
        mealSelect.value = "lunch";
    }
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

function setFoodAddStatus(message) {
    const status = getElement("food-add-status");
    if (status) {
        status.innerText = message;
    }
}

function getFoodRowInputs(row) {
    return {
        eatsInput: getOptionalChild(row, ".food-eats"),
        cooksInput: getOptionalChild(row, ".food-cooks"),
        cookHelperInput: getOptionalChild(row, ".food-cook-helper"),
        cookingGroupSelect: getOptionalChild(row, ".food-cooking-group"),
    };
}

function findExistingCookConflict(personId, dateValue, mealType, cookingGroupId) {
    return currentFoodWeekEntries.find((entry) => (
        String(entry.person_id) !== String(personId)
        && entry.date === dateValue
        && entry.meal_type === mealType
        && entry.cooks
        && String(entry.cooking_group_id || "") === String(cookingGroupId || "")
    ));
}

function validateFoodPlannerRow(row, options = {}) {
    const { showMessage = true, changedField = "" } = options;
    const personSelect = getElement("food-person-select");
    const personId = personSelect?.value || getSelectedPersonId();
    const { cooksInput, cookHelperInput, cookingGroupSelect } = getFoodRowInputs(row);
    if (!personId || !cooksInput || !cookHelperInput || !cookingGroupSelect) {
        return true;
    }

    const dateValue = row.dataset.date;
    const mealType = row.dataset.mealType;
    const cookingGroupId = cookingGroupSelect.value || "";

    if (cooksInput.checked && cookHelperInput.checked) {
        if (changedField === "cooks") {
            cooksInput.checked = false;
        } else if (changedField === "helper") {
            cookHelperInput.checked = false;
        }
        if (showMessage) {
            setFoodAddStatus("Eine Person kann pro Mahlzeit nur Koch oder Helfer sein, nicht beides.");
        }
        return false;
    }

    if (cooksInput.checked) {
        const conflictingEntry = findExistingCookConflict(personId, dateValue, mealType, cookingGroupId);
        if (conflictingEntry) {
            if (changedField === "group") {
                cookingGroupSelect.value = row.dataset.prevCookingGroupValue || "";
            } else {
                cooksInput.checked = false;
            }
            if (showMessage) {
                const cookingGroupName = conflictingEntry.cooking_group_name || "Ganzes Haus";
                setFoodAddStatus(
                    `${conflictingEntry.person_name} kocht bereits für ${formatMealLabel(mealType)} in ${cookingGroupName}.`
                );
            }
            return false;
        }
    }

    row.dataset.prevCookingGroupValue = cookingGroupId;
    if (showMessage) {
        setFoodAddStatus("");
    }
    return true;
}

function attachFoodRowValidation(row) {
    const { cooksInput, cookHelperInput, cookingGroupSelect } = getFoodRowInputs(row);
    if (!cooksInput || !cookHelperInput || !cookingGroupSelect) {
        return;
    }

    row.dataset.prevCookingGroupValue = cookingGroupSelect.value || "";

    cooksInput.addEventListener("change", () => {
        validateFoodPlannerRow(row, { changedField: "cooks" });
    });
    cookHelperInput.addEventListener("change", () => {
        validateFoodPlannerRow(row, { changedField: "helper" });
    });
    cookingGroupSelect.addEventListener("change", () => {
        validateFoodPlannerRow(row, { changedField: "group" });
    });
}

function renderFoodWeekTable(entries) {
    const personSelect = getElement("food-person-select");
    const weekLabel = getElement("food-add-week-label");
    const status = getElement("food-add-status");
    const tbody = getOptionalElement("#food-add-table tbody");
    if (!personSelect || !weekLabel || !status || !tbody) {
        return;
    }
    const personId = personSelect.value || getSelectedPersonId();
    const weekRows = getMealRowsForWeek(currentFoodAddWeekStart);
    const entryMap = getFoodEntriesMap(entries, personId);

    weekLabel.innerText = formatWeekLabel(currentFoodAddWeekStart);
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
        attachFoodRowValidation(row);
    });
}

async function loadFoodWeekForAdd() {
    const weekDates = getWeekDates(currentFoodAddWeekStart);
    const response = await apiFetch(`/api/food?start_date=${weekDates[0]}&end_date=${weekDates[weekDates.length - 1]}`);
    if (!response.ok) {
        const status = getElement("food-add-status");
        if (status) {
            status.innerText = "Essenswoche konnte nicht geladen werden.";
        }
        return;
    }
    currentFoodWeekEntries = await response.json();
    renderFoodWeekTable(currentFoodWeekEntries);
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
    const personSelect = getElement("food-person-select");
    const status = getElement("food-add-status");
    const rows = getOptionalElements("#food-add-table tbody tr");
    if (!personSelect || !status) {
        return;
    }
    const personId = personSelect.value || getSelectedPersonId();
    status.innerText = "";

    if (!personId) {
        status.innerText = "Bitte eine Person auswählen.";
        return;
    }

    if (!rows.length) {
        status.innerText = "Keine Essenseinträge zum Speichern gefunden.";
        return;
    }

    for (const row of rows) {
        const eatsInput = getOptionalChild(row, ".food-eats");
        const cooksInput = getOptionalChild(row, ".food-cooks");
        const cookHelperInput = getOptionalChild(row, ".food-cook-helper");
        const guestsInput = getOptionalChild(row, ".food-guests");
        const leftoversInput = getOptionalChild(row, ".food-leftovers");
        const timeInput = getOptionalChild(row, ".food-time");
        const cookingGroupSelect = getOptionalChild(row, ".food-cooking-group");
        const notesInput = getOptionalChild(row, ".food-notes");

        if (
            !eatsInput
            || !cooksInput
            || !cookHelperInput
            || !guestsInput
            || !leftoversInput
            || !timeInput
            || !cookingGroupSelect
            || !notesInput
        ) {
            status.innerText = "Essensformular ist unvollständig.";
            return;
        }

        if (!validateFoodPlannerRow(row, { showMessage: true })) {
            return;
        }

        const payload = {
            person_id: Number(personId),
            date: row.dataset.date,
            meal_type: row.dataset.mealType,
            eats: eatsInput.checked,
            cooks: cooksInput.checked,
            cook_helper: cookHelperInput.checked,
            guests: Number(guestsInput.value || "0"),
            take_leftovers_next_day: leftoversInput.checked,
            eating_time: timeInput.value || getDefaultMealTime(row.dataset.mealType),
            cooking_group_id: cookingGroupSelect.value
                ? Number(cookingGroupSelect.value)
                : null,
            notes: notesInput.value.trim(),
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
    currentFoodSummaryWeekStart = new Date(currentFoodAddWeekStart);
    showFoodSummary();
}

function showFoodAdd() {
    setElementDisplay("food-add", "block");
    setElementDisplay("food-summary", "none");
    syncPersonSelectors();
    if (getHouseToken()) {
        loadFoodWeekForAdd();
    }
}

function formatTimeValue(value) {
    return value ? String(value).slice(0, 5) : "";
}

function buildSummaryRows(entries) {
    const tbody = getOptionalElement("#food-summary-table tbody");
    const status = getElement("food-summary-status");
    const weekLabel = getElement("food-summary-week-label");
    if (!tbody || !status || !weekLabel) {
        return;
    }
    tbody.innerHTML = "";
    weekLabel.innerText = formatWeekLabel(currentFoodSummaryWeekStart);
    status.innerText = "";

    if (!entries.length) {
        status.innerText = "Keine Essenseinträge in dieser Woche.";
        return;
    }

    const mealOrder = {
        brunch: 0,
        lunch: 1,
        dinner: 2,
    };
    const entriesByMeal = new Map();

    entries.forEach((entry) => {
        const key = `${entry.date}|${entry.meal_type}|${entry.cooking_group_id || "house"}`;
        if (!entriesByMeal.has(key)) {
            entriesByMeal.set(key, []);
        }
        entriesByMeal.get(key).push(entry);
    });

    const summaryRows = Array.from(entriesByMeal.values())
        .map((mealEntries) => {
            const firstEntry = mealEntries[0];
            const cooks = mealEntries
                .filter((entry) => entry.cooks)
                .map((entry) => entry.person_name);
            const helpers = mealEntries
                .filter((entry) => entry.cook_helper)
                .map((entry) => entry.person_name);
            const totalPeople = mealEntries.reduce((sum, entry) => (
                entry.eats ? sum + 1 + Number(entry.guests || 0) : sum
            ), 0);

            return {
                date: firstEntry.date,
                mealType: firstEntry.meal_type,
                cookingGroupName: firstEntry.cooking_group_name || "Ganzes Haus",
                cooks,
                helpers,
                totalPeople,
                eatingTime: firstEntry.eating_time || getDefaultMealTime(firstEntry.meal_type),
            };
        })
        .sort((left, right) => {
            if (left.date !== right.date) {
                return left.date.localeCompare(right.date);
            }
            if (left.mealType !== right.mealType) {
                return (mealOrder[left.mealType] ?? 99) - (mealOrder[right.mealType] ?? 99);
            }
            return left.cookingGroupName.localeCompare(right.cookingGroupName, "de-CH");
        });

    summaryRows.forEach((entry) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${entry.date}</td>
            <td>${formatTimeValue(entry.eatingTime)}</td>
            <td>${entry.cookingGroupName}</td>
            <td>${entry.cooks.length ? entry.cooks.join(", ") : "—"}</td>
            <td>${entry.helpers.length ? entry.helpers.join(", ") : "—"}</td>
            <td>${entry.totalPeople}</td>
        `;
        tbody.appendChild(row);
    });
}

async function loadFoodSummary() {
    const weekDates = getWeekDates(currentFoodSummaryWeekStart);
    const response = await apiFetch(`/api/food?start_date=${weekDates[0]}&end_date=${weekDates[weekDates.length - 1]}`);
    if (!response.ok) {
        const status = getElement("food-summary-status");
        if (status) {
            status.innerText = "Essensübersicht konnte nicht geladen werden.";
        }
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
    setElementDisplay("food-add", "none");
    setElementDisplay("food-summary", "block");
    loadFoodSummary();
}

async function renderActiveFoodViews() {
    const foodAdd = getElement("food-add");
    const foodSummary = getElement("food-summary");
    if (foodAdd && foodAdd.style.display !== "none") {
        await loadFoodWeekForAdd();
    }
    if (foodSummary && foodSummary.style.display !== "none") {
        await loadFoodSummary();
    }
}

function showGuestroomAdd() {
    setElementDisplay("guestroom-add", "block");
    setElementDisplay("guestroom-list", "none");
    syncPersonSelectors();
    updateGuestroomFormUi();
}

function startNewGuestroomBooking() {
    resetGuestroomForm();
    showGuestroomAdd();
}

function showGuestroomList() {
    setElementDisplay("guestroom-add", "none");
    setElementDisplay("guestroom-list", "block");
    loadGuestroomBookings();
}

function updateGuestroomFormUi() {
    const saveButton = getElement("guestroom-save-button");
    const cancelButton = getElement("guestroom-cancel-button");
    if (saveButton) {
        saveButton.innerText = editingGuestroomBookingId ? "Änderungen speichern" : "Buchung speichern";
    }
    if (cancelButton) {
        cancelButton.style.display = editingGuestroomBookingId ? "inline-block" : "none";
    }
}

function resetGuestroomForm() {
    editingGuestroomBookingId = null;
    const guestInput = getElement("guestroom-guest");
    const startInput = getElement("guestroom-start");
    const endInput = getElement("guestroom-end");
    const status = getElement("guestroom-add-status");
    syncPersonSelectors();
    if (guestInput) {
        guestInput.value = "";
    }
    if (startInput) {
        startInput.value = "";
    }
    if (endInput) {
        endInput.value = "";
    }
    if (status) {
        status.innerText = "";
    }
    updateGuestroomFormUi();
}

function editGuestroomBooking(booking) {
    editingGuestroomBookingId = booking.id;
    showGuestroomAdd();
    const personSelect = getElement("guestroom-person-select");
    const guestInput = getElement("guestroom-guest");
    const startInput = getElement("guestroom-start");
    const endInput = getElement("guestroom-end");
    const status = getElement("guestroom-add-status");
    if (personSelect) {
        personSelect.value = String(booking.person_id);
    }
    if (guestInput) {
        guestInput.value = booking.guest_name;
    }
    if (startInput) {
        startInput.value = booking.start_at.slice(0, 16);
    }
    if (endInput) {
        endInput.value = booking.end_at.slice(0, 16);
    }
    if (status) {
        status.innerText = "Buchung bearbeiten.";
    }
    updateGuestroomFormUi();
}

function editGuestroomBookingById(bookingId) {
    const booking = currentGuestroomBookings.find((entry) => entry.id === bookingId);
    if (booking) {
        editGuestroomBooking(booking);
    }
}

async function saveGuestroomBooking() {
    const personSelect = getElement("guestroom-person-select");
    const guestInput = getElement("guestroom-guest");
    const startInput = getElement("guestroom-start");
    const endInput = getElement("guestroom-end");
    const status = getElement("guestroom-add-status");
    if (!personSelect || !guestInput || !startInput || !endInput || !status) {
        return;
    }
    const personId = personSelect.value;
    const guestName = guestInput.value.trim();
    const startAt = startInput.value;
    const endAt = endInput.value;
    status.innerText = "";

    if (!personId || !guestName || !startAt || !endAt) {
        status.innerText = "Bitte alle Felder ausfüllen.";
        return;
    }

    const response = await apiFetch(
        editingGuestroomBookingId ? `/api/guestroom/${editingGuestroomBookingId}` : "/api/guestroom",
        {
            method: editingGuestroomBookingId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                person_id: Number(personId),
                guest_name: guestName,
                start_at: startAt,
                end_at: endAt,
            }),
        },
    );

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Buchung konnte nicht gespeichert werden: ${error}`;
        return;
    }

    status.innerText = editingGuestroomBookingId ? "Buchung aktualisiert." : "Buchung gespeichert.";
    resetGuestroomForm();
    showGuestroomList();
}

async function deleteGuestroomBooking(bookingId) {
    const status = getElement("guestroom-list-status");
    if (!window.confirm("Gästebuchung wirklich löschen?")) {
        return;
    }
    const response = await apiFetch(`/api/guestroom/${bookingId}`, { method: "DELETE" });
    if (!response.ok) {
        const error = await response.text();
        if (status) {
            status.innerText = `Buchung konnte nicht gelöscht werden: ${error}`;
        }
        return;
    }
    if (editingGuestroomBookingId === bookingId) {
        resetGuestroomForm();
    }
    loadGuestroomBookings();
}

async function loadGuestroomBookings() {
    const status = getElement("guestroom-list-status");
    const tableBody = getOptionalElement("#guestroom-table tbody");
    if (!status || !tableBody) {
        return;
    }
    status.innerText = "";
    tableBody.innerHTML = "";

    const response = await apiFetch("/api/guestroom");
    if (!response.ok) {
        status.innerText = "Gästebuchungen konnten nicht geladen werden.";
        return;
    }

    const data = await response.json();
    currentGuestroomBookings = data;
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
            <td>
                <button type="button" onclick="editGuestroomBookingById(${booking.id})">Bearbeiten</button>
                <button type="button" onclick="deleteGuestroomBooking(${booking.id})">Löschen</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function initLaundryPage() {
    const laundrySection = getElement("laundry");
    const laundryAdd = getElement("laundry-add");
    const laundryList = getElement("laundry-list");
    if (!laundrySection || !laundryAdd || !laundryList) {
        return;
    }
    showLaundryAdd();
}

function initFoodPage() {
    const foodSection = getElement("food");
    const foodPersonSelect = getElement("food-person-select");
    const foodAdd = getElement("food-add");
    const foodSummary = getElement("food-summary");
    if (!foodSection || !foodPersonSelect || !foodAdd || !foodSummary) {
        return;
    }

    foodPersonSelect.addEventListener("change", () => {
        loadFoodWeekForAdd();
    });

    updateBrunchAvailability();

    const foodDateInput = getElement("food-date");
    if (foodDateInput) {
        foodDateInput.addEventListener("change", updateBrunchAvailability);
    }

    showFoodAdd();
}

function initOverviewPage() {
    const overviewCalendar = getElement("overview-calendar");
    const overviewRangeLabel = getElement("overview-range-label");
    const overviewWeekButton = getElement("overview-week-button");
    const overviewMonthButton = getElement("overview-month-button");
    if (!overviewCalendar || !overviewRangeLabel || !overviewWeekButton || !overviewMonthButton) {
        return;
    }
    renderOverviewCalendar();
}

function initHomePage() {
    const homeSection = getElement("home");
    if (!homeSection) {
        return;
    }
    showSection("home");
    setAuthVisibility(false);
    renderLivingGroups();
    renderPeople();
    syncPersonSelectors();
}

function initGuestroomPage() {
    const guestroomSection = getElement("guestroom");
    const guestroomAdd = getElement("guestroom-add");
    const guestroomList = getElement("guestroom-list");
    if (!guestroomSection || !guestroomAdd || !guestroomList) {
        return;
    }
    showGuestroomAdd();
}

document.addEventListener("DOMContentLoaded", async () => {
    initHomePage();
    initLaundryPage();
    initFoodPage();
    initOverviewPage();
    initGuestroomPage();

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
