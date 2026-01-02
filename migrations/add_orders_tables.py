"""
Add order management tables and seed with customers
"""
from app import app
from models import db, Customer
import openpyxl

# Customers from your Excel file
CUSTOMERS = [
    {'name': 'Field to Fork', 'short_name': 'F2F'},
    {'name': 'Trattoria', 'short_name': 'Trat'},
    {'name': 'Slo Foods Kitchen', 'short_name': 'Slo Kitchen'},
    {'name': 'Slo Foods Retail', 'short_name': 'Slo Retail'},
    {'name': 'Il Ritrovo', 'short_name': 'Ritrovo'},
    {'name': 'Aspen Oak', 'short_name': 'AspenOak'},
]

def add_orders_tables():
    """Add new tables for order management"""
    with app.app_context():
        print("Creating new order management tables...")
        db.create_all()
        print("[OK] Tables created!")

        print("\nSeeding customers...")
        for customer_data in CUSTOMERS:
            existing = Customer.query.filter_by(name=customer_data['name']).first()
            if existing:
                print(f"  [SKIP] {customer_data['name']} already exists")
            else:
                customer = Customer(
                    name=customer_data['name'],
                    short_name=customer_data['short_name'],
                    is_active=True
                )
                db.session.add(customer)
                print(f"  [OK] Created customer: {customer_data['name']}")

        db.session.commit()
        print("\n[OK] Customers seeded successfully!")

        # Show summary
        total_customers = Customer.query.count()
        print(f"\nTotal customers in database: {total_customers}")
        for customer in Customer.query.all():
            print(f"  - {customer.name} ({customer.short_name})")

if __name__ == '__main__':
    add_orders_tables()
