"""
Clear all orders from the database
"""
from app import app, db
from models import Order

with app.app_context():
    # Delete all orders
    num_deleted = Order.query.delete()
    db.session.commit()

    print(f"Deleted {num_deleted} orders")
    print("All orders cleared successfully!")
