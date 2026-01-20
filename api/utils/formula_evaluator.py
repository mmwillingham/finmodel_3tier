"""
Formula Evaluator for Custom Charts
Evaluates formulas using projection data to create derived series.
"""

import logging
import re
from typing import Dict, List, Any, Optional
from typing import Union

logger = logging.getLogger(__name__)

# Available functions for formulas
FORMULA_FUNCTIONS = {
    'SUM': lambda *args: sum(args) if args else 0,
    'AVG': lambda *args: sum(args) / len(args) if args else 0,
    'MAX': lambda *args: max(args) if args else 0,
    'MIN': lambda *args: min(args) if args else 0,
    'ABS': lambda x: abs(x) if isinstance(x, (int, float)) else 0,
}


def extract_series_references(formula: str) -> List[str]:
    """
    Extract series references from a formula string.
    References can be:
    - Series labels in quotes: "Income" - "Expenses"
    - Series IDs: Series_1 + Series_2
    - Data type totals: income_total, expense_total, asset_total, liability_total
    - Projection fields: Total_Income_Flow, Total_Expense_Flow, Total_Assets, Net_Cash_Flow
    
    Returns a list of referenced series/fields.
    """
    # Pattern to match quoted strings (series labels)
    quoted_pattern = r'"([^"]+)"'
    # Pattern to match Series_X format
    series_pattern = r'Series_(\d+)'
    # Pattern to match data type totals or projection fields
    field_pattern = r'\b([a-z_]+_total|Total_[A-Z][a-zA-Z_]+|Net_[A-Z][a-zA-Z_]+)\b'
    
    references = set()
    
    # Find quoted references
    quoted_refs = re.findall(quoted_pattern, formula)
    references.update(quoted_refs)
    
    # Find Series_X references
    series_refs = re.findall(series_pattern, formula, re.IGNORECASE)
    references.update([f'Series_{ref}' for ref in series_refs])
    
    # Find field references
    field_refs = re.findall(field_pattern, formula, re.IGNORECASE)
    references.update(field_refs)
    
    return list(references)


