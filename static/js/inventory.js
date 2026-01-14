// Inventory Management JavaScript

let inventory = [];
let currentIngredient = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadInventory();

    // Set up form handlers
    document.getElementById('add-stock-form').addEventListener('submit', handleAddStock);
    document.getElementById('adjust-stock-form').addEventListener('submit', handleAdjustStock);
    document.getElementById('threshold-form').addEventListener('submit', handleSetThreshold);
});

async function loadInventory() {
    try {
        const response = await fetch('/api/inventory');
        inventory = await response.json();
        displayInventory();
        checkLowStock();
    } catch (error) {
        console.error('Error loading inventory:', error);
        showError('Failed to load inventory');
    }
}

function displayInventory() {
    const container = document.getElementById('inventory-list');

    if (inventory.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No ingredients found. Add ingredients in the Recipes page first.</p>';
        return;
    }

    // Sort by category and name
    const sorted = [...inventory].sort((a, b) => {
        if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
    });

    let html = '<table class="inventory-table">';
    html += `
        <thead>
            <tr>
                <th>Ingredient</th>
                <th>Category</th>
                <th>Stock Level</th>
                <th>Cost Per Unit</th>
                <th>Stock Value</th>
                <th>Low Stock Alert</th>
                <th>Last Updated</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
    `;

    sorted.forEach(item => {
        const stockClass = item.is_low_stock ? 'low-stock' : 'good-stock';
        const lastUpdated = item.last_updated
            ? new Date(item.last_updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Never';

        // Cost display
        const costDisplay = item.cost_per_unit
            ? `$${item.cost_per_unit.toFixed(4)}/${item.unit === 'grams' ? 'g' : item.unit}`
            : '<span style="color: #999;">-</span>';

        // Stock value calculation
        const stockValue = item.cost_per_unit && item.quantity_in_stock
            ? `$${(item.cost_per_unit * item.quantity_in_stock).toFixed(2)}`
            : '<span style="color: #999;">-</span>';

        html += `
            <tr>
                <td><strong>${item.name}</strong></td>
                <td>${item.category}</td>
                <td>
                    <span class="stock-level ${stockClass}">
                        ${item.quantity_in_stock.toFixed(1)} ${item.unit}
                    </span>
                </td>
                <td style="color: #28a745; font-weight: 600;">${costDisplay}</td>
                <td style="color: #28a745; font-weight: 600;">${stockValue}</td>
                <td>
                    ${item.low_stock_threshold
                        ? `${item.low_stock_threshold.toFixed(1)} ${item.unit}`
                        : '<span style="color: #95a5a6;">Not set</span>'}
                </td>
                <td>${lastUpdated}</td>
                <td class="stock-actions">
                    <button class="btn btn-small btn-primary" onclick="showAddStockModal(${item.id})">+ Add Stock</button>
                    <button class="btn btn-small btn-secondary" onclick="showAdjustStockModal(${item.id})">Adjust</button>
                    <button class="btn btn-small btn-secondary" onclick="showThresholdModal(${item.id})">Set Alert</button>
                    <button class="btn btn-small" onclick="deleteIngredient(${item.id}, '${item.name}')" style="background-color: #e74c3c; color: white;">Delete</button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function checkLowStock() {
    const lowStockItems = inventory.filter(item => item.is_low_stock);

    const alertDiv = document.getElementById('low-stock-alerts');
    const listDiv = document.getElementById('low-stock-list');

    if (lowStockItems.length === 0) {
        alertDiv.style.display = 'none';
        return;
    }

    alertDiv.style.display = 'block';

    let html = '<ul style="margin: 0; padding-left: 1.5rem;">';
    lowStockItems.forEach(item => {
        const deficit = item.low_stock_threshold - item.quantity_in_stock;
        html += `<li style="color: #856404;"><strong>${item.name}:</strong> ${item.quantity_in_stock.toFixed(1)} ${item.unit} (${deficit.toFixed(1)} ${item.unit} below threshold)</li>`;
    });
    html += '</ul>';

    listDiv.innerHTML = html;
}

function showAddStockModal(ingredientId) {
    currentIngredient = inventory.find(i => i.id === ingredientId);
    if (!currentIngredient) return;

    document.getElementById('add-stock-ingredient-id').value = ingredientId;
    document.getElementById('add-stock-ingredient-name').textContent = currentIngredient.name;
    document.getElementById('add-stock-unit').textContent = `Enter quantity in ${currentIngredient.unit}`;
    document.getElementById('add-stock-quantity').value = '';
    document.getElementById('add-stock-notes').value = '';
    document.getElementById('add-stock-by').value = '';

    document.getElementById('add-stock-modal').classList.add('show');
}

function closeAddStockModal() {
    document.getElementById('add-stock-modal').classList.remove('show');
}

async function handleAddStock(e) {
    e.preventDefault();

    const ingredientId = parseInt(document.getElementById('add-stock-ingredient-id').value);
    const quantity = parseFloat(document.getElementById('add-stock-quantity').value);
    const notes = document.getElementById('add-stock-notes').value;
    const createdBy = document.getElementById('add-stock-by').value;

    if (quantity <= 0) {
        showError('Quantity must be greater than 0');
        return;
    }

    try {
        const response = await fetch('/api/inventory/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ingredient_id: ingredientId,
                quantity: quantity,
                notes: notes,
                created_by: createdBy
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            showError(errorData.error || 'Error adding stock');
            return;
        }

        showSuccess(`Added ${quantity} ${currentIngredient.unit} to ${currentIngredient.name}`);
        closeAddStockModal();
        loadInventory();

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to add stock');
    }
}

function showAdjustStockModal(ingredientId) {
    currentIngredient = inventory.find(i => i.id === ingredientId);
    if (!currentIngredient) return;

    document.getElementById('adjust-stock-ingredient-id').value = ingredientId;
    document.getElementById('adjust-stock-ingredient-name').textContent = currentIngredient.name;
    document.getElementById('adjust-stock-current').textContent = `${currentIngredient.quantity_in_stock.toFixed(1)} ${currentIngredient.unit}`;
    document.getElementById('adjust-stock-unit').textContent = `Enter new quantity in ${currentIngredient.unit}`;
    document.getElementById('adjust-stock-new-quantity').value = currentIngredient.quantity_in_stock.toFixed(1);
    document.getElementById('adjust-stock-notes').value = '';
    document.getElementById('adjust-stock-by').value = '';

    document.getElementById('adjust-stock-modal').classList.add('show');
}

function closeAdjustStockModal() {
    document.getElementById('adjust-stock-modal').classList.remove('show');
}

async function handleAdjustStock(e) {
    e.preventDefault();

    const ingredientId = parseInt(document.getElementById('adjust-stock-ingredient-id').value);
    const newQuantity = parseFloat(document.getElementById('adjust-stock-new-quantity').value);
    const notes = document.getElementById('adjust-stock-notes').value;
    const createdBy = document.getElementById('adjust-stock-by').value;

    if (newQuantity < 0) {
        showError('Quantity cannot be negative');
        return;
    }

    try {
        const response = await fetch('/api/inventory/adjust', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ingredient_id: ingredientId,
                new_quantity: newQuantity,
                notes: notes,
                created_by: createdBy
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            showError(errorData.error || 'Error adjusting stock');
            return;
        }

        showSuccess(`Adjusted ${currentIngredient.name} stock to ${newQuantity} ${currentIngredient.unit}`);
        closeAdjustStockModal();
        loadInventory();

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to adjust stock');
    }
}

function showThresholdModal(ingredientId) {
    currentIngredient = inventory.find(i => i.id === ingredientId);
    if (!currentIngredient) return;

    document.getElementById('threshold-ingredient-id').value = ingredientId;
    document.getElementById('threshold-ingredient-name').textContent = currentIngredient.name;
    document.getElementById('threshold-unit').textContent = `Alert when stock falls below this amount (in ${currentIngredient.unit}). Leave empty to remove alert.`;
    document.getElementById('threshold-value').value = currentIngredient.low_stock_threshold || '';

    document.getElementById('threshold-modal').classList.add('show');
}

function closeThresholdModal() {
    document.getElementById('threshold-modal').classList.remove('show');
}

async function handleSetThreshold(e) {
    e.preventDefault();

    const ingredientId = parseInt(document.getElementById('threshold-ingredient-id').value);
    const thresholdValue = document.getElementById('threshold-value').value;
    const threshold = thresholdValue ? parseFloat(thresholdValue) : null;

    try {
        const response = await fetch('/api/inventory/set-threshold', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ingredient_id: ingredientId,
                threshold: threshold
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            showError(errorData.error || 'Error setting threshold');
            return;
        }

        if (threshold) {
            showSuccess(`Set low stock alert for ${currentIngredient.name} at ${threshold} ${currentIngredient.unit}`);
        } else {
            showSuccess(`Removed low stock alert for ${currentIngredient.name}`);
        }
        closeThresholdModal();
        loadInventory();

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to set threshold');
    }
}

async function showTransactionHistory() {
    try {
        const response = await fetch('/api/inventory/transactions?limit=100');
        const transactions = await response.json();

        const listDiv = document.getElementById('history-list');

        if (transactions.length === 0) {
            listDiv.innerHTML = '<p class="placeholder-text">No transactions found.</p>';
        } else {
            let html = '';
            transactions.forEach(t => {
                const date = new Date(t.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                });

                const typeLabel = {
                    'addition': 'Added',
                    'deduction': 'Used',
                    'adjustment': 'Adjusted'
                }[t.transaction_type] || t.transaction_type;

                html += `
                    <div class="transaction-item ${t.transaction_type}">
                        <div class="transaction-meta">
                            <span><strong>${date}</strong></span>
                            <span>${typeLabel}</span>
                            ${t.created_by ? `<span>by ${t.created_by}</span>` : ''}
                        </div>
                        <div class="transaction-details">
                            <strong>${t.ingredient_name}:</strong>
                            ${t.quantity >= 0 ? '+' : ''}${t.quantity.toFixed(1)}g
                            (${t.quantity_before.toFixed(1)}g → ${t.quantity_after.toFixed(1)}g)
                        </div>
                        ${t.notes ? `<div style="margin-top: 0.5rem; color: #7f8c8d; font-size: 0.9rem;">${t.notes}</div>` : ''}
                    </div>
                `;
            });
            listDiv.innerHTML = html;
        }

        document.getElementById('history-modal').classList.add('show');

    } catch (error) {
        console.error('Error loading transaction history:', error);
        showError('Failed to load transaction history');
    }
}

function closeHistoryModal() {
    document.getElementById('history-modal').classList.remove('show');
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

async function deleteIngredient(ingredientId, ingredientName) {
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${ingredientName}"?\n\nThis will also delete all inventory transaction history for this ingredient.\n\nNote: You cannot delete ingredients that are used in recipes.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/ingredients/${ingredientId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Failed to delete ingredient');
            return;
        }

        showSuccess(`Successfully deleted "${ingredientName}"`);
        loadInventory();

    } catch (error) {
        console.error('Error deleting ingredient:', error);
        showError('Failed to delete ingredient');
    }
}
