/**
 * Dashboard JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    loadDashboardData();
});

async function loadDashboardData() {
    // Get current week dates
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startDate = formatDate(monday);
    const endDate = formatDate(sunday);

    // Load this week's orders
    try {
        const ordersResponse = await fetch(`/api/orders?start_date=${startDate}&end_date=${endDate}`);
        const orders = await ordersResponse.json();

        document.getElementById('week-orders').textContent = orders.length;

        // Load production runs for next 7 days
        const productionResponse = await fetch(`/api/production/history?start_date=${formatDate(today)}&end_date=${formatDate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000))}`);
        const productionRuns = await productionResponse.json();

        document.getElementById('production-days').textContent = productionRuns.length;

        displayUpcomingProduction(productionRuns);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function displayUpcomingProduction(productionRuns) {
    const container = document.getElementById('upcoming-production');

    if (productionRuns.length === 0) {
        container.innerHTML = '<p class="empty-state">No production scheduled for the next 7 days</p>';
        return;
    }

    let html = '<table class="production-table"><thead><tr><th>Date</th><th>Day</th><th>Breads</th><th>Total Loaves</th><th>Action</th></tr></thead><tbody>';

    productionRuns.forEach(run => {
        const date = new Date(run.date);
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const breadNames = run.items.map(item => item.recipe_name).join(', ');
        const totalLoaves = run.items.reduce((sum, item) => sum + item.quantity, 0);

        html += `
            <tr>
                <td>${formattedDate}</td>
                <td>${dayOfWeek}</td>
                <td>${breadNames}</td>
                <td>${totalLoaves}</td>
                <td><a href="/mep?date=${run.date}" class="btn-small btn-primary">View MEP</a></td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
