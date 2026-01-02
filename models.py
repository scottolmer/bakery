from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Ingredient(db.Model):
    """Base ingredients used in recipes"""
    __tablename__ = 'ingredients'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    category = db.Column(db.String(50))  # flour, water, yeast, starter, soaker, etc.
    unit = db.Column(db.String(20), default='grams')

    def __repr__(self):
        return f'<Ingredient {self.name}>'


class Recipe(db.Model):
    """Bread recipes (Italian, Multigrain, etc.)"""
    __tablename__ = 'recipes'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    recipe_type = db.Column(db.String(50))  # bread, starter, soaker
    base_batch_weight = db.Column(db.Float)  # grams
    loaf_weight = db.Column(db.Float)  # grams per loaf
    is_active = db.Column(db.Boolean, default=True)
    notes = db.Column(db.Text)

    # Relationships
    ingredients = db.relationship('RecipeIngredient', back_populates='recipe', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Recipe {self.name}>'


class RecipeIngredient(db.Model):
    """Junction table for recipe ingredients with baker's percentages"""
    __tablename__ = 'recipe_ingredients'

    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)
    ingredient_id = db.Column(db.Integer, db.ForeignKey('ingredients.id'), nullable=False)
    percentage = db.Column(db.Float)  # Baker's percentage
    amount_grams = db.Column(db.Float)  # Fixed amount in grams (if not percentage-based)
    is_percentage = db.Column(db.Boolean, default=True)
    order = db.Column(db.Integer, default=0)  # Display order

    # Relationships
    recipe = db.relationship('Recipe', back_populates='ingredients')
    ingredient = db.relationship('Ingredient')

    def __repr__(self):
        return f'<RecipeIngredient {self.recipe.name} - {self.ingredient.name}>'


class ProductionRun(db.Model):
    """Historical record of production runs"""
    __tablename__ = 'production_runs'

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, index=True)
    batch_id = db.Column(db.String(6), index=True)  # MMDDYY format (e.g., '010826')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(100))  # username
    notes = db.Column(db.Text)

    # Relationships
    items = db.relationship('ProductionItem', back_populates='production_run', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<ProductionRun {self.date}>'


class ProductionItem(db.Model):
    """Individual bread items in a production run"""
    __tablename__ = 'production_items'

    id = db.Column(db.Integer, primary_key=True)
    production_run_id = db.Column(db.Integer, db.ForeignKey('production_runs.id'), nullable=False)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)  # number of loaves
    batch_weight = db.Column(db.Float)  # calculated batch weight in grams

    # Relationships
    production_run = db.relationship('ProductionRun', back_populates='items')
    recipe = db.relationship('Recipe')
    ingredient_amounts = db.relationship('ProductionIngredient', back_populates='production_item', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<ProductionItem {self.recipe.name} x{self.quantity}>'


class ProductionIngredient(db.Model):
    """Calculated ingredient amounts for a production item"""
    __tablename__ = 'production_ingredients'

    id = db.Column(db.Integer, primary_key=True)
    production_item_id = db.Column(db.Integer, db.ForeignKey('production_items.id'), nullable=False)
    ingredient_id = db.Column(db.Integer, db.ForeignKey('ingredients.id'), nullable=False)
    amount_grams = db.Column(db.Float, nullable=False)

    # Relationships
    production_item = db.relationship('ProductionItem', back_populates='ingredient_amounts')
    ingredient = db.relationship('Ingredient')

    def __repr__(self):
        return f'<ProductionIngredient {self.ingredient.name}: {self.amount_grams}g>'


class ScheduleTemplate(db.Model):
    """Saved production schedule templates"""
    __tablename__ = 'schedule_templates'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text)
    is_default = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Store as JSON or separate table - for now using JSON
    template_data = db.Column(db.JSON)  # Stores the production quantities

    def __repr__(self):
        return f'<ScheduleTemplate {self.name}>'


class MixerCapacity(db.Model):
    """Mixer capacity limits"""
    __tablename__ = 'mixer_capacities'

    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'))
    max_batch_weight = db.Column(db.Float, nullable=False)  # grams

    recipe = db.relationship('Recipe')

    def __repr__(self):
        return f'<MixerCapacity {self.recipe.name if self.recipe else "General"}: {self.max_batch_weight}g>'


class Customer(db.Model):
    """Customer accounts (F2F, Trattoria, Slo Kitchen, etc.)"""
    __tablename__ = 'customers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    short_name = db.Column(db.String(20))  # Abbreviation like "F2F"
    is_active = db.Column(db.Boolean, default=True)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    orders = db.relationship('Order', back_populates='customer', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Customer {self.name}>'


class Order(db.Model):
    """Customer orders by date and recipe"""
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)
    order_date = db.Column(db.Date, nullable=False, index=True)  # When they want delivery
    quantity = db.Column(db.Integer, nullable=False)  # Number of loaves
    day_of_week = db.Column(db.String(10))  # Monday, Tuesday, etc.
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    customer = db.relationship('Customer', back_populates='orders')
    recipe = db.relationship('Recipe')

    def __repr__(self):
        return f'<Order {self.customer.name} - {self.recipe.name} x{self.quantity} on {self.order_date}>'


class WeeklyOrderTemplate(db.Model):
    """Template for recurring weekly orders"""
    __tablename__ = 'weekly_order_templates'

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)
    day_of_week = db.Column(db.String(10), nullable=False)  # Monday, Tuesday, etc.
    quantity = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=True)

    # Relationships
    customer = db.relationship('Customer')
    recipe = db.relationship('Recipe')

    def __repr__(self):
        return f'<WeeklyTemplate {self.customer.name} - {self.recipe.name} x{self.quantity} on {self.day_of_week}>'
