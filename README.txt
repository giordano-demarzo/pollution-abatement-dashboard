# Dashboard Data Package

Created: 2025-09-09 15:23:21

## Contents

### dashboard_data/
Main dashboard data files including:
- dashboard_data.json - Complete dashboard data
- patent_coordinates.csv - UMAP projections for all patents
- patents/*.json - Patent data organized by pollutant
- metadata.json - Processing metadata

### optimized_data/
React-optimized data including:
- pollutants/*_top.json - Top 100 patents per pollutant
- pollutants/*_scores.json - All patent scores
- bref_relevance/*.json - BREF relevance scores
- dashboard_summary.json - Dashboard summary statistics

### processed_data/
- bref_hierarchy.json - BREF document hierarchy

## Configuration Used
- Patent-BREF file: bref_patents_with_LLM_scores_jina_prefiltering_IPC_top200_GPT4.1miniImprovedChapters.csv
- Relevance threshold: 0.5
- Package size: 153.11 MB
- Total files: 365

## Usage
Extract this zip file in your dashboard application directory and point your 
application to the appropriate data folders.
