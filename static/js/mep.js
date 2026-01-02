// MEP Sheet JavaScript

// Set today's date as default
document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.getElementById('mep-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
});

async function loadMEP() {
    const dateInput = document.getElementById('mep-date');
    const mepDate = dateInput.value;

    if (!mepDate) {
        showError('Please select a date');
        return;
    }

    try {
        const response = await fetch(`/api/mep/${mepDate}`);

        if (!response.ok) {
            if (response.status === 404) {
                showError('No production run found for this date');
            } else {
                showError('Error loading MEP sheet');
            }
            document.getElementById('mep-content').style.display = 'none';
            return;
        }

        const data = await response.json();
        displayMEP(data);
        document.getElementById('error-message').style.display = 'none';
        document.getElementById('mep-content').style.display = 'block';

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to load MEP sheet');
        document.getElementById('mep-content').style.display = 'none';
    }
}

function displayMEP(data) {
    // Update date display
    const dateDisplay = document.getElementById('mep-date-display');
    const date = new Date(data.date);
    dateDisplay.textContent = `Date: ${date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })}`;

    // Display total ingredients
    const totalIngredientsBody = document.getElementById('total-ingredients-body');
    totalIngredientsBody.innerHTML = '';

    // Sort ingredients by category
    const ingredientEntries = Object.entries(data.total_ingredients);
    ingredientEntries.sort((a, b) => a[0].localeCompare(b[0]));

    for (const [ingredient, amount] of ingredientEntries) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${ingredient}</strong></td>
            <td>${amount.toLocaleString()} g</td>
        `;
        totalIngredientsBody.appendChild(row);
    }

    // Display bread items
    const breadsList = document.getElementById('breads-list');
    breadsList.innerHTML = '';

    for (const bread of data.breads) {
        const breadDiv = document.createElement('div');
        breadDiv.className = 'bread-item';

        let ingredientsHTML = '<table class="ingredients-table"><thead><tr><th>Ingredient</th><th>Amount (g)</th><th>Category</th></tr></thead><tbody>';

        // Sort ingredients by category
        const sortedIngredients = bread.ingredients.sort((a, b) => {
            const categoryOrder = { flour: 1, water: 2, starter: 3, soaker: 4, salt: 5, yeast: 6, oil: 7 };
            return (categoryOrder[a.category] || 99) - (categoryOrder[b.category] || 99);
        });

        for (const ingredient of sortedIngredients) {
            ingredientsHTML += `
                <tr>
                    <td>${ingredient.name}</td>
                    <td>${ingredient.amount.toLocaleString()}</td>
                    <td><span class="badge">${ingredient.category}</span></td>
                </tr>
            `;
        }

        ingredientsHTML += '</tbody></table>';

        breadDiv.innerHTML = `
            <h3>${bread.name}</h3>
            <div class="bread-info">
                <div class="info-item">
                    <span class="info-label">Quantity:</span>
                    <span>${bread.quantity} loaves</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Loaf Weight:</span>
                    <span>${bread.loaf_weight} g</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Total Batch:</span>
                    <span>${bread.total_weight.toLocaleString()} g</span>
                </div>
            </div>
            ${ingredientsHTML}
        `;

        breadsList.appendChild(breadDiv);
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}
