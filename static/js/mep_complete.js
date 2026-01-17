// Complete MEP Sheets JavaScript

let allSheets = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.getElementById('mep-date');
    if (dateInput) {
        // Check if date is in URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const dateParam = urlParams.get('date');

        if (dateParam) {
            // Use date from URL and auto-load sheets
            dateInput.value = dateParam;
            loadAllSheets();
        } else {
            // Default to today
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }
    }
});

async function loadAllSheets() {
    const dateInput = document.getElementById('mep-date');
    const mepDate = dateInput.value;

    if (!mepDate) {
        showError('Please select a date');
        return;
    }

    try {
        const response = await fetch(`/api/mep/${mepDate}/all`);

        if (!response.ok) {
            if (response.status === 404) {
                showError('No production run found for this date. Create one first in the Production Entry page.');
            } else {
                showError('Error loading MEP sheets');
            }
            return;
        }

        allSheets = await response.json();
        displayAllSheets(allSheets);
        document.getElementById('error-message').style.display = 'none';
        document.getElementById('sheet-tabs').style.display = 'flex';

        // Show date info and batch ID
        const dateInfo = document.getElementById('date-info');
        dateInfo.style.display = 'block';
        document.getElementById('batch-id').textContent = allSheets.batch_id || 'N/A';
        document.getElementById('delivery-date').textContent = formatDate(allSheets.delivery_date);
        document.getElementById('mix-date').textContent = formatDate(allSheets.mix_date);
        document.getElementById('prep-date').textContent = formatDate(allSheets.prep_date);

        // Update sheet subtitles with actual dates
        const mixDate = formatDateShort(allSheets.mix_date);
        const prepDate = formatDateShort(allSheets.prep_date);

        document.getElementById('mix-subtitle').textContent = `Mix doughs on ${mixDate} morning`;
        document.getElementById('emmy-subtitle').textContent = `Feed Emmy on ${mixDate} morning using yesterday's leftover Levain`;
        document.getElementById('starters-subtitle').textContent = `Built on ${prepDate} evening for ${mixDate} mix`;
        document.getElementById('soakers-subtitle').textContent = `Prepared on ${prepDate} evening for ${mixDate} mix`;
        document.getElementById('mep-subtitle').textContent = `Measured on ${prepDate} evening for ${mixDate} mix`;

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to load MEP sheets');
    }
}

function displayAllSheets(sheets) {
    displayMixSheet(sheets.mix_sheet);
    displayMorningEmmyFeed(sheets.morning_emmy_feed);
    displayStarterSheet(sheets.starter_sheet);
    displaySoakerSheet(sheets.soak_sheet);
    displayMEPIngredients(sheets.mep_ingredients);
}

