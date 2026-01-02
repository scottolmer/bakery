// Recipe Management JavaScript

let recipes = [];
let ingredients = [];

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
        recipes = await response.json();
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

function displayRecipes() {
    const container = document.getElementById('recipes-list');

    if (recipes.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No recipes found. Add your first recipe!</p>';
        return;
    }

    let html = '';
    recipes.forEach(recipe => {
        html += `
            <div class="recipe-card">
                <h4>${recipe.name}</h4>
                <div class="recipe-meta">
                    <span><strong>Type:</strong> ${recipe.recipe_type}</span>
                    <span><strong>Batch:</strong> ${recipe.base_batch_weight}g</span>
                    <span><strong>Loaf:</strong> ${recipe.loaf_weight}g</span>
                </div>
                <div class="recipe-actions">
                    <button class="btn-edit" onclick="editRecipe(${recipe.id})">Edit</button>
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
            html += `
                <div class="ingredient-card">
                    <h5>${ing.name}</h5>
                    <p class="ingredient-category">${ing.category}</p>
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
    document.getElementById('recipe-modal').classList.add('show');
}

function editRecipe(recipeId) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    document.getElementById('recipe-modal-title').textContent = 'Edit Recipe';
    document.getElementById('recipe-id').value = recipe.id;
    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-type').value = recipe.recipe_type;
    document.getElementById('base-batch-weight').value = recipe.base_batch_weight;
    document.getElementById('loaf-weight').value = recipe.loaf_weight;
    document.getElementById('recipe-notes').value = recipe.notes || '';
    document.getElementById('recipe-modal').classList.add('show');
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
    const recipeData = {
        name: document.getElementById('recipe-name').value,
        recipe_type: document.getElementById('recipe-type').value,
        base_batch_weight: parseFloat(document.getElementById('base-batch-weight').value),
        loaf_weight: parseFloat(document.getElementById('loaf-weight').value),
        notes: document.getElementById('recipe-notes').value
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
            showError('Error saving recipe');
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

    const ingredientData = {
        name: document.getElementById('ingredient-name').value,
        category: document.getElementById('ingredient-category').value
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
