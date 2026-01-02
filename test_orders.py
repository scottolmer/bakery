"""
Test script to create sample orders and test the workflow
"""
from app import app
from models import db, Recipe, Customer, Order
from datetime import date, timedelta

with app.app_context():
    print('\n=== Available Recipes (Breads) ===')
    recipes = Recipe.query.filter_by(recipe_type='bread', is_active=True).limit(5).all()
    for r in recipes:
        print(f'  {r.id}: {r.name}')

    print('\n=== Available Customers ===')
    customers = Customer.query.filter_by(is_active=True).all()
    for c in customers:
        print(f'  {c.id}: {c.name} ({c.short_name})')

    # Create sample orders for next week
    print('\n=== Creating Sample Orders ===')

    # Get the first few recipes and customers
    italian = Recipe.query.filter_by(name='Italian').first()
    baguette = Recipe.query.filter_by(name='Baguette').first()
    multigrain = Recipe.query.filter_by(name='Multigrain').first()

    f2f = Customer.query.filter_by(short_name='F2F').first()
    trat = Customer.query.filter_by(short_name='Trat').first()
    slo_kitchen = Customer.query.filter_by(short_name='Slo Kitchen').first()

    if not all([italian, baguette, f2f, trat]):
        print('Missing required recipes or customers')
        exit(1)

    # Monday, Jan 6, 2026
    monday = date(2026, 1, 6)

    # Clear existing orders for this week
    Order.query.filter(Order.order_date >= monday).delete()
    db.session.commit()

    # Create sample orders
    orders_data = [
        # Monday
        {'customer': f2f, 'recipe': italian, 'date': monday, 'quantity': 20, 'day': 'Monday'},
        {'customer': trat, 'recipe': baguette, 'date': monday, 'quantity': 15, 'day': 'Monday'},

        # Tuesday
        {'customer': f2f, 'recipe': italian, 'date': monday + timedelta(days=1), 'quantity': 25, 'day': 'Tuesday'},
        {'customer': slo_kitchen, 'recipe': baguette, 'date': monday + timedelta(days=1), 'quantity': 10, 'day': 'Tuesday'},

        # Wednesday
        {'customer': f2f, 'recipe': italian, 'date': monday + timedelta(days=2), 'quantity': 30, 'day': 'Wednesday'},
        {'customer': trat, 'recipe': baguette, 'date': monday + timedelta(days=2), 'quantity': 20, 'day': 'Wednesday'},
    ]

    if multigrain:
        orders_data.append({'customer': slo_kitchen, 'recipe': multigrain, 'date': monday + timedelta(days=2), 'quantity': 12, 'day': 'Wednesday'})

    for order_data in orders_data:
        order = Order(
            customer_id=order_data['customer'].id,
            recipe_id=order_data['recipe'].id,
            order_date=order_data['date'],
            quantity=order_data['quantity'],
            day_of_week=order_data['day']
        )
        db.session.add(order)
        print(f"  [OK] {order_data['customer'].short_name} - {order_data['recipe'].name} x{order_data['quantity']} on {order_data['date']}")

    db.session.commit()

    print('\n=== Sample Orders Created Successfully! ===')
    print(f'\nTotal orders created: {len(orders_data)}')
    print(f'Week: {monday} to {monday + timedelta(days=6)}')
    print('\nYou can now:')
    print('1. Go to http://localhost:5000/orders')
    print('2. Select week: Jan 6 - Jan 12, 2026')
    print('3. Click "Calculate Production" to see aggregated orders')
    print('4. Click "Create Production Runs" to generate production schedules')
    print('5. Go to http://localhost:5000/mep to view MEP sheets')