function displayMixSheet(mixSheet) {
    const container = document.getElementById('mix-sheet-content');

    if (!mixSheet.breads || mixSheet.breads.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No breads to mix</p>';
        return;
    }

    let html = '';

    for (const bread of mixSheet.breads) {
        // Add batch highlighting class if this is a batch
        const batchClass = bread.batch_number ? 'bread-item-batch' : 'bread-item';

        html += `
            <div class="${batchClass}">
                <h3>${bread.name}</h3>
                <div class="bread-info">
                    <div class="info-item">
                        <span class="info-label">Quantity:</span>
                        <span>${bread.quantity} loaves</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Loaf Weight:</span>
                        <span>${bread.loaf_weight}g</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Total Weight:</span>
                        <span>${bread.total_weight.toLocaleString()}g</span>
                    </div>
                </div>
        `;

        // Show extra dough note if applicable
        if (bread.extra_dough_for && bread.extra_dough_for.length > 0) {
            html += '<div class="alert alert-info" style="margin-top: 1rem;">';
            html += '<strong>Note:</strong> This batch includes extra dough for:<br>';
            for (const extra of bread.extra_dough_for) {
                html += `&nbsp;&nbsp;• ${extra.name}: ${extra.quantity} loaves (${extra.amount.toLocaleString()}g)<br>`;
            }
            html += '</div>';
        }

        // Show Italian dough removal note if applicable
        if (bread.italian_dough_amount) {
            html += '<div class="alert alert-info" style="margin-top: 1rem;">';
            html += `<strong>From Italian Batch:</strong> Remove ${bread.italian_dough_amount.toLocaleString()}g of Italian dough<br>`;
            html += 'Then mix with the ingredients below:';
            html += '</div>';
        }

        html += `
                <table class="ingredient-table">
                    <thead>
                        <tr>
                            <th>Ingredient</th>
                            <th>Amount (g)</th>
                            <th>Category</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (const ing of bread.ingredients) {
            html += `
                <tr>
                    <td><strong>${ing.name}</strong></td>
                    <td>${ing.amount_grams.toLocaleString()}g</td>
                    <td><span class="badge">${ing.category}</span></td>
                </tr>
            `;
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;
    }

    container.innerHTML = html;
}

function displayMorningEmmyFeed(morningEmmyData) {
    const container = document.getElementById('morning-emmy-content');

    // Log what we received for debugging
    console.log('Morning Emmy Data:', morningEmmyData);

    if (!morningEmmyData || !morningEmmyData.emmy_feed) {
        let html = '<p class="placeholder-text">No Emmy feed needed (no production scheduled for tomorrow)</p>';

        // ALWAYS show debug section when no Emmy feed
        html += '<div style="margin-top: 2rem; padding: 1.5rem; background: #fff3cd; border: 2px solid #ffc107; border-radius: 4px;">';
        html += '<h4 style="margin-top: 0; color: #856404;">🔍 Debug Information</h4>';

        if (morningEmmyData && morningEmmyData.debug) {
            const debug = morningEmmyData.debug;
            html += '<div style="font-family: monospace; font-size: 0.95rem; color: #2c3e50;">';
            html += '<p><strong>Looking for date:</strong> ' + debug.looking_for_date + '</p>';
            html += '<p><strong>Current delivery date:</strong> ' + debug.current_delivery_date + '</p>';
            html += '<p><strong>Found next day run:</strong> ' + debug.found_run + '</p>';

            // Show items count and details
            if (debug.next_run_items_count !== undefined) {
                html += '<p><strong>Next day items count:</strong> <span style="color: ' + (debug.next_run_items_count > 0 ? '#28a745' : '#e74c3c') + '; font-weight: bold;">' + debug.next_run_items_count + '</span></p>';

                if (debug.next_run_items && debug.next_run_items.length > 0) {
                    html += '<p><strong>Next day breads:</strong></p>';
                    html += '<ul style="margin: 0.5rem 0; padding-left: 2rem;">';
                    for (const item of debug.next_run_items) {
                        html += '<li>' + item.recipe + ' × ' + item.quantity + '</li>';
                    }
                    html += '</ul>';
                }
            }

            if (debug.reason) {
                html += '<p><strong>Reason:</strong> <span style="color: #e74c3c;">' + debug.reason + '</span></p>';
            }

            if (debug.starters_checked) {
                html += '<p><strong>Starters checked:</strong> ' + debug.starters_checked.join(', ') + '</p>';
            }

            if (debug.starters_detail) {
                html += '<p><strong>Starters detail:</strong></p>';
                html += '<ul style="margin: 0.5rem 0; padding-left: 2rem;">';
                for (const [name, detail] of Object.entries(debug.starters_detail)) {
                    html += '<li>' + name + ': ' + detail.grams.toFixed(1) + 'g</li>';
                }
                html += '</ul>';
            }

            if (debug.total_emmy_needed !== undefined) {
                html += '<p><strong>Total Emmy needed:</strong> ' + debug.total_emmy_needed.toFixed(1) + 'g</p>';
            }

            if (debug.available_starter_recipes) {
                html += '<p><strong>Available starter recipes in database:</strong> ' + debug.available_starter_recipes.join(', ') + '</p>';
            }

            if (debug.emmy_calc_debug) {
                html += '<p><strong>Emmy calculation details:</strong></p>';
                html += '<ul style="margin: 0.5rem 0; padding-left: 2rem; font-size: 0.9rem;">';
                for (const calc of debug.emmy_calc_debug) {
                    html += '<li>' + calc.starter;
                    if (calc.starter_name_repr) {
                        html += ' <span style="color: #999; font-size: 0.85rem;">(' + calc.starter_name_repr + ')</span>';
                    }
                    html += ' (' + calc.grams.toFixed(1) + 'g):';
                    if (calc.recipe_found) {
                        html += ' Recipe found ✓';
                        if (calc.total_percentage !== undefined) {
                            html += ', Total %: ' + calc.total_percentage;
                        }
                        if (calc.flour_weight !== undefined) {
                            html += ', Flour: ' + calc.flour_weight.toFixed(1) + 'g';
                        }
                        if (calc.emmy_found !== undefined) {
                            if (calc.emmy_found) {
                                html += ', Emmy found ✓';
                                if (calc.emmy_percentage) {
                                    html += ' (' + calc.emmy_percentage + '%)';
                                }
                                if (calc.emmy_amount !== undefined) {
                                    html += ', Calculated: ' + calc.emmy_amount.toFixed(1) + 'g';
                                }
                            } else {
                                html += ', <span style="color: #e74c3c;">Emmy NOT found in recipe</span>';
                            }
                        }
                    } else {
                        html += ' <span style="color: #e74c3c;">Recipe NOT found</span>';
                    }
                    html += '</li>';
                }
                html += '</ul>';
            }

            html += '<p><strong>All production dates:</strong> ' + debug.all_production_dates.join(', ') + '</p>';
            html += '</div>';
        } else {
            html += '<p style="color: #856404;">No debug data available. Data structure: ' + JSON.stringify(morningEmmyData) + '</p>';
        }

        html += '</div>';

        container.innerHTML = html;
        return;
    }

    const feed = morningEmmyData.emmy_feed;

    let html = `
        <div class="emmy-feed-card">
            <div class="alert alert-info">
                <strong>Note:</strong> ${feed.note}
            </div>

            <h3>Emmy Feed Recipe</h3>
            <p><strong>Total Emmy Needed: ${feed.total_grams.toLocaleString()}g</strong></p>

            <table class="ingredient-table">
                <thead>
                    <tr>
                        <th>Ingredient</th>
                        <th>Amount (g)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (const ing of feed.ingredients) {
        const isLevain = ing.name.includes('Yesterday');
        const rowClass = isLevain ? 'highlight-row' : '';
        html += `
            <tr class="${rowClass}">
                <td>${ing.name}</td>
                <td><strong>${ing.amount_grams.toLocaleString()}g</strong></td>
            </tr>
        `;
    }

    html += `
                </tbody>
            </table>

            <div class="feed-instructions">
                <h4>Instructions:</h4>
                <ol>
                    <li>Save leftover Levain from yesterday (keep warm)</li>
                    <li>Mix the ingredients above this morning</li>
                    <li>Feed Emmy will be ready by tonight for Levain build</li>
                    <li>Keep Emmy warm throughout the day</li>
                </ol>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function displayStarterSheet(starterSheet) {
    const container = document.getElementById('starters-sheet-content');

    if (!starterSheet.starters || starterSheet.starters.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No starters needed for tomorrow</p>';
        return;
    }

    let html = '';

    for (const starter of starterSheet.starters) {
        // Add batch highlighting class if this is a batch
        const batchClass = starter.batch_number ? 'starter-card-batch' : 'starter-card';

        html += `
            <div class="${batchClass}">
                <h3>${starter.starter_name}</h3>
                <p><strong>Total Needed: ${starter.total_grams.toLocaleString()}g</strong></p>

                <div class="needed-for">
                    <strong>Needed for:</strong><br>
        `;

        if (starter.recipes_needing && starter.recipes_needing.length > 0) {
            for (const recipe of starter.recipes_needing) {
                html += `${recipe.recipe} (${recipe.amount_grams.toLocaleString()}g)<br>`;
            }
        } else if (starter.batch_number === 2) {
            html += `(Same as Batch 1)<br>`;
        }

        html += `</div>`;

        if (starter.ingredients && starter.ingredients.length > 0) {
            html += `
                <table class="ingredient-table">
                    <thead>
                        <tr>
                            <th>Ingredient</th>
                            <th>Amount (g)</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            for (const ing of starter.ingredients) {
                html += `
                    <tr>
                        <td>${ing.name}</td>
                        <td><strong>${ing.amount_grams.toLocaleString()}g</strong></td>
                    </tr>
                `;
            }

            html += `
                    </tbody>
                </table>
            `;
        }

        html += `</div>`;
    }

    container.innerHTML = html;
}

