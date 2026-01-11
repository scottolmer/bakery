import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'

    # Railway provides DATABASE_URL with postgres://, but SQLAlchemy needs postgresql://
    database_url = os.environ.get('DATABASE_URL') or 'sqlite:///bakery.db'
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)

    SQLALCHEMY_DATABASE_URI = database_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Excel file paths
    BREAD_FORMULAS_FILE = 'Bread Formulas 2024.xlsx'
    WEEKLY_ORDERS_FILE = 'Weekly Bread-Pastry Orders.xlsx'
