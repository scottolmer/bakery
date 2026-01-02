"""
MEP (Mise en Place) Calculator
Calculates what needs to be prepared tonight for tomorrow's production
"""
from models import Recipe, RecipeIngredient, Ingredient
from typing import Dict, List, Tuple
from collections import defaultdict


class MEPCalculator:
    """Calculate MEP sheets for bakery production"""

    def __init__(self, production_items: List[Dict], delivery_date=None):
        """
        Initialize with production items
        production_items: [{'recipe_id': int, 'quantity': int}, ...]
        delivery_date: date object for the delivery date (used for Emmy Feed calculation)
        """
        self.production_items = production_items
        self.delivery_date = delivery_date
        self.starter_totals = defaultdict(float)
        self.soaker_totals = defaultdict(float)
        self.ingredient_totals = defaultdict(float)

    def calculate_all_sheets(self) -> Dict:
        """
        Calculate all MEP sheets for a mix date:
        1. Today's Mix Sheet (mix this morning)
        2. Morning Emmy Feed (feed Emmy this morning)
        3. Starter Prep Sheet (should have been built last night for today's mix)
        4. Soak Prep Sheet (should have been prepared last night for today's mix)
        5. MEP Ingredient List (should have been measured last night for today's mix)

        All sheets are for the SAME production run:
        - Mix date: When doughs are mixed (morning)
        - Prep date: Evening before mix date (when starters/soakers were built)
        - Delivery date: Day after mix date (when breads are baked and delivered)
        """
        mix_sheet = self.calculate_mix_sheet()
        morning_emmy = self.calculate_morning_emmy_feed()
        starter_sheet = self.calculate_starter_sheet()
        soak_sheet = self.calculate_soak_sheet()
        mep_ingredients = self.calculate_mep_ingredients()

        return {
            'mix_sheet': mix_sheet,
            'morning_emmy_feed': morning_emmy,
            'starter_sheet': starter_sheet,
            'soak_sheet': soak_sheet,
            'mep_ingredients': mep_ingredients
        }

    def calculate_mix_sheet(self) -> Dict:
        """
        Today's Mix Sheet - what to mix right now
        """
        breads = []

        # First pass: find breads that use Italian dough (like Multigrain)
        italian_dough_needed = 0.0
        breads_using_italian_dough = []

        for item in self.production_items:
            recipe = Recipe.query.get(item['recipe_id'])
            if not recipe or recipe.recipe_type != 'bread':
                continue

            # Check if this bread uses Italian dough
            for ri in recipe.ingredients:
                if ri.ingredient.name == 'Italian dough':
                    quantity = item['quantity']
                    total_weight = quantity * recipe.loaf_weight

                    # Calculate how much Italian dough this bread needs
                    if ri.is_percentage:
                        amount = (ri.percentage / 100.0) * total_weight
                    else:
                        amount = ri.amount_grams * (total_weight / recipe.base_batch_weight) if recipe.base_batch_weight > 0 else 0

                    italian_dough_needed += amount
                    breads_using_italian_dough.append({
                        'name': recipe.name,
                        'quantity': quantity,
                        'amount': round(amount, 1)
                    })
                    break

        # Second pass: process each bread for the mix sheet
        for item in self.production_items:
            recipe = Recipe.query.get(item['recipe_id'])
            if not recipe or recipe.recipe_type != 'bread':
                continue

            quantity = item['quantity']
            total_weight = quantity * recipe.loaf_weight

            # Check if this bread uses Italian dough
            uses_italian_dough = any(ri.ingredient.name == 'Italian dough' for ri in recipe.ingredients)
            italian_dough_amount = None

            # For Italian bread, add extra dough for breads that use it
            if recipe.name == 'Italian' and italian_dough_needed > 0:
                total_weight += italian_dough_needed

            # Calculate ingredients for this bread
            ingredients = []
            for ri in recipe.ingredients:
                # Handle Italian dough specially for breads that use it
                if ri.ingredient.name == 'Italian dough':
                    if ri.is_percentage:
                        italian_dough_amount = round((ri.percentage / 100.0) * (quantity * recipe.loaf_weight), 1)
                    else:
                        if recipe.base_batch_weight > 0:
                            italian_dough_amount = round(ri.amount_grams * ((quantity * recipe.loaf_weight) / recipe.base_batch_weight), 1)
                        else:
                            italian_dough_amount = 0
                    continue

                if ri.is_percentage:
                    amount = (ri.percentage / 100.0) * total_weight
                else:
                    amount = ri.amount_grams * (total_weight / recipe.base_batch_weight) if recipe.base_batch_weight > 0 else 0

                ingredients.append({
                    'name': ri.ingredient.name,
                    'amount_grams': round(amount, 1),
                    'category': ri.ingredient.category
                })

            bread_info = {
                'name': recipe.name,
                'quantity': quantity,
                'loaf_weight': recipe.loaf_weight,
                'total_weight': total_weight,
                'ingredients': ingredients
            }

            # Add note about extra dough if this is Italian
            if recipe.name == 'Italian' and breads_using_italian_dough:
                bread_info['extra_dough_for'] = breads_using_italian_dough

            # Add Italian dough amount if this bread uses it
            if italian_dough_amount is not None:
                bread_info['italian_dough_amount'] = italian_dough_amount

            breads.append(bread_info)

        return {'breads': breads}

    def calculate_starter_sheet(self) -> Dict:
        """
        Starter Prep Sheet - what starters should have been built last night for today's mix
        (These were prepared on prep date evening for this morning's mix)
        """
        starters = defaultdict(lambda: {'total_grams': 0, 'recipes_needing': []})

        for item in self.production_items:
            recipe = Recipe.query.get(item['recipe_id'])
            if not recipe or recipe.recipe_type != 'bread':
                continue

            quantity = item['quantity']
            total_weight = quantity * recipe.loaf_weight

            # Find all starter requirements for this recipe
            for ri in recipe.ingredients:
                if ri.ingredient.category == 'starter':
                    # Calculate amount needed
                    if ri.is_percentage:
                        amount = (ri.percentage / 100.0) * total_weight
                    else:
                        amount = ri.amount_grams * (total_weight / recipe.base_batch_weight)

                    starters[ri.ingredient.name]['total_grams'] += amount
                    starters[ri.ingredient.name]['recipes_needing'].append({
                        'recipe': recipe.name,
                        'amount_grams': round(amount, 1)
                    })

        # Format for output
        starter_list = []
        for starter_name, data in starters.items():
            # Get the starter recipe if it exists
            starter_recipe = Recipe.query.filter_by(name=starter_name, recipe_type='starter').first()

            starter_ingredients = []
            if starter_recipe:
                # Calculate ingredients for this starter
                # Need to work backwards from total weight to flour weight
                total_needed = data['total_grams']

                # Calculate sum of percentages to find flour weight
                total_percentage = sum(ri.percentage for ri in starter_recipe.ingredients if ri.is_percentage)

                if total_percentage > 0:
                    flour_weight = total_needed / (total_percentage / 100.0)

                    for ri in starter_recipe.ingredients:
                        if ri.is_percentage:
                            # Calculate based on flour weight
                            amount = (ri.percentage / 100.0) * flour_weight
                        else:
                            if starter_recipe.base_batch_weight > 0:
                                amount = ri.amount_grams * (total_needed / starter_recipe.base_batch_weight)
                            else:
                                amount = 0

                        starter_ingredients.append({
                            'name': ri.ingredient.name,
                            'amount_grams': round(amount, 1)
                        })

            starter_list.append({
                'starter_name': starter_name,
                'total_grams': round(data['total_grams'], 1),
                'recipes_needing': data['recipes_needing'],
                'ingredients': starter_ingredients
            })

        return {'starters': starter_list}

    def calculate_morning_emmy_feed(self) -> Dict:
        """
        Morning Emmy Feed - calculate how much Emmy to feed in the morning
        This uses yesterday's leftover Levain to feed Emmy
        The fed Emmy will be used for tonight's Levain build (for tomorrow's production)
        """
        from datetime import timedelta
        from models import ProductionRun

        # If no delivery date provided, can't calculate next day's Emmy
        if not self.delivery_date:
            return {'emmy_feed': None}

        # Look up NEXT day's production run (delivery_date + 1)
        next_delivery_date = self.delivery_date + timedelta(days=1)
        next_production_run = ProductionRun.query.filter_by(date=next_delivery_date).first()

        if not next_production_run or not next_production_run.items:
            # No production tomorrow, so no Emmy feed needed
            return {'emmy_feed': None}

        # Calculate starters needed for NEXT day's production
        next_day_items = [{'recipe_id': item.recipe_id, 'quantity': item.quantity}
                         for item in next_production_run.items]

        # Calculate total Emmy needed for tonight's starter builds (for tomorrow's mix)
        total_emmy_needed = 0.0

        # Calculate starters for next day's production
        starters = defaultdict(lambda: {'total_grams': 0, 'recipes_needing': []})

        for item in next_day_items:
            recipe = Recipe.query.get(item['recipe_id'])
            if not recipe or recipe.recipe_type != 'bread':
                continue

            quantity = item['quantity']
            total_weight = quantity * recipe.loaf_weight

            # Find all starter requirements for this recipe
            for ri in recipe.ingredients:
                if ri.ingredient.category == 'starter':
                    # Calculate amount needed
                    if ri.is_percentage:
                        amount = (ri.percentage / 100.0) * total_weight
                    else:
                        amount = ri.amount_grams * (total_weight / recipe.base_batch_weight) if recipe.base_batch_weight > 0 else 0

                    starters[ri.ingredient.name]['total_grams'] += amount

        # Now calculate Emmy needed for these starters
        for starter_name, data in starters.items():
            # Get the starter recipe to see if it uses Emmy
            starter_recipe = Recipe.query.filter_by(name=starter_name, recipe_type='starter').first()
            if starter_recipe:
                # Calculate total percentage for this starter to find flour weight
                starter_total_percentage = sum(ri.percentage for ri in starter_recipe.ingredients if ri.is_percentage)

                if starter_total_percentage > 0:
                    # Work backwards from total weight to flour weight
                    starter_flour_weight = data['total_grams'] / (starter_total_percentage / 100.0)

                    for ri in starter_recipe.ingredients:
                        if 'Emmy' in ri.ingredient.name:
                            # Calculate Emmy based on flour weight
                            if ri.is_percentage:
                                emmy_amount = (ri.percentage / 100.0) * starter_flour_weight
                            else:
                                if starter_recipe.base_batch_weight > 0:
                                    emmy_amount = ri.amount_grams * (data['total_grams'] / starter_recipe.base_batch_weight)
                                else:
                                    emmy_amount = 0
                            total_emmy_needed += emmy_amount

        if total_emmy_needed == 0:
            return {'emmy_feed': None}

        # Get Emmy recipe to calculate morning feed ingredients
        emmy_recipe = Recipe.query.filter_by(name='Emmy(starter)', recipe_type='starter').first()
        if not emmy_recipe:
            return {'emmy_feed': None}

        # Calculate ingredients for morning Emmy feed
        # Need to work backwards from total weight to flour weight
        # Emmy recipe: 100% flour + 100% water + 25% levain = 225% total
        # So: flour_weight = total_weight / (sum_of_percentages / 100)

        # Calculate sum of percentages
        total_percentage = sum(ri.percentage for ri in emmy_recipe.ingredients if ri.is_percentage)

        if total_percentage == 0:
            return {'emmy_feed': None}

        # Calculate flour weight (the base)
        flour_weight = total_emmy_needed / (total_percentage / 100.0)

        feed_ingredients = []
        for ri in emmy_recipe.ingredients:
            if ri.is_percentage:
                # Calculate based on flour weight
                amount = (ri.percentage / 100.0) * flour_weight
            else:
                if emmy_recipe.base_batch_weight > 0:
                    amount = ri.amount_grams * (total_emmy_needed / emmy_recipe.base_batch_weight)
                else:
                    amount = 0

            # Replace Emmy with "Yesterday's Levain" in the display
            ingredient_name = ri.ingredient.name
            if 'Emmy' in ingredient_name:
                ingredient_name = "Yesterday's Levain (saved)"

            feed_ingredients.append({
                'name': ingredient_name,
                'amount_grams': round(amount, 1),
                'category': ri.ingredient.category
            })

        # Format next delivery date for display
        next_date_str = next_delivery_date.strftime('%m/%d')

        return {
            'emmy_feed': {
                'total_grams': round(total_emmy_needed, 1),
                'ingredients': feed_ingredients,
                'note': f'Feed Emmy this morning using saved Levain from yesterday. This will be used tonight to build starters for tomorrow\'s mix ({next_date_str} delivery).'
            }
        }

    def calculate_soak_sheet(self) -> Dict:
        """
        Soak Prep Sheet - what soaks should have been prepared last night for today's mix
        (These were prepared on prep date evening for this morning's mix)
        """
        soakers = defaultdict(lambda: {'total_grams': 0, 'recipes_needing': []})

        for item in self.production_items:
            recipe = Recipe.query.get(item['recipe_id'])
            if not recipe or recipe.recipe_type != 'bread':
                continue

            quantity = item['quantity']
            total_weight = quantity * recipe.loaf_weight

            # Find all soaker requirements
            for ri in recipe.ingredients:
                if ri.ingredient.category == 'soaker':
                    if ri.is_percentage:
                        amount = (ri.percentage / 100.0) * total_weight
                    else:
                        amount = ri.amount_grams * (total_weight / recipe.base_batch_weight)

                    soakers[ri.ingredient.name]['total_grams'] += amount
                    soakers[ri.ingredient.name]['recipes_needing'].append({
                        'recipe': recipe.name,
                        'amount_grams': round(amount, 1)
                    })

        # Format for output
        soaker_list = []
        for soaker_name, data in soakers.items():
            # Get the soaker recipe if it exists
            soaker_recipe = Recipe.query.filter_by(name=soaker_name, recipe_type='soaker').first()

            soaker_ingredients = []
            if soaker_recipe:
                # Calculate ingredients for this soaker
                # Need to work backwards from total weight to flour weight
                total_needed = data['total_grams']

                # Calculate sum of percentages to find flour weight
                total_percentage = sum(ri.percentage for ri in soaker_recipe.ingredients if ri.is_percentage)
                if total_percentage > 0:
                    flour_weight = total_needed / (total_percentage / 100.0)
                else:
                    flour_weight = total_needed  # Fallback if no percentages

                for ri in soaker_recipe.ingredients:
                    if ri.is_percentage:
                        # Calculate based on flour weight
                        amount = (ri.percentage / 100.0) * flour_weight
                    else:
                        if soaker_recipe.base_batch_weight > 0:
                            amount = ri.amount_grams * (total_needed / soaker_recipe.base_batch_weight)
                        else:
                            amount = 0

                    soaker_ingredients.append({
                        'name': ri.ingredient.name,
                        'amount_grams': round(amount, 1)
                    })

            soaker_list.append({
                'soaker_name': soaker_name,
                'total_grams': round(data['total_grams'], 1),
                'recipes_needing': data['recipes_needing'],
                'ingredients': soaker_ingredients
            })

        return {'soakers': soaker_list}

    def calculate_mep_ingredients(self) -> Dict:
        """
        MEP Ingredient List - ingredients that should have been measured last night
        Ingredients organized by bread type - each bread gets its own bin of pre-measured ingredients
        (These were measured on prep date evening for this morning's mix)
        """
        # Get starters and soakers (prepared separately)
        starter_sheet = self.calculate_starter_sheet()
        soak_sheet = self.calculate_soak_sheet()

        # Organize bread ingredients by bread type
        breads = []

        for item in self.production_items:
            recipe = Recipe.query.get(item['recipe_id'])
            if not recipe or recipe.recipe_type != 'bread':
                continue

            quantity = item['quantity']
            total_weight = quantity * recipe.loaf_weight

            bread_ingredients = []
            italian_dough_amount = None

            for ri in recipe.ingredients:
                # Skip starters and soakers (they're prepared separately)
                if ri.ingredient.category in ['starter', 'soaker']:
                    continue

                # Handle Italian dough specially
                if ri.ingredient.name == 'Italian dough':
                    if ri.is_percentage:
                        italian_dough_amount = round((ri.percentage / 100.0) * total_weight, 1)
                    else:
                        if recipe.base_batch_weight > 0:
                            italian_dough_amount = round(ri.amount_grams * (total_weight / recipe.base_batch_weight), 1)
                        else:
                            italian_dough_amount = 0
                    continue

                if ri.is_percentage:
                    amount = (ri.percentage / 100.0) * total_weight
                else:
                    if recipe.base_batch_weight > 0:
                        amount = ri.amount_grams * (total_weight / recipe.base_batch_weight)
                    else:
                        amount = 0

                bread_ingredients.append({
                    'name': ri.ingredient.name,
                    'amount_grams': round(amount, 1),
                    'category': ri.ingredient.category
                })

            # Sort ingredients by category for better organization
            bread_ingredients.sort(key=lambda x: (x['category'], x['name']))

            bread_info = {
                'bread_name': recipe.name,
                'quantity': quantity,
                'total_weight': total_weight,
                'ingredients': bread_ingredients
            }

            # Add Italian dough amount if this bread uses it
            if italian_dough_amount is not None:
                bread_info['italian_dough_amount'] = italian_dough_amount

            breads.append(bread_info)

        return {
            'starters': starter_sheet['starters'],
            'soakers': soak_sheet['soakers'],
            'breads': breads
        }
