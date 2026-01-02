from app import app
from models import db, Recipe, RecipeIngredient, Ingredient

with app.app_context():
    emmy = Recipe.query.filter_by(name='Emmy(starter)').first()
    print(f'\nEmmy Recipe ID: {emmy.id}')
    print(f'Base Batch Weight: {emmy.base_batch_weight}g')

    print(f'\nEmmy Ingredients:')
    for ri in emmy.ingredients:
        print(f'  {ri.ingredient.name}: {ri.percentage}%')

    print(f'\n\nBreads that use Emmy:')
    emmy_ingredient = Ingredient.query.filter_by(name='Emmy(starter)').first()
    if emmy_ingredient:
        breads = RecipeIngredient.query.filter_by(ingredient_id=emmy_ingredient.id).all()
        if breads:
            for ri in breads:
                if ri.recipe.recipe_type == 'bread':
                    print(f'  {ri.recipe.name} uses {ri.percentage}% Emmy')
        else:
            print('  No breads use Emmy yet')
    else:
        print('  Emmy not found as ingredient - need to check dependencies')

    # Check recipe dependencies
    print('\n\nChecking all bread dependencies for Emmy:')
    breads = Recipe.query.filter_by(recipe_type='bread').all()
    for bread in breads:
        for ri in bread.ingredients:
            if 'emmy' in ri.ingredient.name.lower():
                print(f'  {bread.name} uses {ri.ingredient.name}')
