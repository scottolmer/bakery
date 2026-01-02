/**
 * Weekly Order Sheets JavaScript
 */

let customers = [];
let recipes = [];
let weeklyData = {};
let currentCustomer = null;
let currentWeekStart = null;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBREV = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

document.addEventListener('DOMContentLoaded', function() {
    loadCustomers();
    loadRecipes();
    setDefaultWeek();
});

function setDefaultWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    document.getElementById('week-start').value = formatDate(monday);
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function loadCustomers() {
    try {
        const response = await fetch('/api/customers');
        customers = await response.json();

        const select = document.getElementById('customer-select');
        select.innerHTML = '<option value="">Select customer...</option>';

        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = `${customer.name} (${customer.short_name})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading customers:', error);
        alert('Failed to load customers');
    }
}

async function loadRecipes() {
    try {
        const response = await fetch('/api/recipes');
        const allRecipes = await response.json();

        // Filter to only show bread recipes
        recipes = allRecipes.filter(r => r.recipe_type === 'bread');
    } catch (error) {
        console.error('Error loading recipes:', error);
        alert('Failed to load recipes');
    }
}

async function loadWeeklySheet() {
    const customerId = document.getElementById('customer-select').value;
    const weekStart = document.getElementById('week-start').value;

    if (!customerId || !weekStart) {
        alert('Please select a customer and week start date');
        return;
    }

    currentCustomer = customers.find(c => c.id == customerId);
    currentWeekStart = new Date(weekStart + 'T00:00:00');

    // Calculate week end (Sunday)
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);

    // Load existing orders for this customer and week
    try {
        const response = await fetch(`/api/orders?start_date=${formatDate(currentWeekStart)}&end_date=${formatDate(weekEnd)}&customer_id=${customerId}`);
        const orders = await response.json();

        // Build weeklyData structure
        weeklyData = {};
        recipes.forEach(recipe => {
            weeklyData[recipe.id] = {
                recipe_name: recipe.name,
                quantities: {
                    'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0,
                    'Friday': 0, 'Saturday': 0, 'Sunday': 0
                }
            };
        });

        // Populate with existing orders
        orders.forEach(order => {
            if (weeklyData[order.recipe_id]) {
                weeklyData[order.recipe_id].quantities[order.day_of_week] = order.quantity;
            }
        });

        displayWeeklySheet();
    } catch (error) {
        console.error('Error loading orders:', error);
        alert('Failed to load weekly orders');
    }
}

function displayWeeklySheet() {
    const container = document.getElementById('weekly-sheet-container');
    const tbody = document.getElementById('weekly-sheet-body');
    const title = document.getElementById('sheet-title');
    const weekRange = document.getElementById('week-range');

    title.textContent = `${currentCustomer.name} - Weekly Orders`;

    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);
    weekRange.textContent = `${formatDateDisplay(currentWeekStart)} - ${formatDateDisplay(weekEnd)}`;

    tbody.innerHTML = '';

    // Create a row for each bread recipe
    recipes.forEach(recipe => {
        const row = document.createElement('tr');
        const data = weeklyData[recipe.id];

        let rowHTML = `<td class="bread-name"><strong>${recipe.name}</strong></td>`;

        let weekTotal = 0;
        DAYS.forEach(day => {
            const quantity = data.quantities[day];
            weekTotal += quantity;
            rowHTML += `<td><input type="number"
                class="quantity-input"
                data-recipe-id="${recipe.id}"
                data-day="${day}"
                value="${quantity}"
                min="0"
                onchange="updateQuantity(${recipe.id}, '${day}', this.value)"></td>`;
        });

        rowHTML += `<td class="week-total" id="week-total-${recipe.id}">${weekTotal}</td>`;

        row.innerHTML = rowHTML;
        tbody.appendChild(row);
    });

    updateDailyTotals();
    container.style.display = 'block';
}

function updateQuantity(recipeId, day, value) {
    const quantity = parseInt(value) || 0;
    weeklyData[recipeId].quantities[day] = quantity;

    // Update week total for this recipe
    let weekTotal = 0;
    DAYS.forEach(d => {
        weekTotal += weeklyData[recipeId].quantities[d];
    });
    document.getElementById(`week-total-${recipeId}`).textContent = weekTotal;

    updateDailyTotals();
}

function updateDailyTotals() {
    const dayTotals = {
        'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0,
        'Friday': 0, 'Saturday': 0, 'Sunday': 0
    };

    let grandTotal = 0;

    Object.values(weeklyData).forEach(data => {
        DAYS.forEach(day => {
            dayTotals[day] += data.quantities[day];
            grandTotal += data.quantities[day];
        });
    });

    DAY_ABBREV.forEach((abbrev, index) => {
        document.getElementById(`total-${abbrev}`).textContent = dayTotals[DAYS[index]];
    });

    document.getElementById('total-week').textContent = grandTotal;
}

async function saveWeeklySheet() {
    if (!currentCustomer || !currentWeekStart) {
        alert('Please load a weekly sheet first');
        return;
    }

    const customerId = currentCustomer.id;
    const orders = [];

    // Build list of all orders
    Object.keys(weeklyData).forEach(recipeId => {
        const data = weeklyData[recipeId];

        DAYS.forEach((day, dayIndex) => {
            const quantity = data.quantities[day];

            if (quantity > 0) {
                const orderDate = new Date(currentWeekStart);
                orderDate.setDate(currentWeekStart.getDate() + dayIndex);

                orders.push({
                    customer_id: customerId,
                    recipe_id: parseInt(recipeId),
                    order_date: formatDate(orderDate),
                    quantity: quantity,
                    day_of_week: day
                });
            }
        });
    });

    // Delete existing orders for this customer and week
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);

    try {
        // First, delete existing orders
        const deleteResponse = await fetch('/api/orders/delete-week', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_id: customerId,
                start_date: formatDate(currentWeekStart),
                end_date: formatDate(weekEnd)
            })
        });

        // Then create new orders
        for (const order of orders) {
            await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(order)
            });
        }

        alert(`Weekly orders saved for ${currentCustomer.name}!\n\nTotal orders: ${orders.length}`);
    } catch (error) {
        console.error('Error saving orders:', error);
        alert('Failed to save orders');
    }
}

function printWeeklySheet() {
    if (!currentCustomer || !currentWeekStart) {
        alert('Please load a weekly sheet first');
        return;
    }

    // Populate print version
    document.getElementById('print-customer-name').textContent = currentCustomer.name;

    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);
    document.getElementById('print-week-range').textContent =
        `Week of ${formatDateDisplay(currentWeekStart)} - ${formatDateDisplay(weekEnd)}`;

    // Copy table content
    const mainTable = document.getElementById('weekly-sheet');
    const printTable = document.getElementById('print-table');
    printTable.innerHTML = mainTable.innerHTML;

    // Replace input fields with plain text
    printTable.querySelectorAll('input').forEach(input => {
        const value = input.value || '0';
        const span = document.createElement('span');
        span.textContent = value;
        input.parentNode.replaceChild(span, input);
    });

    window.print();
}

function formatDateDisplay(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
