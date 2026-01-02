# Bakery Production Management System

A web-based application for managing bakery production, calculating ingredient requirements, and generating mise en place (MEP) sheets.

## Features

### Current (Phase 1)
- ✅ Recipe management with baker's percentages
- ✅ Ingredient calculation engine
- ✅ MEP sheet generation and viewing
- ✅ Print-friendly layouts
- ✅ Production history tracking
- ✅ Historical reporting API

### Coming Soon (Phase 2-3)
- 🔄 User authentication and role-based access
- 🔄 Admin interface for recipe management
- 🔄 Production schedule templates
- 🔄 Advanced historical reports and analytics
- 🔄 Excel import/export
- 🔄 Batch splitting logic (mixer capacity limits)

## Installation

### Prerequisites
- Python 3.13+
- pip

### Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Initialize the database:**
   ```bash
   flask --app app init-db
   ```

3. **Seed with sample data (optional):**
   ```bash
   flask --app app seed-db
   ```

4. **Start the server:**
   ```bash
   flask --app app run --port 5000
   ```

5. **Open your browser:**
   Navigate to `http://localhost:5000`

## Usage

### Viewing MEP Sheets

1. Go to the homepage (http://localhost:5000)
2. Select a date using the date picker
3. Click "Load MEP Sheet"
4. View the production details and ingredient list
5. Click "Print" to generate a printer-friendly version

### API Endpoints

#### Get All Recipes
```http
GET /api/recipes
```

#### Get Recipe Details
```http
GET /api/recipes/{recipe_id}
```

#### Calculate Production
```http
POST /api/production/calculate
Content-Type: application/json

{
  "items": [
    {"recipe_id": 1, "quantity": 10},
    {"recipe_id": 2, "quantity": 15}
  ]
}
```

#### Save Production Run
```http
POST /api/production/save
Content-Type: application/json

{
  "date": "2024-01-15",
  "created_by": "admin",
  "items": [
    {"recipe_id": 1, "quantity": 10},
    {"recipe_id": 2, "quantity": 15}
  ]
}
```

#### Get Production History
```http
GET /api/production/history?start_date=2024-01-01&end_date=2024-01-31&recipe_name=Italian
```

#### Get MEP Sheet
```http
GET /api/mep/2024-01-15
```

## Project Structure

```
bakery/
├── app.py                    # Main Flask application
├── config.py                 # Configuration settings
├── models.py                 # Database models
├── excel_parser.py           # Excel file utilities
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variables template
├── templates/                # HTML templates
│   ├── base.html
│   └── index.html
├── static/                   # Static files
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── mep.js
└── bakery.db                 # SQLite database (created after init-db)
```

## Database Schema

### Tables

- **ingredients** - Base ingredients (flour, water, salt, etc.)
- **recipes** - Bread recipes and their properties
- **recipe_ingredients** - Recipe ingredients with baker's percentages
- **production_runs** - Historical production records
- **production_items** - Individual breads in a production run
- **production_ingredients** - Calculated ingredient amounts
- **schedule_templates** - Saved production schedules
- **mixer_capacities** - Mixer capacity limits per recipe

## Development

### Adding a New Recipe

```python
# Using Flask shell
flask --app app shell

>>> from models import db, Recipe, Ingredient, RecipeIngredient
>>>
>>> # Create recipe
>>> recipe = Recipe(
...     name='Baguette',
...     recipe_type='bread',
...     base_batch_weight=400,
...     loaf_weight=400
... )
>>> db.session.add(recipe)
>>> db.session.commit()
>>>
>>> # Add ingredients
>>> flour = Ingredient.query.filter_by(name='Red Rose Flour').first()
>>> water = Ingredient.query.filter_by(name='Water').first()
>>>
>>> ri1 = RecipeIngredient(recipe_id=recipe.id, ingredient_id=flour.id, percentage=100.0, order=1)
>>> ri2 = RecipeIngredient(recipe_id=recipe.id, ingredient_id=water.id, percentage=70.0, order=2)
>>> db.session.add(ri1)
>>> db.session.add(ri2)
>>> db.session.commit()
```

### Creating a Production Run

```python
from datetime import date
from models import db, ProductionRun, ProductionItem, Recipe

# Create production run
run = ProductionRun(
    date=date.today(),
    created_by='admin'
)
db.session.add(run)
db.session.commit()

# Add items
italian = Recipe.query.filter_by(name='Italian').first()
item = ProductionItem(
    production_run_id=run.id,
    recipe_id=italian.id,
    quantity=10,
    batch_weight=10 * italian.loaf_weight
)
db.session.add(item)
db.session.commit()
```

## Next Steps

### Phase 2: User Management & Admin Interface
1. Implement user authentication (Flask-Login)
2. Add role-based access control
3. Build admin interface for:
   - Recipe editing
   - Ingredient management
   - Order entry

### Phase 3: Advanced Features
1. Production schedule templates
2. Excel import from existing spreadsheets
3. Batch splitting logic
4. MEP Hub functionality (day selection)
5. Advanced reporting dashboard

### Phase 4: Integration & Polish
1. Two-day vs same-day bread formulas
2. Starter and soaker calculations
3. Mobile-responsive design improvements
4. Real-time collaboration features

## Troubleshooting

### Database Issues
If you need to reset the database:
```bash
rm bakery.db
flask --app app init-db
flask --app app seed-db
```

### Port Already in Use
If port 5000 is already in use:
```bash
flask --app app run --port 5001
```

## License

Copyright 2024 - Bakery Production Management System
