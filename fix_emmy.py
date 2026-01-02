"""
Fix Emmy starter recipe - add missing ingredients
"""
from app import app
from models import db, Recipe, Ingredient, RecipeIngredient

with app.app_context():
    print('\n=== Fixing Emmy Starter ===')

    # Get Emmy recipe
    emmy = Recipe.query.filter_by(name='Emmy(starter)').first()
    if not emmy:
        print('[ERROR] Emmy recipe not found!')
        exit(1)

    # Set base batch weight
    emmy.base_batch_weight = 1500.0
    emmy.loaf_weight = 1500.0

    # Get ingredients
    red_rose = Ingredient.query.filter_by(name='Red Rose Flour').first()
    water = Ingredient.query.filter_by(name='Water').first()
    levain = Ingredient.query.filter_by(name='Levain').first()

    if not all([red_rose, water, levain]):
        print('[ERROR] Required ingredients not found!')
        print(f'  Red Rose: {red_rose}')
        print(f'  Water: {water}')
        print(f'  Levain: {levain}')
        exit(1)

    # Clear existing ingredients
    RecipeIngredient.query.filter_by(recipe_id=emmy.id).delete()

    # Add ingredients based on Excel formula
    ingredients = [
        RecipeIngredient(
            recipe_id=emmy.id,
            ingredient_id=red_rose.id,
            percentage=100.0,
            is_percentage=True,
            order=1
        ),
        RecipeIngredient(
            recipe_id=emmy.id,
            ingredient_id=water.id,
            percentage=100.0,
            is_percentage=True,
            order=2
        ),
        RecipeIngredient(
            recipe_id=emmy.id,
            ingredient_id=levain.id,
            percentage=25.0,
            is_percentage=True,
            order=3
        )
    ]

    for ing in ingredients:
        db.session.add(ing)

    db.session.commit()

    print('[OK] Emmy starter fixed!')
    print(f'\nEmmy ingredients:')
    for ri in emmy.ingredients:
        print(f'  {ri.ingredient.name}: {ri.percentage}%')

    # Check if Emmy exists as an ingredient
    emmy_ingredient = Ingredient.query.filter_by(name='Emmy(starter)').first()
    if not emmy_ingredient:
        print('\n[CREATING] Emmy as ingredient for other recipes to use...')
        emmy_ingredient = Ingredient(
            name='Emmy(starter)',
            category='starter'
        )
        db.session.add(emmy_ingredient)
        db.session.commit()
        print('[OK] Emmy ingredient created!')

    # Check which breads use Emmy
    print('\n=== Checking bread dependencies ===')
    from excel_parser import RECIPE_DEPENDENCIES

    emmy_users = []
    for bread_name, deps in RECIPE_DEPENDENCIES.items():
        if 'Emmy(starter)' in deps.get('starters', []):
            emmy_users.append(bread_name)

    if emmy_users:
        print(f'Breads that should use Emmy: {", ".join(emmy_users)}')
    else:
        print('No breads currently use Emmy in dependencies')
