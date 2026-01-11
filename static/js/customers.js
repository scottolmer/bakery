// Customer Management

document.addEventListener('DOMContentLoaded', function() {
    loadCustomers();

    document.getElementById('customer-form').addEventListener('submit', function(e) {
        e.preventDefault();
        addCustomer();
    });
});

async function loadCustomers() {
    try {
        const response = await fetch('/api/customers');
        const customers = await response.json();

        displayCustomers(customers);
    } catch (error) {
        console.error('Error loading customers:', error);
        showError('Failed to load customers');
    }
}

function displayCustomers(customers) {
    const container = document.getElementById('customers-list');

    if (customers.length === 0) {
        container.innerHTML = '<p>No customers yet. Add your first customer above!</p>';
        return;
    }

    let html = '<table class="items-table"><thead><tr>';
    html += '<th>Customer Name</th>';
    html += '<th>Short Name</th>';
    html += '<th>Actions</th>';
    html += '</tr></thead><tbody>';

    customers.forEach(customer => {
        html += `
            <tr>
                <td><strong>${customer.name}</strong></td>
                <td>${customer.short_name || '-'}</td>
                <td>
                    <button class="btn btn-small" onclick="deleteCustomer(${customer.id}, '${customer.name}')" style="background-color: #e74c3c; color: white;">Delete</button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

async function addCustomer() {
    const name = document.getElementById('customer-name').value.trim();
    const shortName = document.getElementById('customer-short-name').value.trim();

    if (!name) {
        showError('Customer name is required');
        return;
    }

    try {
        const response = await fetch('/api/customers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                short_name: shortName || name.substring(0, 10)
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Failed to add customer');
            return;
        }

        showSuccess(`Customer "${name}" added successfully!`);

        // Clear form
        document.getElementById('customer-name').value = '';
        document.getElementById('customer-short-name').value = '';

        // Reload list
        loadCustomers();

    } catch (error) {
        console.error('Error adding customer:', error);
        showError('Failed to add customer');
    }
}

async function deleteCustomer(customerId, customerName) {
    if (!confirm(`Are you sure you want to delete "${customerName}"?\n\nThis will mark the customer as inactive but preserve their order history.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/customers/${customerId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Failed to delete customer');
            return;
        }

        showSuccess(`Customer "${customerName}" deleted successfully`);
        loadCustomers();

    } catch (error) {
        console.error('Error deleting customer:', error);
        showError('Failed to delete customer');
    }
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
