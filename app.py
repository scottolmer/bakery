"""
Bakery Production Management System
Main Flask application
"""
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from config import Config
from models import db, Recipe, Ingredient, RecipeIngredient, ProductionRun, ProductionItem, ProductionIngredient, ScheduleTemplate, MixerCapacity, Customer, Order, WeeklyOrderTemplate
from datetime import datetime, date, timedelta
import json
from mep_calculator import MEPCalculator

app = Flask(__name__)
app.config.from_object(Config)

# Initialize extensions
CORS(app)
db.init_app(app)


# =============================================================================
# Database Initialization
# =============================================================================

@app.cli.command('init-db')
def init_db():
    """Initialize the database"""
    db.create_all()
    print("Database tables created successfully!")


@app.cli.command('seed-db')
def seed_db():
    """Seed database with sample data"""
    print("Seeding database...")

    # Create base ingredients
    ingredients_data = [
        ('Red Rose Flour', 'flour'),
        ('Whole Wheat Flour', 'flour'),
        ('Water', 'water'),
        ('Salt', 'salt'),
        ('Levain', 'starter'),
        ('Poolish', 'starter'),
        ('Biga', 'starter'),
        ('Olive Oil', 'oil'),
        ('Yeast', 'yeast'),
        ('7 Grain Soaker', 'soaker'),
        ('RW Soaker', 'soaker'),
    ]

    for name, category in ingredients_data:
        if not Ingredient.query.filter_by(name=name).first():
            ingredient = Ingredient(name=name, category=category)
            db.session.add(ingredient)

    db.session.commit()
    print(f"Created {len(ingredients_data)} ingredients")

    # Create sample recipes
    # Italian Bread
    italian = Recipe(
        name='Italian',
        recipe_type='bread',
        base_batch_weight=1000,
        loaf_weight=1000
    )
    db.session.add(italian)
    db.session.commit()

    # Add ingredients to Italian recipe
    red_rose = Ingredient.query.filter_by(name='Red Rose Flour').first()
    water = Ingredient.query.filter_by(name='Water').first()
    salt = Ingredient.query.filter_by(name='Salt').first()
    levain = Ingredient.query.filter_by(name='Levain').first()

    recipe_ingredients = [
        RecipeIngredient(recipe_id=italian.id, ingredient_id=red_rose.id, percentage=70.0, is_percentage=True, order=1),
        RecipeIngredient(recipe_id=italian.id, ingredient_id=water.id, percentage=65.0, is_percentage=True, order=2),
        RecipeIngredient(recipe_id=italian.id, ingredient_id=salt.id, percentage=2.0, is_percentage=True, order=3),
        RecipeIngredient(recipe_id=italian.id, ingredient_id=levain.id, percentage=30.0, is_percentage=True, order=4),
    ]

    for ri in recipe_ingredients:
        db.session.add(ri)

    db.session.commit()
    print("Created sample Italian bread recipe")

    # Create mixer capacity limit
    capacity = MixerCapacity(recipe_id=italian.id, max_batch_weight=5000)
    db.session.add(capacity)
    db.session.commit()

    print("Database seeded successfully!")


# =============================================================================
# API Routes
# =============================================================================

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')


@app.route('/history')
def history():
    """Production history page"""
    return render_template('history.html')


@app.route('/production')
def production():
    """Production entry page"""
    return render_template('production.html')


@app.route('/recipes')
def recipes_page():
    """Recipe management page"""
    return render_template('recipes.html')


@app.route('/mep')
def mep_complete():
    """Complete MEP sheets page"""
    return render_template('mep_complete.html')


@app.route('/orders')
def orders_page():
    """Orders management page"""
    return render_template('orders.html')


@app.route('/orders/weekly')
def weekly_orders_page():
    """Weekly order sheets page"""
    return render_template('weekly_orders.html')


@app.route('/api/recipes', methods=['GET'])
def get_recipes():
    """Get all recipes"""
    recipes = Recipe.query.filter_by(is_active=True).all()
    return jsonify([{
        'id': r.id,
        'name': r.name,
        'recipe_type': r.recipe_type,
        'base_batch_weight': r.base_batch_weight,
        'loaf_weight': r.loaf_weight
    } for r in recipes])


