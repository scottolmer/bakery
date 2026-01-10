// Customer Production View JavaScript

let customers = [];
let currentProduction = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadCustomers();
    setupViewTypeListener();
});

async function loadCustomers() {
    try {
        const response = await fetch('/api/customers');
        customers = await response.json();

        const select = document.getElementById('customer-select');
        select.innerHTML = '<option value="">Select a customer...</option>';

        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading customers:', error);
        showError('Failed to load customers');
    }
}

function setupViewTypeListener() {
    const viewType = document.getElementById('view-type');
    viewType.addEventListener('change', function() {
        const customDateGroup = document.getElementById('custom-date-group');
        const customEndGroup = document.getElementById('custom-end-group');

        if (this.value === 'custom') {
            customDateGroup.style.display = 'block';
            customEndGroup.style.display = 'block';
        } else {
            customDateGroup.style.display = 'none';
            customEndGroup.style.display = 'none';
        }
    });
}

function getDateRange() {
    const viewType = document.getElementById('view-type').value;
    const today = new Date();
    let startDate, endDate;

    switch (viewType) {
        case 'week':
            // Get current week (Sunday to Saturday)
            const dayOfWeek = today.getDay();
            startDate = new Date(today);
            startDate.setDate(today.getDate() - dayOfWeek);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            break;

        case 'next-week':
            // Get next week (Sunday to Saturday)
            const currentDay = today.getDay();
            startDate = new Date(today);
            startDate.setDate(today.getDate() - currentDay + 7);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            break;

        case 'month':
            // Get current month
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;

        case 'custom':
            const startInput = document.getElementById('start-date').value;
            const endInput = document.getElementById('end-date').value;

            if (!startInput || !endInput) {
                showError('Please select both start and end dates');
                return null;
            }

            startDate = new Date(startInput);
            endDate = new Date(endInput);
            break;

        default:
            return null;
    }

    return {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
    };
}

async function loadCustomerProduction() {
    const customerId = document.getElementById('customer-select').value;

    if (!customerId) {
        showError('Please select a customer');
        return;
    }

    const dateRange = getDateRange();
    if (!dateRange) {
        return;
    }

    try {
        const response = await fetch(
            `/api/customer-production/${customerId}?start_date=${dateRange.start}&end_date=${dateRange.end}`
        );

        if (!response.ok) {
            throw new Error('Failed to load production data');
        }

        currentProduction = await response.json();
        displayProduction();

    } catch (error) {
        console.error('Error loading customer production:', error);
        showError('Failed to load production data');
    }
}

function displayProduction() {
    const container = document.getElementById('production-table-container');
    const tableCard = document.getElementById('production-table-card');
    const noDataCard = document.getElementById('no-data-card');
    const titleElement = document.getElementById('production-title');

    if (!currentProduction || currentProduction.recipes.length === 0) {
        tableCard.style.display = 'none';
        noDataCard.style.display = 'block';
        return;
    }

    noDataCard.style.display = 'none';
    tableCard.style.display = 'block';

    // Update title
    titleElement.textContent = `${currentProduction.customer_name} - Production Schedule`;

    // Build table
    let html = '<table class="production-table">';

    // Header row
    html += '<thead><tr>';
    html += '<th class="recipe-header">Bread Type</th>';

    currentProduction.recipes[0].quantities.forEach(dateInfo => {
        const date = new Date(dateInfo.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

        html += `<th class="day-header">
            <span class="day-name">${dayName}</span>
            <span class="date-display">${dateStr}</span>
        </th>`;
    });

    html += '<th>Total</th>';
    html += '</tr></thead>';

    // Body rows
    html += '<tbody>';

    currentProduction.recipes.forEach(recipe => {
        html += '<tr>';
        html += `<td class="recipe-name">${recipe.recipe_name}</td>`;

        let rowTotal = 0;
        recipe.quantities.forEach(qty => {
            const hasOrder = qty.quantity > 0;
            const quantityClass = hasOrder ? 'has-order' : 'no-order';
            const displayValue = hasOrder ? qty.quantity : '-';

            html += `<td class="quantity ${quantityClass}">${displayValue}</td>`;
            rowTotal += qty.quantity;
        });

        html += `<td class="quantity"><strong>${rowTotal}</strong></td>`;
        html += '</tr>';
    });

    // Totals row
    html += '<tr class="totals-row">';
    html += '<td>Daily Totals</td>';

    // Calculate daily totals
    const numDays = currentProduction.recipes[0].quantities.length;
    let grandTotal = 0;

    for (let i = 0; i < numDays; i++) {
        let dayTotal = 0;
        currentProduction.recipes.forEach(recipe => {
            dayTotal += recipe.quantities[i].quantity;
        });
        html += `<td>${dayTotal > 0 ? dayTotal : '-'}</td>`;
        grandTotal += dayTotal;
    }

    html += `<td><strong>${grandTotal}</strong></td>`;
    html += '</tr>';

    html += '</tbody>';
    html += '</table>';

    container.innerHTML = html;
}

function printProduction() {
    if (!currentProduction || currentProduction.recipes.length === 0) {
        alert('Please load production data before printing. Select a customer and click "Load Production" first.');
        return;
    }

    // Get the table HTML
    const tableHtml = document.getElementById('production-table-container').innerHTML;
    const title = document.getElementById('production-title').textContent;

    // Create print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                }
                h2 {
                    margin-bottom: 20px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    border: 1px solid #000;
                    padding: 8px;
                    text-align: center;
                }
                th {
                    background-color: #3498db;
                    color: white;
                    font-weight: bold;
                }
                th.recipe-header {
                    background-color: #2c3e50;
                    text-align: left;
                }
                td.recipe-name {
                    font-weight: bold;
                    text-align: left;
                    background: #ecf0f1;
                }
                .quantity.has-order {
                    color: #2ecc71;
                    font-weight: 600;
                }
                .quantity.no-order {
                    color: #95a5a6;
                }
                .totals-row {
                    font-weight: 600;
                    background: #e8f4f8;
                }
                @media print {
                    body {
                        margin: 0.5in;
                    }
                }
            </style>
        </head>
        <body>
            <h2>${title}</h2>
            ${tableHtml}
        </body>
        </html>
    `);
    printWindow.document.close();

    // Wait for content to load, then print
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = message;
    successDiv.style.display = 'block';

    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 3000);
}
