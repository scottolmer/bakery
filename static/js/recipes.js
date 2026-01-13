// Recipe Management JavaScript

let recipes = [];
let ingredients = [];
let currentRecipeIngredients = []; // Track ingredients being edited in modal
let currentFilter = 'all'; // Track current recipe filter

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadRecipes();
    loadIngredients();

    // Set up form handlers
    document.getElementById('recipe-form').addEventListener('submit', handleRecipeSubmit);
    document.getElementById('ingredient-form').addEventListener('submit', handleIngredientSubmit);
});

async function loadRecipes() {
    try {
        const response = await fetch('/api/recipes');
        const basicRecipes = await response.json();

        // Fetch detailed info for each recipe to get costs
        recipes = await Promise.all(basicRecipes.map(async (recipe) => {
            try {
                const detailResponse = await fetch(`/api/recipes/${recipe.id}`);
                return await detailResponse.json();
            } catch (error) {
                console.error(`Error loading recipe ${recipe.id}:`, error);
                return recipe;
            }
        }));

        displayRecipes();
    } catch (error) {
        console.error('Error loading recipes:', error);
        showError('Failed to load recipes');
    }
}

async function loadIngredients() {
    try {
        const response = await fetch('/api/ingredients');
        ingredients = await response.json();
        displayIngredients();
    } catch (error) {
        console.error('Error loading ingredients:', error);
        showError('Failed to load ingredients');
    }
}

function filterRecipes(type) {
    currentFilter = type;

    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    displayRecipes();
}