@app.route('/api/recipes/<int:recipe_id>', methods=['GET'])
def get_recipe(recipe_id):
    """Get a specific recipe with ingredients"""
    recipe = Recipe.query.get_or_404(recipe_id)
    ingredients = []

    for ri in recipe.ingredients:
        ingredients.append({
            'ingredient_name': ri.ingredient.name,
            'percentage': ri.percentage,
            'amount_grams': ri.amount_grams,
            'is_percentage': ri.is_percentage,
            'category': ri.ingredient.category
        })

    return jsonify({
        'id': recipe.id,
        'name': recipe.name,
        'recipe_type': recipe.recipe_type,
        'base_batch_weight': recipe.base_batch_weight,
        'loaf_weight': recipe.loaf_weight,
        'ingredients': ingredients
    })


@app.route('/api/production/calculate', methods=['POST'])
def calculate_production():
    """
    Calculate ingredient amounts for production
    Expected input: { "items": [{"recipe_id": 1, "quantity": 10}, ...] }
    """
    data = request.json
    items = data.get('items', [])

    results = []

    for item in items:
        recipe_id = item['recipe_id']
        quantity = item['quantity']

        recipe = Recipe.query.get(recipe_id)
        if not recipe:
            continue

        # Calculate batch weight needed
        total_weight = quantity * recipe.loaf_weight

        # Calculate ingredients
        ingredients = []
        for ri in recipe.ingredients:
            if ri.is_percentage:
                # Baker's percentage calculation
                amount = (ri.percentage / 100.0) * recipe.base_batch_weight * (total_weight / recipe.base_batch_weight)
            else:
                # Fixed amount
                amount = ri.amount_grams * (total_weight / recipe.base_batch_weight)

            ingredients.append({
                'name': ri.ingredient.name,
                'amount_grams': round(amount, 1),
                'category': ri.ingredient.category
            })

        results.append({
            'recipe_name': recipe.name,
            'quantity': quantity,
            'total_weight': total_weight,
            'ingredients': ingredients
        })

    return jsonify(results)


