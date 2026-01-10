// DDT Mixing Log JavaScript
// Handles form initialization, validation, saving, and history/trends views

let ddtTargets = {};
let currentDate = null;
let currentMixingLog = null;

// Initialize when tab is shown
document.addEventListener('DOMContentLoaded', function() {
    // Load DDT targets once on page load
    loadDDTTargets();
});

// Called when mixing log tab is clicked
function initializeMixingLog() {
    const mepDate = document.getElementById('mep-date').value;
    if (!mepDate) {
        showMixingLogError('Please select a date first');
        return;
    }

    currentDate = mepDate;
    loadMixingLog(mepDate);
}

async function loadDDTTargets() {
    try {
        const response = await fetch('/api/ddt-targets');
        const data = await response.json();

        // Store targets in a map for easy lookup
        data.targets.forEach(target => {
            ddtTargets[target.bread_name] = target;
        });
    } catch (error) {
        console.error('Error loading DDT targets:', error);
    }
}

async function loadMixingLog(date) {
    try {
        // Try to load existing mixing log
        const response = await fetch(`/api/mixing-log/${date}`);

        if (response.ok) {
            // Mixing log exists, display it
            const data = await response.json();
            currentMixingLog = data;
            displayMixingLogForm(data);
        } else if (response.status === 404) {
            // No mixing log exists, load breads for auto-population
            await loadBreadsForDate(date);
        } else {
            throw new Error('Failed to load mixing log');
        }
    } catch (error) {
        console.error('Error:', error);
        showMixingLogError('Failed to load mixing log');
    }
}

async function loadBreadsForDate(date) {
    try {
        const response = await fetch(`/api/mixing-log/breads/${date}`);

        if (!response.ok) {
            if (response.status === 404) {
                showMixingLogError('No production run found for this date');
            } else {
                throw new Error('Failed to load breads');
            }
            return;
        }

        const data = await response.json();

        // Create empty mixing log with breads
        currentMixingLog = {
            date: data.date,
            mix_date: data.mix_date,
            batch_id: data.batch_id,
            mixer_initials: '',
            notes: '',
            entries: data.breads.map((bread, index) => ({
                bread_name: bread.bread_name,
                recipe_id: bread.recipe_id,
                batch_size: bread.batch_weight,
                quantity: bread.quantity,
                room_temp: null,
                flour_temp: null,
                preferment_temp: null,
                friction_factor: 24,
                water_temp: null,
                final_dough_temp: null,
                bulk_fermentation_notes: '',
                fold_schedule: '',
                portioning_notes: '',
                batch_notes: '',
                ddt_target: bread.ddt_target,
                order: index
            }))
        };

        displayMixingLogForm(currentMixingLog);
    } catch (error) {
        console.error('Error:', error);
        showMixingLogError('Failed to load breads for date');
    }
}

