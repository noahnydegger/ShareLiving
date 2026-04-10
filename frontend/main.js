const API_URL = "/homes/default";
const HOUSE_TOKEN_KEY = "shareLiving.houseToken";
const HOUSE_NAME_KEY = "shareLiving.houseName";
const HOUSE_ID_KEY = "shareLiving.houseId";
const ACTIVE_SECTION_KEY = "shareLiving.activeSection";

let currentPeople = [];
let currentGuestRooms = [];
let currentChores = [];
let currentDefects = [];
let currentFeedback = [];
let currentDefectPhotoLink = "";
let currentFoodAddWeekStart = getFoodWeekStart(new Date());
let currentFoodSummaryWeekStart = getFoodWeekStart(new Date());
let currentOverviewView = "week";
let currentOverviewDate = getMonday(new Date());
let currentOverviewEvents = [];
let currentFoodWeekEntries = [];
let editingLaundryBookingId = null;
let editingGuestroomBookingId = null;
let currentLaundryBookings = [];
let currentGuestroomBookings = [];
let currentLaundryListEntries = [];
let currentGuestroomListEntries = [];
let currentLaundryOffset = 0;
let currentGuestroomOffset = 0;
let editingPersonId = null;
let editingGuestRoomId = null;
let editingChoreId = null;
let currentDefectFilter = "all";
let currentFeedbackFilter = "all";
let expandedChoreIds = new Set();
let expandedDefectIds = new Set();
let expandedFeedbackIds = new Set();
let livingGroupEditMode = false;
let personEditMode = false;
let guestRoomEditMode = false;

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

function closeNavDropdown() {
    getOptionalElements(".nav-dropdown").forEach((dropdown) => {
        dropdown.classList.remove("is-open");
    });
}

function toggleNavDropdown(event) {
    event?.preventDefault();
    event?.stopPropagation();
    const dropdown = event?.currentTarget?.closest(".nav-dropdown");
    if (!dropdown) {
        return;
    }
    const shouldOpen = !dropdown.classList.contains("is-open");
    closeNavDropdown();
    if (shouldOpen) {
        dropdown.classList.add("is-open");
    }
}

function showSection(id) {
    closeNavDropdown();
    document.querySelectorAll("section").forEach((section) => {
        section.style.display = "none";
    });
    const element = getElement(id);
    if (element) {
        element.style.display = "block";
        setActiveSection(id);
    }

    if (id === "overview" && getHouseToken()) {
        resetOverviewFilters();
        loadOverviewData();
    }
    if (id === "food" && getHouseToken()) {
        showFoodSummary();
    }
    if (id === "chores" && getHouseToken()) {
        showChoresOverview();
    }
    if (id === "feedback" && getHouseToken()) {
        showFeedbackAdd();
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

function getActiveSectionStorageKey() {
    const houseId = getActiveHouseId();
    return houseId ? `${ACTIVE_SECTION_KEY}.${houseId}` : ACTIVE_SECTION_KEY;
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

function getActiveSection() {
    return localStorage.getItem(getActiveSectionStorageKey()) || "home";
}

function setActiveSection(sectionId) {
    localStorage.setItem(getActiveSectionStorageKey(), sectionId);
}

function clearActiveSection() {
    localStorage.removeItem(getActiveSectionStorageKey());
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

function fillPersonSelect(selectId, includeEmpty = false, emptyLabel = "Person auswählen", preferredValue = null) {
    const select = getElement(selectId);
    if (!select) {
        return;
    }

    const selectedValue = preferredValue ?? (select.value || getSelectedPersonId());
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
        option.textContent = person.name;
        select.appendChild(option);
    });

    if (selectedValue && currentPeople.some((person) => String(person.id) === String(selectedValue))) {
        select.value = String(selectedValue);
    } else if (!includeEmpty && currentPeople.length) {
        select.value = String(currentPeople[0].id);
    }
}

function syncPersonSelectors() {
    const selectedPersonId = getSelectedPersonId();
    fillPersonSelect("current-person-select", true, "Person auswählen", selectedPersonId);
    fillPersonSelect("laundry-person-select", false, "Person auswählen", selectedPersonId);
    fillPersonSelect("food-person-select", false, "Person auswählen", selectedPersonId);
    fillPersonSelect("guestroom-person-select", false, "Person auswählen", selectedPersonId);
    fillPersonSelect("defect-person-select", false, "Person auswählen", selectedPersonId);
    fillPersonSelect("feedback-person-select", false, "Person auswählen", selectedPersonId);
    renderGuestroomRoomOptions();
}

function renderGuestRooms() {
    const list = getElement("guest-rooms-list");
    if (!list) {
        return;
    }
    list.innerHTML = "";

    if (!currentGuestRooms.length) {
        list.innerHTML = "<li>Noch keine Gästezimmer.</li>";
        return;
    }

    currentGuestRooms.forEach((room) => {
        const item = document.createElement("li");
        item.innerHTML = guestRoomEditMode
            ? `
                <span>${room.name}</span>
                <button type="button" onclick="editGuestRoomById(${room.id})">Bearbeiten</button>
                <button type="button" onclick="deleteGuestRoom(${room.id})">Löschen</button>
            `
            : `<span>${room.name}</span>`;
        list.appendChild(item);
    });
}

function renderGuestroomRoomOptions() {
    const select = getElement("guestroom-room-select");
    const personSelect = getElement("guestroom-person-select");
    if (!select) {
        return;
    }

    const selectedValue = select.value;
    const selectedPerson = currentPeople.find((person) => String(person.id) === String(personSelect?.value || ""));
    const ownRoomLabel = selectedPerson
        ? `Eigenes Zimmer (${selectedPerson.name})`
        : "Eigenes Zimmer";

    select.innerHTML = `<option value="">${ownRoomLabel}</option>`;
    currentGuestRooms.forEach((room) => {
        const option = document.createElement("option");
        option.value = String(room.id);
        option.textContent = room.name;
        select.appendChild(option);
    });

    if (selectedValue && currentGuestRooms.some((room) => String(room.id) === String(selectedValue))) {
        select.value = selectedValue;
    }
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
        item.innerHTML = personEditMode
            ? `
                <span>${person.name}</span>
                <button type="button" onclick="editPersonById(${person.id})">Bearbeiten</button>
                <button type="button" onclick="deletePerson(${person.id})">Löschen</button>
            `
            : `<span>${person.name}</span>`;
        list.appendChild(item);
    });

    currentPersonStatus.innerText = getSelectedPersonId()
        ? ""
        : "Wähle eine aktuelle Person für schnellere Einträge.";
}

async function loadHouseData() {
    const [peopleResponse, guestRoomsResponse] = await Promise.all([
        apiFetch("/api/people"),
        apiFetch("/api/guest-rooms"),
    ]);

    if (!peopleResponse.ok || !guestRoomsResponse.ok) {
        return false;
    }

    currentPeople = await peopleResponse.json();
    currentGuestRooms = await guestRoomsResponse.json();

    renderPeople();
    renderGuestRooms();
    renderChoreAssignments();
    renderChoresOverview();
    renderDefectsList();
    renderFeedbackList();
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
    showSection(getActiveSection());
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
    clearActiveSection();
    setSelectedPersonId("");
    clearAuthState();
    currentPeople = [];
    currentGuestRooms = [];
    currentChores = [];
    currentDefects = [];
    currentFeedback = [];
    currentDefectPhotoLink = "";
    currentDefectFilter = "all";
    currentFeedbackFilter = "all";
    expandedChoreIds = new Set();
    expandedDefectIds = new Set();
    expandedFeedbackIds = new Set();
    editingPersonId = null;
    editingGuestRoomId = null;
    editingChoreId = null;
    personEditMode = false;
    guestRoomEditMode = false;
    setAuthVisibility(false);
    renderPeople();
    renderGuestRooms();
    renderChoresList();
    renderChoreAssignments();
    renderChoresOverview();
    renderDefectsList();
    renderFeedbackList();
    updatePersonFormUi();
    updateGuestRoomFormUi();
    updateChoreFormUi();
    syncPersonSelectors();
    showSection("home");
}

function handleCurrentPersonChange() {
    const select = getElement("current-person-select");
    if (!select) {
        return;
    }
    setSelectedPersonId(select.value);
    window.location.reload();
}

