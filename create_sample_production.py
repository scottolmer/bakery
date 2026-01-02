"""
Create sample production runs for testing
"""
from datetime import date, timedelta
from app import app
from models import db, Recipe, ProductionRun, ProductionItem

with app.app_context():
    # Create production run for today
    today = date.today()

    # Check if already exists
    existing = ProductionRun.query.filter_by(date=today).first()
    if existing:
        print(f"Production run already exists for {today}")
    else:
        # Create new production run
        run = ProductionRun(
            date=today,
            created_by='system',
            notes='Sample production run for testing'
        )
        db.session.add(run)
        db.session.flush()

        # Get some recipes
        italian = Recipe.query.filter_by(name='Italian').first()
        baguette = Recipe.query.filter_by(name='Baguette').first()
        rustic = Recipe.query.filter_by(name='Rustic White').first()

        # Add production items
        items_to_add = []

        if italian:
            items_to_add.append(ProductionItem(
                production_run_id=run.id,
                recipe_id=italian.id,
                quantity=20,
                batch_weight=20 * italian.loaf_weight
            ))

        if baguette:
            items_to_add.append(ProductionItem(
                production_run_id=run.id,
                recipe_id=baguette.id,
                quantity=15,
                batch_weight=15 * baguette.loaf_weight
            ))

        if rustic:
            items_to_add.append(ProductionItem(
                production_run_id=run.id,
                recipe_id=rustic.id,
                quantity=12,
                batch_weight=12 * rustic.loaf_weight
            ))

        for item in items_to_add:
            db.session.add(item)

        db.session.commit()

        print(f"[OK] Created sample production run for {today}")
        print(f"  - Italian: 20 loaves")
        print(f"  - Baguette: 15 loaves")
        print(f"  - Rustic White: 12 loaves")
        print(f"\nNow go to http://localhost:5000 and load today's date!")

    # Also create one for yesterday for testing history
    yesterday = today - timedelta(days=1)
    existing_yesterday = ProductionRun.query.filter_by(date=yesterday).first()

    if not existing_yesterday:
        run_yesterday = ProductionRun(
            date=yesterday,
            created_by='system',
            notes='Sample production from yesterday'
        )
        db.session.add(run_yesterday)
        db.session.flush()

        multigrain = Recipe.query.filter_by(name='Multigrain').first()
        if multigrain:
            item = ProductionItem(
                production_run_id=run_yesterday.id,
                recipe_id=multigrain.id,
                quantity=10,
                batch_weight=10 * multigrain.loaf_weight
            )
            db.session.add(item)

        db.session.commit()
        print(f"\n[OK] Created sample production run for {yesterday}")
        print(f"  - Multigrain: 10 loaves")
        print(f"\nYou can also test the history page!")
