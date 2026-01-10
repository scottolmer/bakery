"""
Migration script to add friction_factor column to mixing_log_entries table

This adds the friction_factor field which is used in calculating the water temperature
for achieving target DDT (Desired Dough Temperature).
"""

from app import app, db

def run_migration():
    """Add friction_factor column"""
    with app.app_context():
        print("Adding friction_factor column to mixing_log_entries table...")

        try:
            # Add the column with a default value of 24 (typical friction factor)
            db.engine.execute("""
                ALTER TABLE mixing_log_entries
                ADD COLUMN friction_factor REAL DEFAULT 24
            """)

            print("✓ Successfully added friction_factor column")
            print("  Default value: 24°F (typical mixing friction)")

        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("! Column already exists, skipping...")
            else:
                print(f"Error: {e}")
                raise

        print("\nMigration completed!")

if __name__ == '__main__':
    run_migration()