function displaySoakerSheet(soakerSheet) {
    const container = document.getElementById('soakers-sheet-content');

    if (!soakerSheet.soakers || soakerSheet.soakers.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No soakers needed for tomorrow</p>';
        return;
    }

    let html = '';

    for (const soaker of soakerSheet.soakers) {
        html += `
            <div class="soaker-card">
                <h3>${soaker.soaker_name}</h3>
                <p><strong>Total Needed: ${soaker.total_grams.toLocaleString()}g</strong></p>

                <div class="needed-for">
                    <strong>Needed for:</strong><br>
        `;

        for (const recipe of soaker.recipes_needing) {
            html += `${recipe.recipe} (${recipe.amount_grams.toLocaleString()}g)<br>`;
        }

        html += `</div>`;

        if (soaker.ingredients && soaker.ingredients.length > 0) {
            html += `
                <table class="ingredient-table">
                    <thead>
                        <tr>
                            <th>Ingredient</th>
                            <th>Amount (g)</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            for (const ing of soaker.ingredients) {
                html += `
                    <tr>
                        <td>${ing.name}</td>
                        <td><strong>${ing.amount_grams.toLocaleString()}g</strong></td>
                    </tr>
                `;
            }

            html += `
                    </tbody>
                </table>
            `;
        }

        html += `</div>`;
    }

    container.innerHTML = html;
}

function displayMEPIngredients(mepIngredients) {
    const container = document.getElementById('ingredients-sheet-content');

    if (!mepIngredients.breads || mepIngredients.breads.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No ingredients to prep</p>';
        return;
    }

    let html = '<div class="mep-ingredients-list">';

    // Display starters section
    if (mepIngredients.starters && mepIngredients.starters.length > 0) {
        html += '<div class="mep-section"><h3 class="section-title">Starters to Build</h3>';
        for (const starter of mepIngredients.starters) {
            html += `
                <div class="ingredient-bin">
                    <h4>${starter.starter_name}</h4>
                    <p class="bin-info">Total needed: ${starter.total_grams.toLocaleString()}g</p>
                    <table class="ingredient-table">
                        <thead>
                            <tr>
                                <th>Ingredient</th>
                                <th>Amount (g)</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            for (const ing of starter.ingredients) {
                html += `
                    <tr>
                        <td>${ing.name}</td>
                        <td><strong>${ing.amount_grams.toLocaleString()}g</strong></td>
                    </tr>
                `;
            }

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        html += '</div>';
    }

    // Display soakers section
    if (mepIngredients.soakers && mepIngredients.soakers.length > 0) {
        html += '<div class="mep-section"><h3 class="section-title">Soakers to Prepare</h3>';
        for (const soaker of mepIngredients.soakers) {
            html += `
                <div class="ingredient-bin">
                    <h4>${soaker.soaker_name}</h4>
                    <p class="bin-info">Total needed: ${soaker.total_grams.toLocaleString()}g</p>
                    <table class="ingredient-table">
                        <thead>
                            <tr>
                                <th>Ingredient</th>
                                <th>Amount (g)</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            for (const ing of soaker.ingredients) {
                html += `
                    <tr>
                        <td>${ing.name}</td>
                        <td><strong>${ing.amount_grams.toLocaleString()}g</strong></td>
                    </tr>
                `;
            }

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        html += '</div>';
    }

    // Display bread ingredients by bread type
    html += '<div class="mep-section"><h3 class="section-title">Bread Ingredient Bins</h3>';
    html += '<p class="section-note">Pre-measure ingredients into bins labeled for each bread type</p>';

    for (const bread of mepIngredients.breads) {
        html += `
            <div class="ingredient-bin bread-bin">
                <div class="bin-header">
                    <h4>${bread.bread_name}</h4>
                    <span class="bin-badge">${bread.quantity} loaves</span>
                </div>
                <p class="bin-info">Total dough weight: ${bread.total_weight.toLocaleString()}g</p>
        `;

        // Show Italian dough removal note if applicable
        if (bread.italian_dough_amount) {
            html += `
                <div class="alert alert-info" style="margin-bottom: 1rem;">
                    <strong>From Italian Batch:</strong> Remove ${bread.italian_dough_amount.toLocaleString()}g of Italian dough
                </div>
            `;
        }

        if (bread.ingredients && bread.ingredients.length > 0) {
            html += `
                <table class="ingredient-table">
                    <thead>
                        <tr>
                            <th>Ingredient</th>
                            <th>Amount (g)</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            for (const ing of bread.ingredients) {
                html += `
                    <tr>
                        <td>${ing.name}</td>
                        <td><strong>${ing.amount_grams.toLocaleString()}g</strong></td>
                    </tr>
                `;
            }

            html += `
                    </tbody>
                </table>
            `;
        }

        html += '</div>';
    }

    html += '</div></div>';

    container.innerHTML = html;
}

function showTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Deactivate all buttons
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    document.getElementById('tab-' + tabName).classList.add('active');

    // Activate button
    event.target.classList.add('active');

    // Initialize mixing log when tab is shown
    if (tabName === 'mixing-log') {
        initializeMixingLog();
    }
}

function formatDate(dateStr) {
    // Parse date string manually to avoid timezone issues
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatDateShort(dateStr) {
    // Parse date string manually to avoid timezone issues
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 7000);
}
