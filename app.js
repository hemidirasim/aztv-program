// API
const API_BASE = '/api';
const LIST_URL = `${API_BASE}/list`;
const CREATE_URL = `${API_BASE}/create`;

// Channel names
const channelNames = { "1": "AzTV", "2": "İdman", "3": "Mədəniyyət" };

// State
let selectedChannelId = 1;
let programs = [];
// editingDayIndex and editingItemIndex are declared in editProgram function

// DOM
const channelTabs = document.querySelectorAll('.channel-tab');
const channelTitle = document.getElementById('channelTitle');
const programList = document.getElementById('programList');
const addProgramBtn = document.getElementById('addProgramBtn');
const refreshBtn = document.getElementById('refreshBtn');
const modal = document.getElementById('programModal');
const modalTitle = document.getElementById('modalTitle');
const programForm = document.getElementById('programForm');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const toast = document.getElementById('toast');

// Inputs
const inputDate = document.getElementById('inputDate');
const inputStartTime = document.getElementById('inputStartTime');
const inputEndTime = document.getElementById('inputEndTime');
const inputTitle = document.getElementById('inputTitle');
const inputDescription = document.getElementById('inputDescription');

// Init
document.addEventListener('DOMContentLoaded', () => {
    inputDate.value = new Date().toISOString().split('T')[0];
    
    channelTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            channelTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            selectedChannelId = parseInt(tab.dataset.channel);
            channelTitle.textContent = `${channelNames[selectedChannelId]} - Proqram Cədvəli`;
            loadPrograms();
        });
    });
    
    addProgramBtn.addEventListener('click', openAddModal);
    refreshBtn.addEventListener('click', loadPrograms);
    closeModal.addEventListener('click', hideModal);
    cancelBtn.addEventListener('click', hideModal);
    programForm.addEventListener('submit', saveProgram);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });
    
    loadPrograms();
});

// Load programs from API
async function loadPrograms() {
    programList.innerHTML = '<div class="loading">Yüklənir...</div>';
    
    try {
        const res = await fetch(LIST_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId: selectedChannelId })
        });
        
        const data = await res.json();
        
        // Handle "Channel ID not found" - just show empty list
        if (data.message && data.message.includes('not found')) {
            programs = [];
            renderPrograms();
            return;
        }
        
        programs = parsePrograms(data);
        renderPrograms();
    } catch (err) {
        programList.innerHTML = '<div class="empty">Xəta baş verdi</div>';
        showToast('Xəta: ' + err.message, true);
    }
}

// Parse API response - NEW structure with days
function parsePrograms(data) {
    try {
        if (data.programs) {
            let p = data.programs;
            if (typeof p === 'string') p = JSON.parse(p);
            // New structure: p.programs is array of days, each day has items
            if (p.programs && Array.isArray(p.programs)) {
                return p.programs; // Return array of days
            }
            if (Array.isArray(p)) return p;
        }
    } catch (e) {
        console.error('Parse error:', e);
    }
    return [];
}

