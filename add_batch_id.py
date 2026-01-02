"""
Add batch_id column to ProductionRun table and populate existing records
"""
from app import app, db, ProductionRun
from datetime import datetime

with app.app_context():
    # Check if batch_id column exists
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    columns = [col['name'] for col in inspector.get_columns('production_runs')]

    if 'batch_id' not in columns:
        print('Adding batch_id column to production_runs table...')

        # Add the column
        with db.engine.connect() as conn:
            conn.execute(db.text('ALTER TABLE production_runs ADD COLUMN batch_id VARCHAR(6)'))
            conn.commit()

        print('[OK] Column added successfully')
    else:
        print('[OK] batch_id column already exists')

    # Populate batch_id for existing production runs
    print('\nPopulating batch_id for existing production runs...')

    production_runs = ProductionRun.query.all()
    updated = 0

    for run in production_runs:
        if not run.batch_id:
            # Generate batch_id from date in MMDDYY format
            run.batch_id = run.date.strftime('%m%d%y')
            updated += 1

    if updated > 0:
        db.session.commit()
        print(f'[OK] Updated {updated} production runs with batch IDs')
    else:
        print('[OK] All production runs already have batch IDs')

    # Display some examples
    print('\nExample batch IDs:')
    for run in ProductionRun.query.limit(5).all():
        print(f'  Date: {run.date} -> Batch ID: {run.batch_id}')
