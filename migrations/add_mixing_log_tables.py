"""
Migration script to add mixing log tables and DDT targets

This script creates:
1. ddt_targets table - Target temperature ranges for breads
2. mixing_logs table - Daily mixing sessions
3. mixing_log_entries table - Individual bread entries

And seeds DDT targets from the Excel sheet data.
"""

from app import app, db
from models import DDTTarget

def run_migration():
    """Create tables and seed initial data"""
    with app.app_context():
        print("Creating mixing log tables...")

        # Create all tables (will skip existing ones)
        db.create_all()

        print("Seeding DDT targets...")

        # DDT target data from Excel "DDT Sheet"
        ddt_data = [
            {'bread_name': 'Italian', 'target_temp_min': 70.0, 'target_temp_max': 73.0,
             'notes': 'Aim for 72°F for best texture'},
            {'bread_name': 'Baguette', 'target_temp_min': 75.0, 'target_temp_max': 78.0,
             'notes': 'Higher temp for better rise'},
            {'bread_name': 'Rustic White', 'target_temp_min': 81.0, 'target_temp_max': 83.0,
             'notes': 'Higher temp for enriched dough'},
            {'bread_name': 'Multigrain', 'target_temp_min': 81.0, 'target_temp_max': 83.0,
             'notes': 'Similar to Rustic White'},
            {'bread_name': 'Miche', 'target_temp_min': 76.0, 'target_temp_max': 78.0,
             'notes': 'Moderate temp for large loaves'},
            {'bread_name': 'Pain d\'Mie', 'target_temp_min': 75.0, 'target_temp_max': 75.0,
             'notes': 'Precise temp for sandwich loaf'},
            {'bread_name': 'Fino', 'target_temp_min': 76.0, 'target_temp_max': 77.0,
             'notes': 'Moderate temp range'},
            {'bread_name': 'Croissant', 'target_temp_min': 74.0, 'target_temp_max': 75.0,
             'notes': 'Cool temp for laminated dough'},
            {'bread_name': 'Schiacciata', 'target_temp_min': 75.0, 'target_temp_max': 75.0,
             'notes': 'Standard temp for flatbread'},
            {'bread_name': 'Focaccia', 'target_temp_min': 75.0, 'target_temp_max': 77.0,
             'notes': 'Moderate temp for flatbread'},
        ]

        # Add DDT targets if they don't exist
        for target_data in ddt_data:
            existing = DDTTarget.query.filter_by(bread_name=target_data['bread_name']).first()
            if not existing:
                target = DDTTarget(**target_data)
                db.session.add(target)
                print(f"  Added DDT target for {target_data['bread_name']}: " +
                      f"{target_data['target_temp_min']}-{target_data['target_temp_max']}°F")
            else:
                print(f"  DDT target for {target_data['bread_name']} already exists")

        db.session.commit()
        print("\nMigration completed successfully!")
        print(f"Total DDT targets: {DDTTarget.query.count()}")

if __name__ == '__main__':
    run_migration()
