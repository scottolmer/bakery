from app import app
from models import db, Recipe, Ingredient

with app.app_context():
    total_recipes = Recipe.query.count()
    total_ingredients = Ingredient.query.count()

    print(f"Total Recipes: {total_recipes}")
    print(f"Total Ingredients: {total_ingredients}")
    print("\nRecipes by type:")

    for rtype in ['bread', 'starter', 'soaker']:
        count = Recipe.query.filter_by(recipe_type=rtype).count()
        print(f"  {rtype}: {count}")

    print("\nSample recipes:")
    for recipe in Recipe.query.limit(10).all():
        print(f"  - {recipe.name} ({recipe.recipe_type}): {recipe.loaf_weight}g")
