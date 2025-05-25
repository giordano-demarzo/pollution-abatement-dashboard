#!/usr/bin/env python3
"""
Debug script to check consistency between patent scores and BREF relevance data
"""

import json
import os
import pandas as pd
from collections import defaultdict

def load_json_file(filepath):
    """Safely load a JSON file"""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return None

def debug_patent_scores(pollutant_filename, output_dir="optimized_data"):
    """
    Debug patent scores for a specific pollutant
    
    Args:
        pollutant_filename: The filename-safe version of the pollutant (e.g., 'chlorine_and_inorganic_compounds_as_hcl')
        output_dir: Directory containing the optimized data
    """
    print(f"\n{'='*80}")
    print(f"Debugging data for pollutant: {pollutant_filename}")
    print(f"{'='*80}\n")
    
    # Load the different data sources
    # 1. Top patents file
    top_patents_path = os.path.join(output_dir, "pollutants", f"{pollutant_filename}_top.json")
    top_patents = load_json_file(top_patents_path)
    
    # 2. Patent scores file
    scores_path = os.path.join(output_dir, "pollutants", f"{pollutant_filename}_scores.json")
    patent_scores = load_json_file(scores_path)
    
    # 3. BREF relevance scores
    bref_relevance_path = os.path.join(output_dir, "bref_relevance", f"{pollutant_filename}_bref_relevance.json")
    bref_relevance = load_json_file(bref_relevance_path)
    
    # 4. Load BREF-pollutant matches
    bref_pollutant_path = "bref_pollutant.csv"
    bref_pollutant_df = pd.read_csv(bref_pollutant_path) if os.path.exists(bref_pollutant_path) else None
    
    # 5. Load the original patent-BREF data
    original_data_path = "./data/bref_patents_with_LLM_scores_llama3_giordano-patents_brefs_GS12_enhanced.csv"
    original_df = pd.read_csv(original_data_path) if os.path.exists(original_data_path) else None
    
    if not top_patents:
        print(f"ERROR: Could not load top patents from {top_patents_path}")
        return
    
    print(f"Loaded {len(top_patents)} top patents")
    print(f"Loaded {len(patent_scores)} patent scores")
    print(f"Loaded BREF relevance data for {len(bref_relevance) if bref_relevance else 0} patents")
    
    # Get BREF sections that match this pollutant
    matching_brefs = set()
    if bref_pollutant_df is not None:
        # Extract pollutant name from filename (reverse the filename transformation)
        pollutant_name = pollutant_filename.replace('_', ' ').title()
        # Try different variations
        pollutant_variations = [
            pollutant_name,
            pollutant_name.replace(' And ', ' and '),
            pollutant_name.replace(' As ', ' as '),
            "Chlorine and inorganic compounds (as HCl)",  # Exact match for this case
        ]
        
        for variant in pollutant_variations:
            matches = bref_pollutant_df[
                (bref_pollutant_df['pollutant'] == variant) & 
                (bref_pollutant_df['label'] == 1)
            ]
            if len(matches) > 0:
                matching_brefs.update(matches['code'].tolist())
                print(f"\nFound {len(matches)} BREF sections matching pollutant '{variant}'")
                break
    
    print(f"BREF sections matching this pollutant: {len(matching_brefs)}")
    if matching_brefs:
        print(f"Sample matching BREFs: {list(matching_brefs)[:5]}")
    
    # Analyze each top patent
    print("\n" + "-"*80)
    print("ANALYZING TOP PATENTS:")
    print("-"*80)
    
    for i, patent in enumerate(top_patents[:5]):  # Analyze top 5
        patent_id = patent.get('id')
        displayed_score = patent.get('score', 0)
        
        print(f"\nPatent {i+1}: {patent_id}")
        print(f"  Title: {patent.get('title', 'N/A')[:80]}...")
        print(f"  Displayed score: {displayed_score:.2%}")
        
        # Check if patent has embedded BREF relevance
        if 'bref_relevance' in patent:
            print(f"  Has embedded BREF relevance: YES ({len(patent['bref_relevance'])} BREFs)")
            max_embedded_score = max(patent['bref_relevance'].values()) if patent['bref_relevance'] else 0
            print(f"  Max embedded BREF score: {max_embedded_score:.2%}")
        else:
            print(f"  Has embedded BREF relevance: NO")
        
        # Check BREF relevance file
        if bref_relevance and patent_id in bref_relevance:
            patent_bref_scores = bref_relevance[patent_id]
            print(f"  BREF relevance file has: {len(patent_bref_scores)} BREFs")
            
            # Find max score overall
            if patent_bref_scores:
                max_bref_score = max(patent_bref_scores.values())
                max_bref_id = max(patent_bref_scores, key=patent_bref_scores.get)
                print(f"  Max BREF score (all BREFs): {max_bref_score:.2%} (BREF: {max_bref_id})")
                
                # Find max score among matching BREFs only
                matching_scores = {
                    bref_id: score 
                    for bref_id, score in patent_bref_scores.items() 
                    if bref_id in matching_brefs
                }
                
                if matching_scores:
                    max_matching_score = max(matching_scores.values())
                    max_matching_bref = max(matching_scores, key=matching_scores.get)
                    print(f"  Max BREF score (matching pollutant): {max_matching_score:.2%} (BREF: {max_matching_bref})")
                    
                    # CHECK CONSISTENCY
                    if abs(displayed_score - max_matching_score) > 0.01:
                        print(f"  ⚠️  INCONSISTENCY: Displayed score ({displayed_score:.2%}) != Max matching score ({max_matching_score:.2%})")
                else:
                    print(f"  ⚠️  No BREF scores found for BREFs matching this pollutant!")
                
                # Show top 5 BREF scores
                top_brefs = sorted(patent_bref_scores.items(), key=lambda x: x[1], reverse=True)[:5]
                print(f"  Top 5 BREF scores:")
                for bref_id, score in top_brefs:
                    is_match = "✓" if bref_id in matching_brefs else "✗"
                    print(f"    {is_match} {bref_id}: {score:.2%}")
        else:
            print(f"  ⚠️  No BREF relevance data found in file!")
        
        # Check original data if available
        if original_df is not None:
            patent_rows = original_df[original_df['APPLN_ID'] == patent_id]
            if not patent_rows.empty:
                print(f"  Original data has {len(patent_rows)} rows")
                # Check scores for matching BREFs
                matching_rows = patent_rows[patent_rows['bref_code'].isin(matching_brefs)]
                if not matching_rows.empty:
                    max_original_score = matching_rows['LLM_yes_probs'].max()
                    print(f"  Max score in original data (matching BREFs): {max_original_score:.2%}")

