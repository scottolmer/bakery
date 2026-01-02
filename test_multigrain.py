"""
Test Multigrain (Italian dough + soak) workflow
"""
from app import app
from mep_calculator import MEPCalculator

with app.app_context():
    # Test with 10 Italian + 2 Multigrain
    items = [
        {'recipe_id': 1, 'quantity': 10},   # Italian
        {'recipe_id': 10, 'quantity': 2}    # Multigrain
    ]

    calculator = MEPCalculator(items)
    sheets = calculator.calculate_all_sheets()

    print('=== MIX SHEET TEST ===')
    mix_sheet = sheets['mix_sheet']

    for bread in mix_sheet['breads']:
        print(f'\nBread: {bread["name"]}')
        print(f'Quantity: {bread["quantity"]} loaves')
        print(f'Total Weight: {bread["total_weight"]}g')

        if 'extra_dough_for' in bread:
            print('\nExtra dough for:')
            for extra in bread['extra_dough_for']:
                print(f'  - {extra["name"]}: {extra["quantity"]} loaves ({extra["amount"]}g)')

        if 'italian_dough_amount' in bread:
            print(f'\n[!] Remove {bread["italian_dough_amount"]}g from Italian batch')

        print('\nIngredients to add:')
        for ing in bread['ingredients']:
            print(f'  {ing["name"]}: {ing["amount_grams"]}g')

    print('\n=== MEP INGREDIENTS TEST ===')
    mep = sheets['mep_ingredients']

    for bread in mep['breads']:
        print(f'\nBread: {bread["bread_name"]} ({bread["quantity"]} loaves)')

        if 'italian_dough_amount' in bread:
            print(f'  [!] Remove {bread["italian_dough_amount"]}g from Italian batch')

        if bread['ingredients']:
            print('  Other ingredients:')
            for ing in bread['ingredients']:
                print(f'    {ing["name"]}: {ing["amount_grams"]}g')
        else:
            print('  No other ingredients')

    print('\n=== VERIFICATION ===')
    # Check that Multigrain appears in mix sheet
    multigrain_in_mix = any(b['name'] == 'Multigrain' for b in mix_sheet['breads'])
    print(f'Multigrain in Mix Sheet: {multigrain_in_mix} (should be True)')

    # Check that Italian has extra dough note
    italian_bread = next((b for b in mix_sheet['breads'] if b['name'] == 'Italian'), None)
    if italian_bread:
        has_extra = 'extra_dough_for' in italian_bread
        print(f'Italian has extra dough note: {has_extra} (should be True)')
        if has_extra:
            total_extra = sum(e['amount'] for e in italian_bread['extra_dough_for'])
            print(f'Total extra dough: {total_extra}g')

    # Check that Multigrain appears in MEP with Italian dough note
    multigrain_mep = next((b for b in mep['breads'] if b['bread_name'] == 'Multigrain'), None)
    if multigrain_mep:
        has_italian_dough = 'italian_dough_amount' in multigrain_mep
        print(f'Multigrain has Italian dough amount: {has_italian_dough} (should be True)')
        if has_italian_dough:
            print(f'Italian dough to remove: {multigrain_mep["italian_dough_amount"]}g')
