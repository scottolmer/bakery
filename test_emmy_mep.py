"""
Test if Emmy appears in MEP starter calculations
"""
from app import app
from mep_calculator import MEPCalculator
import json

with app.app_context():
    # Test with Italian bread (uses Levain which now uses Emmy)
    items = [
        {'recipe_id': 1, 'quantity': 10}  # Italian bread
    ]

    calculator = MEPCalculator(items)
    sheets = calculator.calculate_all_sheets()

    print('\n=== Tomorrow\'s Starter Sheet ===')
    starter_sheet = sheets['starter_sheet']

    print(json.dumps(starter_sheet, indent=2))

    print('\n\n=== Checking if Emmy appears ===')
    emmy_found = False
    for starter in starter_sheet.get('starters', []):
        print(f'\n{starter["starter_name"]} - {starter["total_grams"]}g needed')
        if 'ingredients' in starter:
            for ing in starter['ingredients']:
                print(f'  {ing["name"]}: {ing["amount_grams"]}g')
                if 'Emmy' in ing['name']:
                    emmy_found = True
                    print('    ✓ EMMY FOUND!')

    if emmy_found:
        print('\n✓ SUCCESS: Emmy is now showing in the starter sheet!')
    else:
        print('\n✗ Emmy NOT found in any starter')