function displayMixingLogForm(mixingLog) {
    const container = document.getElementById('mixing-log-content');

    let html = `
        <div class="mixing-log-form">
            <div class="mixing-log-header">
                <div class="form-row">
                    <div class="form-group">
                        <label for="mixing-date">Date:</label>
                        <input type="date" id="mixing-date" class="form-control" value="${mixingLog.date}" readonly>
                    </div>
                    <div class="form-group">
                        <label for="mixer-initials">Mixer Initials:</label>
                        <input type="text" id="mixer-initials" class="form-control"
                               value="${mixingLog.mixer_initials || ''}"
                               maxlength="10" required
                               placeholder="e.g., JS">
                    </div>
                </div>
                <div class="form-group">
                    <label for="mixing-notes">Notes (optional):</label>
                    <textarea id="mixing-notes" class="form-control" rows="2"
                              placeholder="Any notes about today's mixing session...">${mixingLog.notes || ''}</textarea>
                </div>
            </div>

            <h3 style="margin-top: 2rem;">Bread Entries</h3>
            <div id="bread-entries">
    `;

    // Display each bread entry
    mixingLog.entries.forEach((entry, index) => {
        html += renderBreadEntry(entry, index);
    });

    html += `
            </div>

            <div class="form-actions" style="margin-top: 2rem;">
                <button onclick="saveMixingLog()" class="btn btn-primary">Save Mixing Log</button>
                <button onclick="showHistoryView()" class="btn btn-secondary">View History</button>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function renderBreadEntry(entry, index) {
    const target = entry.ddt_target || ddtTargets[entry.bread_name];
    const targetRange = target ? `${target.min}-${target.max}°F` : 'No target set';

    // Parse bulk fermentation start time if it exists
    const bulkStartTime = entry.bulk_fermentation_notes || '';

    // Parse fold schedule into individual times
    const foldTimes = parseFoldSchedule(entry.fold_schedule || '');

    return `
        <div class="bread-entry-card" data-index="${index}">
            <h4>${entry.bread_name}</h4>
            <p style="color: #7f8c8d; margin: 0 0 1rem 0;">
                ${entry.quantity} loaves | ${entry.batch_size}g batch
                ${target ? ` | Target DDT: ${targetRange}` : ''}
            </p>

            <div class="temp-grid">
                <div class="temp-input-group">
                    <label>Room Temp (°F):</label>
                    <input type="number" step="0.1" class="temp-input"
                           data-index="${index}" data-field="room_temp"
                           data-bread="${entry.bread_name}"
                           value="${entry.room_temp || ''}"
                           placeholder="e.g., 68.5"
                           oninput="calculateWaterTemp(${index})">
                </div>

                <div class="temp-input-group">
                    <label>Flour Temp (°F):</label>
                    <input type="number" step="0.1" class="temp-input"
                           data-index="${index}" data-field="flour_temp"
                           data-bread="${entry.bread_name}"
                           value="${entry.flour_temp || ''}"
                           placeholder="e.g., 70.0"
                           oninput="calculateWaterTemp(${index})">
                </div>

                <div class="temp-input-group">
                    <label>Pre-ferment Temp (°F):</label>
                    <input type="number" step="0.1" class="temp-input"
                           data-index="${index}" data-field="preferment_temp"
                           data-bread="${entry.bread_name}"
                           value="${entry.preferment_temp || ''}"
                           placeholder="e.g., 72.0"
                           oninput="calculateWaterTemp(${index})">
                </div>

                <div class="temp-input-group">
                    <label>Friction Factor (°F):</label>
                    <input type="number" step="0.1" class="temp-input"
                           data-index="${index}" data-field="friction_factor"
                           value="24"
                           placeholder="e.g., 24"
                           oninput="calculateWaterTemp(${index})">
                    <small class="target-range">Heat from mixing (typically 20-30°F)</small>
                </div>

                <div class="temp-input-group">
                    <label>Water Temp (°F):</label>
                    <div class="temp-input-with-indicator">
                        <input type="number" step="0.1" class="temp-input water-temp-input"
                               data-index="${index}" data-field="water_temp"
                               value="${entry.water_temp || ''}"
                               placeholder="Auto-calculated">
                        <span class="temp-indicator" id="water-temp-indicator-${index}">🔢</span>
                    </div>
                    <small class="target-range auto-calc-note">Auto-calculated (editable)</small>
                </div>

                <div class="temp-input-group">
                    <label>Final Dough Temp (°F):</label>
                    <div class="temp-input-with-indicator">
                        <input type="number" step="0.1" class="temp-input final-temp-input"
                               data-index="${index}" data-field="final_dough_temp"
                               data-bread="${entry.bread_name}"
                               value="${entry.final_dough_temp || ''}"
                               placeholder="e.g., 72.0"
                               oninput="validateTemperature(this)">
                        <span class="temp-indicator" id="temp-indicator-${index}"></span>
                    </div>
                    ${target ? `<small class="target-range">(Target: ${targetRange})</small>` : ''}
                </div>
            </div>

            <div class="process-notes-section">
                <div class="form-group">
                    <label>Bulk Fermentation Start Time:</label>
                    <input type="time" class="form-control time-input"
                           data-index="${index}" data-field="bulk_start_time"
                           value="${bulkStartTime}"
                           placeholder="e.g., 09:30">
                    <small class="target-range">When bulk fermentation begins (ends with last fold)</small>
                </div>

                <div class="form-group">
                    <label>Fold Schedule:</label>
                    <div id="fold-schedule-${index}" class="fold-schedule-container">
                        ${renderFoldTimes(foldTimes, index)}
                    </div>
                    <button type="button" onclick="addFoldTime(${index})" class="btn btn-secondary btn-sm" style="margin-top: 0.5rem;">+ Add Fold</button>
                </div>

                <div class="form-group">
                    <label>Portioning/Refrigeration:</label>
                    <textarea class="form-control process-notes" rows="2"
                              data-index="${index}" data-field="portioning_notes"
                              placeholder="e.g., Shaped and refrigerated at 4pm">${entry.portioning_notes || ''}</textarea>
                </div>

                <div class="form-group">
                    <label>Batch Notes/Issues:</label>
                    <textarea class="form-control process-notes" rows="2"
                              data-index="${index}" data-field="batch_notes"
                              placeholder="e.g., Dough felt dry, added 50g water; Oven temp dropped to 420F">${entry.batch_notes || ''}</textarea>
                    <small class="target-range">Note any adjustments, issues, or observations for this batch</small>
                </div>
            </div>
        </div>
    `;
}

function parseFoldSchedule(foldSchedule) {
    // Parse "Fold 1 10:15am; Fold 2 11:00am; Fold 3 11:45am" format
    if (!foldSchedule) return [];

    const foldTimes = [];
    const parts = foldSchedule.split(';');

    for (const part of parts) {
        const match = part.match(/Fold\s+\d+\s+(\d{1,2}):(\d{2})\s*(am|pm)/i);
        if (match) {
            let hours = parseInt(match[1]);
            const minutes = match[2];
            const meridiem = match[3].toLowerCase();

            // Convert to 24-hour format for time input
            if (meridiem === 'pm' && hours !== 12) {
                hours += 12;
            } else if (meridiem === 'am' && hours === 12) {
                hours = 0;
            }

            const timeValue = `${hours.toString().padStart(2, '0')}:${minutes}`;
            foldTimes.push(timeValue);
        }
    }

    return foldTimes;
}

function renderFoldTimes(foldTimes, breadIndex) {
    if (foldTimes.length === 0) {
        // Start with one empty fold time
        foldTimes = [''];
    }

    let html = '';
    foldTimes.forEach((time, foldIndex) => {
        html += `
            <div class="fold-time-entry" data-fold-index="${foldIndex}">
                <label>Fold ${foldIndex + 1}:</label>
                <input type="time" class="form-control time-input fold-time-input"
                       data-bread-index="${breadIndex}" data-fold-index="${foldIndex}"
                       value="${time}"
                       placeholder="e.g., 10:15">
                ${foldTimes.length > 1 ? `<button type="button" onclick="removeFoldTime(${breadIndex}, ${foldIndex})" class="btn-remove-fold">×</button>` : ''}
            </div>
        `;
    });

    return html;
}

function addFoldTime(breadIndex) {
    const container = document.getElementById(`fold-schedule-${breadIndex}`);
    const currentFolds = container.querySelectorAll('.fold-time-entry').length;

    const newFoldHtml = `
        <div class="fold-time-entry" data-fold-index="${currentFolds}">
            <label>Fold ${currentFolds + 1}:</label>
            <input type="time" class="form-control time-input fold-time-input"
                   data-bread-index="${breadIndex}" data-fold-index="${currentFolds}"
                   value=""
                   placeholder="e.g., 10:15">
            <button type="button" onclick="removeFoldTime(${breadIndex}, ${currentFolds})" class="btn-remove-fold">×</button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', newFoldHtml);
}