def main():
    """Main function to debug multiple pollutants"""
    
    # List of pollutants to debug
    pollutants_to_check = [
        "Chlorine_and_inorganic_compounds_as_HCl",
        # Add more pollutants as needed
    ]
    
    for pollutant in pollutants_to_check:
        debug_patent_scores(pollutant)
    
    # Additional check: Compare preprocessing calculation with actual data
    print("\n" + "="*80)
    print("CHECKING PREPROCESSING LOGIC:")
    print("="*80)
    
    # Load the source data to verify preprocessing
    original_path = "./data/bref_patents_with_LLM_scores_llama3_giordano-patents_brefs_GS12_enhanced.csv"
    if os.path.exists(original_path):
        df = pd.read_csv(original_path)
        print(f"\nOriginal data shape: {df.shape}")
        print(f"Columns: {df.columns.tolist()}")
        
        # Check a specific patent
        patent_id = "563923120"  # The gas adsorption patent
        patent_data = df[df['APPLN_ID'] == patent_id]
        if not patent_data.empty:
            print(f"\nData for patent {patent_id}:")
            print(f"Number of BREF connections: {len(patent_data)}")
            print(f"LLM_yes_probs range: {patent_data['LLM_yes_probs'].min():.3f} - {patent_data['LLM_yes_probs'].max():.3f}")
            print("\nTop 5 BREF connections:")
            top_connections = patent_data.nlargest(5, 'LLM_yes_probs')[['bref_code', 'LLM_yes_probs']]
            print(top_connections)

if __name__ == "__main__":
    main()