async function createPerson() {
    const nameInput = getElement("person-name");
    const status = getElement("person-status");
    if (!nameInput || !status) {
        return;
    }
    status.innerText = "";

    const payload = {
        name: nameInput.value.trim(),
        living_group_id: null,
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
    status.innerText = "Person hinzugefügt.";
    await loadHouseData();
    await renderActiveFoodViews();
}

function updatePersonFormUi() {
    const saveButton = getElement("person-save-button");
    const cancelButton = getElement("person-cancel-button");
    const editToggle = getElement("person-edit-toggle");
    if (saveButton) {
        saveButton.innerText = editingPersonId ? "Änderungen speichern" : "Person hinzufügen";
    }
    if (cancelButton) {
        cancelButton.style.display = editingPersonId ? "inline-block" : "none";
    }
    if (editToggle) {
        editToggle.innerText = personEditMode ? "Fertig" : "Personen bearbeiten";
    }
}

function togglePersonEditMode() {
    personEditMode = !personEditMode;
    if (!personEditMode) {
        resetPersonForm();
    }
    renderPeople();
    updatePersonFormUi();
}

function resetPersonForm() {
    editingPersonId = null;
    const nameInput = getElement("person-name");
    const status = getElement("person-status");
    if (nameInput) {
        nameInput.value = "";
    }
    if (status) {
        status.innerText = "";
    }
    updatePersonFormUi();
}

function editPersonById(personId) {
    const person = currentPeople.find((entry) => entry.id === personId);
    const nameInput = getElement("person-name");
    const status = getElement("person-status");
    if (!person || !nameInput || !status) {
        return;
    }
    editingPersonId = personId;
    nameInput.value = person.name;
    status.innerText = "Person bearbeiten.";
    updatePersonFormUi();
}

async function savePerson() {
    if (editingPersonId) {
        const nameInput = getElement("person-name");
        const status = getElement("person-status");
        if (!nameInput || !status) {
            return;
        }
        status.innerText = "";
        const response = await apiFetch(`/api/people/${editingPersonId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: nameInput.value.trim(),
                living_group_id: null,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            status.innerText = `Person konnte nicht gespeichert werden: ${error}`;
            return;
        }
        status.innerText = "Person aktualisiert.";
        resetPersonForm();
        await loadHouseData();
        await renderActiveFoodViews();
        return;
    }
    await createPerson();
}

async function deletePerson(personId) {
    const status = getElement("person-status");
    if (!window.confirm("Person wirklich löschen?")) {
        return;
    }
    const response = await apiFetch(`/api/people/${personId}`, { method: "DELETE" });
    if (!response.ok) {
        const error = await response.text();
        if (status) {
            status.innerText = `Person konnte nicht gelöscht werden: ${error}`;
        }
        return;
    }
    if (editingPersonId === personId) {
        resetPersonForm();
    }
    await loadHouseData();
    await renderActiveFoodViews();
}

async function createGuestRoom() {
    const input = getElement("guest-room-name");
    const status = getElement("guest-room-status");
    if (!input || !status) {
        return;
    }
    status.innerText = "";

    const response = await apiFetch("/api/guest-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: input.value.trim() }),
    });

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Gästezimmer konnte nicht hinzugefügt werden: ${error}`;
        return;
    }

    input.value = "";
    status.innerText = "Gästezimmer hinzugefügt.";
    await loadHouseData();
}

function updateGuestRoomFormUi() {
    const saveButton = getElement("guest-room-save-button");
    const cancelButton = getElement("guest-room-cancel-button");
    const editToggle = getElement("guest-room-edit-toggle");
    if (saveButton) {
        saveButton.innerText = editingGuestRoomId ? "Änderungen speichern" : "Gästezimmer hinzufügen";
    }
    if (cancelButton) {
        cancelButton.style.display = editingGuestRoomId ? "inline-block" : "none";
    }
    if (editToggle) {
        editToggle.innerText = guestRoomEditMode ? "Fertig" : "Gästezimmer bearbeiten";
    }
}

function toggleGuestRoomEditMode() {
    guestRoomEditMode = !guestRoomEditMode;
    if (!guestRoomEditMode) {
        resetGuestRoomForm();
    }
    renderGuestRooms();
    updateGuestRoomFormUi();
}

function resetGuestRoomForm() {
    editingGuestRoomId = null;
    const input = getElement("guest-room-name");
    const status = getElement("guest-room-status");
    if (input) {
        input.value = "";
    }
    if (status) {
        status.innerText = "";
    }
    updateGuestRoomFormUi();
}

function editGuestRoomById(guestRoomId) {
    const room = currentGuestRooms.find((entry) => entry.id === guestRoomId);
    const input = getElement("guest-room-name");
    const status = getElement("guest-room-status");
    if (!room || !input || !status) {
        return;
    }
    editingGuestRoomId = guestRoomId;
    input.value = room.name;
    status.innerText = "Gästezimmer bearbeiten.";
    updateGuestRoomFormUi();
}

async function saveGuestRoom() {
    if (editingGuestRoomId) {
        const input = getElement("guest-room-name");
        const status = getElement("guest-room-status");
        if (!input || !status) {
            return;
        }
        status.innerText = "";
        const response = await apiFetch(`/api/guest-rooms/${editingGuestRoomId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: input.value.trim() }),
        });
        if (!response.ok) {
            const error = await response.text();
            status.innerText = `Gästezimmer konnte nicht gespeichert werden: ${error}`;
            return;
        }
        status.innerText = "Gästezimmer aktualisiert.";
        resetGuestRoomForm();
        await loadHouseData();
        return;
    }
    await createGuestRoom();
}

async function deleteGuestRoom(guestRoomId) {
    const status = getElement("guest-room-status");
    if (!window.confirm("Gästezimmer wirklich löschen?")) {
        return;
    }
    const response = await apiFetch(`/api/guest-rooms/${guestRoomId}`, { method: "DELETE" });
    if (!response.ok) {
        const error = await response.text();
        if (status) {
            status.innerText = `Gästezimmer konnte nicht gelöscht werden: ${error}`;
        }
        return;
    }
    if (editingGuestRoomId === guestRoomId) {
        resetGuestRoomForm();
    }
    await loadHouseData();
}

function showChoresManage() {
    setElementDisplay("chores-manage", "block");
    setElementDisplay("chores-overview", "none");
    if (getHouseToken()) {
        loadChores();
    }
    updateChoreFormUi();
}

function showChoresOverview() {
    const mineToggle = getElement("chores-mine-toggle");
    if (mineToggle) {
        mineToggle.checked = true;
    }
    setElementDisplay("chores-manage", "none");
    setElementDisplay("chores-overview", "block");
    if (getHouseToken()) {
        loadChores();
    }
}

function formatChoreLabel(chore) {
    const details = [chore.location, chore.frequency].filter(Boolean);
    return details.length ? `${chore.name} (${details.join(", ")})` : chore.name;
}

function formatChoreEffort(effort) {
    if (effort === null || effort === undefined || effort === "") {
        return "";
    }
    return `${Number(effort)} h/Woche`;
}

function buildPersonOptions(selectedValue = "") {
    const selected = String(selectedValue || "");
    let options = '<option value="">Nicht zugeteilt</option>';
    currentPeople.forEach((person) => {
        const isSelected = String(person.id) === selected ? " selected" : "";
        options += `<option value="${person.id}"${isSelected}>${person.name}</option>`;
    });
    return options;
}

function renderChoresList() {
    const list = getElement("chores-list");
    const status = getElement("chore-manage-status");
    if (!list) {
        return;
    }
    list.innerHTML = "";

    if (!currentChores.length) {
        list.innerHTML = "<li>Noch keine Ämtli.</li>";
        if (status) {
            status.innerText = status.innerText || "";
        }
        return;
    }

    currentChores.forEach((chore) => {
        const item = document.createElement("li");
        item.innerHTML = `
            <span>${formatChoreLabel(chore)}</span>
            <span class="inline-actions">
                <button type="button" onclick="editChoreById(${chore.id})">Bearbeiten</button>
                <button type="button" onclick="deleteChore(${chore.id})">Löschen</button>
            </span>
        `;
        list.appendChild(item);
    });
}

function renderChoreAssignments() {
    const tableBody = getOptionalElement("#chores-assign-table tbody");
    const status = getElement("chore-assign-status");
    if (!tableBody || !status) {
        return;
    }
    tableBody.innerHTML = "";

    if (!currentChores.length) {
        status.innerText = "Erstelle zuerst mindestens ein Ämtli.";
        return;
    }
    if (!currentPeople.length) {
        status.innerText = "Erstelle zuerst mindestens eine Person.";
        return;
    }

    status.innerText = "";
    currentChores.forEach((chore) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${chore.name}</td>
            <td>${chore.location || ""}</td>
            <td>
                <select onchange="assignChoreToPerson(${chore.id}, this.value)">
                    ${buildPersonOptions(chore.assigned_person_id)}
                </select>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function renderChoresOverview() {
    const tableBody = getOptionalElement("#chores-overview-table tbody");
    const status = getElement("chores-overview-status");
    const mineToggle = getElement("chores-mine-toggle");
    if (!tableBody || !status || !mineToggle) {
        return;
    }
    tableBody.innerHTML = "";

    const selectedPersonId = getSelectedPersonId();
    const visibleChores = mineToggle.checked && selectedPersonId
        ? currentChores.filter((chore) => String(chore.assigned_person_id || "") === String(selectedPersonId))
        : currentChores;

    if (!visibleChores.length) {
        status.innerText = mineToggle.checked ? "Keine Ämtli für die aktuelle Person." : "Noch keine Ämtli vorhanden.";
        return;
    }

    status.innerText = "";
    visibleChores.forEach((chore) => {
        const row = document.createElement("tr");
        row.className = "expandable-row";
        if (expandedChoreIds.has(chore.id)) {
            row.classList.add("is-expanded");
        }
        row.innerHTML = `
            <td>
                <span class="description-preview">${escapeHtml(chore.name)}</span>
                <span class="description-full">${escapeHtml(chore.description || "Kein Beschrieb vorhanden.")}</span>
            </td>
            <td>${chore.location || ""}</td>
            <td>${chore.frequency || ""}</td>
            <td>${chore.assigned_person_name || "Nicht zugeteilt"}</td>
        `;
        row.addEventListener("click", () => {
            if (expandedChoreIds.has(chore.id)) {
                expandedChoreIds.delete(chore.id);
                row.classList.remove("is-expanded");
            } else {
                expandedChoreIds.add(chore.id);
                row.classList.add("is-expanded");
            }
        });
        tableBody.appendChild(row);
    });
}

function updateChoreFormUi() {
    const saveButton = getElement("chore-save-button");
    const cancelButton = getElement("chore-cancel-button");
    if (saveButton) {
        saveButton.innerText = editingChoreId ? "Änderungen speichern" : "Ämtli hinzufügen";
    }
    if (cancelButton) {
        cancelButton.style.display = editingChoreId ? "inline-block" : "none";
    }
}

function resetChoreForm() {
    editingChoreId = null;
    const nameInput = getElement("chore-name");
    const locationInput = getElement("chore-location");
    const frequencyInput = getElement("chore-frequency");
    const descriptionInput = getElement("chore-description");
    const status = getElement("chore-manage-status");
    if (nameInput) {
        nameInput.value = "";
    }
    if (locationInput) {
        locationInput.value = "";
    }
    if (frequencyInput) {
        frequencyInput.value = "";
    }
    if (descriptionInput) {
        descriptionInput.value = "";
    }
    if (status) {
        status.innerText = "";
    }
    updateChoreFormUi();
}

function editChoreById(choreId) {
    const chore = currentChores.find((entry) => entry.id === choreId);
    const nameInput = getElement("chore-name");
    const locationInput = getElement("chore-location");
    const frequencyInput = getElement("chore-frequency");
    const descriptionInput = getElement("chore-description");
    const status = getElement("chore-manage-status");
    if (!chore || !nameInput || !locationInput || !frequencyInput || !descriptionInput || !status) {
        return;
    }
    editingChoreId = choreId;
    nameInput.value = chore.name;
    locationInput.value = chore.location || "";
    frequencyInput.value = chore.frequency || "";
    descriptionInput.value = chore.description || "";
    status.innerText = "Ämtli bearbeiten.";
    updateChoreFormUi();
}

async function loadChores() {
    const response = await apiFetch("/api/chores");
    const manageStatus = getElement("chore-manage-status");
    const assignStatus = getElement("chore-assign-status");
    const overviewStatus = getElement("chores-overview-status");
    if (!response.ok) {
        if (manageStatus) {
            manageStatus.innerText = "Ämtli konnten nicht geladen werden.";
        }
        if (assignStatus) {
            assignStatus.innerText = "Ämtli konnten nicht geladen werden.";
        }
        if (overviewStatus) {
            overviewStatus.innerText = "Ämtli konnten nicht geladen werden.";
        }
        return;
    }

    currentChores = await response.json();
    renderChoresList();
    renderChoreAssignments();
    renderChoresOverview();
}

async function saveChore() {
    const nameInput = getElement("chore-name");
    const locationInput = getElement("chore-location");
    const frequencyInput = getElement("chore-frequency");
    const descriptionInput = getElement("chore-description");
    const status = getElement("chore-manage-status");
    if (!nameInput || !locationInput || !frequencyInput || !descriptionInput || !status) {
        return;
    }
    const payload = {
        name: nameInput.value.trim(),
        location: locationInput.value.trim() || null,
        frequency: frequencyInput.value.trim() || null,
        effort: null,
        description: descriptionInput.value.trim() || null,
    };

    if (!payload.name) {
        status.innerText = "Bitte einen Namen für das Ämtli eingeben.";
        return;
    }

    const response = await apiFetch(
        editingChoreId ? `/api/chores/${editingChoreId}` : "/api/chores",
        {
            method: editingChoreId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        },
    );

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Ämtli konnte nicht gespeichert werden: ${error}`;
        return;
    }

    status.innerText = editingChoreId ? "Ämtli aktualisiert." : "Ämtli hinzugefügt.";
    resetChoreForm();
    await loadChores();
}

async function deleteChore(choreId) {
    const status = getElement("chore-manage-status");
    if (!window.confirm("Ämtli wirklich löschen?")) {
        return;
    }

    const response = await apiFetch(`/api/chores/${choreId}`, { method: "DELETE" });
    if (!response.ok) {
        const error = await response.text();
        if (status) {
            status.innerText = `Ämtli konnte nicht gelöscht werden: ${error}`;
        }
        return;
    }

    if (editingChoreId === choreId) {
        resetChoreForm();
    }
    await loadChores();
}

async function assignChoreToPerson(choreId, personIdValue) {
    const status = getElement("chore-assign-status");
    const response = await apiFetch(`/api/chores/${choreId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            person_id: personIdValue ? Number(personIdValue) : null,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        if (status) {
            status.innerText = `Ämtli konnte nicht zugeteilt werden: ${error}`;
        }
        return;
    }

    if (status) {
        status.innerText = "Ämtli aktualisiert.";
    }
    await loadChores();
}

function formatDefectCode(defectId) {
    return `M-${String(defectId).padStart(4, "0")}`;
}

function formatDescriptionPreview(description) {
    const words = String(description || "").trim().split(/\s+/).filter(Boolean);
    if (words.length <= 2) {
        return words.join(" ");
    }
    return `${words.slice(0, 2).join(" ")} ...`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function updateSegmentedControlState(buttonIds, activeId) {
    buttonIds.forEach((buttonId) => {
        const button = getElement(buttonId);
        if (button) {
            button.classList.toggle("is-active", buttonId === activeId);
        }
    });
}

function getNextDefectIdPreview() {
    if (!currentDefects.length) {
        return 1;
    }
    return Math.max(...currentDefects.map((defect) => Number(defect.id) || 0)) + 1;
}

function updateDefectCodePreview() {
    const codeInput = getElement("defect-code-preview");
    if (!codeInput) {
        return;
    }
    codeInput.value = formatDefectCode(getNextDefectIdPreview());
}

function renderDefectPhotoLink() {
    const input = getElement("defect-shared-photo-link");
    const display = getElement("defect-shared-photo-display");
    const status = getElement("defect-shared-photo-status");
    if (input) {
        input.value = currentDefectPhotoLink || "";
    }
    if (display) {
        display.innerHTML = currentDefectPhotoLink
            ? `<a href="${escapeHtml(currentDefectPhotoLink)}" target="_blank" rel="noopener noreferrer">Fotolink öffnen</a>`
            : "";
    }
    if (status && !status.innerText) {
        status.innerText = currentDefectPhotoLink ? "Link für alle Mängel gespeichert." : "";
    }
}

function showDefectAdd() {
    setElementDisplay("defects-add", "block");
    setElementDisplay("defects-list", "none");
    syncPersonSelectors();
    const reportedDateInput = getElement("defect-reported-date");
    if (reportedDateInput && !reportedDateInput.value) {
        reportedDateInput.value = formatDate(new Date());
    }
    renderDefectPhotoLink();
    updateDefectCodePreview();
    if (getHouseToken()) {
        loadDefects();
    }
}

function showDefectList() {
    setElementDisplay("defects-add", "none");
    setElementDisplay("defects-list", "block");
    loadDefects();
}

function setDefectFilter(filterValue) {
    currentDefectFilter = filterValue;
    updateSegmentedControlState(
        ["defects-filter-all", "defects-filter-open", "defects-filter-mine"],
        `defects-filter-${filterValue}`,
    );
    renderDefectsList();
}

function getVisibleDefects() {
    const selectedPersonId = getSelectedPersonId();
    return currentDefectFilter === "open"
        ? currentDefects.filter((defect) => !defect.officially_resolved)
        : currentDefectFilter === "mine" && selectedPersonId
            ? currentDefects.filter((defect) => String(defect.person_id) === String(selectedPersonId))
            : currentDefects;
}

function renderDefectsList() {
    const tableBody = getOptionalElement("#defects-table tbody");
    const status = getElement("defects-list-status");
    if (!tableBody || !status) {
        return;
    }
    tableBody.innerHTML = "";
    const visibleDefects = getVisibleDefects();

    if (!visibleDefects.length) {
        status.innerText = currentDefectFilter === "mine"
            ? "Keine Mängel für die aktuelle Person."
            : currentDefectFilter === "open"
                ? "Keine offenen Mängel."
                : "Noch keine Mängel vorhanden.";
        return;
    }

    status.innerText = "";
    visibleDefects.forEach((defect) => {
        const row = document.createElement("tr");
        row.className = "expandable-row defect-row";
        if (expandedDefectIds.has(defect.id)) {
            row.classList.add("is-expanded");
        }
        const description = String(defect.description || "");
        row.innerHTML = `
            <td>${escapeHtml(defect.room)}</td>
            <td>${escapeHtml(defect.room_location)}</td>
            <td title="${escapeHtml(description)}">
                <span class="description-preview">${escapeHtml(formatDescriptionPreview(description))}</span>
                <span class="description-full">${escapeHtml(description)}</span>
            </td>
            <td>${defect.damage_source === "existing" ? "Ja" : "Nein"}</td>
            <td>${defect.resolution_type === "must_fix" ? "Ja" : "Nein"}</td>
            <td>${escapeHtml(defect.person_name)}</td>
            <td>${defect.photo_available ? "Ja" : "Nein"}</td>
            <td>
                <input type="checkbox" ${defect.officially_resolved ? "checked" : ""} onchange="toggleDefectResolved(${defect.id}, this.checked)">
            </td>
            <td>${formatDefectCode(defect.id)}</td>
        `;
        row.addEventListener("click", (event) => {
            if (event.target.closest("input, button, select, label")) {
                return;
            }
            if (expandedDefectIds.has(defect.id)) {
                expandedDefectIds.delete(defect.id);
                row.classList.remove("is-expanded");
            } else {
                expandedDefectIds.add(defect.id);
                row.classList.add("is-expanded");
            }
        });
        tableBody.appendChild(row);
    });
}

async function loadDefects() {
    const [response, settingsResponse] = await Promise.all([
        apiFetch("/api/defects"),
        apiFetch("/api/defects/settings"),
    ]);
    const addStatus = getElement("defect-add-status");
    const listStatus = getElement("defects-list-status");
    const sharedStatus = getElement("defect-shared-photo-status");
    if (!response.ok || !settingsResponse.ok) {
        if (addStatus) {
            addStatus.innerText = "Mängel konnten nicht geladen werden.";
        }
        if (listStatus) {
            listStatus.innerText = "Mängel konnten nicht geladen werden.";
        }
        if (sharedStatus) {
            sharedStatus.innerText = "Fotolink konnte nicht geladen werden.";
        }
        return;
    }
    currentDefects = await response.json();
    currentDefectPhotoLink = (await settingsResponse.json()).photo_link || "";
    renderDefectsList();
    renderDefectPhotoLink();
    updateDefectCodePreview();
}

async function saveDefect() {
    const personSelect = getElement("defect-person-select");
    const roomInput = getElement("defect-room");
    const roomLocationInput = getElement("defect-room-location");
    const descriptionInput = getElement("defect-description");
    const damageSourceSelect = getElement("defect-damage-source");
    const resolutionTypeSelect = getElement("defect-resolution-type");
    const photoCheckbox = getElement("defect-photo-available");
    const reportedDateInput = getElement("defect-reported-date");
    const status = getElement("defect-add-status");
    if (
        !personSelect
        || !roomInput
        || !roomLocationInput
        || !descriptionInput
        || !damageSourceSelect
        || !resolutionTypeSelect
        || !photoCheckbox
        || !reportedDateInput
        || !status
    ) {
        return;
    }

    const payload = {
        person_id: Number(personSelect.value),
        room: roomInput.value.trim(),
        room_location: roomLocationInput.value.trim(),
        description: descriptionInput.value.trim(),
        damage_source: damageSourceSelect.value,
        resolution_type: resolutionTypeSelect.value,
        photo_available: photoCheckbox.checked,
        reported_date: reportedDateInput.value || formatDate(new Date()),
    };

    if (!payload.person_id || !payload.room || !payload.room_location || !payload.description) {
        status.innerText = "Bitte Person, Raum, Ort im Raum und Beschrieb ausfüllen.";
        return;
    }

    const response = await apiFetch("/api/defects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Mangel konnte nicht gespeichert werden: ${error}`;
        return;
    }

    const savedDefect = await response.json();
    roomInput.value = "";
    roomLocationInput.value = "";
    descriptionInput.value = "";
    damageSourceSelect.value = "existing";
    resolutionTypeSelect.value = "must_fix";
    photoCheckbox.checked = false;
    reportedDateInput.value = formatDate(new Date());
    status.innerText = `Mangel gespeichert (${formatDefectCode(savedDefect.id)}).`;
    await loadDefects();
}

async function saveDefectPhotoLink() {
    const input = getElement("defect-shared-photo-link");
    const status = getElement("defect-shared-photo-status");
    if (!input || !status) {
        return;
    }

    const response = await apiFetch("/api/defects/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_link: input.value.trim() || null }),
    });

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Fotolink konnte nicht gespeichert werden: ${error}`;
        return;
    }

    currentDefectPhotoLink = (await response.json()).photo_link || "";
    status.innerText = currentDefectPhotoLink ? "Fotolink gespeichert." : "Fotolink entfernt.";
    renderDefectPhotoLink();
}

async function toggleDefectResolved(defectId, checked) {
    const status = getElement("defects-list-status");
    const response = await apiFetch(`/api/defects/${defectId}/resolve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officially_resolved: checked }),
    });

    if (!response.ok) {
        const error = await response.text();
        if (status) {
            status.innerText = `Mangel konnte nicht aktualisiert werden: ${error}`;
        }
        await loadDefects();
        return;
    }

    if (status) {
        status.innerText = "";
    }
    await loadDefects();
}