function displayRecipes() {
    const container = document.getElementById('recipes-list');

    if (recipes.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No recipes found. Add your first recipe!</p>';
        return;
    }

    // Filter recipes based on current filter
    let filteredRecipes = recipes;
    if (currentFilter !== 'all') {
        filteredRecipes = recipes.filter(recipe => recipe.recipe_type === currentFilter);
    }

    if (filteredRecipes.length === 0) {
        container.innerHTML = `<p class="placeholder-text">No ${currentFilter} recipes found.</p>`;
        return;
    }

    // Sort by name
    filteredRecipes.sort((a, b) => a.name.localeCompare(b.name));

    let html = '';
    filteredRecipes.forEach(recipe => {
        const typeBadgeColor = {
            'bread': '#3498db',
            'starter': '#e74c3c',
            'soaker': '#f39c12'
        }[recipe.recipe_type] || '#95a5a6';

        // Cost and pricing display
        let costHTML = '';
        if (recipe.cost_per_loaf !== undefined && recipe.cost_per_loaf !== null) {
            costHTML += `<span><strong>Cost:</strong> $${recipe.cost_per_loaf.toFixed(2)}/loaf</span>`;
        }
        if (recipe.selling_price) {
            costHTML += `<span><strong>Price:</strong> $${recipe.selling_price.toFixed(2)}/loaf</span>`;
        }
        if (recipe.cost_per_loaf && recipe.selling_price) {
            const profit = recipe.selling_price - recipe.cost_per_loaf;
            const margin = ((profit / recipe.selling_price) * 100).toFixed(0);
            const profitColor = profit > 0 ? '#28a745' : '#dc3545';
            costHTML += `<span style="color: ${profitColor};"><strong>Profit:</strong> $${profit.toFixed(2)} (${margin}%)</span>`;
        }

        html += `
            <div class="recipe-card">
                <h4>${recipe.name} <span style="background: ${typeBadgeColor}; color: white; padding: 0.2rem 0.5rem; border-radius: 3px; font-size: 0.75rem; margin-left: 0.5rem;">${recipe.recipe_type.toUpperCase()}</span></h4>
                <div class="recipe-meta">
                    <span><strong>Batch:</strong> ${recipe.base_batch_weight}g</span>
                    <span><strong>Loaf:</strong> ${recipe.loaf_weight}g</span>
                    ${costHTML}
                </div>
                <div class="recipe-actions">
                    <button class="btn-edit" onclick="editRecipe(${recipe.id})">Edit</button>
                    <button class="btn-edit" onclick="cloneRecipe(${recipe.id})" style="background-color: #9b59b6;">Clone</button>
                    <button class="btn-edit" onclick="viewRecipeDetails(${recipe.id})">View Details</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function displayIngredients() {
    const container = document.getElementById('ingredients-list');

    if (ingredients.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No ingredients found. Add your first ingredient!</p>';
        return;
    }

    // Group by category
    const grouped = {};
    ingredients.forEach(ing => {
        const category = ing.category || 'other';
        if (!grouped[category]) {
            grouped[category] = [];
        }
        grouped[category].push(ing);
    });

    let html = '';
    Object.keys(grouped).sort().forEach(category => {
        html += `<h4 style="margin-top: 1.5rem; color: #2c3e50;">${category.charAt(0).toUpperCase() + category.slice(1)}</h4>`;
        html += '<div class="ingredients-grid">';
        grouped[category].forEach(ing => {
            const costDisplay = ing.cost_per_unit
                ? `<p class="ingredient-cost" style="color: #28a745; font-weight: 600;">$${ing.cost_per_unit.toFixed(4)}/g</p>`
                : '<p class="ingredient-cost" style="color: #999;">No cost set</p>';

            html += `
                <div class="ingredient-card">
                    <h5>${ing.name}</h5>
                    <p class="ingredient-category">${ing.category}</p>
                    ${costDisplay}
                </div>
            `;
        });
        html += '</div>';
    });

    container.innerHTML = html;
}

function showAddRecipeModal() {
    document.getElementById('recipe-modal-title').textContent = 'Add Recipe';
    document.getElementById('recipe-form').reset();
    document.getElementById('recipe-id').value = '';
    currentRecipeIngredients = [];
    populateIngredientDropdown();
    displayRecipeIngredients();
    document.getElementById('recipe-modal').classList.add('show');
}

async function editRecipe(recipeId) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    // Load full recipe details with ingredients
    try {
        const response = await fetch(`/api/recipes/${recipeId}`);
        const fullRecipe = await response.json();

        document.getElementById('recipe-modal-title').textContent = 'Edit Recipe';
        document.getElementById('recipe-id').value = fullRecipe.id;
        document.getElementById('recipe-name').value = fullRecipe.name;
        document.getElementById('recipe-type').value = fullRecipe.recipe_type;
        document.getElementById('base-batch-weight').value = fullRecipe.base_batch_weight;
        document.getElementById('loaf-weight').value = fullRecipe.loaf_weight;
        document.getElementById('recipe-selling-price').value = fullRecipe.selling_price || '';
        document.getElementById('recipe-notes').value = fullRecipe.notes || '';

        // Load ingredients
        currentRecipeIngredients = fullRecipe.ingredients.map(ing => ({
            ingredient_id: ing.ingredient_id,
            ingredient_name: ing.ingredient_name,
            percentage: ing.percentage || 0,
            is_percentage: ing.is_percentage !== false,
            category: ing.category
        }));

        populateIngredientDropdown();
        displayRecipeIngredients();
        document.getElementById('recipe-modal').classList.add('show');
    } catch (error) {
        console.error('Error loading recipe:', error);
        showError('Failed to load recipe details');
    }
}

async function cloneRecipe(recipeId) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    // Load full recipe details with ingredients
    try {
        const response = await fetch(`/api/recipes/${recipeId}`);
        const fullRecipe = await response.json();

        document.getElementById('recipe-modal-title').textContent = 'Clone Recipe';
        document.getElementById('recipe-id').value = ''; // Clear ID to create new recipe
        document.getElementById('recipe-name').value = fullRecipe.name + ' (Copy)';
        document.getElementById('recipe-type').value = fullRecipe.recipe_type;
        document.getElementById('base-batch-weight').value = fullRecipe.base_batch_weight;
        document.getElementById('loaf-weight').value = fullRecipe.loaf_weight;
        document.getElementById('recipe-selling-price').value = fullRecipe.selling_price || '';
        document.getElementById('recipe-notes').value = fullRecipe.notes || '';

        // Load ingredients
        currentRecipeIngredients = fullRecipe.ingredients.map(ing => ({
            ingredient_id: ing.ingredient_id,
            ingredient_name: ing.ingredient_name,
            percentage: ing.percentage || 0,
            is_percentage: ing.is_percentage !== false,
            category: ing.category
        }));

        populateIngredientDropdown();
        displayRecipeIngredients();
        document.getElementById('recipe-modal').classList.add('show');

        // Focus on the name field so user can easily rename
        setTimeout(() => {
            const nameInput = document.getElementById('recipe-name');
            nameInput.focus();
            nameInput.select();
        }, 100);
    } catch (error) {
        console.error('Error loading recipe:', error);
        showError('Failed to load recipe details');
    }
}

function populateIngredientDropdown() {
    const select = document.getElementById('add-ingredient-select');
    select.innerHTML = '<option value="">Select ingredient...</option>';

    // Sort ingredients by category and name
    const sortedIngredients = [...ingredients].sort((a, b) => {
        if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
    });

    let currentCategory = '';
    sortedIngredients.forEach(ing => {
        if (ing.category !== currentCategory) {
            if (currentCategory !== '') {
                // Close previous optgroup
            }
            currentCategory = ing.category;
            const optgroup = document.createElement('optgroup');
            optgroup.label = ing.category.charAt(0).toUpperCase() + ing.category.slice(1);
            select.appendChild(optgroup);

            const option = document.createElement('option');
            option.value = ing.id;
            option.textContent = ing.name;
            option.dataset.category = ing.category;
            optgroup.appendChild(option);
        } else {
            // Find the last optgroup and add to it
            const optgroups = select.querySelectorAll('optgroup');
            const lastOptgroup = optgroups[optgroups.length - 1];
            const option = document.createElement('option');
            option.value = ing.id;
            option.textContent = ing.name;
            option.dataset.category = ing.category;
            lastOptgroup.appendChild(option);
        }
    });
}

function addIngredientToRecipe() {
    const select = document.getElementById('add-ingredient-select');
    const percentageInput = document.getElementById('add-ingredient-percentage');

    const ingredientId = parseInt(select.value);
    const percentage = parseFloat(percentageInput.value);

    if (!ingredientId) {
        showError('Please select an ingredient');
        return;
    }

    if (!percentage || percentage <= 0) {
        showError('Please enter a valid percentage');
        return;
    }

    // Check if ingredient already exists
    if (currentRecipeIngredients.find(ing => ing.ingredient_id === ingredientId)) {
        showError('This ingredient is already in the recipe');
        return;
    }

    const ingredient = ingredients.find(ing => ing.id === ingredientId);
    if (!ingredient) return;

    currentRecipeIngredients.push({
        ingredient_id: ingredientId,
        ingredient_name: ingredient.name,
        percentage: percentage,
        is_percentage: true,
        category: ingredient.category
    });

    // Clear inputs
    select.value = '';
    percentageInput.value = '';

    displayRecipeIngredients();
}

function removeIngredientFromRecipe(ingredientId) {
    currentRecipeIngredients = currentRecipeIngredients.filter(ing => ing.ingredient_id !== ingredientId);
    displayRecipeIngredients();
}

function updateIngredientPercentage(ingredientId, newPercentage) {
    const ingredient = currentRecipeIngredients.find(ing => ing.ingredient_id === ingredientId);
    if (ingredient) {
        ingredient.percentage = parseFloat(newPercentage);
    }
}

function displayRecipeIngredients() {
    const container = document.getElementById('recipe-ingredients-list');

    if (currentRecipeIngredients.length === 0) {
        container.innerHTML = '<p style="color: #95a5a6; text-align: center; padding: 1rem;">No ingredients added yet</p>';
        return;
    }

    // Sort by category
    const sorted = [...currentRecipeIngredients].sort((a, b) => {
        if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
        }
        return a.ingredient_name.localeCompare(b.ingredient_name);
    });

    let html = '';
    sorted.forEach(ing => {
        html += `
            <div class="recipe-ingredient-item">
                <div class="ingredient-info">
                    <span class="ingredient-name">${ing.ingredient_name}</span>
                    <span class="ingredient-percentage">
                        <input type="number"
                               step="0.1"
                               value="${ing.percentage}"
                               onchange="updateIngredientPercentage(${ing.ingredient_id}, this.value)"
                               style="width: 70px; padding: 0.25rem 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                        %
                    </span>
                    <span style="color: #95a5a6; font-size: 0.85rem;">${ing.category}</span>
                </div>
                <div class="ingredient-actions">
                    <button type="button" class="btn-small btn-remove" onclick="removeIngredientFromRecipe(${ing.ingredient_id})">Remove</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function viewRecipeDetails(recipeId) {
    try {
        const response = await fetch(`/api/recipes/${recipeId}`);
        const recipe = await response.json();

        // Create a modal or alert with recipe details
        let details = `Recipe: ${recipe.name}\n\n`;
        details += `Type: ${recipe.recipe_type}\n`;
        details += `Batch Weight: ${recipe.base_batch_weight}g\n`;
        details += `Loaf Weight: ${recipe.loaf_weight}g\n\n`;

        // Cost and pricing info
        if (recipe.cost_per_loaf || recipe.selling_price) {
            details += `--- Cost & Pricing ---\n`;
            if (recipe.cost_per_loaf) {
                details += `Cost per Loaf: $${recipe.cost_per_loaf.toFixed(2)}\n`;
            }
            if (recipe.selling_price) {
                details += `Selling Price: $${recipe.selling_price.toFixed(2)}\n`;
            }
            if (recipe.cost_per_loaf && recipe.selling_price) {
                const profit = recipe.selling_price - recipe.cost_per_loaf;
                const margin = ((profit / recipe.selling_price) * 100).toFixed(1);
                details += `Profit per Loaf: $${profit.toFixed(2)} (${margin}% margin)\n`;
            }
            details += `\n`;
        }

        details += `Ingredients:\n`;
        recipe.ingredients.forEach(ing => {
            if (ing.is_percentage) {
                details += `  - ${ing.ingredient_name}: ${ing.percentage}%\n`;
            } else {
                details += `  - ${ing.ingredient_name}: ${ing.amount_grams}g\n`;
            }
        });

        alert(details);
    } catch (error) {
        console.error('Error loading recipe details:', error);
        showError('Failed to load recipe details');
    }
}

function closeRecipeModal() {
    document.getElementById('recipe-modal').classList.remove('show');
}

async function handleRecipeSubmit(e) {
    e.preventDefault();

    const recipeId = document.getElementById('recipe-id').value;
    const sellingPriceValue = document.getElementById('recipe-selling-price').value;
    const recipeData = {
        name: document.getElementById('recipe-name').value,
        recipe_type: document.getElementById('recipe-type').value,
        base_batch_weight: parseFloat(document.getElementById('base-batch-weight').value),
        loaf_weight: parseFloat(document.getElementById('loaf-weight').value),
        notes: document.getElementById('recipe-notes').value,
        selling_price: sellingPriceValue ? parseFloat(sellingPriceValue) : null,
        ingredients: currentRecipeIngredients.map(ing => ({
            ingredient_id: ing.ingredient_id,
            percentage: ing.percentage,
            is_percentage: true
        }))
    };

    try {
        const url = recipeId ? `/api/recipes/${recipeId}` : '/api/recipes';
        const method = recipeId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(recipeData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            showError(errorData.error || 'Error saving recipe');
            return;
        }

        showSuccess(recipeId ? 'Recipe updated successfully!' : 'Recipe added successfully!');
        closeRecipeModal();
        loadRecipes();

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to save recipe');
    }
}

function showAddIngredientModal() {
    document.getElementById('ingredient-form').reset();
    document.getElementById('ingredient-modal').classList.add('show');
}

function closeIngredientModal() {
    document.getElementById('ingredient-modal').classList.remove('show');
}

async function handleIngredientSubmit(e) {
    e.preventDefault();

    const costValue = document.getElementById('ingredient-cost').value;
    const ingredientData = {
        name: document.getElementById('ingredient-name').value,
        category: document.getElementById('ingredient-category').value,
        cost_per_unit: costValue ? parseFloat(costValue) : null
    };

    try {
        const response = await fetch('/api/ingredients', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ingredientData)
        });

        if (!response.ok) {
            showError('Error adding ingredient');
            return;
        }

        showSuccess('Ingredient added successfully!');
        closeIngredientModal();
        loadIngredients();

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to add ingredient');
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
