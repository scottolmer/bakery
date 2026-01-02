"""
Update Levain recipes to include Emmy as seed starter
"""
from app import app
from models import db, Recipe, Ingredient, RecipeIngredient

with app.app_context():
    print('\n=== Updating Levain Recipes with Emmy ===')

    # Get Emmy ingredient
    emmy = Ingredient.query.filter_by(name='Emmy(starter)').first()
    if not emmy:
        print('[ERROR] Emmy ingredient not found!')
        exit(1)

    # Get other ingredients
    red_rose = Ingredient.query.filter_by(name='Red Rose Flour').first()
    water = Ingredient.query.filter_by(name='Water').first()

    # Update Levain
    print('\n1. Updating Levain...')
    levain = Recipe.query.filter_by(name='Levain').first()
    if levain:
        # Clear existing ingredients
        RecipeIngredient.query.filter_by(recipe_id=levain.id).delete()

        # Add ingredients with Emmy
        ingredients = [
            RecipeIngredient(
                recipe_id=levain.id,
                ingredient_id=red_rose.id,
                percentage=100.0,
                is_percentage=True,
                order=1
            ),
            RecipeIngredient(
                recipe_id=levain.id,
                ingredient_id=water.id,
                percentage=100.0,
                is_percentage=True,
                order=2
            ),
            RecipeIngredient(
                recipe_id=levain.id,
                ingredient_id=emmy.id,
                percentage=20.0,  # 0.2 from Excel = 20%
                is_percentage=True,
                order=3
            )
        ]

        for ing in ingredients:
            db.session.add(ing)

        print('[OK] Levain updated with Emmy')
        print('  Ingredients:')
        for ri in ingredients:
            print(f'    {ri.ingredient.name}: {ri.percentage}%')

    # Update Italian Levain
    print('\n2. Updating Italian Levain...')
    itl_levain = Recipe.query.filter_by(name='Itl Levain').first()
    if itl_levain:
        # Clear existing ingredients
        RecipeIngredient.query.filter_by(recipe_id=itl_levain.id).delete()

        # Add ingredients with Emmy
        ingredients = [
            RecipeIngredient(
                recipe_id=itl_levain.id,
                ingredient_id=red_rose.id,
                percentage=100.0,
                is_percentage=True,
                order=1
            ),
            RecipeIngredient(
                recipe_id=itl_levain.id,
                ingredient_id=water.id,
                percentage=100.0,
                is_percentage=True,
                order=2
            ),
            RecipeIngredient(
                recipe_id=itl_levain.id,
                ingredient_id=emmy.id,
                percentage=20.0,  # 0.2 from Excel = 20%
                is_percentage=True,
                order=3
            )
        ]

        for ing in ingredients:
            db.session.add(ing)

        print('[OK] Italian Levain updated with Emmy')
        print('  Ingredients:')
        for ri in ingredients:
            print(f'    {ri.ingredient.name}: {ri.percentage}%')

    db.session.commit()
    print('\n[SUCCESS] All starters updated!')