def evaluate_formula(
    formula: str,
    series_values: Dict[str, List[float]],
    projection_data: List[Dict[str, Any]],
    series_labels: Dict[str, str] = None
) -> List[float]:
    """
    Evaluate a formula expression across all years of projection data.
    
    Args:
        formula: Formula string (e.g., "(income - expenses)")
        series_values: Dict mapping series labels/IDs to arrays of yearly values
        projection_data: List of projection data points (one per year)
        series_labels: Optional mapping from series IDs to labels
    
    Returns:
        List of calculated values (one per year)
    """
    if not formula or not formula.strip():
        logger.warning("Empty formula provided")
        return []
    
    if not projection_data:
        logger.warning("No projection data provided")
        return []
    
    num_years = len(projection_data)
    results = []
    
    # Log series values for debugging (only once, before the loop)
    if num_years > 0:
        logger.info(f"Formula evaluator: Formula='{formula}', Available series_values keys: {list(series_values.keys())}")
        for key, values in series_values.items():
            if len(values) >= 2:
                logger.info(f"  {key}: [{values[0]:.2f}, {values[1]:.2f}, ...] (first 2 years)")
    
    # Build a context dictionary for each year
    for year_index in range(num_years):
        year_data = projection_data[year_index]
        context = {}
        
        # Add series values to context
        for series_ref, values in series_values.items():
            if year_index < len(values):
                # Use the series reference as-is (label or ID)
                context[series_ref] = values[year_index]
                # Log context values for first 2 years
                if year_index < 2:
                    logger.info(f"  Year {year_index} context[{series_ref}] = {values[year_index]:.2f}")
        
        # Add projection fields to context (replace spaces with underscores for formula access)
        for key, value in year_data.items():
            # Convert keys like "Total Income Flow" to "Total_Income_Flow"
            formula_key = key.replace(' ', '_')
            # Also allow access by original key with quotes
            context[formula_key] = value
            context[f'"{key}"'] = value
        
        # Add standard projection field aliases
        if 'Total Income Flow' in year_data:
            context['income_total'] = year_data['Total Income Flow']
            context['Total_Income_Flow'] = year_data['Total Income Flow']
        if 'Total Expense Flow' in year_data:
            context['expense_total'] = abs(year_data['Total Expense Flow'])  # Convert to positive
            context['Total_Expense_Flow'] = abs(year_data['Total Expense Flow'])
        if 'Total Assets' in year_data:
            context['asset_total'] = year_data['Total Assets']
            context['Total_Assets'] = year_data['Total Assets']
        if 'Total Liabilities' in year_data:
            context['liability_total'] = abs(year_data['Total Liabilities'])  # Convert to positive
            context['Total_Liabilities'] = abs(year_data['Total Liabilities'])
        if 'Net Cash Flow' in year_data:
            context['net_cash_flow'] = year_data['Net Cash Flow']
            context['Net_Cash_Flow'] = year_data['Net Cash Flow']
        if 'Net Worth' in year_data:
            context['net_worth'] = year_data['Net Worth']
            context['Net_Worth'] = year_data['Net Worth']
        
        try:
            # Replace series references with their values
            evaluated_formula = formula
            
            # Replace quoted strings with their values FIRST (before removing spaces)
            quoted_pattern = r'"([^"]+)"'
            quoted_replacements = {}
            for match in re.finditer(quoted_pattern, formula):
                quoted_label = match.group(1)
                quoted_full = match.group(0)  # Full match including quotes
                if quoted_label in context:
                    quoted_replacements[quoted_full] = str(context[quoted_label])
                # Also check if quoted label matches projection field names
                elif quoted_label in year_data:
                    quoted_replacements[quoted_full] = str(year_data[quoted_label])
                elif quoted_label.replace(' ', '_') in context:
                    quoted_replacements[quoted_full] = str(context[quoted_label.replace(' ', '_')])
            
            # Apply quoted string replacements
            for quoted_full, replacement in quoted_replacements.items():
                evaluated_formula = evaluated_formula.replace(quoted_full, replacement)
            
            # Now remove spaces for easier parsing (after quoted strings are replaced)
            evaluated_formula = evaluated_formula.replace(' ', '')
            
            # Log context keys for debugging (first 2 years only)
            if year_index < 2:
                logger.info(f"  Year {year_index} context keys: {list(context.keys())}")
                logger.info(f"  Year {year_index} formula before Series_X replacement: {evaluated_formula}")
            
            # Replace Series_X references (case-insensitive lookup)
            # Collect all matches first, then replace in reverse order to avoid position shifts
            series_pattern = r'Series_(\d+)'
            series_replacements = []
            for match in re.finditer(series_pattern, evaluated_formula, re.IGNORECASE):
                series_id_matched = match.group(0)  # Matched string (could be Series_1 or series_1)
                # Find the actual key in context (case-insensitive)
                series_id_key = None
                for key in context.keys():
                    if key.lower() == series_id_matched.lower():
                        series_id_key = key
                        break
                
                if series_id_key and series_id_key in context:
                    replacement_value = str(context[series_id_key])
                    logger.info(f"  Replacing {series_id_matched} with {replacement_value} (from context key: {series_id_key})")
                    series_replacements.append((series_id_matched, replacement_value))
                else:
                    logger.error(f"  ERROR: Could not find {series_id_matched} in context! Available keys: {list(context.keys())}")
                    logger.error(f"  This will cause incorrect formula evaluation. Formula: {formula}")
            
            # Apply replacements (using replace for each unique match)
            for series_id_matched, replacement_value in series_replacements:
                evaluated_formula = evaluated_formula.replace(
                    series_id_matched,
                    replacement_value
                )
            
            # Log formula after Series_X replacement (for first 2 years)
            if year_index < 2:
                logger.info(f"  Year {year_index} formula after Series_X replacement: {evaluated_formula}")
            
            # Replace field references (but not quoted strings - already processed)
            # Also skip Series_X keys since we already processed them
            # IMPORTANT: Skip keys that are pure numbers to avoid replacing numeric values in formulas
            for key, value in context.items():
                # Skip if it's a quoted string we already processed
                if key.startswith('"'):
                    continue
                # Skip Series_X keys - we already processed them
                if re.match(r'Series_\d+', key, re.IGNORECASE):
                    continue
                # Skip keys that are pure numbers (to avoid replacing numeric values in the formula)
                # This prevents replacing numbers like "237053" with other values
                if isinstance(key, (int, float)) or (isinstance(key, str) and re.match(r'^-?\d+\.?\d*$', str(key))):
                    continue
                # Replace all occurrences of the key (as a whole word)
                pattern = r'\b' + re.escape(str(key)) + r'\b'
                # Check if replacement would happen and log it
                if re.search(pattern, evaluated_formula, flags=re.IGNORECASE):
                    if year_index < 2:
                        logger.info(f"  Year {year_index} Would replace field reference '{key}' (value: {value}) in formula")
                    evaluated_formula = re.sub(pattern, str(value), evaluated_formula, flags=re.IGNORECASE)
                    if year_index < 2:
                        logger.info(f"  Year {year_index} After replacing '{key}': {evaluated_formula}")
            
            # Log the final formula before evaluation (for first 2 years only)
            if year_index < 2:
                logger.info(f"  Year {year_index} formula after replacements: {evaluated_formula}")
            
            # Evaluate the formula safely
            # Only allow math operations and function calls
            # Remove any remaining non-math characters for safety
            safe_formula = evaluated_formula
            
            # Evaluate using eval with restricted globals/locals
            # This is safe because we've already replaced all references with numeric values
            allowed_names = {
                **FORMULA_FUNCTIONS,
                '__builtins__': {},
            }
            
            # Ensure the formula only contains safe characters after replacement
            if not re.match(r'^[\d+\-*/().,a-zA-Z_]+$', safe_formula):
                logger.warning(f"Formula contains unsafe characters after replacement: {safe_formula}")
                results.append(0.0)
                continue
            
            result = eval(safe_formula, allowed_names)
            
            # Log the result (for first 2 years only)
            if year_index < 2:
                logger.info(f"  Year {year_index} formula result: {result}")
            
            # Convert result to float
            if isinstance(result, (int, float)):
                results.append(float(result))
            else:
                logger.warning(f"Formula result is not numeric: {result}")
                results.append(0.0)
                
        except Exception as e:
            logger.error(f"Error evaluating formula '{formula}' for year {year_index}: {e}")
            results.append(0.0)
    
    return results


