/**
 * Orders Management Page JavaScript
 */

let customers = [];
let recipes = [];
let orders = [];

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Set default week to current week
    setDefaultWeek();

    // Load customers and recipes
    loadCustomers();
    loadRecipes();
});

function setDefaultWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    document.getElementById('start-date').value = formatDate(monday);
    document.getElementById('end-date').value = formatDate(sunday);

    // Auto-load orders for current week
    loadOrders();
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

        const select = document.getElementById('recipe-select');
        select.innerHTML = '<option value="">Select recipe...</option>';

        recipes.forEach(recipe => {
            const option = document.createElement('option');
            option.value = recipe.id;
            option.textContent = recipe.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading recipes:', error);
        alert('Failed to load recipes');
    }
}

async function loadOrders() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!startDate || !endDate) {
        alert('Please select start and end dates');
        return;
    }

    try {
        const response = await fetch(`/api/orders?start_date=${startDate}&end_date=${endDate}`);
        orders = await response.json();

        displayOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
        alert('Failed to load orders');
    }
}

function displayOrders() {
    const tbody = document.getElementById('orders-table-body');

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No orders for selected week</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    orders.forEach(order => {
        const row = document.createElement('tr');

        const date = new Date(order.order_date);
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });

        row.innerHTML = `
            <td>${order.order_date}</td>
            <td>${dayOfWeek}</td>
            <td>${order.customer_short_name}</td>
            <td>${order.recipe_name}</td>
            <td>${order.quantity}</td>
            <td>
                <button onclick="deleteOrder(${order.id})" class="btn-small btn-danger">Delete</button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

async function addOrder() {
    const customerId = document.getElementById('customer-select').value;
    const recipeId = document.getElementById('recipe-select').value;
    const orderDate = document.getElementById('order-date').value;
    const quantity = parseInt(document.getElementById('quantity').value);

    if (!customerId || !recipeId || !orderDate || !quantity) {
        alert('Please fill in all fields');
        return;
    }

    // Calculate day of week
    const date = new Date(orderDate);
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customer_id: parseInt(customerId),
                recipe_id: parseInt(recipeId),
                order_date: orderDate,
                quantity: quantity,
                day_of_week: dayOfWeek
            })
        });

        const result = await response.json();

        if (result.success) {
            // Reload orders
            await loadOrders();

            // Reset quantity field
            document.getElementById('quantity').value = 10;

            // Show success message
            showMessage('Order added successfully', 'success');
        } else {
            alert('Failed to add order');
        }
    } catch (error) {
        console.error('Error adding order:', error);
        alert('Failed to add order');
    }
}

async function deleteOrder(orderId) {
    if (!confirm('Are you sure you want to delete this order?')) {
        return;
    }

    try {
        const response = await fetch(`/api/orders/${orderId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            await loadOrders();
            showMessage('Order deleted successfully', 'success');
        } else {
            alert('Failed to delete order');
        }
    } catch (error) {
        console.error('Error deleting order:', error);
        alert('Failed to delete order');
    }
}

async function calculateProduction() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!startDate || !endDate) {
        alert('Please select start and end dates');
        return;
    }

    try {
        const response = await fetch('/api/orders/aggregate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                start_date: startDate,
                end_date: endDate
            })
        });

        const aggregated = await response.json();

        displayProductionSummary(aggregated);
    } catch (error) {
        console.error('Error calculating production:', error);
        alert('Failed to calculate production');
    }
}

function displayProductionSummary(aggregated) {
    const card = document.getElementById('production-summary-card');
    const container = document.getElementById('production-summary');

    card.style.display = 'block';
    container.innerHTML = '';

    if (Object.keys(aggregated).length === 0) {
        container.innerHTML = '<p>No orders to aggregate</p>';
        return;
    }

    // Sort dates
    const sortedDates = Object.keys(aggregated).sort();

    sortedDates.forEach(date => {
        const dateSection = document.createElement('div');
        dateSection.className = 'production-date-section';

        const dateObj = new Date(date);
        const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

        let html = `
            <h4>${date} (${dayOfWeek})</h4>
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Recipe</th>
                        <th>Total Quantity</th>
                    </tr>
                </thead>
                <tbody>
        `;

        aggregated[date].forEach(item => {
            html += `
                <tr>
                    <td>${item.recipe_name}</td>
                    <td>${item.total_quantity}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';

        dateSection.innerHTML = html;
        container.appendChild(dateSection);
    });
}

// createProductionRuns function removed - production runs are now automatically
// synced whenever orders are created, updated, or deleted

function showMessage(message, type) {
    // Simple message display - could be enhanced with a toast notification
    console.log(`[${type}] ${message}`);
}
