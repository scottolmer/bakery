from app import app
from models import db, Recipe, Ingredient

with app.app_context():
    print('\n=== All Starter Recipes ===')
    starters = Recipe.query.filter_by(recipe_type='starter').all()
    for r in starters:
        print(f'{r.id}: {r.name}')

    print('\n=== Looking for Emmy ===')
    emmy = Recipe.query.filter(Recipe.name.like('%Emmy%')).first()
    if emmy:
        print(f'Found recipe: {emmy.name}')
    else:
        print('Emmy not found in recipes')

    emmy_ing = Ingredient.query.filter(Ingredient.name.like('%Emmy%')).first()
    if emmy_ing:
        print(f'Found ingredient: {emmy_ing.name}')
    else:
        print('Emmy not found in ingredients')