function formatFeedbackType(feedbackType) {
    return feedbackType === "bug" ? "Fehler" : "Idee";
}

function getPriorityRank(priority) {
    if (priority === "high") {
        return 0;
    }
    if (priority === "medium") {
        return 1;
    }
    return 2;
}

function showFeedbackAdd() {
    setElementDisplay("feedback-add", "block");
    setElementDisplay("feedback-list", "none");
    syncPersonSelectors();
}

function showFeedbackList() {
    setElementDisplay("feedback-add", "none");
    setElementDisplay("feedback-list", "block");
    loadFeedback();
}

function setFeedbackFilter(filterValue) {
    currentFeedbackFilter = filterValue;
    updateSegmentedControlState(
        ["feedback-filter-all", "feedback-filter-open", "feedback-filter-mine"],
        `feedback-filter-${filterValue}`,
    );
    renderFeedbackList();
}

function getVisibleFeedback() {
    const selectedPersonId = getSelectedPersonId();
    const sortSelect = getElement("feedback-sort-select");
    const sortMode = sortSelect?.value || "created";
    const filteredItems = currentFeedback.filter((entry) => {
        if (currentFeedbackFilter === "open") {
            return !entry.resolved;
        }
        if (currentFeedbackFilter === "mine" && selectedPersonId) {
            return String(entry.person_id) === String(selectedPersonId);
        }
        return true;
    });

    return filteredItems.sort((left, right) => {
        if (sortMode === "priority") {
            const rankDiff = getPriorityRank(left.priority) - getPriorityRank(right.priority);
            if (rankDiff !== 0) {
                return rankDiff;
            }
        }
        return new Date(right.created_at) - new Date(left.created_at);
    });
}