function removeFoldTime(breadIndex, foldIndex) {
    const container = document.getElementById(`fold-schedule-${breadIndex}`);
    const foldEntry = container.querySelector(`[data-fold-index="${foldIndex}"]`);

    if (foldEntry) {
        foldEntry.remove();

        // Renumber remaining folds
        const remainingFolds = container.querySelectorAll('.fold-time-entry');
        remainingFolds.forEach((fold, newIndex) => {
            fold.setAttribute('data-fold-index', newIndex);
            fold.querySelector('label').textContent = `Fold ${newIndex + 1}:`;
            fold.querySelector('input').setAttribute('data-fold-index', newIndex);
        });
    }
}

function formatTime12Hour(time24) {
    // Convert "14:30" to "2:30pm"
    if (!time24) return '';

    const [hours, minutes] = time24.split(':');
    let hour = parseInt(hours);
    const meridiem = hour >= 12 ? 'pm' : 'am';

    if (hour > 12) {
        hour -= 12;
    } else if (hour === 0) {
        hour = 12;
    }

    return `${hour}:${minutes}${meridiem}`;
}

function calculateWaterTemp(index) {
    const card = document.querySelector(`.bread-entry-card[data-index="${index}"]`);

    // Get bread name to find DDT target
    const breadName = currentMixingLog.entries[index].bread_name;
    const target = ddtTargets[breadName];

    if (!target) {
        return; // Can't calculate without target DDT
    }

    // Get target DDT (use middle of range)
    const targetDDT = (target.target_temp_min + target.target_temp_max) / 2;

    // Get input temperatures
    const roomTemp = parseFloat(card.querySelector('[data-field="room_temp"]').value) || 0;
    const flourTemp = parseFloat(card.querySelector('[data-field="flour_temp"]').value) || 0;
    const prefermentTemp = parseFloat(card.querySelector('[data-field="preferment_temp"]').value) || 0;
    const frictionFactor = parseFloat(card.querySelector('[data-field="friction_factor"]').value) || 0;

    // Only calculate if we have at least some input values
    if (roomTemp === 0 && flourTemp === 0 && prefermentTemp === 0) {
        return; // Don't calculate with all zeros
    }

    // DDT Formula: Target DDT = (Room + Flour + Preferment + Water + Friction) / 5
    // Solving for Water: Water = (Target DDT × 5) - Room - Flour - Preferment - Friction
    const calculatedWaterTemp = (targetDDT * 5) - roomTemp - flourTemp - prefermentTemp - frictionFactor;

    // Update water temp field
    const waterTempInput = card.querySelector('[data-field="water_temp"]');
    waterTempInput.value = calculatedWaterTemp.toFixed(1);

    // Update indicator to show it's calculated
    const indicator = document.getElementById(`water-temp-indicator-${index}`);
    indicator.innerHTML = '<span style="color: #3498db;">🔢</span>';
    indicator.title = 'Auto-calculated';
}

