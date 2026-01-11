// Production Entry JavaScript

let productionItems = [];
let recipes = [];
let customers = [];

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('production-date').value = today;

    // Load recipes and customers
    loadRecipes();
    loadCustomers();
});

async function loadRecipes() {
    try {
        const response = await fetch('/api/recipes');
        recipes = await response.json();

        const select = document.getElementById('recipe-select');
        recipes.forEach(recipe => {
            const option = document.createElement('option');
            option.value = recipe.id;
            option.textContent = `${recipe.name} (${recipe.loaf_weight}g)`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading recipes:', error);
        showError('Failed to load recipes');
    }
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

function addItem() {
    const customerId = document.getElementById('customer-select').value ? parseInt(document.getElementById('customer-select').value) : null;
    const recipeId = parseInt(document.getElementById('recipe-select').value);
    const quantity = parseInt(document.getElementById('quantity-input').value);

    if (!recipeId) {
        showError('Please select a recipe');
        return;
    }

    if (!quantity || quantity < 1) {
        showError('Please enter a valid quantity');
        return;
    }

    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) {
        showError('Recipe not found');
        return;
    }

    const customer = customerId ? customers.find(c => c.id === customerId) : null;

    // Check if same recipe AND customer combination already exists
    const existingIndex = productionItems.findIndex(item =>
        item.recipe_id === recipeId && item.customer_id === customerId
    );

    if (existingIndex >= 0) {
        // Update quantity
        productionItems[existingIndex].quantity += quantity;
    } else {
        // Add new item
        productionItems.push({
            recipe_id: recipeId,
            recipe_name: recipe.name,
            customer_id: customerId,
            customer_name: customer ? customer.name : 'House use',
            quantity: quantity,
            loaf_weight: recipe.loaf_weight,
            total_weight: quantity * recipe.loaf_weight
        });
    }

    updateItemsDisplay();

    // Reset form
    document.getElementById('recipe-select').value = '';
    document.getElementById('quantity-input').value = '10';
}

function removeItem(index) {
    productionItems.splice(index, 1);
    updateItemsDisplay();
}

function updateItemsDisplay() {
    const placeholder = document.getElementById('items-list');
    const tableContainer = document.getElementById('items-table-container');
    const tableBody = document.getElementById('items-table-body');

    if (productionItems.length === 0) {
        placeholder.style.display = 'block';
        tableContainer.style.display = 'none';
        document.getElementById('calculation-results').style.display = 'none';
        return;
    }

    placeholder.style.display = 'none';
    tableContainer.style.display = 'block';

    // Build table
    tableBody.innerHTML = '';
    productionItems.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.customer_name || '-'}</td>
            <td><strong>${item.recipe_name}</strong></td>
            <td>${item.quantity} loaves</td>
            <td>${item.loaf_weight}g</td>
            <td>${item.total_weight.toLocaleString()}g</td>
            <td>
                <button class="remove-btn" onclick="removeItem(${index})">Remove</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function calculateProduction() {
    if (productionItems.length === 0) {
        showError('Please add items before calculating');
        return;
    }

    try {
        const response = await fetch('/api/production/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: productionItems.map(item => ({
                    recipe_id: item.recipe_id,
                    quantity: item.quantity
                }))
            })
        });

        if (!response.ok) {
            showError('Error calculating production');
            return;
        }

        const calculations = await response.json();
        displayCalculations(calculations);

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to calculate production');
    }
}

function displayCalculations(calculations) {
    const container = document.getElementById('calculations-container');
    const resultsCard = document.getElementById('calculation-results');

    container.innerHTML = '';

    calculations.forEach(calc => {
        const breadDiv = document.createElement('div');
        breadDiv.className = 'bread-calculation';

        let ingredientsHTML = '<div class="ingredients-grid">';
        calc.ingredients.forEach(ing => {
            ingredientsHTML += `
                <div class="ingredient-item">
                    <div>
                        <span class="ingredient-name">${ing.name}</span>
                        <span class="category-badge">${ing.category}</span>
                    </div>
                    <span class="ingredient-amount">${ing.amount_grams.toLocaleString()}g</span>
                </div>
            `;
        });
        ingredientsHTML += '</div>';

        breadDiv.innerHTML = `
            <h4>${calc.recipe_name}</h4>
            <p>Quantity: ${calc.quantity} loaves | Total Weight: ${calc.total_weight.toLocaleString()}g</p>
            ${ingredientsHTML}
        `;

        container.appendChild(breadDiv);
    });

    resultsCard.style.display = 'block';
}

async function saveProduction() {
    if (productionItems.length === 0) {
        showError('Please add items before saving');
        return;
    }

    const productionDate = document.getElementById('production-date').value;
    if (!productionDate) {
        showError('Please select a production date');
        return;
    }

    try {
        const response = await fetch('/api/production/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                date: productionDate,
                created_by: 'admin', // TODO: Get from logged-in user
                items: productionItems.map(item => ({
                    recipe_id: item.recipe_id,
                    quantity: item.quantity,
                    customer_id: item.customer_id
                }))
            })
        });

        if (!response.ok) {
            showError('Error saving production');
            return;
        }

        const result = await response.json();

        // Use delivery date directly (system will calculate backwards)
        showSuccess(`Production run saved successfully! Batch ID: ${result.batch_id}<br><a href="/?date=${productionDate}" style="color: white; text-decoration: underline;">View MEP Sheets</a>`);

        // Clear form
        setTimeout(() => {
            clearItems();
            // Redirect to MEP sheet with delivery date (system calculates backwards)
            window.location.href = `/?date=${productionDate}`;
        }, 2000);

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to save production');
    }
}

function clearItems() {
    productionItems = [];
    updateItemsDisplay();
    document.getElementById('calculation-results').style.display = 'none';
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
    successDiv.innerHTML = message;
    successDiv.style.display = 'block';

    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}