@app.route('/api/production/history', methods=['GET'])
def get_production_history():
    """Get production history with optional date filtering"""
    # Query parameters
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    recipe_name = request.args.get('recipe_name')

    query = ProductionRun.query

    if start_date:
        query = query.filter(ProductionRun.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
    if end_date:
        query = query.filter(ProductionRun.date <= datetime.strptime(end_date, '%Y-%m-%d').date())

    production_runs = query.order_by(ProductionRun.date.desc()).all()

    results = []
    for run in production_runs:
        items = []
        for item in run.items:
            if recipe_name and item.recipe.name != recipe_name:
                continue

            items.append({
                'recipe_name': item.recipe.name,
                'quantity': item.quantity,
                'batch_weight': item.batch_weight
            })

        if items or not recipe_name:  # Include run if it has matching items or no filter
            results.append({
                'id': run.id,
                'date': run.date.isoformat(),
                'batch_id': run.batch_id,
                'created_by': run.created_by,
                'items': items
            })

    return jsonify(results)


@app.route('/api/production/batch/<batch_id>', methods=['GET'])
def get_production_by_batch(batch_id):
    """Get production run by batch ID"""
    production_run = ProductionRun.query.filter_by(batch_id=batch_id).first()

    if not production_run:
        return jsonify({'error': 'No production run found for this batch ID'}), 404

    items = []
    for item in production_run.items:
        items.append({
            'recipe_name': item.recipe.name,
            'quantity': item.quantity,
            'batch_weight': item.batch_weight
        })

    result = {
        'id': production_run.id,
        'date': production_run.date.isoformat(),
        'batch_id': production_run.batch_id,
        'created_by': production_run.created_by,
        'notes': production_run.notes,
        'items': items
    }

    return jsonify(result)


@app.route('/api/production/save', methods=['POST'])
def save_production():
    """Save a production run"""
    data = request.json

    run_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    production_run = ProductionRun(
        date=run_date,
        batch_id=run_date.strftime('%m%d%y'),  # Auto-generate batch ID (MMDDYY)
        created_by=data.get('created_by', 'admin'),
        notes=data.get('notes', '')
    )
    db.session.add(production_run)
    db.session.flush()  # Get the ID

    for item_data in data['items']:
        recipe = Recipe.query.get(item_data['recipe_id'])

        production_item = ProductionItem(
            production_run_id=production_run.id,
            recipe_id=item_data['recipe_id'],
            quantity=item_data['quantity'],
            batch_weight=item_data['quantity'] * recipe.loaf_weight
        )
        db.session.add(production_item)

    db.session.commit()

    return jsonify({
        'success': True,
        'production_run_id': production_run.id,
        'batch_id': production_run.batch_id
    })


@app.route('/api/mep/<date_str>')
def get_mep_sheet(date_str):
    """Generate MEP (mise en place) sheet for a specific date"""
    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    # Find production run for this date
    production_run = ProductionRun.query.filter_by(date=target_date).first()

    if not production_run:
        return jsonify({'error': 'No production run found for this date'}), 404

    # Generate MEP sheet data
    mep_data = {
        'date': target_date.isoformat(),
        'breads': [],
        'total_ingredients': {}
    }

    for item in production_run.items:
        recipe = item.recipe
        bread_data = {
            'name': recipe.name,
            'quantity': item.quantity,
            'loaf_weight': recipe.loaf_weight,
            'total_weight': item.batch_weight,
            'ingredients': []
        }

        # Calculate ingredients for this bread
        for ri in recipe.ingredients:
            if ri.is_percentage:
                amount = (ri.percentage / 100.0) * item.batch_weight
            else:
                amount = ri.amount_grams * (item.batch_weight / recipe.base_batch_weight)

            bread_data['ingredients'].append({
                'name': ri.ingredient.name,
                'amount': round(amount, 1),
                'category': ri.ingredient.category
            })

            # Add to total ingredients
            ingredient_name = ri.ingredient.name
            if ingredient_name not in mep_data['total_ingredients']:
                mep_data['total_ingredients'][ingredient_name] = 0
            mep_data['total_ingredients'][ingredient_name] += amount

        mep_data['breads'].append(bread_data)

    # Round total ingredients
    for ingredient in mep_data['total_ingredients']:
        mep_data['total_ingredients'][ingredient] = round(mep_data['total_ingredients'][ingredient], 1)

    return jsonify(mep_data)


@app.route('/api/ingredients', methods=['GET'])
def get_ingredients():
    """Get all ingredients"""
    ingredients = Ingredient.query.all()
    return jsonify([{
        'id': i.id,
        'name': i.name,
        'category': i.category,
        'unit': i.unit
    } for i in ingredients])


@app.route('/api/ingredients', methods=['POST'])
def create_ingredient():
    """Create a new ingredient"""
    data = request.json

    # Check if ingredient already exists
    existing = Ingredient.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': 'Ingredient already exists'}), 400

    ingredient = Ingredient(
        name=data['name'],
        category=data.get('category', 'other'),
        unit=data.get('unit', 'grams')
    )
    db.session.add(ingredient)
    db.session.commit()

    return jsonify({
        'success': True,
        'ingredient_id': ingredient.id
    })


@app.route('/api/recipes', methods=['POST'])
def create_recipe():
    """Create a new recipe"""
    data = request.json

    # Check if recipe already exists
    existing = Recipe.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': 'Recipe already exists'}), 400

    recipe = Recipe(
        name=data['name'],
        recipe_type=data.get('recipe_type', 'bread'),
        base_batch_weight=data.get('base_batch_weight'),
        loaf_weight=data.get('loaf_weight'),
        notes=data.get('notes', '')
    )
    db.session.add(recipe)
    db.session.commit()

    return jsonify({
        'success': True,
        'recipe_id': recipe.id
    })


@app.route('/api/recipes/<int:recipe_id>', methods=['PUT'])
def update_recipe(recipe_id):
    """Update a recipe"""
    recipe = Recipe.query.get_or_404(recipe_id)
    data = request.json

    recipe.name = data.get('name', recipe.name)
    recipe.recipe_type = data.get('recipe_type', recipe.recipe_type)
    recipe.base_batch_weight = data.get('base_batch_weight', recipe.base_batch_weight)
    recipe.loaf_weight = data.get('loaf_weight', recipe.loaf_weight)
    recipe.notes = data.get('notes', recipe.notes)

    db.session.commit()

    return jsonify({'success': True})


@app.route('/api/recipes/<int:recipe_id>', methods=['DELETE'])
def delete_recipe(recipe_id):
    """Delete a recipe"""
    recipe = Recipe.query.get_or_404(recipe_id)
    recipe.is_active = False
    db.session.commit()

    return jsonify({'success': True})


@app.route('/api/recipes/<int:recipe_id>/ingredients', methods=['POST'])
def add_recipe_ingredient(recipe_id):
    """Add an ingredient to a recipe"""
    recipe = Recipe.query.get_or_404(recipe_id)
    data = request.json

    recipe_ingredient = RecipeIngredient(
        recipe_id=recipe_id,
        ingredient_id=data['ingredient_id'],
        percentage=data.get('percentage'),
        amount_grams=data.get('amount_grams'),
        is_percentage=data.get('is_percentage', True),
        order=data.get('order', 0)
    )
    db.session.add(recipe_ingredient)
    db.session.commit()

    return jsonify({'success': True})


@app.route('/api/mep/calculate', methods=['POST'])
def calculate_mep_sheets():
    """
    Calculate all four MEP sheets for given production items
    Input: { "items": [{"recipe_id": 1, "quantity": 10}, ...] }
    Output: {
        "mix_sheet": {...},
        "starter_sheet": {...},
        "soak_sheet": {...},
        "mep_ingredients": {...}
    }
    """
    data = request.json
    items = data.get('items', [])

    if not items:
        return jsonify({'error': 'No items provided'}), 400

    calculator = MEPCalculator(items)
    sheets = calculator.calculate_all_sheets()

    return jsonify(sheets)


@app.route('/api/mep/<date_str>/all', methods=['GET'])
def get_all_mep_sheets(date_str):
    """
    Get all MEP sheets for a specific delivery date
    System calculates backwards: delivery date -> mix date -> prep date
    """
    try:
        delivery_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    # The date entered is the DELIVERY date
    # Calculate backwards:
    # - Mix date: delivery - 1 day (when doughs are mixed)
    # - Prep date: delivery - 2 days (when starters/soakers are built)
    mix_date = delivery_date - timedelta(days=1)
    prep_date = delivery_date - timedelta(days=2)

    # Find production run for the delivery date
    production_run = ProductionRun.query.filter_by(date=delivery_date).first()

    if not production_run:
        return jsonify({'error': 'No production run found for this delivery date'}), 404

    # Build items list
    items = []
    for item in production_run.items:
        items.append({
            'recipe_id': item.recipe_id,
            'quantity': item.quantity
        })

    # Calculate all sheets (pass delivery_date for Emmy Feed calculation)
    calculator = MEPCalculator(items, delivery_date=delivery_date)
    sheets = calculator.calculate_all_sheets()

    # Add metadata with proper timeline
    # All calculated from the delivery date
    sheets['delivery_date'] = delivery_date.isoformat()
    sheets['mix_date'] = mix_date.isoformat()
    sheets['prep_date'] = prep_date.isoformat()
    sheets['batch_id'] = production_run.batch_id  # Add batch ID for labeling

    return jsonify(sheets)


@app.route('/api/customers', methods=['GET'])
def get_customers():
    """Get all active customers"""
    customers = Customer.query.filter_by(is_active=True).all()
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'short_name': c.short_name
    } for c in customers])