function validateTemperature(input) {
    const index = input.dataset.index;
    const breadName = input.dataset.bread;
    const value = parseFloat(input.value);
    const indicator = document.getElementById(`temp-indicator-${index}`);

    if (!value || isNaN(value)) {
        indicator.innerHTML = '';
        input.classList.remove('temp-success', 'temp-warning');
        return;
    }

    const target = ddtTargets[breadName];
    if (!target) {
        indicator.innerHTML = '<span style="color: #95a5a6;">-</span>';
        input.classList.remove('temp-success', 'temp-warning');
        return;
    }

    const inRange = value >= target.target_temp_min && value <= target.target_temp_max;

    if (inRange) {
        indicator.innerHTML = '<span style="color: #2ecc71; font-weight: bold;">✓</span>';
        input.classList.add('temp-success');
        input.classList.remove('temp-warning');
    } else {
        indicator.innerHTML = '<span style="color: #f39c12; font-weight: bold;">⚠</span>';
        input.classList.add('temp-warning');
        input.classList.remove('temp-success');
    }
}

async function saveMixingLog() {
    const date = document.getElementById('mixing-date').value;
    const initials = document.getElementById('mixer-initials').value.trim();
    const notes = document.getElementById('mixing-notes').value.trim();

    // Validate
    if (!initials) {
        showMixingLogError('Mixer initials are required');
        return;
    }

    // Collect entries
    const entries = currentMixingLog.entries.map((entry, index) => {
        const card = document.querySelector(`.bread-entry-card[data-index="${index}"]`);

        // Collect bulk fermentation start time
        const bulkStartTime = card.querySelector('[data-field="bulk_start_time"]').value;

        // Collect and format fold times
        const foldContainer = document.getElementById(`fold-schedule-${index}`);
        const foldInputs = foldContainer.querySelectorAll('.fold-time-input');
        const foldTimes = [];

        foldInputs.forEach((input, foldIndex) => {
            const timeValue = input.value;
            if (timeValue) {
                const formatted = formatTime12Hour(timeValue);
                foldTimes.push(`Fold ${foldIndex + 1} ${formatted}`);
            }
        });

        const foldSchedule = foldTimes.join('; ');

        return {
            bread_name: entry.bread_name,
            recipe_id: entry.recipe_id,
            batch_size: entry.batch_size,
            quantity: entry.quantity,
            room_temp: parseFloat(card.querySelector('[data-field="room_temp"]').value) || null,
            flour_temp: parseFloat(card.querySelector('[data-field="flour_temp"]').value) || null,
            preferment_temp: parseFloat(card.querySelector('[data-field="preferment_temp"]').value) || null,
            friction_factor: parseFloat(card.querySelector('[data-field="friction_factor"]').value) || null,
            water_temp: parseFloat(card.querySelector('[data-field="water_temp"]').value) || null,
            final_dough_temp: parseFloat(card.querySelector('[data-field="final_dough_temp"]').value) || null,
            bulk_fermentation_notes: bulkStartTime,
            fold_schedule: foldSchedule,
            portioning_notes: card.querySelector('[data-field="portioning_notes"]').value.trim(),
            batch_notes: card.querySelector('[data-field="batch_notes"]').value.trim()
        };
    });

    try {
        const response = await fetch('/api/mixing-log/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                date: date,
                mixer_initials: initials,
                notes: notes,
                entries: entries
            })
        });

        const result = await response.json();

        if (result.success) {
            showMixingLogSuccess('Mixing log saved successfully!');

            // Show warnings if any
            if (result.warnings && result.warnings.length > 0) {
                const outOfRange = result.warnings.filter(w => !w.in_range);
                if (outOfRange.length > 0) {
                    showMixingLogWarning(`Note: ${outOfRange.length} temperature(s) outside target range`);
                }
            }

            // Reload to show saved data
            setTimeout(() => loadMixingLog(date), 1000);
        } else {
            showMixingLogError(result.error || 'Failed to save mixing log');
        }
    } catch (error) {
        console.error('Error:', error);
        showMixingLogError('Failed to save mixing log');
    }
}

