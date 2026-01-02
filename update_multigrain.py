"""
Update Multigrain recipe to use Italian dough + soak
"""
from app import app, db, Recipe, RecipeIngredient, Ingredient

with app.app_context():
    # 1. Create "Italian dough" ingredient if it doesn't exist
    italian_dough = Ingredient.query.filter_by(name='Italian dough').first()
    if not italian_dough:
        italian_dough = Ingredient(
            name='Italian dough',
            category='dough',
            unit='grams'
        )
        db.session.add(italian_dough)
        db.session.commit()
        print(f'[OK] Created ingredient: Italian dough (ID: {italian_dough.id})')
    else:
        print(f'[OK] Italian dough already exists (ID: {italian_dough.id})')

    # 2. Get Multigrain recipe
    multigrain = Recipe.query.filter_by(name='Multigrain').first()
    if not multigrain:
        print('[ERROR] Multigrain recipe not found!')
        exit(1)

    print(f'\n[OK] Found Multigrain recipe (ID: {multigrain.id})')
    print(f'  Loaf weight: {multigrain.loaf_weight}g')

    # 3. Remove Poolish and Levain from Multigrain (they're in Italian dough now)
    removed = []
    for ri in multigrain.ingredients:
        if ri.ingredient.name in ['Poolish', 'Levain']:
            removed.append(ri.ingredient.name)
            db.session.delete(ri)

    if removed:
        print(f'\n[OK] Removed from Multigrain: {", ".join(removed)}')

    # 4. Add Italian dough to Multigrain
    # For a 1000g Multigrain loaf, we need to figure out how much Italian dough
    # Let's say 85% Italian dough (850g) + 15% soak (150g) = 1000g total
    # This means Italian dough is 85% of the final weight

    italian_dough_ri = RecipeIngredient.query.filter_by(
        recipe_id=multigrain.id,
        ingredient_id=italian_dough.id
    ).first()

    if not italian_dough_ri:
        # Add Italian dough as 85% of total weight
        italian_dough_ri = RecipeIngredient(
            recipe_id=multigrain.id,
            ingredient_id=italian_dough.id,
            is_percentage=True,
            percentage=85.0,
            amount_grams=None
        )
        db.session.add(italian_dough_ri)
        print(f'\n[OK] Added Italian dough: 85% (850g for 1000g loaf)')
    else:
        print(f'\n[OK] Italian dough already in recipe')

    # 5. Check the 7 Grain Soaker
    soaker = Ingredient.query.filter_by(name='7 Grain Soaker').first()
    if soaker:
        soaker_ri = RecipeIngredient.query.filter_by(
            recipe_id=multigrain.id,
            ingredient_id=soaker.id
        ).first()
        if soaker_ri:
            # Update to 15% of total weight
            soaker_ri.is_percentage = True
            soaker_ri.percentage = 15.0
            soaker_ri.amount_grams = None
            print(f'[OK] Updated 7 Grain Soaker: 15% (150g for 1000g loaf)')

    db.session.commit()
    print('\n[OK] Multigrain recipe updated successfully!')

    # Print final recipe
    print('\nFinal Multigrain recipe:')
    multigrain = Recipe.query.filter_by(name='Multigrain').first()
    for ri in multigrain.ingredients:
        if ri.is_percentage:
            print(f'  {ri.ingredient.name}: {ri.percentage}% ({ri.ingredient.category})')
        else:
            print(f'  {ri.ingredient.name}: {ri.amount_grams}g ({ri.ingredient.category})')
