// Production History JavaScript

let historyData = [];

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
    document.getElementById('end-date').value = endDate.toISOString().split('T')[0];

    // Load recipes for filter dropdown
    loadRecipes();

    // Auto-load initial data
    loadHistory();
});

async function loadRecipes() {
    try {
        const response = await fetch('/api/recipes');
        const recipes = await response.json();

        const select = document.getElementById('recipe-filter');
        recipes.forEach(recipe => {
            const option = document.createElement('option');
            option.value = recipe.name;
            option.textContent = recipe.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading recipes:', error);
    }
}

async function searchByBatchId() {
    const batchId = document.getElementById('batch-id-search').value.trim();

    if (!batchId) {
        showError('Please enter a batch ID');
        return;
    }

    if (batchId.length !== 6 || !/^\d{6}$/.test(batchId)) {
        showError('Batch ID must be 6 digits in MMDDYY format');
        return;
    }

    try {
        const response = await fetch(`/api/production/batch/${batchId}`);

        if (!response.ok) {
            if (response.status === 404) {
                showError(`No production run found for batch ID: ${batchId}`);
            } else {
                showError('Error searching for batch');
            }
            return;
        }

        const batch = await response.json();
        displayHistory([batch]);
        updateSummary([batch]);
        document.getElementById('error-message').style.display = 'none';

        // Show message that this is a single batch
        const container = document.getElementById('history-table-container');
        container.insertAdjacentHTML('afterbegin', `
            <div class="alert alert-info" style="margin-bottom: 1rem;">
                <strong>Showing Batch: <span class="batch-id-badge">${batchId}</span></strong>
                <a href="#" onclick="clearBatchSearch(); return false;" style="margin-left: 1rem;">Clear and show all</a>
            </div>
        `);

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to search for batch');
    }
}

function clearBatchSearch() {
    document.getElementById('batch-id-search').value = '';
    loadHistory();
}

async function loadHistory() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const recipeName = document.getElementById('recipe-filter').value;

    if (!startDate || !endDate) {
        showError('Please select both start and end dates');
        return;
    }

    // Build query string
    let url = `/api/production/history?start_date=${startDate}&end_date=${endDate}`;
    if (recipeName) {
        url += `&recipe_name=${encodeURIComponent(recipeName)}`;
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            showError('Error loading production history');
            return;
        }

        historyData = await response.json();
        displayHistory(historyData);
        updateSummary(historyData);
        document.getElementById('error-message').style.display = 'none';

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to load production history');
    }
}

function displayHistory(data) {
    const container = document.getElementById('history-table-container');

    if (data.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No production records found for the selected date range</p>';
        document.getElementById('summary-card').style.display = 'none';
        return;
    }

    let tableHTML = '<table class="history-table"><thead><tr><th>Batch ID</th><th>Date</th><th>Recipe</th><th>Quantity</th><th>Total Weight (g)</th><th>Created By</th></tr></thead><tbody>';

    data.forEach((run, runIndex) => {
        const date = new Date(run.date);
        const dateStr = date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const batchIdDisplay = run.batch_id ? `<span class="batch-id-badge">${run.batch_id}</span>` : 'N/A';

        if (run.items.length === 0) {
            tableHTML += `
                <tr class="recipe-row">
                    <td>${batchIdDisplay}</td>
                    <td><strong>${dateStr}</strong></td>
                    <td colspan="4"><em>No items recorded</em></td>
                </tr>
            `;
        } else {
            run.items.forEach((item, itemIndex) => {
                tableHTML += `
                    <tr class="recipe-row">
                        ${itemIndex === 0 ? `<td rowspan="${run.items.length}">${batchIdDisplay}</td>` : ''}
                        ${itemIndex === 0 ? `<td rowspan="${run.items.length}"><strong>${dateStr}</strong></td>` : ''}
                        <td>${item.recipe_name}</td>
                        <td>${item.quantity} loaves</td>
                        <td>${item.batch_weight.toLocaleString()}</td>
                        ${itemIndex === 0 ? `<td rowspan="${run.items.length}">${run.created_by || 'N/A'}</td>` : ''}
                    </tr>
                `;
            });
        }
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}

function updateSummary(data) {
    const summaryCard = document.getElementById('summary-card');
    summaryCard.style.display = 'block';

    let totalDays = data.length;
    let totalLoaves = 0;
    let totalWeight = 0;

    data.forEach(run => {
        run.items.forEach(item => {
            totalLoaves += item.quantity;
            totalWeight += item.batch_weight;
        });
    });

    document.getElementById('total-days').textContent = totalDays;
    document.getElementById('total-loaves').textContent = totalLoaves.toLocaleString();
    document.getElementById('total-weight').textContent = (totalWeight / 1000).toFixed(1);
}

function clearFilters() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
    document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
    document.getElementById('recipe-filter').value = '';

    loadHistory();
}

function exportCSV() {
    if (historyData.length === 0) {
        showError('No data to export');
        return;
    }

    // Create CSV content
    let csv = 'Date,Recipe,Quantity,Total Weight (g),Created By\n';

    historyData.forEach(run => {
        const date = new Date(run.date).toISOString().split('T')[0];
        run.items.forEach(item => {
            csv += `${date},${item.recipe_name},${item.quantity},${item.batch_weight},${run.created_by || 'N/A'}\n`;
        });
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}
