"""
Migration: Add recipe dependencies for starters and soakers
"""
from app import app
from models import db, Recipe, RecipeIngredient, Ingredient

# Mapping of bread recipes to their starter/soaker requirements
RECIPE_DEPENDENCIES = {
    'Italian': {
        'starters': ['Poolish', 'Levain'],
        'soakers': []
    },
    'Multigrain': {
        'starters': ['Poolish', 'Levain'],
        'soakers': ['7 Grain Soaker']
    },
    'Rustic White': {
        'starters': ['Levain', 'Biga'],
        'soakers': ['RW Soaker']
    },
    'Baguette': {
        'starters': ['Levain'],
        'soakers': []
    },
    'Pain dMie': {
        'starters': ['Levain'],  # Using Levain Discard
        'soakers': []
    },
    'Brioche': {
        'starters': [],
        'soakers': []
    },
    'Croissant': {
        'starters': [],
        'soakers': []
    },
    'Dinkel': {
        'starters': ['Levain'],
        'soakers': ['Dinkel Soaker']
    },
    'Two-Day Italian': {
        'starters': ['Poolish', 'Levain'],
        'soakers': []
    },
    'Two-Day Multigrain': {
        'starters': ['Poolish', 'Levain'],
        'soakers': ['7 Grain Soaker']
    },
    'Two-Day Baguette': {
        'starters': ['Biga', 'Levain'],
        'soakers': []
    }
}

def add_dependencies():
    """Add starter and soaker dependencies to recipes"""
    with app.app_context():
        print("Adding recipe dependencies...")

        for recipe_name, deps in RECIPE_DEPENDENCIES.items():
            recipe = Recipe.query.filter_by(name=recipe_name).first()
            if not recipe:
                print(f"  [SKIP] Recipe '{recipe_name}' not found")
                continue

            print(f"\n  Processing: {recipe_name}")

            # Add starters
            for starter_name in deps['starters']:
                starter = Ingredient.query.filter_by(name=starter_name).first()
                if not starter:
                    # Try to find as a recipe
                    starter_recipe = Recipe.query.filter_by(name=starter_name).first()
                    if starter_recipe:
                        # Create ingredient reference if needed
                        starter = Ingredient.query.filter_by(name=starter_name).first()
                        if not starter:
                            starter = Ingredient(name=starter_name, category='starter')
                            db.session.add(starter)
                            db.session.flush()

                if starter:
                    # Check if already exists
                    existing = RecipeIngredient.query.filter_by(
                        recipe_id=recipe.id,
                        ingredient_id=starter.id
                    ).first()

                    if not existing:
                        # Add with a default percentage (will be calculated dynamically)
                        recipe_ing = RecipeIngredient(
                            recipe_id=recipe.id,
                            ingredient_id=starter.id,
                            percentage=30.0,  # Default, will be calculated
                            is_percentage=True,
                            order=99  # Place at end
                        )
                        db.session.add(recipe_ing)
                        print(f"    + Added starter: {starter_name}")
                    else:
                        print(f"    [EXISTS] Starter: {starter_name}")

            # Add soakers
            for soaker_name in deps['soakers']:
                soaker = Ingredient.query.filter_by(name=soaker_name).first()
                if not soaker:
                    soaker_recipe = Recipe.query.filter_by(name=soaker_name).first()
                    if soaker_recipe:
                        soaker = Ingredient.query.filter_by(name=soaker_name).first()
                        if not soaker:
                            soaker = Ingredient(name=soaker_name, category='soaker')
                            db.session.add(soaker)
                            db.session.flush()

                if soaker:
                    existing = RecipeIngredient.query.filter_by(
                        recipe_id=recipe.id,
                        ingredient_id=soaker.id
                    ).first()

                    if not existing:
                        recipe_ing = RecipeIngredient(
                            recipe_id=recipe.id,
                            ingredient_id=soaker.id,
                            percentage=15.0,  # Default, will be calculated
                            is_percentage=True,
                            order=98
                        )
                        db.session.add(recipe_ing)
                        print(f"    + Added soaker: {soaker_name}")
                    else:
                        print(f"    [EXISTS] Soaker: {soaker_name}")

        db.session.commit()
        print("\n[OK] Dependencies added successfully!")

if __name__ == '__main__':
    add_dependencies()
