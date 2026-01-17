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
        Includes batch splitting logic for Italian dough (>110 loaves)
        """
        breads = []

        # ITALIAN SPLIT THRESHOLD
        ITALIAN_SPLIT_THRESHOLD = 110  # loaves

        # First pass: Count Italian + Multigrain loaves and calculate Italian dough needed
        italian_loaves = 0
        multigrain_loaves = 0
        italian_dough_needed = 0.0
        breads_using_italian_dough = []

        for item in self.production_items:
            recipe = Recipe.query.get(item['recipe_id'])
            if not recipe or recipe.recipe_type != 'bread':
                continue

            # Count Italian loaves
            if recipe.name == 'Italian':
                italian_loaves = item['quantity']

            # Check if this bread uses Italian dough (like Multigrain)
            for ri in recipe.ingredients:
                if ri.ingredient.name == 'Italian dough':
                    multigrain_loaves = item['quantity']
                    quantity = item['quantity']
                    total_weight = quantity * recipe.loaf_weight

                    # Calculate total percentage for baker's percentage calculation
                    total_percentage = sum(ri.percentage for ri in recipe.ingredients if ri.is_percentage)
                    flour_weight = total_weight / (total_percentage / 100.0) if total_percentage > 0 else 0

                    # Calculate how much Italian dough this bread needs using baker's percentages
                    if ri.is_percentage:
                        # flour_weight is the base (flour = 100%), other ingredients are relative to it
                        amount = (ri.percentage / 100.0) * flour_weight
                    else:
                        amount = ri.amount_grams * (total_weight / recipe.base_batch_weight) if recipe.base_batch_weight > 0 else 0

                    italian_dough_needed += amount
                    breads_using_italian_dough.append({
                        'name': recipe.name,
                        'quantity': quantity,
                        'amount': round(amount, 1)
                    })
                    break

        # Determine if Italian needs to be split
        total_italian_units = italian_loaves + multigrain_loaves
        needs_split = total_italian_units > ITALIAN_SPLIT_THRESHOLD

        # Calculate batch sizes if splitting
        if needs_split:
            # Batch 1 includes Multigrain units
            batch1_italian = (total_italian_units // 2) - multigrain_loaves
            batch2_italian = total_italian_units // 2

            # If odd number, give extra to batch 2
            if total_italian_units % 2 == 1:
                batch2_italian += 1

        # Second pass: process each bread for the mix sheet
        for item in self.production_items:
            recipe = Recipe.query.get(item['recipe_id'])
            if not recipe or recipe.recipe_type != 'bread':
                continue

            quantity = item['quantity']

            # Check if this bread uses Italian dough
            uses_italian_dough = any(ri.ingredient.name == 'Italian dough' for ri in recipe.ingredients)

            # ITALIAN DOUGH - Handle splitting
            if recipe.name == 'Italian' and needs_split:
                # Create Batch 1 (includes Multigrain removal)
                batch1_weight = batch1_italian * recipe.loaf_weight + italian_dough_needed
                batch1_ingredients = self._calculate_bread_ingredients(recipe, batch1_italian, batch1_weight)

                breads.append({
                    'name': 'Italian - BATCH 1',
                    'quantity': batch1_italian,
                    'loaf_weight': recipe.loaf_weight,
                    'total_weight': batch1_weight,
                    'ingredients': batch1_ingredients,
                    'extra_dough_for': breads_using_italian_dough,
                    'batch_number': 1
                })

                # Create Batch 2 (pure Italian, no removal)
                batch2_weight = batch2_italian * recipe.loaf_weight
                batch2_ingredients = self._calculate_bread_ingredients(recipe, batch2_italian, batch2_weight)

                breads.append({
                    'name': 'Italian - BATCH 2',
                    'quantity': batch2_italian,
                    'loaf_weight': recipe.loaf_weight,
                    'total_weight': batch2_weight,
                    'ingredients': batch2_ingredients,
                    'batch_number': 2
                })

            # ITALIAN DOUGH - No split needed
            elif recipe.name == 'Italian' and not needs_split:
                total_weight = quantity * recipe.loaf_weight
                if italian_dough_needed > 0:
                    total_weight += italian_dough_needed

                ingredients = self._calculate_bread_ingredients(recipe, quantity, total_weight)

                bread_info = {
                    'name': recipe.name,
                    'quantity': quantity,
                    'loaf_weight': recipe.loaf_weight,
                    'total_weight': total_weight,
                    'ingredients': ingredients
                }

                if breads_using_italian_dough:
                    bread_info['extra_dough_for'] = breads_using_italian_dough

                breads.append(bread_info)

            # MULTIGRAIN OR OTHER BREADS USING ITALIAN DOUGH
            elif uses_italian_dough:
                # Calculate Italian dough amount needed
                italian_dough_amount = None
                for ri in recipe.ingredients:
                    if ri.ingredient.name == 'Italian dough':
                        if ri.is_percentage:
                            italian_dough_amount = round((ri.percentage / 100.0) * (quantity * recipe.loaf_weight), 1)
                        else:
                            if recipe.base_batch_weight > 0:
                                italian_dough_amount = round(ri.amount_grams * ((quantity * recipe.loaf_weight) / recipe.base_batch_weight), 1)
                            else:
                                italian_dough_amount = 0
                        break

                # Calculate other ingredients (exclude Italian dough)
                ingredients = []
                for ri in recipe.ingredients:
                    if ri.ingredient.name == 'Italian dough':
                        continue

                    if ri.is_percentage:
                        amount = (ri.percentage / 100.0) * (quantity * recipe.loaf_weight)
                    else:
                        amount = ri.amount_grams * ((quantity * recipe.loaf_weight) / recipe.base_batch_weight) if recipe.base_batch_weight > 0 else 0

                    ingredients.append({
                        'name': ri.ingredient.name,
                        'amount_grams': round(amount, 1),
                        'category': ri.ingredient.category
                    })

                breads.append({
                    'name': recipe.name,
                    'quantity': quantity,
                    'loaf_weight': recipe.loaf_weight,
                    'total_weight': quantity * recipe.loaf_weight,
                    'ingredients': ingredients,
                    'italian_dough_amount': italian_dough_amount
                })

            # ALL OTHER BREADS
            else:
                total_weight = quantity * recipe.loaf_weight
                ingredients = self._calculate_bread_ingredients(recipe, quantity, total_weight)

                breads.append({
                    'name': recipe.name,
                    'quantity': quantity,
                    'loaf_weight': recipe.loaf_weight,
                    'total_weight': total_weight,
                    'ingredients': ingredients
                })

        return {'breads': breads}

    def _calculate_bread_ingredients(self, recipe, quantity, total_weight):
        """Helper method to calculate ingredients for a bread batch"""
        # Calculate total percentage for baker's percentage calculation
        total_percentage = sum(ri.percentage for ri in recipe.ingredients if ri.is_percentage and ri.ingredient.name != 'Italian dough')
        flour_weight = total_weight / (total_percentage / 100.0) if total_percentage > 0 else 0

        ingredients = []
        for ri in recipe.ingredients:
            # Skip Italian dough ingredient (handled separately)
            if ri.ingredient.name == 'Italian dough':
                continue

            if ri.is_percentage:
                # Baker's percentage calculation
                # flour_weight is the base (flour = 100%), other ingredients are relative to it
                amount = (ri.percentage / 100.0) * flour_weight
            else:
                amount = ri.amount_grams * (total_weight / recipe.base_batch_weight) if recipe.base_batch_weight > 0 else 0

            ingredients.append({
                'name': ri.ingredient.name,
                'amount_grams': round(amount, 1),
                'category': ri.ingredient.category
            })

        return ingredients

    def _calculate_mep_bread_ingredients(self, recipe, quantity, total_weight):
        """Helper method to calculate ingredients for MEP (skips starters, soakers, and Italian dough)"""
        # Calculate total percentage for baker's percentage calculation
        total_percentage = sum(ri.percentage for ri in recipe.ingredients if ri.is_percentage and ri.ingredient.name != 'Italian dough')
        flour_weight = total_weight / (total_percentage / 100.0) if total_percentage > 0 else 0

        ingredients = []
        for ri in recipe.ingredients:
            # Skip starters, soakers, and Italian dough (handled separately)
            if ri.ingredient.category in ['starter', 'soaker']:
                continue
            if ri.ingredient.name == 'Italian dough':
                continue

            if ri.is_percentage:
                # Baker's percentage calculation
                # flour_weight is the base (flour = 100%), other ingredients are relative to it
                amount = (ri.percentage / 100.0) * flour_weight
            else:
                amount = ri.amount_grams * (total_weight / recipe.base_batch_weight) if recipe.base_batch_weight > 0 else 0

            ingredients.append({
                'name': ri.ingredient.name,
                'amount_grams': round(amount, 1),
                'category': ri.ingredient.category
            })

        # Sort ingredients by category for better organization
        ingredients.sort(key=lambda x: (x['category'], x['name']))

        return ingredients

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

            # Calculate total percentage for baker's percentage calculation
            total_percentage = sum(ri.percentage for ri in recipe.ingredients if ri.is_percentage)
            flour_weight = total_weight / (total_percentage / 100.0) if total_percentage > 0 else 0

            # Find all starter requirements for this recipe
            for ri in recipe.ingredients:
                if ri.ingredient.category == 'starter':
                    # Calculate amount needed using baker's percentages
                    if ri.is_percentage:
                        # flour_weight is the base (flour = 100%), other ingredients are relative to it
                        amount = (ri.percentage / 100.0) * flour_weight
                    else:
                        amount = ri.amount_grams * (total_weight / recipe.base_batch_weight)

                    starters[ri.ingredient.name]['total_grams'] += amount
                    starters[ri.ingredient.name]['recipes_needing'].append({
                        'recipe': recipe.name,
                        'amount_grams': round(amount, 1)
                    })

        # Format for output with splitting logic
        LEVAIN_SPLIT_THRESHOLD = 6999  # grams

        starter_list = []
        for starter_name, data in starters.items():
            # Get the starter recipe if it exists
            starter_recipe = Recipe.query.filter_by(name=starter_name, recipe_type='starter').first()

            total_needed = data['total_grams']

            # Check if this is a Levain that needs splitting
            is_levain = 'Levain' in starter_name or 'levain' in starter_name.lower()
            needs_split = is_levain and total_needed > LEVAIN_SPLIT_THRESHOLD

            if needs_split:
                # Split into 2 batches
                batch1_weight = round(total_needed / 2, -1)  # Round to nearest 10g
                batch2_weight = round(total_needed / 2, -1)

                # Calculate Batch 1 ingredients
                batch1_ingredients = []
                if starter_recipe:
                    total_percentage = sum(ri.percentage for ri in starter_recipe.ingredients if ri.is_percentage)
                    if total_percentage > 0:
                        flour_weight = batch1_weight / (total_percentage / 100.0)

                        for ri in starter_recipe.ingredients:
                            if ri.is_percentage:
                                amount = (ri.percentage / 100.0) * flour_weight
                            else:
                                amount = ri.amount_grams * (batch1_weight / starter_recipe.base_batch_weight) if starter_recipe.base_batch_weight > 0 else 0

                            batch1_ingredients.append({
                                'name': ri.ingredient.name,
                                'amount_grams': round(amount, -1)  # Round to nearest 10g
                            })

                # Calculate Batch 2 ingredients
                batch2_ingredients = []
                if starter_recipe:
                    total_percentage = sum(ri.percentage for ri in starter_recipe.ingredients if ri.is_percentage)
                    if total_percentage > 0:
                        flour_weight = batch2_weight / (total_percentage / 100.0)

                        for ri in starter_recipe.ingredients:
                            if ri.is_percentage:
                                amount = (ri.percentage / 100.0) * flour_weight
                            else:
                                amount = ri.amount_grams * (batch2_weight / starter_recipe.base_batch_weight) if starter_recipe.base_batch_weight > 0 else 0

                            batch2_ingredients.append({
                                'name': ri.ingredient.name,
                                'amount_grams': round(amount, -1)  # Round to nearest 10g
                            })

                # Add Batch 1
                starter_list.append({
                    'starter_name': f'{starter_name} - BATCH 1',
                    'total_grams': batch1_weight,
                    'recipes_needing': data['recipes_needing'],
                    'ingredients': batch1_ingredients,
                    'batch_number': 1
                })

                # Add Batch 2
                starter_list.append({
                    'starter_name': f'{starter_name} - BATCH 2',
                    'total_grams': batch2_weight,
                    'recipes_needing': [],  # Don't repeat recipes for batch 2
                    'ingredients': batch2_ingredients,
                    'batch_number': 2
                })

            else:
                # No split needed
                starter_ingredients = []
                if starter_recipe:
                    # Calculate ingredients for this starter
                    # Need to work backwards from total weight to flour weight
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
                    'total_grams': round(total_needed, 1),
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
            return {'emmy_feed': None, 'debug': 'No delivery date provided'}

        # Look up NEXT day's production run (delivery_date + 1)
        next_delivery_date = self.delivery_date + timedelta(days=1)
        next_production_run = ProductionRun.query.filter_by(date=next_delivery_date).first()

        # Debug: Check what we found
        all_runs = ProductionRun.query.all()
        debug_info = {
            'looking_for_date': next_delivery_date.isoformat(),
            'current_delivery_date': self.delivery_date.isoformat(),
            'found_run': next_production_run is not None,
            'all_production_dates': [run.date.isoformat() for run in all_runs],
            'next_run_items_count': len(next_production_run.items) if next_production_run else 0,
            'next_run_items': [{'recipe': item.recipe.name, 'quantity': item.quantity} for item in next_production_run.items] if next_production_run else []
        }

        if not next_production_run or not next_production_run.items:
            # No production tomorrow, so no Emmy feed needed
            return {'emmy_feed': None, 'debug': debug_info}

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

            # Calculate total percentage for baker's percentage calculation
            total_percentage = sum(ri.percentage for ri in recipe.ingredients if ri.is_percentage)
            flour_weight = total_weight / (total_percentage / 100.0) if total_percentage > 0 else 0

            # Find all starter requirements for this recipe
            for ri in recipe.ingredients:
                if ri.ingredient.category == 'starter':
                    # Calculate amount needed using baker's percentages
                    if ri.is_percentage:
                        # flour_weight is the base (flour = 100%), other ingredients are relative to it
                        amount = (ri.percentage / 100.0) * flour_weight
                    else:
                        amount = ri.amount_grams * (total_weight / recipe.base_batch_weight) if recipe.base_batch_weight > 0 else 0

                    starters[ri.ingredient.name]['total_grams'] += amount

                elif ri.ingredient.category == 'dough':
                    # This recipe uses another dough (e.g., Multigrain uses Italian dough)
                    # Need to look up what starters the source dough recipe requires
                    dough_recipe = Recipe.query.filter_by(name=ri.ingredient.name, recipe_type='bread').first()
                    if dough_recipe:
                        # Calculate how much of this dough is needed
                        if ri.is_percentage:
                            dough_amount = (ri.percentage / 100.0) * flour_weight
                        else:
                            dough_amount = ri.amount_grams * (total_weight / recipe.base_batch_weight) if recipe.base_batch_weight > 0 else 0

                        # Calculate flour weight for the source dough
                        dough_total_percentage = sum(dri.percentage for dri in dough_recipe.ingredients if dri.is_percentage)
                        if dough_total_percentage > 0:
                            dough_flour_weight = dough_amount / (dough_total_percentage / 100.0)

                            # Find starters in the source dough recipe
                            for dri in dough_recipe.ingredients:
                                if dri.ingredient.category == 'starter':
                                    if dri.is_percentage:
                                        starter_amount = (dri.percentage / 100.0) * dough_flour_weight
                                    else:
                                        starter_amount = dri.amount_grams * (dough_amount / dough_recipe.base_batch_weight) if dough_recipe.base_batch_weight > 0 else 0

                                    starters[dri.ingredient.name]['total_grams'] += starter_amount

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
            return {
                'emmy_feed': None,
                'debug': {
                    **debug_info,
                    'reason': 'total_emmy_needed is 0',
                    'starters_checked': list(starters.keys())
                }
            }

        # Get Emmy recipe to calculate morning feed ingredients
        emmy_recipe = Recipe.query.filter_by(name='Emmy(starter)', recipe_type='starter').first()
        if not emmy_recipe:
            return {
                'emmy_feed': None,
                'debug': {
                    **debug_info,
                    'reason': 'Emmy(starter) recipe not found',
                    'total_emmy_needed': total_emmy_needed
                }
            }

        # Calculate ingredients for morning Emmy feed
        # Need to work backwards from total weight to flour weight
        # Emmy recipe: 100% flour + 100% water + 25% levain = 225% total
        # So: flour_weight = total_weight / (sum_of_percentages / 100)

        # Calculate sum of percentages
        total_percentage = sum(ri.percentage for ri in emmy_recipe.ingredients if ri.is_percentage)

        if total_percentage == 0:
            return {
                'emmy_feed': None,
                'debug': {
                    **debug_info,
                    'reason': 'Emmy recipe has no percentage-based ingredients',
                    'total_emmy_needed': total_emmy_needed
                }
            }

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

            # Calculate total percentage for baker's percentage calculation
            total_percentage = sum(ri.percentage for ri in recipe.ingredients if ri.is_percentage)
            flour_weight = total_weight / (total_percentage / 100.0) if total_percentage > 0 else 0

            # Find all soaker requirements
            for ri in recipe.ingredients:
                if ri.ingredient.category == 'soaker':
                    # Calculate amount needed using baker's percentages
                    if ri.is_percentage:
                        # flour_weight is the base (flour = 100%), other ingredients are relative to it
                        amount = (ri.percentage / 100.0) * flour_weight
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

        # ITALIAN SPLIT THRESHOLD
        ITALIAN_SPLIT_THRESHOLD = 110  # loaves

        # First pass: Count Italian + Multigrain loaves and calculate Italian dough needed
        italian_loaves = 0
        multigrain_loaves = 0
        italian_dough_needed = 0.0
        breads_using_italian_dough = []

        for item in self.production_items:
            recipe = Recipe.query.get(item['recipe_id'])
            if not recipe or recipe.recipe_type != 'bread':
                continue

            # Count Italian loaves
            if recipe.name == 'Italian':
                italian_loaves = item['quantity']

            # Check if this bread uses Italian dough (like Multigrain)
            for ri in recipe.ingredients:
                if ri.ingredient.name == 'Italian dough':
                    multigrain_loaves = item['quantity']
                    quantity = item['quantity']
                    total_weight = quantity * recipe.loaf_weight

                    # Calculate total percentage for baker's percentage calculation
                    total_percentage = sum(ri.percentage for ri in recipe.ingredients if ri.is_percentage)
                    flour_weight = total_weight / (total_percentage / 100.0) if total_percentage > 0 else 0

                    # Calculate how much Italian dough this bread needs using baker's percentages
                    if ri.is_percentage:
                        # flour_weight is the base (flour = 100%), other ingredients are relative to it
                        amount = (ri.percentage / 100.0) * flour_weight
                    else:
                        amount = ri.amount_grams * (total_weight / recipe.base_batch_weight) if recipe.base_batch_weight > 0 else 0

                    italian_dough_needed += amount
                    breads_using_italian_dough.append({
                        'name': recipe.name,
                        'quantity': quantity,
                        'amount': round(amount, 1)
                    })
                    break

        # Determine if Italian needs to be split
        total_italian_units = italian_loaves + multigrain_loaves
        needs_split = total_italian_units > ITALIAN_SPLIT_THRESHOLD

        # Calculate batch sizes if splitting
        if needs_split:
            # Batch 1 includes Multigrain units
            batch1_italian = (total_italian_units // 2) - multigrain_loaves
            batch2_italian = total_italian_units // 2

            # If odd number, give extra to batch 2
            if total_italian_units % 2 == 1:
                batch2_italian += 1

        # Second pass: process each bread for the MEP ingredient list
        for item in self.production_items:
            recipe = Recipe.query.get(item['recipe_id'])
            if not recipe or recipe.recipe_type != 'bread':
                continue

            quantity = item['quantity']

            # Check if this bread uses Italian dough
            uses_italian_dough = any(ri.ingredient.name == 'Italian dough' for ri in recipe.ingredients)

            # ITALIAN DOUGH - Handle splitting
            if recipe.name == 'Italian' and needs_split:
                # Create Batch 1 (includes Multigrain removal)
                batch1_weight = batch1_italian * recipe.loaf_weight + italian_dough_needed
                batch1_ingredients = self._calculate_mep_bread_ingredients(recipe, batch1_italian, batch1_weight)

                breads.append({
                    'bread_name': 'Italian - BATCH 1',
                    'quantity': batch1_italian,
                    'total_weight': batch1_weight,
                    'ingredients': batch1_ingredients,
                    'extra_dough_for': breads_using_italian_dough,
                    'batch_number': 1
                })

                # Create Batch 2 (pure Italian, no removal)
                batch2_weight = batch2_italian * recipe.loaf_weight
                batch2_ingredients = self._calculate_mep_bread_ingredients(recipe, batch2_italian, batch2_weight)

                breads.append({
                    'bread_name': 'Italian - BATCH 2',
                    'quantity': batch2_italian,
                    'total_weight': batch2_weight,
                    'ingredients': batch2_ingredients,
                    'batch_number': 2
                })

            # ITALIAN DOUGH - No split needed
            elif recipe.name == 'Italian' and not needs_split:
                total_weight = quantity * recipe.loaf_weight
                if italian_dough_needed > 0:
                    total_weight += italian_dough_needed

                bread_ingredients = self._calculate_mep_bread_ingredients(recipe, quantity, total_weight)

                bread_info = {
                    'bread_name': recipe.name,
                    'quantity': quantity,
                    'total_weight': total_weight,
                    'ingredients': bread_ingredients
                }

                if breads_using_italian_dough:
                    bread_info['extra_dough_for'] = breads_using_italian_dough

                breads.append(bread_info)

            # MULTIGRAIN OR OTHER BREADS USING ITALIAN DOUGH
            elif uses_italian_dough:
                total_weight = quantity * recipe.loaf_weight
                bread_ingredients = self._calculate_mep_bread_ingredients(recipe, quantity, total_weight)

                # Calculate Italian dough amount needed
                italian_dough_amount = None
                for ri in recipe.ingredients:
                    if ri.ingredient.name == 'Italian dough':
                        # Calculate total percentage for baker's percentage calculation
                        total_percentage = sum(ri.percentage for ri in recipe.ingredients if ri.is_percentage)
                        flour_weight = total_weight / (total_percentage / 100.0) if total_percentage > 0 else 0

                        if ri.is_percentage:
                            italian_dough_amount = round((ri.percentage / 100.0) * flour_weight, 1)
                        else:
                            if recipe.base_batch_weight > 0:
                                italian_dough_amount = round(ri.amount_grams * (total_weight / recipe.base_batch_weight), 1)
                            else:
                                italian_dough_amount = 0
                        break

                breads.append({
                    'bread_name': recipe.name,
                    'quantity': quantity,
                    'total_weight': total_weight,
                    'ingredients': bread_ingredients,
                    'italian_dough_amount': italian_dough_amount
                })

            # ALL OTHER BREADS (not Italian, not using Italian dough)
            else:
                total_weight = quantity * recipe.loaf_weight
                bread_ingredients = self._calculate_mep_bread_ingredients(recipe, quantity, total_weight)

                breads.append({
                    'bread_name': recipe.name,
                    'quantity': quantity,
                    'total_weight': total_weight,
                    'ingredients': bread_ingredients
                })

        return {
            'starters': starter_sheet['starters'],
            'soakers': soak_sheet['soakers'],
            'breads': breads
        }
