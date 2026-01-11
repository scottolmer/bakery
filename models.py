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
    cost_per_unit = db.Column(db.Float)  # Cost per gram (or per unit specified)

    # Inventory tracking
    quantity_in_stock = db.Column(db.Float, default=0)  # Current quantity in stock
    low_stock_threshold = db.Column(db.Float)  # Alert when stock falls below this amount
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
    selling_price = db.Column(db.Float)  # Price per loaf

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
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'))  # Optional customer association
    quantity = db.Column(db.Integer, nullable=False)  # number of loaves
    batch_weight = db.Column(db.Float)  # calculated batch weight in grams

    # Relationships
    production_run = db.relationship('ProductionRun', back_populates='items')
    recipe = db.relationship('Recipe')
    customer = db.relationship('Customer')
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


class DDTTarget(db.Model):
    """Target temperature ranges for different bread types"""
    __tablename__ = 'ddt_targets'

    id = db.Column(db.Integer, primary_key=True)
    bread_name = db.Column(db.String(100), nullable=False, unique=True)
    target_temp_min = db.Column(db.Float, nullable=False)  # Minimum target temp (F)
    target_temp_max = db.Column(db.Float, nullable=False)  # Maximum target temp (F)
    notes = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f'<DDTTarget {self.bread_name}: {self.target_temp_min}-{self.target_temp_max}°F>'


class MixingLog(db.Model):
    """Parent table for daily mixing sessions"""
    __tablename__ = 'mixing_logs'

    id = db.Column(db.Integer, primary_key=True)
    production_run_id = db.Column(db.Integer, db.ForeignKey('production_runs.id'), nullable=False)
    date = db.Column(db.Date, nullable=False, index=True)  # Mix date
    mixer_initials = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = db.Column(db.Text)

    # Relationships
    production_run = db.relationship('ProductionRun', backref='mixing_log')
    entries = db.relationship('MixingLogEntry', back_populates='mixing_log', cascade='all, delete-orphan')

    # Unique constraint: one mixing log per production run
    __table_args__ = (db.UniqueConstraint('production_run_id', name='unique_production_mixing_log'),)

    def __repr__(self):
        return f'<MixingLog {self.date} by {self.mixer_initials}>'


class MixingLogEntry(db.Model):
    """Individual bread entries within a mixing log"""
    __tablename__ = 'mixing_log_entries'

    id = db.Column(db.Integer, primary_key=True)
    mixing_log_id = db.Column(db.Integer, db.ForeignKey('mixing_logs.id'), nullable=False)
    bread_name = db.Column(db.String(100), nullable=False)  # Denormalized for historical accuracy
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=True)  # Optional FK

    # Batch information
    batch_size = db.Column(db.Float)  # Weight in grams
    quantity = db.Column(db.Integer)  # Number of loaves

    # Temperature readings (all in Fahrenheit)
    room_temp = db.Column(db.Float)
    flour_temp = db.Column(db.Float)
    preferment_temp = db.Column(db.Float)  # Pre-ferment temperature
    friction_factor = db.Column(db.Float)  # Heat from mixing (typically 20-30°F)
    water_temp = db.Column(db.Float)
    final_dough_temp = db.Column(db.Float)

    # Process notes (text fields for flexibility)
    bulk_fermentation_notes = db.Column(db.Text)  # e.g., "3 hours at room temp"
    fold_schedule = db.Column(db.Text)  # e.g., "Every 30 min x 3"
    portioning_notes = db.Column(db.Text)  # e.g., "Refrigerated at 4pm"
    batch_notes = db.Column(db.Text)  # Issues, adjustments, observations for this batch

    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    order = db.Column(db.Integer, default=0)  # Display order

    # Relationships
    mixing_log = db.relationship('MixingLog', back_populates='entries')
    recipe = db.relationship('Recipe')

    def __repr__(self):
        return f'<MixingLogEntry {self.bread_name}: {self.final_dough_temp}°F>'


class ProductionIssue(db.Model):
    """Log production problems and equipment issues"""
    __tablename__ = 'production_issues'

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, index=True)
    issue_type = db.Column(db.String(50), nullable=False)  # equipment, timing, quality, other
    severity = db.Column(db.String(20), nullable=False)  # low, medium, high, critical
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    affected_items = db.Column(db.Text)  # Comma-separated list of affected breads/recipes
    resolution = db.Column(db.Text)  # How it was resolved
    resolved_at = db.Column(db.DateTime)
    reported_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<ProductionIssue {self.title} on {self.date}>'


class InventoryTransaction(db.Model):
    """Log all inventory additions and deductions"""
    __tablename__ = 'inventory_transactions'

    id = db.Column(db.Integer, primary_key=True)
    ingredient_id = db.Column(db.Integer, db.ForeignKey('ingredients.id'), nullable=False)
    transaction_type = db.Column(db.String(20), nullable=False)  # addition, deduction, adjustment
    quantity = db.Column(db.Float, nullable=False)  # Positive for additions, negative for deductions
    quantity_before = db.Column(db.Float, nullable=False)  # Stock level before transaction
    quantity_after = db.Column(db.Float, nullable=False)  # Stock level after transaction
    production_run_id = db.Column(db.Integer, db.ForeignKey('production_runs.id'))  # If related to production
    notes = db.Column(db.Text)
    created_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    ingredient = db.relationship('Ingredient')
    production_run = db.relationship('ProductionRun')

    def __repr__(self):
        return f'<InventoryTransaction {self.ingredient.name if self.ingredient else "Unknown"}: {self.quantity}>'
