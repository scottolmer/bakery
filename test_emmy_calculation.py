"""
Test Emmy feed calculation to verify correct amounts
"""
from app import app
from mep_calculator import MEPCalculator

with app.app_context():
    # Test with Italian bread (uses Levain which uses Emmy)
    items = [
        {'recipe_id': 1, 'quantity': 10}  # Italian bread
    ]

    calculator = MEPCalculator(items)
    sheets = calculator.calculate_all_sheets()

    print('\n=== MORNING EMMY FEED TEST ===')
    morning_feed = sheets['morning_emmy_feed']

    if morning_feed and morning_feed.get('emmy_feed'):
        feed = morning_feed['emmy_feed']
        print(f'\nTotal Emmy needed: {feed["total_grams"]}g')
        print(f'\nIngredients:')

        total_calculated = 0
        for ing in feed['ingredients']:
            print(f'  {ing["name"]}: {ing["amount_grams"]}g')
            total_calculated += ing['amount_grams']

        print(f'\n--- VERIFICATION ---')
        print(f'Sum of ingredients: {total_calculated}g')
        print(f'Target total: {feed["total_grams"]}g')
        print(f'Difference: {abs(total_calculated - feed["total_grams"]):.1f}g')

        if abs(total_calculated - feed["total_grams"]) < 1:
            print('[OK] Calculation is correct!')
        else:
            print('[ERROR] Calculation is wrong!')

    print('\n=== LEVAIN BUILD TEST ===')
    starter_sheet = sheets['starter_sheet']
    for starter in starter_sheet['starters']:
        if starter['starter_name'] == 'Levain':
            print(f'\nLevain total needed: {starter["total_grams"]}g')
            print(f'\nIngredients:')

            total_calculated = 0
            for ing in starter['ingredients']:
                print(f'  {ing["name"]}: {ing["amount_grams"]}g')
                total_calculated += ing['amount_grams']

            print(f'\n--- VERIFICATION ---')
            print(f'Sum of ingredients: {total_calculated}g')
            print(f'Target total: {starter["total_grams"]}g')
            print(f'Difference: {abs(total_calculated - starter["total_grams"]):.1f}g')

            if abs(total_calculated - starter["total_grams"]) < 1:
                print('[OK] Calculation is correct!')
            else:
                print('[ERROR] Calculation is wrong!')
