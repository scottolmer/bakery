from app import app
from models import db, Recipe, Ingredient, RecipeIngredient

with app.app_context():
    # Get recipes and ingredients
    levain = Recipe.query.filter_by(name='Levain').first()
    itl_levain = Recipe.query.filter_by(name='Itl Levain').first()
    emmy_ing = Ingredient.query.filter_by(name='Emmy(starter)').first()
    red_rose = Ingredient.query.filter_by(name='Red Rose Flour').first()
    water = Ingredient.query.filter_by(name='Water').first()

    print(f'\nLevain ID: {levain.id}')
    print(f'Itl Levain ID: {itl_levain.id}')
    print(f'Emmy ingredient ID: {emmy_ing.id}')
    print(f'Red Rose ID: {red_rose.id}')
    print(f'Water ID: {water.id}')

    # Clear existing
    print('\nClearing existing ingredients...')
    RecipeIngredient.query.filter_by(recipe_id=levain.id).delete()
    RecipeIngredient.query.filter_by(recipe_id=itl_levain.id).delete()
    db.session.commit()

    # Add Levain ingredients
    print('\nAdding Levain ingredients...')
    levain_ings = [
        RecipeIngredient(recipe_id=levain.id, ingredient_id=red_rose.id, percentage=100.0, is_percentage=True, order=1),
        RecipeIngredient(recipe_id=levain.id, ingredient_id=water.id, percentage=100.0, is_percentage=True, order=2),
        RecipeIngredient(recipe_id=levain.id, ingredient_id=emmy_ing.id, percentage=20.0, is_percentage=True, order=3)
    ]
    for ri in levain_ings:
        db.session.add(ri)
        print(f'  Added: ingredient_id={ri.ingredient_id}, percentage={ri.percentage}')

    # Add Itl Levain ingredients
    print('\nAdding Italian Levain ingredients...')
    itl_ings = [
        RecipeIngredient(recipe_id=itl_levain.id, ingredient_id=red_rose.id, percentage=100.0, is_percentage=True, order=1),
        RecipeIngredient(recipe_id=itl_levain.id, ingredient_id=water.id, percentage=100.0, is_percentage=True, order=2),
        RecipeIngredient(recipe_id=itl_levain.id, ingredient_id=emmy_ing.id, percentage=20.0, is_percentage=True, order=3)
    ]
    for ri in itl_ings:
        db.session.add(ri)
        print(f'  Added: ingredient_id={ri.ingredient_id}, percentage={ri.percentage}')

    db.session.commit()
    print('\n[SUCCESS] Committed to database!')

    # Verify
    print('\nVerifying...')
    levain_count = RecipeIngredient.query.filter_by(recipe_id=levain.id).count()
    itl_count = RecipeIngredient.query.filter_by(recipe_id=itl_levain.id).count()
    print(f'Levain now has {levain_count} ingredients')
    print(f'Italian Levain now has {itl_count} ingredients')
