import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///bakery.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Excel file paths
    BREAD_FORMULAS_FILE = 'Bread Formulas 2024.xlsx'
    WEEKLY_ORDERS_FILE = 'Weekly Bread-Pastry Orders.xlsx'