def resolve_series_references(
    references: List[str],
    series_configs: List[Dict[str, Any]],
    projection_data: List[Dict[str, Any]],
    all_series_data: Dict[str, List[float]]
) -> Dict[str, List[float]]:
    """
    Resolve series references to their actual values.
    
    Args:
        references: List of series references (labels, IDs, or field names)
        series_configs: List of series configuration objects
        projection_data: Projection data points
        all_series_data: Pre-computed series data
    
    Returns:
        Dictionary mapping resolved references to value arrays
    """
    resolved_values = {}
    
    for ref in references:
        if ref in all_series_data:
            # Direct match (already computed)
            resolved_values[ref] = all_series_data[ref]
            continue
        
        # Check if it's a Series_X reference
        series_match = re.match(r'Series_(\d+)', ref, re.IGNORECASE)
        if series_match:
            series_index = int(series_match.group(1)) - 1  # Convert to 0-based index
            if 0 <= series_index < len(series_configs):
                series_config = series_configs[series_index]
                series_label = series_config.get('label', f'Series_{series_index + 1}')
                if series_label in all_series_data:
                    resolved_values[ref] = all_series_data[series_label]
            continue
        
        # Check if it's a projection field reference
        field_name = ref.replace('_', ' ')  # Convert Total_Income_Flow to "Total Income Flow"
        if projection_data and field_name in projection_data[0]:
            # Extract this field from all years
            resolved_values[ref] = [dp.get(field_name, 0) for dp in projection_data]
            continue
        
        # Check if it matches a series label exactly
        for series_config in series_configs:
            series_label = series_config.get('label', '')
            if series_label == ref or series_label.replace(' ', '_') == ref:
                if series_label in all_series_data:
                    resolved_values[ref] = all_series_data[series_label]
                    break
    
    return resolved_values