function renderFeedbackList() {
    const tableBody = getOptionalElement("#feedback-table tbody");
    const status = getElement("feedback-list-status");
    if (!tableBody || !status) {
        return;
    }
    tableBody.innerHTML = "";
    const visibleFeedback = getVisibleFeedback();

    if (!visibleFeedback.length) {
        status.innerText = currentFeedbackFilter === "mine"
            ? "Keine Feedbacks für die aktuelle Person."
            : currentFeedbackFilter === "open"
                ? "Keine offenen Feedbacks."
                : "Noch keine Feedbacks vorhanden.";
        return;
    }

    status.innerText = "";
    visibleFeedback.forEach((entry) => {
        const row = document.createElement("tr");
        row.className = "expandable-row feedback-row";
        if (expandedFeedbackIds.has(entry.id)) {
            row.classList.add("is-expanded");
        }
        const description = String(entry.description || "");
        row.innerHTML = `
            <td>${escapeHtml(entry.area)}</td>
            <td>${formatFeedbackType(entry.feedback_type)}</td>
            <td>${escapeHtml(entry.person_name)}</td>
            <td title="${escapeHtml(description)}">
                <span class="description-preview">${escapeHtml(formatDescriptionPreview(description))}</span>
                <span class="description-full">${escapeHtml(description)}</span>
            </td>
            <td>
                <input type="checkbox" ${entry.resolved ? "checked" : ""} onchange="toggleFeedbackResolved(${entry.id}, this.checked)">
            </td>
        `;
        row.addEventListener("click", (event) => {
            if (event.target.closest("input, button, select, label")) {
                return;
            }
            if (expandedFeedbackIds.has(entry.id)) {
                expandedFeedbackIds.delete(entry.id);
                row.classList.remove("is-expanded");
            } else {
                expandedFeedbackIds.add(entry.id);
                row.classList.add("is-expanded");
            }
        });
        tableBody.appendChild(row);
    });
}

async function loadFeedback() {
    const response = await apiFetch("/api/feedback");
    const addStatus = getElement("feedback-add-status");
    const listStatus = getElement("feedback-list-status");
    if (!response.ok) {
        if (addStatus) {
            addStatus.innerText = "Feedbacks konnten nicht geladen werden.";
        }
        if (listStatus) {
            listStatus.innerText = "Feedbacks konnten nicht geladen werden.";
        }
        return;
    }
    currentFeedback = await response.json();
    renderFeedbackList();
}

async function saveFeedback() {
    const personSelect = getElement("feedback-person-select");
    const areaInput = getElement("feedback-area");
    const typeSelect = getElement("feedback-type");
    const descriptionInput = getElement("feedback-description");
    const prioritySelect = getElement("feedback-priority");
    const status = getElement("feedback-add-status");
    if (!personSelect || !areaInput || !typeSelect || !descriptionInput || !prioritySelect || !status) {
        return;
    }

    const payload = {
        person_id: Number(personSelect.value),
        area: areaInput.value.trim(),
        feedback_type: typeSelect.value,
        description: descriptionInput.value.trim(),
        priority: prioritySelect.value,
    };

    if (!payload.person_id || !payload.area || !payload.description) {
        status.innerText = "Bitte Erfasser, Bereich und Beschrieb ausfüllen.";
        return;
    }

    const response = await apiFetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.text();
        status.innerText = `Feedback konnte nicht gespeichert werden: ${error}`;
        return;
    }

    descriptionInput.value = "";
    typeSelect.value = "bug";
    prioritySelect.value = "medium";
    status.innerText = "Feedback gespeichert.";
    await loadFeedback();
}

