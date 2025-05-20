#!/usr/bin/env python3
# preprocess_bref_pollutant_data.py
import pandas as pd
import json
import os
import copy

def process_bref_pollutant_matches():
    """
    Process the bref_pollutant.csv file to identify which BREF sections match with each pollutant.
    Updates the BREF hierarchy to include this match information.
    """
    print("Processing BREF-pollutant match data...")
    
    # Path configurations
    input_dir = ""
    output_dir = "optimized_data"
    bref_hierarchy_path = os.path.join(output_dir, "bref_hierarchy_optimized.json")
    bref_pollutant_path = os.path.join(input_dir, "bref_pollutant.csv")
    pollutant_filenames_path = os.path.join(output_dir, "pollutant_filenames.json")
    
    # Create output directory for pollutant-specific BREF hierarchies
    pollutant_bref_dir = os.path.join(output_dir, "pollutant_bref_hierarchies")
    os.makedirs(pollutant_bref_dir, exist_ok=True)
    
    try:
        # Load existing BREF hierarchy
        with open(bref_hierarchy_path, 'r') as f:
            bref_data = json.load(f)
        
        bref_hierarchy = bref_data.get('hierarchy', {})
        bref_flatmap = bref_data.get('flatMap', {})
        
        # Load pollutant filenames for mapping
        with open(pollutant_filenames_path, 'r') as f:
            pollutant_filenames = json.load(f)
        
        # Load BREF-pollutant match data
        bref_pollutant_df = pd.read_csv(bref_pollutant_path)
        print(f"Loaded {len(bref_pollutant_df)} BREF-pollutant mappings")
        
        # Create dictionary to store matches for each pollutant
        pollutant_bref_matches = {}
        pollutant_match_counts = {}
        
        # Process each row in the CSV
        for _, row in bref_pollutant_df.iterrows():
            bref_code = row['code']
            pollutant = row['pollutant']
            has_match = int(row['label']) == 1  # Ensure it's an integer comparison
            
            # Initialize pollutant in dictionaries if not present
            if pollutant not in pollutant_bref_matches:
                pollutant_bref_matches[pollutant] = set()
                pollutant_match_counts[pollutant] = 0
            
            # Add to matches if there is a match
            if has_match:
                pollutant_bref_matches[pollutant].add(bref_code)
                pollutant_match_counts[pollutant] += 1
        
        print(f"Processed match data for {len(pollutant_bref_matches)} pollutants")
        
        # Log pollutants with the most matches
        for pollutant, count in sorted(pollutant_match_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"  Pollutant '{pollutant}' has {count} matching BREF sections")
        
        # Create a function to update the BREF hierarchy nodes recursively
        def update_hierarchy_with_matches(node, matches, path=""):
            """Recursively update the hierarchy to mark nodes with matches"""
            # Skip non-node items
            if not node or not isinstance(node, dict):
                return False
            
            node_id = node.get('id')
            current_path = f"{path}/{node_id}" if node_id else path
            has_match = False
            
            # Check if this node has a direct match
            if node_id and node_id in matches:
                # IMPORTANT: Set the flag directly on the node without any nesting
                node['hasMatchForPollutant'] = True
                has_match = True
                print(f"  MATCH: {current_path}")
            else:
                # Explicitly set to false (for clarity)
                node['hasMatchForPollutant'] = False
            
            # Process children nodes
            children_with_matches = False
            
            if 'children' in node:
                if isinstance(node['children'], list):
                    # Handle list of children
                    for child in node['children']:
                        if update_hierarchy_with_matches(child, matches, current_path):
                            children_with_matches = True
                
                elif isinstance(node['children'], dict):
                    # Handle dictionary of children
                    for _, child in node['children'].items():
                        if update_hierarchy_with_matches(child, matches, current_path):
                            children_with_matches = True
            
            # Mark node if any children have matches
            if children_with_matches:
                # IMPORTANT: Set the flag directly on the node
                node['hasChildrenWithMatchForPollutant'] = True
                has_match = True
                if not node['hasMatchForPollutant']:
                    print(f"  PARENT WITH MATCHING CHILDREN: {current_path}")
            else:
                # Explicitly set to false (for clarity)
                node['hasChildrenWithMatchForPollutant'] = False
            
            return has_match
        
        # Validate that match flags are properly set in the hierarchy
        def validate_hierarchy_matches(node, path=""):
            """Validate that match flags are properly set in the hierarchy."""
            if not isinstance(node, dict):
                return True
            
            # Check if this node has the match flags
            has_match_flag = 'hasMatchForPollutant' in node
            has_children_flag = 'hasChildrenWithMatchForPollutant' in node
            
            # Validate that flags exist
            if not has_match_flag or not has_children_flag:
                print(f"  WARNING: Missing match flags in node {path}/{node.get('id', 'root')}")
                return False
            
            # Check match status for debugging
            direct_match = node.get('hasMatchForPollutant', False)
            children_match = node.get('hasChildrenWithMatchForPollutant', False)
            
            # Validate children
            valid = True
            if 'children' in node:
                if isinstance(node['children'], list):
                    for i, child in enumerate(node['children']):
                        child_path = f"{path}/{node.get('id', 'root')}/[{i}]"
                        valid = validate_hierarchy_matches(child, child_path) and valid
                elif isinstance(node['children'], dict):
                    for child_key, child in node['children'].items():
                        child_path = f"{path}/{node.get('id', 'root')}/{child_key}"
                        valid = validate_hierarchy_matches(child, child_path) and valid
            
            return valid
        
        # Create a pollutant-specific BREF hierarchy for each pollutant
        for pollutant, matches in pollutant_bref_matches.items():
            # Find the filename-safe version of the pollutant
            pollutant_filename = None
            for p_name, p_filename in pollutant_filenames.items():
                if p_name == pollutant:
                    pollutant_filename = p_filename
                    break
            
            if not pollutant_filename:
                print(f"Warning: No filename mapping found for pollutant '{pollutant}'")
                # Create a safe filename
                pollutant_filename = pollutant.lower().replace(' ', '_').replace(',', '').replace('(', '').replace(')', '')
            
            # Create a deep copy of the hierarchy to avoid modifying the original
            pollutant_hierarchy = copy.deepcopy(bref_hierarchy)
            
            print(f"\nProcessing hierarchy for pollutant: {pollutant}")
            print(f"This pollutant has {len(matches)} matching BREF sections")
            
            # Update the hierarchy with match information
            match_count = 0
            top_level_match_count = 0
            for bref_type, bref_content in pollutant_hierarchy.items():
                # Initialize document-level match flags
                if isinstance(bref_content, dict):
                    # IMPORTANT: Clearly set and log these flags for top-level documents
                    bref_content['hasMatchForPollutant'] = False
                    bref_content['hasChildrenWithMatchForPollutant'] = False
                    
                    # Update hierarchy recursively
                    has_match = update_hierarchy_with_matches(bref_content, matches, bref_type)
                    
                    # Check if flags were properly updated, directly logging the after-values
                    print(f"BREF document '{bref_type}' after processing:")
                    print(f"  Direct match: {bref_content.get('hasMatchForPollutant', False)}")
                    print(f"  Children with matches: {bref_content.get('hasChildrenWithMatchForPollutant', False)}")
                    
                    if has_match:
                        print(f"BREF document '{bref_type}' has matches or children with matches")
                        match_count += 1
                        top_level_match_count += 1
                
                elif isinstance(bref_content, list):
                    has_matches = False
                    for item in bref_content:
                        # Explicitly set top-level match flags
                        if isinstance(item, dict):
                            item['hasMatchForPollutant'] = False
                            item['hasChildrenWithMatchForPollutant'] = False
                            
                            # Update hierarchy and check if any matches were found
                            if update_hierarchy_with_matches(item, matches, bref_type):
                                has_matches = True
                                match_count += 1
                    
                    if has_matches:
                        print(f"BREF document '{bref_type}' has matches or children with matches")
            
            print(f"Found matches in {top_level_match_count} top-level BREF documents (out of {len(pollutant_hierarchy)} total)")
            
            # Validate the hierarchy
            print("Validating hierarchy match flags...")
            all_valid = True
            for bref_type, bref_content in pollutant_hierarchy.items():
                if isinstance(bref_content, dict):
                    if not validate_hierarchy_matches(bref_content, bref_type):
                        all_valid = False
                elif isinstance(bref_content, list):
                    for i, item in enumerate(bref_content):
                        if not validate_hierarchy_matches(item, f"{bref_type}/[{i}]"):
                            all_valid = False
            
            if all_valid:
                print("All match flags are properly set")
            else:
                print("WARNING: Some match flags may be missing!")
            
            # Save the pollutant-specific BREF hierarchy
            output_path = os.path.join(pollutant_bref_dir, f"{pollutant_filename}_bref_hierarchy.json")
            with open(output_path, 'w') as f:
                json.dump(pollutant_hierarchy, f)
            print(f"Saved BREF hierarchy with match info for {pollutant_filename}")
        
        # Also update the main flatmap with match information for all pollutants
        for bref_id, bref_node in bref_flatmap.items():
            matching_pollutants = []
            for pollutant, matches in pollutant_bref_matches.items():
                if bref_id in matches:
                    matching_pollutants.append(pollutant)
            
            if matching_pollutants:
                bref_node['matchingPollutants'] = matching_pollutants
        
        # Update and save the main BREF data with enhanced flatmap
        bref_data['flatMap'] = bref_flatmap
        with open(bref_hierarchy_path, 'w') as f:
            json.dump(bref_data, f)
        
        print(f"Updated and saved main BREF hierarchy with match information")
        
        # Create a lookup file for quick checking of which BREFs match each pollutant
        pollutant_bref_lookup = {p: list(m) for p, m in pollutant_bref_matches.items()}
        lookup_path = os.path.join(output_dir, "pollutant_bref_lookup.json")
        with open(lookup_path, 'w') as f:
            json.dump(pollutant_bref_lookup, f)
        print(f"Saved pollutant-BREF lookup table")
        
        return True
    
    except Exception as e:
        print(f"Error processing BREF-pollutant match data: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    process_bref_pollutant_matches()