// Render programs - NEW structure (days with items)
function renderPrograms() {
    if (programs.length === 0) {
        programList.innerHTML = '<div class="empty">Proqram yoxdur</div>';
        return;
    }
    
    // Sort days by date
    const sortedDays = [...programs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    
    let html = '';
    sortedDays.forEach((day, dayIndex) => {
        const dayTitle = day.title || getDayName(day.date);
        const formattedDate = formatDate(day.date);
        
        // Date header (clickable to edit)
        html += `<div class="date-header" onclick="editDateGroup(${dayIndex})" title="Klikləyin tarixi dəyişmək üçün">
            <span class="date-day">${dayTitle}</span>
            <span class="date-full">${formattedDate}</span>
            <span class="date-edit-icon">✏️</span>
        </div>`;
        
        // Programs for this day (items array)
        const items = day.items || [];
        const sortedItems = [...items].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
        
        sortedItems.forEach((item, itemIndex) => {
            html += `
                <div class="program-item" draggable="true" data-day="${dayIndex}" data-item="${itemIndex}">
                    <div class="drag-handle">⋮⋮</div>
                    <div class="program-time">${item.start_time || '--:--'} - ${item.end_time || '--:--'}</div>
                    <div class="program-info">
                        <div class="program-title">${item.name || 'Adsız'}</div>
                        ${item.description ? `<div class="program-desc">${item.description}</div>` : ''}
                    </div>
                    <div class="program-actions">
                        <button class="btn-edit" onclick="editProgram(${dayIndex}, ${itemIndex})" title="Redaktə">✏️</button>
                        <button class="btn-delete" onclick="deleteProgram(${dayIndex}, ${itemIndex})" title="Sil">🗑️</button>
                    </div>
                </div>
            `;
        });
    });
    
    programList.innerHTML = html;
    
    // Add drag and drop listeners
    setupDragAndDrop();
}

// Drag and Drop
let draggedIndex = null;

function setupDragAndDrop() {
    const items = programList.querySelectorAll('.program-item');
    
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    programList.querySelectorAll('.program-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    const targetIndex = parseInt(this.dataset.index);
    
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
        // Reorder programs
        const draggedProgram = programs[draggedIndex];
        programs.splice(draggedIndex, 1);
        programs.splice(targetIndex, 0, draggedProgram);
        
        renderPrograms();
        const saved = await saveToAPI();
        if (saved) {
            showToast('✅ Sıralama dəyişdirildi və saxlanıldı');
        }
    }
    
    draggedIndex = null;
}

// Format date
function formatDate(d) {
    if (!d) return '--';
    const date = new Date(d);
    return date.toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Get day name in Azerbaijani
function getDayName(d) {
    if (!d) return '';
    const date = new Date(d);
    const days = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];
    return days[date.getDay()];
}

// Open modal for adding
function openAddModal() {
    editingDayIndex = -1;
    editingItemIndex = -1;
    modalTitle.textContent = 'Yeni Proqram';
    inputDate.value = new Date().toISOString().split('T')[0];
    inputStartTime.value = '08:00';
    inputEndTime.value = '09:00';
    inputTitle.value = '';
    inputDescription.value = '';
    modal.classList.add('show');
}

// Edit program
// Track editing position
let editingDayIndex = -1;
let editingItemIndex = -1;

function editProgram(dayIndex, itemIndex) {
    editingDayIndex = dayIndex;
    editingItemIndex = itemIndex;
    const day = programs[dayIndex];
    const item = day.items[itemIndex];
    modalTitle.textContent = 'Proqramı Redaktə Et';
    inputDate.value = day.date || '';
    inputStartTime.value = item.start_time || '08:00';
    inputEndTime.value = item.end_time || '09:00';
    inputTitle.value = item.name || '';
    inputDescription.value = item.description || '';
    modal.classList.add('show');
}

// Date Edit Modal elements
const dateModal = document.getElementById('dateModal');
const dateModalTitle = document.getElementById('dateModalTitle');
const inputNewDate = document.getElementById('inputNewDate');
const closeDateModal = document.getElementById('closeDateModal');
const cancelDateBtn = document.getElementById('cancelDateBtn');
const saveDateBtn = document.getElementById('saveDateBtn');

let editingOldDate = null;

// Setup date modal events
closeDateModal.addEventListener('click', hideDateModal);
cancelDateBtn.addEventListener('click', hideDateModal);
saveDateBtn.addEventListener('click', saveDateChange);
dateModal.addEventListener('click', (e) => {
    if (e.target === dateModal) hideDateModal();
});

function hideDateModal() {
    dateModal.classList.remove('show');
    editingOldDate = null;
}

// Edit all programs for a specific date
function editDateGroup(dayIndex) {
    editingDayIndex = dayIndex;
    const day = programs[dayIndex];
    editingOldDate = day.date;
    dateModalTitle.textContent = `${day.title} - ${formatDate(day.date)}`;
    inputNewDate.value = day.date;
    dateModal.classList.add('show');
}

async function saveDateChange() {
    const newDate = inputNewDate.value;
    
    if (!newDate || newDate === editingOldDate) {
        hideDateModal();
        return;
    }
    
    // Update the day's date and title
    if (editingDayIndex >= 0 && programs[editingDayIndex]) {
        programs[editingDayIndex].date = newDate;
        programs[editingDayIndex].title = getDayName(newDate);
        
        hideDateModal();
        renderPrograms();
        
        const saved = await saveToAPI();
        if (saved) {
            showToast(`Tarix dəyişdirildi: ${formatDate(newDate)}`);
        }
    } else {
        hideDateModal();
    }
}

// Delete program
async function deleteProgram(dayIndex, itemIndex) {
    if (!confirm('Bu proqramı silmək istəyirsiniz?')) return;
    
    // Remove item from the day
    programs[dayIndex].items.splice(itemIndex, 1);
    
    // If day has no items left, remove the day too
    if (programs[dayIndex].items.length === 0) {
        programs.splice(dayIndex, 1);
    }
    
    renderPrograms();
    
    const saved = await saveToAPI();
    if (saved) {
        showToast('✅ Proqram silindi');
    }
}

// Hide modal
function hideModal() {
    modal.classList.remove('show');
}

// Save program - NEW structure
async function saveProgram(e) {
    e.preventDefault();
    
    // Validate
    const date = inputDate.value;
    const startTime = inputStartTime.value;
    const endTime = inputEndTime.value;
    const name = inputTitle.value.trim();
    const description = inputDescription.value.trim();
    
    if (!date) {
        showToast('Tarix seçin', true);
        return;
    }
    if (!name) {
        showToast('Proqram adı yazın', true);
        return;
    }
    
    const submitBtn = programForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Saxlanılır...';
    submitBtn.disabled = true;
    
    const item = {
        start_time: startTime || '00:00',
        end_time: endTime || '00:00',
        name: name,
        description: description || null
    };
    
    console.log('📝 Program item:', item);
    
    if (editingDayIndex >= 0 && editingItemIndex >= 0) {
        // Editing existing item
        const oldDate = programs[editingDayIndex].date;
        if (oldDate === date) {
            // Same day, just update item
            programs[editingDayIndex].items[editingItemIndex] = item;
        } else {
            // Moving to different day
            programs[editingDayIndex].items.splice(editingItemIndex, 1);
            if (programs[editingDayIndex].items.length === 0) {
                programs.splice(editingDayIndex, 1);
            }
            addItemToDay(date, item);
        }
    } else {
        // Adding new item
        addItemToDay(date, item);
    }
    
    renderPrograms();
    const saved = await saveToAPI();
    
    submitBtn.textContent = 'Yadda Saxla';
    submitBtn.disabled = false;
    hideModal();
    
    if (saved) {
        showToast(editingDayIndex >= 0 ? '✅ Proqram yeniləndi' : '✅ Proqram əlavə edildi');
    }
    
    // Reset editing state
    editingDayIndex = -1;
    editingItemIndex = -1;
}

// Helper: Add item to a day (create day if not exists)
function addItemToDay(date, item) {
    // Find existing day
    let dayIndex = programs.findIndex(d => d.date === date);
    
    if (dayIndex >= 0) {
        // Day exists, add item
        programs[dayIndex].items.push(item);
    } else {
        // Create new day
        const dayName = getDayName(date);
        programs.push({
            date: date,
            title: dayName,
            items: [item]
        });
    }
}

// Save to API - POST every change immediately - NEW structure
async function saveToAPI() {
    console.log('🔍 Raw programs (days):', JSON.stringify(programs, null, 2));
    
    // Clean and validate - NEW structure with days and items
    const cleanedDays = programs.map(day => {
        const cleanedItems = (day.items || []).map(item => ({
            start_time: item.start_time || "00:00",
            end_time: item.end_time || "00:00",
            name: item.name ? String(item.name).trim() : null,
            description: item.description ? String(item.description).trim() : null
        })).filter(item => item.name); // Remove items without name
        
        return {
            date: day.date,
            title: day.title || getDayName(day.date),
            items: cleanedItems
        };
    }).filter(day => day.date && day.items.length > 0); // Remove empty days
    
    console.log('🧹 Cleaned days:', JSON.stringify(cleanedDays, null, 2));
    
    if (cleanedDays.length === 0) {
        console.log('⚠️ No valid programs to save');
        showToast('Saxlamaq üçün etibarlı proqram yoxdur', true);
        return false;
    }
    
    // API format: channels object with NEW structure (days with items)
    const payload = {
        channels: {
            [selectedChannelId]: {
                name: channelNames[selectedChannelId],
                programs: cleanedDays
            }
        }
    };
    
    console.log('📤 POST to API:', CREATE_URL);
    console.log('📦 Full Payload:', JSON.stringify(payload));
    
    try {
        const res = await fetch(CREATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const responseText = await res.text();
        console.log('📥 Response:', res.status, responseText);
        
        if (!res.ok) {
            let errorMsg = 'Xəta';
            try {
                const errorData = JSON.parse(responseText);
                errorMsg = errorData.message || errorMsg;
            } catch(e) {}
            throw new Error(`HTTP ${res.status}: ${errorMsg}`);
        }
        
        console.log('✅ Saved to database successfully');
        return true;
    } catch (err) {
        console.error('❌ Save error:', err);
        showToast('Saxlama xətası: ' + err.message, true);
        return false;
    }
}

// Toast
function showToast(msg, isError = false) {
    toast.textContent = msg;
    toast.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