async function toggleFeedbackResolved(feedbackId, checked) {
    const status = getElement("feedback-list-status");
    const response = await apiFetch(`/api/feedback/${feedbackId}/resolve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: checked }),
    });

    if (!response.ok) {
        const error = await response.text();
        if (status) {
            status.innerText = `Feedback konnte nicht aktualisiert werden: ${error}`;
        }
        await loadFeedback();
        return;
    }

    if (status) {
        status.innerText = "";
    }
    await loadFeedback();
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

function getFoodWeekStart(date) {
    const friday = cloneDate(date);
    friday.setHours(0, 0, 0, 0);
    const day = friday.getDay();
    const daysSinceFriday = (day + 2) % 7;
    friday.setDate(friday.getDate() - daysSinceFriday);
    return friday;
}

function addDays(date, days) {
    const copy = cloneDate(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

function formatWeekLabel(weekStart) {
    const weekEnd = addDays(weekStart, 6);
    return `${formatMonthDay(weekStart)} bis ${formatMonthDay(weekEnd)}`;
}

function getWeekDates(weekStart = getMonday(new Date())) {
    const dates = [];
    for (let i = 0; i < 7; i += 1) {
        dates.push(formatDate(addDays(weekStart, i)));
    }
    return dates;
}

function getFoodWeekDates(weekStart = getFoodWeekStart(new Date())) {
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

function formatMonthDay(dateValue) {
    const date = typeof dateValue === "string"
        ? new Date(`${dateValue}T00:00:00`)
        : dateValue;
    return date.toLocaleDateString("de-CH", {
        day: "2-digit",
        month: "2-digit",
    });
}

function formatWeekdayMonthDay(dateValue) {
    const date = typeof dateValue === "string"
        ? new Date(`${dateValue}T00:00:00`)
        : dateValue;
    const weekday = date.toLocaleDateString("de-CH", { weekday: "short" }).replace(",", "");
    const dayMonth = date.toLocaleDateString("de-CH", {
        day: "2-digit",
        month: "2-digit",
    });
    return `${weekday} ${dayMonth}`;
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
        laundry: getElement("overview-filter-laundry")?.checked ?? false,
        guestroom: getElement("overview-filter-guestroom")?.checked ?? false,
        mine: getElement("overview-filter-mine")?.checked ?? false,
    };
}

function resetOverviewFilters() {
    const foodToggle = getElement("overview-filter-food");
    const laundryToggle = getElement("overview-filter-laundry");
    const guestroomToggle = getElement("overview-filter-guestroom");
    const mineToggle = getElement("overview-filter-mine");
    if (foodToggle) {
        foodToggle.checked = true;
    }
    if (laundryToggle) {
        laundryToggle.checked = false;
    }
    if (guestroomToggle) {
        guestroomToggle.checked = false;
    }
    if (mineToggle) {
        mineToggle.checked = false;
    }
}

function getOverviewEventsForDate(dateValue) {
    const filters = getOverviewFilterState();
    const selectedPersonId = getSelectedPersonId();
    return currentOverviewEvents.filter((event) => {
        if (event.date !== dateValue) {
            return false;
        }
        if (event.type === "food" && !filters.food) {
            return false;
        }
        if (event.type === "food" && filters.mine && selectedPersonId && !event.personIds.includes(String(selectedPersonId))) {
            return false;
        }
        if (event.type === "laundry" && !filters.laundry) {
            return false;
        }
        if (event.type === "laundry" && filters.mine && selectedPersonId && !event.personIds.includes(String(selectedPersonId))) {
            return false;
        }
        if (event.type === "guestroom" && !filters.guestroom) {
            return false;
        }
        if (event.type === "guestroom" && filters.mine && selectedPersonId && !event.personIds.includes(String(selectedPersonId))) {
            return false;
        }
        return true;
    }).sort((left, right) => {
        if ((left.sortMinutes ?? 9999) !== (right.sortMinutes ?? 9999)) {
            return (left.sortMinutes ?? 9999) - (right.sortMinutes ?? 9999);
        }
        return left.title.localeCompare(right.title, "de-CH");
    });
}

function buildFoodEvents(foodEntries) {
    return buildAggregatedFoodRows(foodEntries).map((entry) => ({
        type: "food",
        date: entry.date,
        title: `${formatTimeValue(entry.eatingTime || getDefaultMealTime(entry.mealType))} · ${entry.floorName}`,
        subtitle: entry.displayCooks.length ? entry.displayCooks.join(", ") : "Kein Koch",
        detail: formatFoodPeopleSummary(entry.ownPeopleTotal, entry.additionalPeopleTotal),
        sortMinutes: Number(String(entry.latestTime || "23:59").slice(0, 2)) * 60
            + Number(String(entry.latestTime || "23:59").slice(3, 5)),
        personIds: entry.personIds,
    }));
}

function buildLaundryEvents(laundryEntries) {
    return laundryEntries.map((entry) => ({
        type: "laundry",
        date: entry.date,
        title: `${entry.start_time.slice(0, 5)}–${entry.end_time.slice(0, 5)}`,
        subtitle: entry.machine,
        detail: entry.person_name,
        sortMinutes: Number(entry.start_time.slice(0, 2)) * 60 + Number(entry.start_time.slice(3, 5)),
        personIds: [String(entry.person_id)],
    }));
}

function getEventsForDate(dateValue, events) {
    return events.filter((event) => event.date === dateValue).sort((left, right) => {
        if ((left.sortMinutes ?? 9999) !== (right.sortMinutes ?? 9999)) {
            return (left.sortMinutes ?? 9999) - (right.sortMinutes ?? 9999);
        }
        return left.title.localeCompare(right.title, "de-CH");
    });
}

function getDurationNights(startValue, endValue) {
    const startAt = new Date(startValue);
    const endAt = new Date(endValue);
    const startDay = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate());
    const endDay = new Date(endAt.getFullYear(), endAt.getMonth(), endAt.getDate());
    const diffDays = Math.round((endDay.getTime() - startDay.getTime()) / 86400000);
    return Math.max(diffDays, 0);
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
                detail: formatGuestroomRoomLabel(entry.room_name, entry.responsible_name),
                sortMinutes: formatDate(cursor) === formatDate(startAt)
                    ? startAt.getHours() * 60 + startAt.getMinutes()
                    : 0,
                personIds: [String(entry.person_id)],
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

function formatGuestroomListDateTime(value) {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return formatDateTime(value);
    }
    return `${formatWeekdayMonthDay(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatGuestroomRoomLabel(roomName, responsibleName) {
    if (roomName === "Eigenes Zimmer" && responsibleName) {
        return `Zimmer ${responsibleName}`;
    }
    return roomName || "";
}

function roundTimeValueToStep(value, stepMinutes) {
    if (!value) {
        return value;
    }
    const [hoursText, minutesText] = value.split(":");
    const totalMinutes = Number(hoursText) * 60 + Number(minutesText);
    const roundedMinutes = Math.round(totalMinutes / stepMinutes) * stepMinutes;
    const normalizedMinutes = Math.max(0, Math.min(23 * 60 + 55, roundedMinutes));
    const roundedHours = Math.floor(normalizedMinutes / 60);
    const minuteRemainder = normalizedMinutes % 60;
    return `${pad2(roundedHours)}:${pad2(minuteRemainder)}`;
}

function roundDateTimeLocalValueToStep(value, stepMinutes) {
    if (!value) {
        return value;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    const totalMinutes = date.getHours() * 60 + date.getMinutes();
    const roundedMinutes = Math.round(totalMinutes / stepMinutes) * stepMinutes;
    date.setHours(0, 0, 0, 0);
    date.setMinutes(roundedMinutes);
    return formatDateTimeLocal(date);
}

function createOverviewEventHtml(event) {
    return `
        <div class="calendar-event calendar-event--${event.type}" onclick="toggleOverviewEventDetails(this)" tabindex="0">
            <strong>${event.title}</strong>
            <span>${event.subtitle}</span>
            <span class="calendar-event-detail">${event.detail || ""}</span>
        </div>
    `;
}

function toggleOverviewEventDetails(element) {
    if (!element) {
        return;
    }
    element.classList.toggle("is-expanded");
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
                    <span>${formatMonthDay(dateValue)}</span>
                </div>
                <div class="calendar-day-events">
                    ${events.length ? events.map(createOverviewEventHtml).join("") : '<p class="calendar-empty">Keine Einträge</p>'}
                </div>
            </div>
        `;
    }).join("");
}

function renderLaundryOverviewWeek(events) {
    const calendar = getElement("laundry-overview-calendar");
    const status = getElement("laundry-overview-status");
    if (!calendar || !status) {
        return;
    }

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const weekDates = Array.from({ length: 7 }, (_, index) => formatDate(addDays(startDate, index)));

    calendar.className = "overview-calendar overview-calendar--week";
    calendar.innerHTML = weekDates.map((dateValue) => {
        const date = new Date(`${dateValue}T00:00:00`);
        const dayLabel = date.toLocaleDateString("de-CH", { weekday: "long" });
        const dayEvents = getEventsForDate(dateValue, events);

        return `
            <div class="calendar-day-card${isToday(dateValue) ? " calendar-day-card--today" : ""}">
                <div class="calendar-day-header">
                    <strong>${dayLabel}</strong>
                    <span>${formatMonthDay(dateValue)}</span>
                </div>
                <div class="calendar-day-events">
                    ${dayEvents.length ? dayEvents.map(createOverviewEventHtml).join("") : '<p class="calendar-empty">Keine Einträge</p>'}
                </div>
            </div>
        `;
    }).join("");

    status.innerText = events.length ? "" : "Keine Wäscheeinträge in den nächsten 7 Tagen.";
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
    loadLaundryOverview();
}

function startNewLaundryBooking() {
    resetLaundryForm();
    showLaundryAdd();
}

function showLaundryList() {
    setElementDisplay("laundry-add", "none");
    setElementDisplay("laundry-list", "block");
    loadLaundry(true);
}

function changeLaundryPage(direction) {
    currentLaundryOffset = Math.max(0, currentLaundryOffset + direction * 10);
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
    const machineSelect = getElement("laundry-machine-select");
    const dateInput = getElement("laundry-date");
    const startInput = getElement("laundry-start");
    const endInput = getElement("laundry-end");
    const status = getElement("laundry-add-status");
    syncPersonSelectors();
    if (dateInput) {
        dateInput.value = "";
    }
    if (machineSelect) {
        machineSelect.value = "links";
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
    const machineSelect = getElement("laundry-machine-select");
    const dateInput = getElement("laundry-date");
    const startInput = getElement("laundry-start");
    const endInput = getElement("laundry-end");
    const status = getElement("laundry-add-status");
    if (personSelect) {
        personSelect.value = String(booking.person_id);
    }
    if (machineSelect) {
        machineSelect.value = booking.machine;
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
    const machineSelect = getElement("laundry-machine-select");
    const dateInput = getElement("laundry-date");
    const startInput = getElement("laundry-start");
    const endInput = getElement("laundry-end");
    const status = getElement("laundry-add-status");
    if (!personSelect || !machineSelect || !dateInput || !startInput || !endInput || !status) {
        return;
    }
    const personId = personSelect.value;
    const machine = machineSelect.value;
    const date = dateInput.value;
    const start = roundTimeValueToStep(startInput.value, 5);
    const end = roundTimeValueToStep(endInput.value, 5);
    status.innerText = "";

    startInput.value = start;
    endInput.value = end;

    if (!personId || !machine || !date || !start || !end) {
        status.innerText = "Bitte Person, Waschmaschine, Datum, Start- und Endzeit auswählen.";
        return;
    }

    const response = await apiFetch(
        editingLaundryBookingId ? `/api/laundry/${editingLaundryBookingId}` : "/api/laundry",
        {
            method: editingLaundryBookingId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                person_id: Number(personId),
                machine,
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

async function loadLaundryOverview() {
    const status = getElement("laundry-overview-status");
    const calendar = getElement("laundry-overview-calendar");
    if (!status || !calendar) {
        return;
    }

    status.innerText = "";
    const response = await apiFetch("/api/laundry");
    if (!response.ok) {
        status.innerText = "Wäscheübersicht konnte nicht geladen werden.";
        return;
    }

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const today = formatDate(todayDate);
    const endDate = formatDate(addDays(todayDate, 6));
    const entries = (await response.json())
        .filter((entry) => entry.date >= today && entry.date <= endDate)
        .sort((left, right) => {
            if (left.date !== right.date) {
                return left.date.localeCompare(right.date);
            }
            if (left.start_time !== right.start_time) {
                return left.start_time.localeCompare(right.start_time);
            }
            return left.id - right.id;
        });

    renderLaundryOverviewWeek(buildLaundryEvents(entries));
}

async function loadLaundry(resetToUpcoming = false) {
    const status = getElement("laundry-list-status");
    const tableBody = getOptionalElement("#laundry-table tbody");
    const prevButton = getElement("laundry-prev-button");
    const nextButton = getElement("laundry-next-button");
    const mineToggle = getElement("laundry-mine-toggle");
    if (!status || !tableBody || !prevButton || !nextButton) {
        return;
    }
    status.innerText = "";
    tableBody.innerHTML = "";

    const response = await apiFetch("/api/laundry");
    if (!response.ok) {
        status.innerText = "Wäschebuchungen konnten nicht geladen werden.";
        return;
    }

    const today = formatDate(new Date());
    const selectedPersonId = getSelectedPersonId();
    currentLaundryListEntries = (await response.json())
        .filter((entry) => !(mineToggle?.checked && selectedPersonId) || String(entry.person_id) === String(selectedPersonId))
        .sort((left, right) => {
            if (left.date !== right.date) {
                return left.date.localeCompare(right.date);
            }
            if (left.start_time !== right.start_time) {
                return left.start_time.localeCompare(right.start_time);
            }
            return left.id - right.id;
        });

    if (resetToUpcoming) {
        const firstUpcomingIndex = currentLaundryListEntries.findIndex((entry) => entry.date >= today);
        if (firstUpcomingIndex >= 0) {
            currentLaundryOffset = firstUpcomingIndex;
        } else {
            currentLaundryOffset = currentLaundryListEntries.length;
        }
    }

    if (
        currentLaundryOffset >= currentLaundryListEntries.length
        && currentLaundryOffset > 0
        && !(resetToUpcoming && !currentLaundryListEntries.some((entry) => entry.date >= today))
    ) {
        currentLaundryOffset = Math.max(0, currentLaundryOffset - 10);
    }

    currentLaundryBookings = currentLaundryListEntries.slice(currentLaundryOffset, currentLaundryOffset + 10);
    prevButton.disabled = currentLaundryOffset === 0;
    nextButton.disabled = currentLaundryOffset + 10 >= currentLaundryListEntries.length;
    if (!currentLaundryBookings.length) {
        status.innerText = mineToggle?.checked
            ? "Keine Buchungen ab heute für die aktuelle Person."
            : "Keine Buchungen ab heute.";
        return;
    }

    currentLaundryBookings.forEach((booking) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${formatWeekdayMonthDay(booking.date)}</td>
            <td>${booking.start_time.slice(0, 5)}</td>
            <td>${booking.end_time.slice(0, 5)}</td>
            <td>${booking.machine}</td>
            <td>${booking.person_name}</td>
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
    const weekDates = getFoodWeekDates(weekStart);
    weekDates.forEach((dateValue) => {
        rows.push({ date: dateValue, mealType: "lunch" });
        rows.push({ date: dateValue, mealType: "dinner" });
        if (new Date(`${dateValue}T00:00:00`).getDay() === 0) {
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

function formatWeekdayDateLabel(dateValue) {
    const date = new Date(`${dateValue}T00:00:00`);
    return date.toLocaleDateString("de-CH", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
    }).replace(",", "");
}

function formatPlannerDateLabel(dateValue, mealType) {
    return `${formatWeekdayDateLabel(dateValue)} · ${formatMealLabel(mealType)}`;
}

function normalizeCookingGroupName(value) {
    const cleanedValue = String(value || "").trim();
    if (!cleanedValue || cleanedValue === "Ganzes Haus") {
        return "EG";
    }
    return cleanedValue;
}

function getMealGroupSuggestions(entries, dateValue, mealType) {
    const groups = new Set(["EG"]);
    entries
        .filter((entry) => entry.date === dateValue && entry.meal_type === mealType)
        .forEach((entry) => {
            const groupName = normalizeCookingGroupName(entry.cooking_group_name);
            if (groupName) {
                groups.add(groupName);
            }
        });
    return Array.from(groups).sort((left, right) => left.localeCompare(right, "de-CH"));
}

function setFoodAddStatus(message) {
    const status = getElement("food-add-status");
    if (status) {
        status.innerText = message;
    }
}

function normalizeGuestNames(guestNames) {
    return (guestNames || []).map((name) => String(name || "").trim()).filter(Boolean);
}

function buildGuestNameInputs(guestNames) {
    const normalizedGuestNames = normalizeGuestNames(guestNames);
    const values = [...normalizedGuestNames, ""];
    return `
        <div class="food-guest-names">
            ${values.map((guestName) => (
                `<input class="food-guest-name" type="text" value="${escapeHtml(guestName)}" placeholder="Name des Gasts">`
            )).join("")}
        </div>
    `;
}

function getFoodRowInputs(row) {
    return {
        eatsInput: getOptionalChild(row, ".food-eats"),
        cooksInput: getOptionalChild(row, ".food-cooks"),
        cookingGroupSelect: getOptionalChild(row, ".food-cooking-group-select"),
        cookingGroupCustomInput: getOptionalChild(row, ".food-cooking-group-custom"),
    };
}

function getFoodGuestNames(row) {
    return normalizeGuestNames(Array.from(row.querySelectorAll(".food-guest-name")).map((input) => input.value));
}

function syncGuestNameInputs(row, preserveInput = null) {
    const container = getOptionalChild(row, ".food-guest-names");
    if (!container) {
        return;
    }
    const existingInputs = Array.from(container.querySelectorAll(".food-guest-name"));
    const guestNames = normalizeGuestNames(existingInputs.map((input) => input.value));
    const activeIndex = preserveInput ? existingInputs.indexOf(preserveInput) : -1;
    const activeValue = preserveInput ? preserveInput.value : "";
    container.innerHTML = [...guestNames, ""]
        .map((guestName) => `<input class="food-guest-name" type="text" value="${escapeHtml(guestName)}" placeholder="Name des Gasts">`)
        .join("");
    attachGuestNameInputListeners(row);

    if (activeIndex >= 0) {
        const nextInputs = Array.from(container.querySelectorAll(".food-guest-name"));
        const nextInput = nextInputs[Math.min(activeIndex, nextInputs.length - 1)];
        if (nextInput) {
            nextInput.focus();
            nextInput.setSelectionRange(activeValue.length, activeValue.length);
        }
    }
}

function attachGuestNameInputListeners(row) {
    row.querySelectorAll(".food-guest-name").forEach((input) => {
        input.addEventListener("input", () => {
            const container = getOptionalChild(row, ".food-guest-names");
            if (!container) {
                return;
            }
            const inputs = Array.from(container.querySelectorAll(".food-guest-name"));
            const isLastInput = inputs[inputs.length - 1] === input;
            if (isLastInput && input.value.trim()) {
                syncGuestNameInputs(row, input);
            }
        });
        input.addEventListener("blur", () => {
            syncGuestNameInputs(row);
        });
    });
}

function buildFoodGroupOptions(groupSuggestions, selectedGroupName) {
    const normalizedSelectedGroup = normalizeCookingGroupName(selectedGroupName);
    const values = new Set(groupSuggestions);
    if (normalizedSelectedGroup) {
        values.add(normalizedSelectedGroup);
    }

    const options = ['<option value="EG">EG</option>'];
    Array.from(values)
        .filter((groupName) => groupName !== "EG")
        .sort((left, right) => left.localeCompare(right, "de-CH"))
        .forEach((groupName) => {
            const isSelected = normalizedSelectedGroup === groupName ? " selected" : "";
            options.push(`<option value="${groupName}"${isSelected}>${groupName}</option>`);
        });

    const customSelected = normalizedSelectedGroup && !groupSuggestions.includes(normalizedSelectedGroup)
        ? " selected"
        : "";
    options.push(`<option value="__custom__"${customSelected}>Anderer Stock…</option>`);
    return options.join("");
}

function getFoodRowGroupName(row) {
    const { cookingGroupSelect, cookingGroupCustomInput } = getFoodRowInputs(row);
    if (!cookingGroupSelect || !cookingGroupCustomInput) {
        return "";
    }
    if (cookingGroupSelect.value === "__custom__") {
        return normalizeCookingGroupName(cookingGroupCustomInput.value);
    }
    return normalizeCookingGroupName(cookingGroupSelect.value);
}

function updateFoodGroupInputVisibility(row) {
    const { cookingGroupSelect, cookingGroupCustomInput } = getFoodRowInputs(row);
    if (!cookingGroupSelect || !cookingGroupCustomInput) {
        return;
    }
    const showCustomInput = cookingGroupSelect.value === "__custom__";
    cookingGroupCustomInput.style.display = showCustomInput ? "block" : "none";
    if (showCustomInput) {
        cookingGroupCustomInput.focus();
    }
}

function findExistingCookConflict(personId, dateValue, mealType, cookingGroupName) {
    return currentFoodWeekEntries.find((entry) => (
        String(entry.person_id) !== String(personId)
        && entry.date === dateValue
        && entry.meal_type === mealType
        && entry.cooks
        && normalizeCookingGroupName(entry.cooking_group_name) === normalizeCookingGroupName(cookingGroupName)
    ));
}

function validateFoodPlannerRow(row, options = {}) {
    const { showMessage = true, changedField = "" } = options;
    const personSelect = getElement("food-person-select");
    const personId = personSelect?.value || getSelectedPersonId();
    const { cooksInput, cookingGroupSelect, cookingGroupCustomInput } = getFoodRowInputs(row);
    if (!personId || !cooksInput || !cookingGroupSelect || !cookingGroupCustomInput) {
        return true;
    }

    const dateValue = row.dataset.date;
    const mealType = row.dataset.mealType;
    const cookingGroupName = getFoodRowGroupName(row);

    if (cooksInput.checked) {
        const conflictingEntry = findExistingCookConflict(personId, dateValue, mealType, cookingGroupName);
        if (conflictingEntry) {
            if (changedField === "group") {
                const previousGroupName = row.dataset.prevCookingGroupValue || "";
                if (!previousGroupName) {
                    cookingGroupSelect.value = "";
                    cookingGroupCustomInput.value = "";
                } else if (Array.from(cookingGroupSelect.options).some((option) => option.value === previousGroupName)) {
                    cookingGroupSelect.value = previousGroupName;
                    cookingGroupCustomInput.value = "";
                } else {
                    cookingGroupSelect.value = "__custom__";
                    cookingGroupCustomInput.value = previousGroupName;
                }
                updateFoodGroupInputVisibility(row);
            } else {
                cooksInput.checked = false;
            }
            if (showMessage) {
                const cookingGroupName = getFoodFloorName(conflictingEntry.cooking_group_name);
                setFoodAddStatus(
                    `${conflictingEntry.person_name} kocht bereits für ${formatMealLabel(mealType)} in ${cookingGroupName}.`
                );
            }
            return false;
        }
    }

    row.dataset.prevCookingGroupValue = cookingGroupName;
    if (showMessage) {
        setFoodAddStatus("");
    }
    return true;
}

function attachFoodRowValidation(row) {
    const { cooksInput, cookingGroupSelect, cookingGroupCustomInput } = getFoodRowInputs(row);
    const timeInput = getOptionalChild(row, ".food-time");
    if (!cooksInput || !cookingGroupSelect || !cookingGroupCustomInput) {
        return;
    }

    row.dataset.prevCookingGroupValue = getFoodRowGroupName(row);
    row.dataset.timeChanged = "false";
    updateFoodGroupInputVisibility(row);

    cooksInput.addEventListener("change", () => {
        validateFoodPlannerRow(row, { changedField: "cooks" });
    });
    cookingGroupSelect.addEventListener("change", () => {
        updateFoodGroupInputVisibility(row);
        validateFoodPlannerRow(row, { changedField: "group" });
    });
    cookingGroupCustomInput.addEventListener("input", () => {
        validateFoodPlannerRow(row, { changedField: "group" });
    });
    timeInput?.addEventListener("change", () => {
        row.dataset.timeChanged = "true";
    });
    attachGuestNameInputListeners(row);
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
        const groupSuggestions = getMealGroupSuggestions(entries, rowData.date, rowData.mealType);
        const selectedGroupName = entry?.cooking_group_name || "";
        const useCustomGroup = Boolean(
            normalizeCookingGroupName(selectedGroupName)
            && !groupSuggestions.includes(normalizeCookingGroupName(selectedGroupName))
        );
        const row = document.createElement("tr");
        row.dataset.date = rowData.date;
        row.dataset.mealType = rowData.mealType;
        row.id = `food-row-${rowData.date}-${rowData.mealType}`;
        row.innerHTML = `
            <td>${formatPlannerDateLabel(rowData.date, rowData.mealType)}</td>
            <td><input class="food-eats" type="checkbox" ${entry?.eats ? "checked" : ""}></td>
            <td><input class="food-leftovers" type="checkbox" ${entry?.take_leftovers_next_day ? "checked" : ""} ${rowData.mealType !== "lunch" ? "disabled" : ""}></td>
            <td><input class="food-cooks" type="checkbox" ${entry?.cooks ? "checked" : ""}></td>
            <td>${buildGuestNameInputs(entry?.guest_names || [])}</td>
            <td><input class="food-time" type="time" value="${entry?.eating_time ?? getDefaultMealTime(rowData.mealType)}"></td>
            <td>
                <select class="food-cooking-group-select">
                    ${buildFoodGroupOptions(groupSuggestions, selectedGroupName)}
                </select>
                <input class="food-cooking-group-custom" type="text" value="${useCustomGroup ? selectedGroupName : ""}" placeholder="Anderer Stock" style="display:${useCustomGroup ? "block" : "none"}; margin-top:0.5rem;">
            </td>
        `;
        tbody.appendChild(row);
        attachFoodRowValidation(row);
    });
}

async function loadFoodWeekForAdd() {
    const weekDates = getFoodWeekDates(currentFoodAddWeekStart);
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
    currentFoodAddWeekStart = getFoodWeekStart(new Date());
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
        const leftoversInput = getOptionalChild(row, ".food-leftovers");
        const timeInput = getOptionalChild(row, ".food-time");
        const cookingGroupSelect = getOptionalChild(row, ".food-cooking-group-select");
        const cookingGroupCustomInput = getOptionalChild(row, ".food-cooking-group-custom");

        if (
            !eatsInput
            || !cooksInput
            || !leftoversInput
            || !timeInput
            || !cookingGroupSelect
            || !cookingGroupCustomInput
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
            cook_helper: false,
            guest_names: getFoodGuestNames(row),
            take_leftovers_next_day: leftoversInput.checked,
            eating_time: timeInput.value || getDefaultMealTime(row.dataset.mealType),
            time_changed: row.dataset.timeChanged === "true",
            cooking_group_name: getFoodRowGroupName(row),
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

function formatFoodPeopleSummary(ownPeopleTotal, additionalPeopleTotal) {
    const ownTotal = Number(ownPeopleTotal || 0);
    const additionalTotal = Number(additionalPeopleTotal || 0);
    const combinedTotal = ownTotal + additionalTotal;
    if (ownTotal === 0 || additionalTotal === 0) {
        return String(combinedTotal);
    }
    return `${ownTotal} + ${additionalTotal} = ${combinedTotal}`;
}

function getFoodFloorName(value) {
    return normalizeCookingGroupName(value);
}

function createFoodMealBuckets(entries) {
    const buckets = new Map();

    entries.forEach((entry) => {
        const floorName = getFoodFloorName(entry.cooking_group_name);
        const key = `${entry.date}|${entry.meal_type}|${floorName}`;
        if (!buckets.has(key)) {
            buckets.set(key, {
                date: entry.date,
                mealType: entry.meal_type,
                floorName,
                entries: [],
                cooks: [],
                ownPeopleTotal: 0,
                leftoversCount: 0,
                latestTime: entry.eating_time || getDefaultMealTime(entry.meal_type),
                latestUpdatedAt: entry.updated_at || "",
                ownParticipantIds: new Set(),
                ownEatNames: [],
                ownGuestNames: [],
                leftoversNames: [],
            });
        }

        const bucket = buckets.get(key);
        bucket.entries.push(entry);
        if (entry.eats || entry.cooks) {
            bucket.ownParticipantIds.add(String(entry.person_id));
        }
        if (entry.cooks) {
            bucket.cooks.push(entry.person_name);
        }
        if (entry.eats) {
            bucket.ownPeopleTotal += 1 + Number(entry.guests || 0);
            bucket.ownEatNames.push(entry.person_name);
            bucket.ownGuestNames.push(...normalizeGuestNames(entry.guest_names));
        }
        if (entry.take_leftovers_next_day) {
            bucket.leftoversCount += 1;
            bucket.leftoversNames.push(entry.person_name);
        }
        if ((entry.updated_at || "") >= (bucket.latestUpdatedAt || "")) {
            bucket.latestTime = entry.eating_time || bucket.latestTime;
            bucket.latestUpdatedAt = entry.updated_at || bucket.latestUpdatedAt;
        }
    });

    return buckets;
}

function buildAggregatedFoodRows(entries) {
    const buckets = createFoodMealBuckets(entries);
    const byMeal = new Map();

    buckets.forEach((bucket) => {
        const mealKey = `${bucket.date}|${bucket.mealType}`;
        if (!byMeal.has(mealKey)) {
            byMeal.set(mealKey, new Map());
        }
        byMeal.get(mealKey).set(bucket.floorName, bucket);
    });

    const rows = [];
    byMeal.forEach((mealBuckets) => {
        const egBucket = mealBuckets.get("EG");
        const dependentBuckets = Array.from(mealBuckets.values()).filter((bucket) => (
            bucket.floorName !== "EG"
            && !bucket.cooks.length
            && Boolean(egBucket?.cooks.length)
        ));

        mealBuckets.forEach((bucket) => {
            const sourceBucket = bucket.cooks.length ? bucket : (bucket.floorName !== "EG" && egBucket?.cooks.length ? egBucket : bucket);
            const ownTotal = bucket.ownPeopleTotal;
            const additionalFloorPeopleTotal = bucket.floorName === "EG"
                ? dependentBuckets.reduce((sum, dependentBucket) => sum + dependentBucket.ownPeopleTotal, 0)
                : 0;
            const ownLeftoversTotal = bucket.leftoversCount;
            const dependentLeftoversTotal = bucket.floorName === "EG"
                ? dependentBuckets.reduce((sum, dependentBucket) => sum + dependentBucket.leftoversCount, 0)
                : 0;
            const additionalLeftoversTotal = ownLeftoversTotal + dependentLeftoversTotal;
            const additionalTotal = additionalFloorPeopleTotal + additionalLeftoversTotal;
            const displayCooks = sourceBucket.cooks.length
                ? sourceBucket.cooks.map((cookName) => (
                    sourceBucket.floorName === bucket.floorName ? cookName : `${cookName} (${sourceBucket.floorName})`
                ))
                : [];

            rows.push({
                date: bucket.date,
                mealType: bucket.mealType,
                floorName: bucket.floorName,
                displayCooks,
                ownPeopleTotal: ownTotal,
                additionalFloorPeopleTotal,
                additionalLeftoversTotal,
                additionalPeopleTotal: additionalTotal,
                combinedPeopleTotal: ownTotal + additionalTotal,
                eatingTime: bucket.latestTime,
                latestTime: bucket.latestTime,
                personIds: Array.from(bucket.ownParticipantIds),
                ownEatNames: bucket.ownEatNames,
                ownGuestNames: bucket.ownGuestNames,
                leftoversNames: bucket.leftoversNames,
                additionalFloorDetails: bucket.floorName === "EG"
                    ? dependentBuckets.map((dependentBucket) => ({
                        floorName: dependentBucket.floorName,
                        eatNames: dependentBucket.ownEatNames,
                        guestNames: dependentBucket.ownGuestNames,
                        leftoversNames: dependentBucket.leftoversNames,
                    }))
                    : [],
            });
        });
    });

    return rows;
}

function formatParticipantLines(entry) {
    const lines = [];
    if (entry.ownEatNames.length) {
        lines.push({
            label: `${entry.floorName}:`,
            names: entry.ownEatNames,
        });
    }
    if (entry.ownGuestNames.length) {
        lines.push({
            label: "Gäste:",
            names: entry.ownGuestNames,
        });
    }
    entry.additionalFloorDetails.forEach((detail) => {
        if (detail.eatNames.length) {
            lines.push({
                label: `${detail.floorName}:`,
                names: detail.eatNames,
            });
        }
        if (detail.guestNames.length) {
            lines.push({
                label: `Gäste ${detail.floorName}:`,
                names: detail.guestNames,
            });
        }
    });
    if (entry.leftoversNames.length) {
        lines.push({
            label: "Reste:",
            names: entry.leftoversNames,
        });
    }
    return lines;
}

function formatParticipantLineHtml(label, names) {
    if (!names.length) {
        return "";
    }
    const chunkSize = 4;
    const chunks = [];
    for (let index = 0; index < names.length; index += chunkSize) {
        chunks.push(names.slice(index, index + chunkSize));
    }
    return chunks.map((chunk, index) => (
        `<div>${index === 0 ? `<strong>${escapeHtml(label)}</strong> ` : ""}${escapeHtml(chunk.join(", "))}</div>`
    )).join("");
}

function getFoodPeopleBreakdownLabel(entry) {
    const parts = [];
    if (entry.additionalFloorPeopleTotal > 0) {
        parts.push(`anderer Stock: ${entry.additionalFloorPeopleTotal}`);
    }
    if (entry.additionalLeftoversTotal > 0) {
        parts.push(`Reste: ${entry.additionalLeftoversTotal}`);
    }
    return parts.join(" · ");
}

function buildSummaryRows(entries) {
    const tbody = getOptionalElement("#food-summary-table tbody");
    const status = getElement("food-summary-status");
    const weekLabel = getElement("food-summary-week-label");
    const mineToggle = getElement("food-summary-mine-toggle");
    if (!tbody || !status || !weekLabel) {
        return;
    }
    tbody.innerHTML = "";
    weekLabel.innerText = formatWeekLabel(currentFoodSummaryWeekStart);
    status.innerText = "";

    const mealOrder = {
        brunch: 0,
        lunch: 1,
        dinner: 2,
    };
    const summaryRows = buildAggregatedFoodRows(entries)
        .filter((entry) => {
            const selectedPersonId = getSelectedPersonId();
            return !(mineToggle?.checked && selectedPersonId)
                || entry.personIds.includes(String(selectedPersonId));
        })
        .sort((left, right) => {
            if (left.date !== right.date) {
                return left.date.localeCompare(right.date);
            }
            if (left.mealType !== right.mealType) {
                return (mealOrder[left.mealType] ?? 99) - (mealOrder[right.mealType] ?? 99);
            }
            return left.floorName.localeCompare(right.floorName, "de-CH");
        });

    if (!summaryRows.length) {
        status.innerText = mineToggle?.checked
            ? "Keine Einträge für die aktuelle Person in dieser Woche."
            : "Keine Essenseinträge in dieser Woche.";
        return;
    }

    summaryRows.forEach((entry) => {
        const row = document.createElement("tr");
        row.className = "expandable-row food-summary-row";
        const participantLines = formatParticipantLines(entry);
        row.innerHTML = `
            <td>
                <span class="description-preview">${formatWeekdayDateLabel(entry.date)}</span>
                <span class="description-full">${participantLines.length ? participantLines.map((line) => formatParticipantLineHtml(line.label, line.names)).join("") : "Keine Teilnehmenden."}</span>
            </td>
            <td>${formatTimeValue(entry.eatingTime)}</td>
            <td>${entry.floorName}</td>
            <td>${entry.displayCooks.length ? entry.displayCooks.join(", ") : ""}</td>
            <td title="${escapeHtml(getFoodPeopleBreakdownLabel(entry))}">${formatFoodPeopleSummary(entry.ownPeopleTotal, entry.additionalPeopleTotal)}</td>
        `;
        row.addEventListener("click", () => {
            row.classList.toggle("is-expanded");
        });
        tbody.appendChild(row);
    });
}

async function loadFoodSummary() {
    const weekDates = getFoodWeekDates(currentFoodSummaryWeekStart);
    const response = await apiFetch(`/api/food?start_date=${weekDates[0]}&end_date=${weekDates[weekDates.length - 1]}`);
    if (!response.ok) {
        const status = getElement("food-summary-status");
        if (status) {
            const error = await response.text();
            status.innerText = `Essensübersicht konnte nicht geladen werden: ${error}`;
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
    currentFoodSummaryWeekStart = getFoodWeekStart(new Date());
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

async function showGuestroomList() {
    setElementDisplay("guestroom-add", "none");
    setElementDisplay("guestroom-list", "block");
    await loadGuestroomBookings(true);
}

function changeGuestroomPage(direction) {
    currentGuestroomOffset = Math.max(0, currentGuestroomOffset + direction * 10);
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
    const roomSelect = getElement("guestroom-room-select");
    const guestInput = getElement("guestroom-guest");
    const startInput = getElement("guestroom-start");
    const endInput = getElement("guestroom-end");
    const status = getElement("guestroom-add-status");
    const roomInfo = getElement("guestroom-room-info");
    syncPersonSelectors();
    if (roomSelect) {
        roomSelect.value = "";
    }
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
    if (roomInfo) {
        roomInfo.innerText = "";
    }
    updateGuestroomFormUi();
}

function editGuestroomBooking(booking) {
    editingGuestroomBookingId = booking.id;
    showGuestroomAdd();
    const personSelect = getElement("guestroom-person-select");
    const roomSelect = getElement("guestroom-room-select");
    const guestInput = getElement("guestroom-guest");
    const startInput = getElement("guestroom-start");
    const endInput = getElement("guestroom-end");
    const status = getElement("guestroom-add-status");
    if (personSelect) {
        personSelect.value = String(booking.person_id);
    }
    renderGuestroomRoomOptions();
    if (roomSelect) {
        roomSelect.value = booking.guest_room_id ? String(booking.guest_room_id) : "";
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
    refreshGuestroomRoomInfo();
    updateGuestroomFormUi();
}

function editGuestroomBookingById(bookingId) {
    const booking = currentGuestroomBookings.find((entry) => entry.id === bookingId);
    if (booking) {
        editGuestroomBooking(booking);
    }
}

async function fetchGuestroomConflicts(personId, guestRoomId, startAt, endAt) {
    const params = new URLSearchParams({
        person_id: String(personId),
        start_at: startAt,
        end_at: endAt,
    });
    if (guestRoomId) {
        params.set("guest_room_id", String(guestRoomId));
    }
    if (editingGuestroomBookingId) {
        params.set("exclude_booking_id", String(editingGuestroomBookingId));
    }

    const response = await apiFetch(`/api/guestroom/conflicts?${params.toString()}`);
    if (!response.ok) {
        return [];
    }
    return response.json();
}

function formatGuestroomConflictMessage(conflicts) {
    if (!conflicts.length) {
        return "";
    }
    return conflicts
        .map((conflict) => (
            `${conflict.room_name} ist bereits gebucht von ${conflict.responsible_name} `
            + `(${formatDateTime(conflict.start_at)} bis ${formatDateTime(conflict.end_at)}).`
        ))
        .join(" ");
}

async function refreshGuestroomRoomInfo() {
    const personSelect = getElement("guestroom-person-select");
    const roomSelect = getElement("guestroom-room-select");
    const startInput = getElement("guestroom-start");
    const endInput = getElement("guestroom-end");
    const roomInfo = getElement("guestroom-room-info");
    if (!personSelect || !roomSelect || !startInput || !endInput || !roomInfo) {
        return;
    }

    if (!personSelect.value || !startInput.value || !endInput.value) {
        roomInfo.innerText = "";
        return;
    }

    const conflicts = await fetchGuestroomConflicts(
        personSelect.value,
        roomSelect.value || null,
        startInput.value,
        endInput.value,
    );
    roomInfo.innerText = formatGuestroomConflictMessage(conflicts);
}

async function saveGuestroomBooking() {
    const personSelect = getElement("guestroom-person-select");
    const roomSelect = getElement("guestroom-room-select");
    const guestInput = getElement("guestroom-guest");
    const startInput = getElement("guestroom-start");
    const endInput = getElement("guestroom-end");
    const status = getElement("guestroom-add-status");
    if (!personSelect || !roomSelect || !guestInput || !startInput || !endInput || !status) {
        return;
    }
    const personId = personSelect.value;
    const guestRoomId = roomSelect.value;
    const guestName = guestInput.value.trim();
    const startAt = roundDateTimeLocalValueToStep(startInput.value, 30);
    const endAt = roundDateTimeLocalValueToStep(endInput.value, 30);
    status.innerText = "";

    startInput.value = startAt;
    endInput.value = endAt;

    if (!personId || !guestName || !startAt || !endAt) {
        status.innerText = "Bitte alle Felder ausfüllen.";
        return;
    }

    const conflicts = await fetchGuestroomConflicts(personId, guestRoomId || null, startAt, endAt);

    const response = await apiFetch(
        editingGuestroomBookingId ? `/api/guestroom/${editingGuestroomBookingId}` : "/api/guestroom",
        {
            method: editingGuestroomBookingId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                person_id: Number(personId),
                guest_room_id: guestRoomId ? Number(guestRoomId) : null,
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
    const conflictMessage = formatGuestroomConflictMessage(conflicts);
    resetGuestroomForm();
    await showGuestroomList();
    if (conflictMessage) {
        window.alert(conflictMessage);
    }
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

async function loadGuestroomBookings(resetToUpcoming = false) {
    const status = getElement("guestroom-list-status");
    const tableBody = getOptionalElement("#guestroom-table tbody");
    const prevButton = getElement("guestroom-prev-button");
    const nextButton = getElement("guestroom-next-button");
    const mineToggle = getElement("guestroom-mine-toggle");
    if (!status || !tableBody || !prevButton || !nextButton) {
        return;
    }
    status.innerText = "";
    tableBody.innerHTML = "";

    const response = await apiFetch("/api/guestroom");
    if (!response.ok) {
        status.innerText = "Gästebuchungen konnten nicht geladen werden.";
        return;
    }

    const today = formatDate(new Date());
    const selectedPersonId = getSelectedPersonId();
    currentGuestroomListEntries = (await response.json())
        .filter((entry) => !(mineToggle?.checked && selectedPersonId) || String(entry.person_id) === String(selectedPersonId))
        .sort((left, right) => {
            if (left.start_at !== right.start_at) {
                return left.start_at.localeCompare(right.start_at);
            }
            return left.id - right.id;
        });

    if (resetToUpcoming) {
        const firstUpcomingIndex = currentGuestroomListEntries.findIndex((entry) => String(entry.end_at).slice(0, 10) >= today);
        if (firstUpcomingIndex >= 0) {
            currentGuestroomOffset = firstUpcomingIndex;
        } else {
            currentGuestroomOffset = currentGuestroomListEntries.length;
        }
    }

    if (
        currentGuestroomOffset >= currentGuestroomListEntries.length
        && currentGuestroomOffset > 0
        && !(resetToUpcoming && !currentGuestroomListEntries.some((entry) => String(entry.end_at).slice(0, 10) >= today))
    ) {
        currentGuestroomOffset = Math.max(0, currentGuestroomOffset - 10);
    }

    currentGuestroomBookings = currentGuestroomListEntries.slice(currentGuestroomOffset, currentGuestroomOffset + 10);
    prevButton.disabled = currentGuestroomOffset === 0;
    nextButton.disabled = currentGuestroomOffset + 10 >= currentGuestroomListEntries.length;
    if (!currentGuestroomBookings.length) {
        status.innerText = mineToggle?.checked
            ? "Keine Buchungen ab heute für die aktuelle Person."
            : "Keine Buchungen ab heute.";
        return;
    }

    currentGuestroomBookings.forEach((booking) => {
        const row = document.createElement("tr");
        const durationNights = getDurationNights(booking.start_at, booking.end_at);
        row.innerHTML = `
            <td>${booking.guest_name}</td>
            <td>${formatGuestroomListDateTime(booking.start_at)}</td>
            <td>${formatGuestroomListDateTime(booking.end_at)}</td>
            <td>${durationNights} ${durationNights === 1 ? "Nacht" : "Nächte"}</td>
            <td>${formatGuestroomRoomLabel(booking.room_name, booking.responsible_name)}</td>
            <td>${booking.responsible_name}</td>
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

    showFoodSummary();
}

function initOverviewPage() {
    const overviewCalendar = getElement("overview-calendar");
    const overviewRangeLabel = getElement("overview-range-label");
    const overviewWeekButton = getElement("overview-week-button");
    const overviewMonthButton = getElement("overview-month-button");
    if (!overviewCalendar || !overviewRangeLabel || !overviewWeekButton || !overviewMonthButton) {
        return;
    }
    resetOverviewFilters();
    renderOverviewCalendar();
}

function initChoresPage() {
    const choresSection = getElement("chores");
    const choresManage = getElement("chores-manage");
    const choresOverview = getElement("chores-overview");
    const mineToggle = getElement("chores-mine-toggle");
    if (!choresSection || !choresManage || !choresOverview) {
        return;
    }
    if (mineToggle) {
        mineToggle.checked = true;
    }
    setElementDisplay("chores-manage", "none");
    setElementDisplay("chores-overview", "block");
    if (getHouseToken()) {
        loadChores();
    }
}

function initFeedbackPage() {
    const feedbackSection = getElement("feedback");
    const feedbackAdd = getElement("feedback-add");
    const feedbackList = getElement("feedback-list");
    if (!feedbackSection || !feedbackAdd || !feedbackList) {
        return;
    }
    setElementDisplay("feedback-add", "block");
    setElementDisplay("feedback-list", "none");
    setFeedbackFilter("all");
}

function initHomePage() {
    const homeSection = getElement("home");
    if (!homeSection) {
        return;
    }
    setAuthVisibility(false);
    renderPeople();
    renderGuestRooms();
    renderChoresList();
    renderChoreAssignments();
    renderChoresOverview();
    renderDefectsList();
    renderFeedbackList();
    updatePersonFormUi();
    updateGuestRoomFormUi();
    updateChoreFormUi();
    syncPersonSelectors();
    showSection(getHouseToken() ? getActiveSection() : "home");
}

function initGuestroomPage() {
    const guestroomSection = getElement("guestroom");
    const guestroomAdd = getElement("guestroom-add");
    const guestroomList = getElement("guestroom-list");
    if (!guestroomSection || !guestroomAdd || !guestroomList) {
        return;
    }
    const personSelect = getElement("guestroom-person-select");
    const roomSelect = getElement("guestroom-room-select");
    const startInput = getElement("guestroom-start");
    const endInput = getElement("guestroom-end");
    personSelect?.addEventListener("change", () => {
        renderGuestroomRoomOptions();
        refreshGuestroomRoomInfo();
    });
    roomSelect?.addEventListener("change", refreshGuestroomRoomInfo);
    startInput?.addEventListener("change", refreshGuestroomRoomInfo);
    endInput?.addEventListener("change", refreshGuestroomRoomInfo);
    showGuestroomAdd();
}

document.addEventListener("DOMContentLoaded", async () => {
    document.addEventListener("click", (event) => {
        if (!event.target.closest(".nav-dropdown")) {
            closeNavDropdown();
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeNavDropdown();
        }
    });

    initHomePage();
    initLaundryPage();
    initFoodPage();
    initOverviewPage();
    initGuestroomPage();
    initChoresPage();
    initFeedbackPage();

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