@app.route('/api/orders', methods=['GET'])
def get_orders():
    """Get all orders with optional date and customer filtering"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    customer_id = request.args.get('customer_id')

    query = Order.query

    if start_date:
        query = query.filter(Order.order_date >= datetime.strptime(start_date, '%Y-%m-%d').date())
    if end_date:
        query = query.filter(Order.order_date <= datetime.strptime(end_date, '%Y-%m-%d').date())
    if customer_id:
        query = query.filter(Order.customer_id == int(customer_id))

    orders = query.order_by(Order.order_date.asc()).all()

    return jsonify([{
        'id': o.id,
        'customer_id': o.customer_id,
        'customer_name': o.customer.name,
        'customer_short_name': o.customer.short_name,
        'recipe_id': o.recipe_id,
        'recipe_name': o.recipe.name,
        'order_date': o.order_date.isoformat(),
        'day_of_week': o.day_of_week,
        'quantity': o.quantity,
        'notes': o.notes
    } for o in orders])


@app.route('/api/orders', methods=['POST'])
def create_order():
    """Create a new order"""
    data = request.json

    order = Order(
        customer_id=data['customer_id'],
        recipe_id=data['recipe_id'],
        order_date=datetime.strptime(data['order_date'], '%Y-%m-%d').date(),
        quantity=data['quantity'],
        day_of_week=data.get('day_of_week', ''),
        notes=data.get('notes', '')
    )

    db.session.add(order)
    db.session.commit()

    return jsonify({
        'success': True,
        'order_id': order.id
    })


@app.route('/api/orders/<int:order_id>', methods=['DELETE'])
def delete_order(order_id):
    """Delete an order"""
    order = Order.query.get_or_404(order_id)
    db.session.delete(order)
    db.session.commit()

    return jsonify({'success': True})


@app.route('/api/orders/delete-week', methods=['POST'])
def delete_week_orders():
    """Delete all orders for a customer in a date range"""
    data = request.json
    customer_id = data['customer_id']
    start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
    end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()

    # Delete orders in this range for this customer
    orders = Order.query.filter(
        Order.customer_id == customer_id,
        Order.order_date >= start_date,
        Order.order_date <= end_date
    ).all()

    for order in orders:
        db.session.delete(order)

    db.session.commit()

    return jsonify({'success': True, 'deleted': len(orders)})


@app.route('/api/orders/aggregate', methods=['POST'])
def aggregate_orders():
    """
    Aggregate orders by date and recipe to calculate production needs
    Input: { "start_date": "2026-01-06", "end_date": "2026-01-12" }
    Output: { "2026-01-06": [{"recipe_id": 1, "recipe_name": "Italian", "total_quantity": 50}, ...], ... }
    """
    data = request.json
    start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
    end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()

    # Get all orders in date range
    orders = Order.query.filter(
        Order.order_date >= start_date,
        Order.order_date <= end_date
    ).all()

    # Aggregate by date and recipe
    aggregated = {}
    for order in orders:
        date_key = order.order_date.isoformat()

        if date_key not in aggregated:
            aggregated[date_key] = {}

        if order.recipe_id not in aggregated[date_key]:
            aggregated[date_key][order.recipe_id] = {
                'recipe_id': order.recipe_id,
                'recipe_name': order.recipe.name,
                'total_quantity': 0
            }

        aggregated[date_key][order.recipe_id]['total_quantity'] += order.quantity

    # Convert to list format
    result = {}
    for date_key, recipes in aggregated.items():
        result[date_key] = list(recipes.values())

    return jsonify(result)


@app.route('/api/orders/create-production', methods=['POST'])
def create_production_from_orders():
    """
    Auto-create production runs from aggregated orders
    Input: { "start_date": "2026-01-06", "end_date": "2026-01-12" }
    Output: { "success": true, "production_runs_created": 5 }
    """
    data = request.json
    start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
    end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()

    # Get aggregated orders
    orders = Order.query.filter(
        Order.order_date >= start_date,
        Order.order_date <= end_date
    ).all()

    # Aggregate by date and recipe
    aggregated = {}
    for order in orders:
        date_key = order.order_date

        if date_key not in aggregated:
            aggregated[date_key] = {}

        if order.recipe_id not in aggregated[date_key]:
            aggregated[date_key][order.recipe_id] = 0

        aggregated[date_key][order.recipe_id] += order.quantity

    # Create production runs
    runs_created = 0
    for production_date, recipes in aggregated.items():
        # Check if production run already exists
        existing_run = ProductionRun.query.filter_by(date=production_date).first()

        if existing_run:
            # Delete existing items and recreate
            for item in existing_run.items:
                db.session.delete(item)
            production_run = existing_run
        else:
            # Create new production run
            production_run = ProductionRun(
                date=production_date,
                batch_id=production_date.strftime('%m%d%y'),  # Auto-generate batch ID (MMDDYY)
                created_by='orders_system',
                notes='Auto-generated from customer orders'
            )
            db.session.add(production_run)
            db.session.flush()
            runs_created += 1

        # Add production items
        for recipe_id, quantity in recipes.items():
            recipe = Recipe.query.get(recipe_id)
            production_item = ProductionItem(
                production_run_id=production_run.id,
                recipe_id=recipe_id,
                quantity=quantity,
                batch_weight=quantity * recipe.loaf_weight
            )
            db.session.add(production_item)

    db.session.commit()

    return jsonify({
        'success': True,
        'production_runs_created': runs_created
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