function showHistoryView() {
    const container = document.getElementById('mixing-log-content');

    let html = `
        <div class="history-view">
            <div class="history-controls">
                <button onclick="initializeMixingLog()" class="btn btn-secondary">← Back to Form</button>
                <h3>Mixing Log History</h3>
            </div>

            <div class="history-filters">
                <div class="form-row">
                    <div class="form-group">
                        <label>Start Date:</label>
                        <input type="date" id="history-start-date" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>End Date:</label>
                        <input type="date" id="history-end-date" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Bread Type:</label>
                        <select id="history-bread-filter" class="form-control">
                            <option value="">All Breads</option>
                        </select>
                    </div>
                    <div class="form-group" style="align-self: flex-end;">
                        <button onclick="loadHistory()" class="btn btn-primary">Search</button>
                    </div>
                </div>
            </div>

            <div id="history-results">
                <p class="placeholder-text">Select date range and click Search</p>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Populate bread filter
    const breadFilter = document.getElementById('history-bread-filter');
    Object.keys(ddtTargets).forEach(breadName => {
        const option = document.createElement('option');
        option.value = breadName;
        option.textContent = breadName;
        breadFilter.appendChild(option);
    });

    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    document.getElementById('history-end-date').value = endDate.toISOString().split('T')[0];
    document.getElementById('history-start-date').value = startDate.toISOString().split('T')[0];
}

async function loadHistory() {
    const startDate = document.getElementById('history-start-date').value;
    const endDate = document.getElementById('history-end-date').value;
    const breadName = document.getElementById('history-bread-filter').value;

    let url = `/api/mixing-log/history?start_date=${startDate}&end_date=${endDate}`;
    if (breadName) {
        url += `&bread_name=${breadName}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();

        displayHistoryResults(data.logs);
    } catch (error) {
        console.error('Error:', error);
        showMixingLogError('Failed to load history');
    }
}

function displayHistoryResults(logs) {
    const container = document.getElementById('history-results');

    if (!logs || logs.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No mixing logs found for selected criteria</p>';
        return;
    }

    let html = '<div class="history-list">';

    logs.forEach(log => {
        const warningIndicator = log.has_warnings ? '<span style="color: #f39c12;">⚠</span>' : '';

        html += `
            <div class="history-item">
                <div class="history-item-header">
                    <h4>${log.date} - Batch ${log.batch_id} ${warningIndicator}</h4>
                    <span class="mixer-initials">by ${log.mixer_initials}</span>
                </div>
                <div class="history-item-details">
                    <p><strong>Breads:</strong> ${log.breads_mixed.join(', ')}</p>
                    <p><strong>Entries:</strong> ${log.entry_count} |
                       <strong>Avg Final Temp:</strong> ${log.avg_final_temp ? log.avg_final_temp + '°F' : 'N/A'}</p>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function showMixingLogError(message) {
    const container = document.getElementById('mixing-log-content');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.textContent = message;
    errorDiv.style.marginBottom = '1rem';

    container.insertBefore(errorDiv, container.firstChild);

    setTimeout(() => errorDiv.remove(), 5000);
}

function showMixingLogSuccess(message) {
    const container = document.getElementById('mixing-log-content');
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.style.background = '#d4edda';
    successDiv.style.borderColor = '#c3e6cb';
    successDiv.style.color = '#155724';
    successDiv.textContent = message;
    successDiv.style.marginBottom = '1rem';

    container.insertBefore(successDiv, container.firstChild);

    setTimeout(() => successDiv.remove(), 3000);
}

function showMixingLogWarning(message) {
    const container = document.getElementById('mixing-log-content');
    const warningDiv = document.createElement('div');
    warningDiv.className = 'alert alert-warning';
    warningDiv.style.background = '#fff3cd';
    warningDiv.style.borderColor = '#ffc107';
    warningDiv.style.color = '#856404';
    warningDiv.textContent = message;
    warningDiv.style.marginBottom = '1rem';

    container.insertBefore(warningDiv, container.firstChild);

    setTimeout(() => warningDiv.remove(), 5000);
}
