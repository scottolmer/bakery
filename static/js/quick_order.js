// Quick Order Entry Grid

let customers = [];
let customerBreads = [];
let currentWeekStart = null;
let dateColumns = [];

document.addEventListener('DOMContentLoaded', function() {
    loadCustomers();
    setDefaultDate();

    document.getElementById('customer-select').addEventListener('change', handleCustomerChange);
    document.getElementById('start-date').addEventListener('change', handleDateChange);
    document.getElementById('load-template-btn').addEventListener('click', loadPreviousWeek);
    document.getElementById('save-orders-btn').addEventListener('click', saveAllOrders);
    document.getElementById('clear-grid-btn').addEventListener('click', clearGrid);
});

function setDefaultDate() {
    // Default to next Monday
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);

    document.getElementById('start-date').valueAsDate = nextMonday;
}

async function loadCustomers() {
    try {
        const response = await fetch('/api/customers');
        customers = await response.json();

        const select = document.getElementById('customer-select');
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

async function handleCustomerChange() {
    const customerId = document.getElementById('customer-select').value;
    if (!customerId) {
        document.getElementById('order-grid-card').style.display = 'none';
        return;
    }

    await loadCustomerBreads(customerId);
    buildGrid();
}

function handleDateChange() {
    const customerId = document.getElementById('customer-select').value;
    if (customerId && customerBreads.length > 0) {
        buildGrid();
    }
}

async function loadCustomerBreads(customerId) {
    try {
        const response = await fetch(`/api/customers/${customerId}/typical-breads`);
        const data = await response.json();
        customerBreads = data.breads || [];

        if (customerBreads.length === 0) {
            showError('This customer has no order history. Add breads manually or create orders first.');
        }
    } catch (error) {
        console.error('Error loading customer breads:', error);
        showError('Failed to load customer bread preferences');
    }
}

function buildGrid() {
    const customerId = document.getElementById('customer-select').value;
    const startDateInput = document.getElementById('start-date').value;

    if (!customerId || !startDateInput || customerBreads.length === 0) {
        return;
    }

    const startDate = new Date(startDateInput + 'T00:00:00');
    currentWeekStart = startDate;

    // Generate 7 date columns
    dateColumns = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        dateColumns.push(date);
    }

    // Build header
    const dateHeader = document.getElementById('date-header');
    dateHeader.innerHTML = '<th>Bread</th>';
    dateColumns.forEach(date => {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

        dateHeader.innerHTML += `
            <th class="${isWeekend ? 'weekend-column' : ''}">
                <span class="day-name">${dayName}</span>
                <span class="date-value">${dateStr}</span>
            </th>
        `;
    });

    // Build body
    const gridBody = document.getElementById('grid-body');
    gridBody.innerHTML = '';

    customerBreads.forEach(bread => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${bread.recipe_name}</td>`;

        dateColumns.forEach((date, index) => {
            const dateStr = formatDateForAPI(date);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            row.innerHTML += `
                <td class="${isWeekend ? 'weekend-column' : ''}">
                    <input type="number"
                           min="0"
                           class="quantity-input"
                           data-recipe-id="${bread.recipe_id}"
                           data-date="${dateStr}"
                           data-day-index="${index}"
                           placeholder="0">
                </td>
            `;
        });

        gridBody.appendChild(row);
    });

    // Build totals row
    const totalsRow = document.getElementById('totals-row');
    totalsRow.innerHTML = '<td>Daily Totals</td>';
    dateColumns.forEach((date, index) => {
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        totalsRow.innerHTML += `
            <td class="${isWeekend ? 'weekend-column' : ''}" id="total-${index}">0</td>
        `;
    });

    // Add input listeners for totals calculation
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('input', calculateTotals);
    });

    // Update title
    const customer = customers.find(c => c.id == customerId);
    document.getElementById('grid-title').textContent = `${customer.name} - Week of ${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

    document.getElementById('order-grid-card').style.display = 'block';
}

function calculateTotals() {
    dateColumns.forEach((date, dayIndex) => {
        const inputs = document.querySelectorAll(`input[data-day-index="${dayIndex}"]`);
        let total = 0;
        inputs.forEach(input => {
            const value = parseInt(input.value) || 0;
            total += value;
        });
        document.getElementById(`total-${dayIndex}`).textContent = total;
    });
}

async function loadPreviousWeek() {
    const customerId = document.getElementById('customer-select').value;
    const startDateInput = document.getElementById('start-date').value;

    if (!customerId || !startDateInput) {
        showError('Please select a customer and start date first');
        return;
    }

    const startDate = new Date(startDateInput + 'T00:00:00');
    const previousWeekStart = new Date(startDate);
    previousWeekStart.setDate(startDate.getDate() - 7);

    const previousWeekEnd = new Date(previousWeekStart);
    previousWeekEnd.setDate(previousWeekStart.getDate() + 6);

    try {
        const response = await fetch(`/api/orders?customer_id=${customerId}&start_date=${formatDateForAPI(previousWeekStart)}&end_date=${formatDateForAPI(previousWeekEnd)}`);
        const orders = await response.json();

        // Clear current values
        document.querySelectorAll('.quantity-input').forEach(input => {
            input.value = '';
            input.classList.remove('has-previous-value');
        });

        // Fill in previous week's orders
        orders.forEach(order => {
            const orderDate = new Date(order.order_date + 'T00:00:00');
            const currentWeekDate = new Date(orderDate);
            currentWeekDate.setDate(orderDate.getDate() + 7);

            const input = document.querySelector(
                `input[data-recipe-id="${order.recipe_id}"][data-date="${formatDateForAPI(currentWeekDate)}"]`
            );

            if (input) {
                input.value = order.quantity;
                input.classList.add('has-previous-value');
            }
        });

        calculateTotals();
        showSuccess(`Loaded ${orders.length} orders from previous week`);
    } catch (error) {
        console.error('Error loading previous week:', error);
        showError('Failed to load previous week orders');
    }
}

function clearGrid() {
    if (!confirm('Clear all quantities in the grid?')) {
        return;
    }

    document.querySelectorAll('.quantity-input').forEach(input => {
        input.value = '';
        input.classList.remove('has-previous-value');
    });
    calculateTotals();
}

async function saveAllOrders() {
    const customerId = document.getElementById('customer-select').value;

    if (!customerId) {
        showError('Please select a customer');
        return;
    }

    // Collect all orders
    const orders = [];
    const inputs = document.querySelectorAll('.quantity-input');

    inputs.forEach(input => {
        const quantity = parseInt(input.value);
        if (quantity && quantity > 0) {
            orders.push({
                customer_id: parseInt(customerId),
                recipe_id: parseInt(input.dataset.recipeId),
                order_date: input.dataset.date,
                quantity: quantity
            });
        }
    });

    if (orders.length === 0) {
        showError('No quantities entered. Please add some orders first.');
        return;
    }

    // Save all orders
    try {
        document.getElementById('save-status').textContent = 'Saving...';
        const response = await fetch('/api/orders/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ orders })
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Failed to save orders');
            return;
        }

        showSuccess(`Successfully saved ${data.created} orders!`);
        document.getElementById('save-status').textContent = `✓ Saved ${data.created} orders`;

        // Highlight saved cells
        inputs.forEach(input => {
            if (input.value && parseInt(input.value) > 0) {
                input.style.backgroundColor = '#d4edda';
            }
        });

    } catch (error) {
        console.error('Error saving orders:', error);
        showError('Failed to save orders');
    } finally {
        setTimeout(() => {
            document.getElementById('save-status').textContent = '';
        }, 3000);
    }
}

function formatDateForAPI(date) {
    return date.toISOString().split('T')[0];
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
