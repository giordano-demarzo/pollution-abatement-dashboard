#!/usr/bin/env python3
"""
Comprehensive Dashboard Data Preprocessing Script
=================================================

This script generates ALL files needed for the pollution abatement dashboard:
1. Core patent-pollutant data with UMAP coordinates
2. BREF hierarchy and text processing
3. Patent chunking and indexing
4. Dashboard summary and metadata
5. Complete file structure expected by the frontend

Creates a zip package ready for deployment.

Usage in Jupyter:
    exec(open('comprehensive_dashboard_preprocessing.py').read())
"""

import pandas as pd
import numpy as np
import json
import os
import zipfile
import datetime
import re
import copy
import shutil
from collections import defaultdict
import warnings
from tqdm import tqdm
import csv

# For UMAP
try:
    import umap
    from sklearn.preprocessing import StandardScaler
    UMAP_AVAILABLE = True
    print("✅ UMAP available")
except ImportError:
    UMAP_AVAILABLE = False
    print("⚠️  UMAP not available - will use structured coordinates")

warnings.filterwarnings('ignore')

# Configuration
CONFIG = {
    'relevance_threshold': 0.95,
    'max_patents_per_pollutant': 5000,
    'chunk_size': 1000,
    'output_dir': 'dashboard_package',
    'zip_filename': 'pollution_dashboard_complete.zip'
}

def setup_directories():
    """Create all necessary directories."""
    dirs = [
        CONFIG['output_dir'],
        f"{CONFIG['output_dir']}/optimized_data",
        f"{CONFIG['output_dir']}/optimized_data/pollutants",
        f"{CONFIG['output_dir']}/optimized_data/indexes",
        f"{CONFIG['output_dir']}/optimized_data/patents_chunks",
        f"{CONFIG['output_dir']}/optimized_data/pollutant_bref_hierarchies",
        f"{CONFIG['output_dir']}/optimized_data/bref_relevance",
        f"{CONFIG['output_dir']}/optimized_data/sdgs",
        f"{CONFIG['output_dir']}/optimized_data/pollutants_sdgs_json",
        f"{CONFIG['output_dir']}/processed_data"
    ]
    for directory in dirs:
        os.makedirs(directory, exist_ok=True)
    print("✅ Created directory structure")

def find_patent_file():
    """Find the patent-BREF matching file automatically."""
    # Search in both current directory and data directory
    search_dirs = ['.', 'data']
    
    target_files = [
        "bref_patents_with_LLM_scores_jina_prefiltering_IPC_top200_GPT4.1miniImprovedChapters.csv",
        "bref_patents_with_LLM_scores_llama3_giordano-patents_brefs_GS12_enhanced.csv"
    ]
    
    for search_dir in search_dirs:
        if not os.path.exists(search_dir):
            continue
            
        try:
            files = os.listdir(search_dir)
        except OSError:
            continue
        
        # Try the target files first
        for target_file in target_files:
            if target_file in files:
                return os.path.join(search_dir, target_file)
        
        # Look for any file with key patterns
        for file in files:
            if file.endswith('.csv') and ('bref_patents' in file.lower() or 'jina' in file.lower() or 'gpt4' in file.lower()):
                return os.path.join(search_dir, file)
    
    return None

def load_embeddings():
    """Load embeddings from data directory."""
    print("🔍 Looking for embedding files...")
    
    if not os.path.exists('data'):
        print("⚠️  No 'data' directory found. Will use structured coordinates.")
        return None
    
    def extract_zip_if_needed(zip_path, extract_dir):
        if not os.path.exists(extract_dir):
            print(f"📦 Extracting {os.path.basename(zip_path)}...")
            os.makedirs(extract_dir, exist_ok=True)
            try:
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_dir)
                print(f"✅ Extraction complete")
                return True
            except Exception as e:
                print(f"❌ Error extracting: {e}")
                return False
        else:
            print(f"✅ Using already extracted files")
            return True
    
    embedding_files = []
    zip_files = [
        ("llm2vec_llama38B_embeddings_gt2018.zip", "llm2vec_llama38B_embeddings_gt2018"),
        ("llm2vec_llama38B_embeddings_2011_2018.zip", "llm2vec_llama38B_embeddings_2011_2018")
    ]
    
    for zip_name, extract_name in zip_files:
        zip_path = os.path.join('data', zip_name)
        extract_dir = os.path.join('data', extract_name)
        
        if os.path.exists(zip_path):
            if extract_zip_if_needed(zip_path, extract_dir):
                try:
                    parquet_files = [f for f in os.listdir(extract_dir) if f.endswith('.parquet')]
                    if parquet_files:
                        embedding_files.append(os.path.join(extract_dir, parquet_files[0]))
                        print(f"📄 Found: {parquet_files[0]}")
                except Exception as e:
                    print(f"⚠️  Error accessing extracted files: {e}")
    
    if not embedding_files:
        print("⚠️  No embedding files found")
        return None
    
    # Load and combine embeddings
    print("📊 Loading embeddings...")
    combined_embeddings = []
    
    for file in embedding_files:
        try:
            print(f"📂 Loading {os.path.basename(file)}...")
            df = pd.read_parquet(file)
            combined_embeddings.append(df)
            print(f"   ✓ Loaded {len(df):,} embeddings")
        except Exception as e:
            print(f"❌ Error loading {file}: {e}")
            continue
    
    if not combined_embeddings:
        return None
    
    embeddings_df = pd.concat(combined_embeddings, ignore_index=True)
    print(f"✅ Combined embeddings: {len(embeddings_df):,} rows")
    
    if embeddings_df['APPLN_ID'].duplicated().any():
        duplicate_count = embeddings_df['APPLN_ID'].duplicated().sum()
        print(f"🔧 Removing {duplicate_count} duplicates")
        embeddings_df = embeddings_df.drop_duplicates(subset='APPLN_ID', keep='first')
    
    return embeddings_df

def clean_filename(text):
    """Clean text for filename."""
    cleaned = text.replace(' ', '_')
    cleaned = cleaned.replace('(', '').replace(')', '')
    cleaned = cleaned.replace(',', '').replace('/', '_')
    cleaned = cleaned.replace('-', '-').replace('.', '')
    cleaned = cleaned.replace('&', '').replace("'", '').replace('"', '')
    cleaned = cleaned.replace(':', '')
    return cleaned

def generate_coordinates(unique_patents, embeddings_df=None):
    """Generate coordinates - UMAP if possible, structured otherwise."""
    
    if embeddings_df is None or not UMAP_AVAILABLE:
        print("🎨 Using structured spiral coordinates")
        return generate_structured_coordinates(unique_patents)
    
    print("🧠 Using UMAP with embeddings")
    
    # Match patents with embeddings
    matched_patents = []
    embedding_matrix = []
    
    print("🔗 Matching patents with embeddings...")
    for patent_id in tqdm(unique_patents, desc="Matching"):
        matches = embeddings_df[embeddings_df['APPLN_ID'] == patent_id]
        if not matches.empty:
            embedding = matches.iloc[0]['embedding']
            
            if isinstance(embedding, str):
                try:
                    embedding = np.array(eval(embedding))
                except:
                    continue
            elif not isinstance(embedding, np.ndarray):
                try:
                    embedding = np.array(embedding)
                except:
                    continue
            
            if embedding.size > 0:
                matched_patents.append(patent_id)
                embedding_matrix.append(embedding)
    
    print(f"✅ Matched {len(matched_patents):,} patents with embeddings")
    
    if len(matched_patents) < 10:
        print("⚠️  Too few matches, using structured coordinates")
        return generate_structured_coordinates(unique_patents)
    
    try:
        # Run UMAP
        embedding_matrix = np.array(embedding_matrix)
        print(f"📊 Running UMAP on {embedding_matrix.shape}")
        
        scaler = StandardScaler()
        normalized_embeddings = scaler.fit_transform(embedding_matrix)
        
        n_neighbors = min(15, len(normalized_embeddings) - 1)
        reducer = umap.UMAP(
            n_components=2,
            n_neighbors=n_neighbors,
            min_dist=0.1,
            metric='cosine',
            random_state=42,
            verbose=False
        )
        
        coords_2d = reducer.fit_transform(normalized_embeddings)
        
        # Normalize to [0,1]
        x_min, x_max = coords_2d[:, 0].min(), coords_2d[:, 0].max()
        y_min, y_max = coords_2d[:, 1].min(), coords_2d[:, 1].max()
        
        x_coords = (coords_2d[:, 0] - x_min) / (x_max - x_min)
        y_coords = (coords_2d[:, 1] - y_min) / (y_max - y_min)
        
        patent_coords = {}
        for i, patent_id in enumerate(matched_patents):
            patent_coords[patent_id] = (x_coords[i], y_coords[i])
        
        unmatched = len(unique_patents) - len(matched_patents)
        print(f"✅ Generated UMAP coordinates for {len(matched_patents):,} patents")
        print(f"🗑️  Will drop {unmatched:,} patents without embeddings")
        
        return patent_coords
        
    except Exception as e:
        print(f"❌ UMAP failed: {e}")
        print("🎨 Falling back to structured coordinates")
        return generate_structured_coordinates(unique_patents)

def generate_structured_coordinates(unique_patents):
    """Generate spiral coordinates."""
    n_patents = len(unique_patents)
    
    np.random.seed(42)
    angles = np.linspace(0, 6*np.pi, n_patents)
    radii = 0.2 + 0.6 * (np.arange(n_patents) / n_patents)
    
    x_coords = 0.5 + radii * np.cos(angles) + np.random.normal(0, 0.03, n_patents)
    y_coords = 0.5 + radii * np.sin(angles) + np.random.normal(0, 0.03, n_patents)
    
    x_coords = np.clip(x_coords, 0, 1)
    y_coords = np.clip(y_coords, 0, 1)
    
    return dict(zip(unique_patents, zip(x_coords, y_coords)))

def process_bref_hierarchy():
    """Process BREF files to extract hierarchical structure."""
    print("🏗️  Processing BREF hierarchy...")
    
    bref_dir = "./QUERIES_notab_noacronyms"
    if not os.path.exists(bref_dir):
        print(f"⚠️  BREF directory not found: {bref_dir}")
        # Create minimal hierarchy structure
        return {}, {}
    
    sections = {}
    section_hierarchy = defaultdict(list)
    bref_codes = set()
    
    # Walk through the directory and collect all .txt files
    files = []
    for root, _, filenames in os.walk(bref_dir):
        for filename in filenames:
            if filename.endswith('.txt'):
                files.append(os.path.join(root, filename))
    
    print(f"Found {len(files)} BREF files")
    
    def parse_filename(filename):
        base_name = os.path.splitext(filename)[0]
        if base_name.startswith('_'):
            return None, base_name[1:]
        
        match = re.match(r'^(\d+(?:\.\d+)*(?:\.\d+)*(?:\.\d+)*)_(.+)$', base_name)
        if match:
            section_id = match.group(1)
            title = match.group(2).replace('_', ' ')
            return section_id, title
        
        match = re.match(r'^(\d+)_(.+)$', base_name)
        if match:
            section_id = match.group(1)
            title = match.group(2).replace('_', ' ')
            return section_id, title
        
        return None, base_name
    
    # Process each file
    for file_path in tqdm(files, desc="Processing BREF files"):
        path_parts = file_path.split(os.sep)
        if len(path_parts) > 1:
            bref_code = path_parts[-2]
            bref_codes.add(bref_code)
        else:
            bref_code = "UNKNOWN"
        
        filename = os.path.basename(file_path)
        section_id, title = parse_filename(filename)
        
        if not section_id:
            continue
        
        full_section_id = f"{bref_code}:::{section_id}"
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(file_path, 'r', encoding='latin-1') as f:
                    content = f.read()
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
                continue
        
        sections[full_section_id] = {
            'title': title,
            'content': content,
            'file_path': file_path,
            'bref_code': bref_code
        }
        
        if '.' in section_id:
            chapter = section_id.split('.')[0]
        else:
            chapter = section_id
        
        chapter_key = f"{bref_code}:::{chapter}"
        section_hierarchy[chapter_key].append(full_section_id)
    
    print(f"Processed {len(sections)} sections across {len(bref_codes)} BREF documents")
    
    # Build hierarchical structure
    bref_structures = {}
    
    def add_children(parent, sections_dict):
        parent_id = parent['id']
        parent_path = parent_id.split(':::')[1]
        
        direct_children = {}
        for section_id, section in sections_dict.items():
            section_path = section_id.split(':::')[1]
            
            if section_path.count('.') == parent_path.count('.') + 1 and section_path.startswith(f"{parent_path}."):
                direct_children[section_id] = section
        
        sorted_children = sorted(direct_children.keys(),
                                 key=lambda x: [int(p) if p.isdigit() else 0 for p in x.split(':::')[1].split('.')])
        
        for child_id in sorted_children:
            child_obj = {
                'id': child_id,
                'name': direct_children[child_id]['title'],
                'children': []
            }
            
            add_children(child_obj, sections_dict)
            parent['children'].append(child_obj)
    
    for bref_code in bref_codes:
        bref_sections = {k: v for k, v in sections.items() if v['bref_code'] == bref_code}
        chapter_sections = {k: v for k, v in bref_sections.items() if '.' not in k.split(':::')[1]}
        
        sorted_chapters = sorted(chapter_sections.keys(),
                                  key=lambda x: int(x.split(':::')[1]) if x.split(':::')[1].isdigit() else float('inf'))
        
        bref_hierarchy = []
        
        for chapter_id in sorted_chapters:
            chapter_obj = {
                'id': chapter_id,
                'name': chapter_sections[chapter_id]['title'],
                'children': []
            }
            
            chapter_num = chapter_id.split(':::')[1]
            subsections = {k: v for k, v in bref_sections.items()
                           if k != chapter_id and k.split(':::')[1].startswith(f"{chapter_num}.")}
            
            add_children(chapter_obj, subsections)
            bref_hierarchy.append(chapter_obj)
        
        bref_structures[bref_code] = bref_hierarchy
    
    # Create flat map for quick lookups
    bref_flatmap = {}
    for section_id, section in sections.items():
        bref_flatmap[section_id] = {
            'id': section_id,
            'title': section['title'],
            'bref_code': section['bref_code'],
            'content': section['content'][:500]  # Truncate for performance
        }
    
    return bref_structures, bref_flatmap, sections

def create_bref_text_csv(sections):
    """Create BREF texts CSV file."""
    print("📝 Creating BREF texts CSV...")
    
    csv_path = f"{CONFIG['output_dir']}/processed_data/brefs_texts_final.csv"
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['code', 'title', 'text', 'section_id'])
        
        for section_id, section in sections.items():
            writer.writerow([
                section_id,  # Use section_id as 'code' for lookup
                section['title'],
                section['content'],  # Use full content as 'text'
                section_id  # Keep section_id for reference
            ])
    
    print(f"✅ Created BREF texts CSV with {len(sections)} sections")

def process_patent_data():
    """Process patent-BREF-pollutant data."""
    print("🔬 Processing patent data...")
    
    # Find patent file
    patent_file = find_patent_file()
    if not patent_file:
        raise FileNotFoundError("Patent file not found!")
    print(f"✅ Found patent file: {patent_file}")
    
    # Load patent data
    patent_df = pd.read_csv(patent_file)
    print(f"   ✓ Loaded {len(patent_df):,} patent-BREF matches")
    
    # Check required columns
    required_cols = ['APPLN_ID', 'bref_code', 'LLM_yes_probs', 'APPLN_TITLE', 'APPLN_YR']
    missing = [col for col in required_cols if col not in patent_df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")
    
    # Load BREF-pollutant data
    if not os.path.exists('bref_pollutant.csv'):
        raise FileNotFoundError("bref_pollutant.csv not found!")
    
    bref_pollutant_df = pd.read_csv('bref_pollutant.csv')
    print(f"   ✓ Loaded {len(bref_pollutant_df):,} BREF-pollutant mappings")
    
    # Filter and join data
    print("🔗 Processing connections...")
    relevant_bref_pollutant = bref_pollutant_df[bref_pollutant_df['label'] == 1].copy()
    
    merged_df = pd.merge(
        patent_df,
        relevant_bref_pollutant,
        left_on='bref_code',
        right_on='code',
        how='inner'
    )
    
    # Apply threshold
    min_threshold = CONFIG['relevance_threshold']
    merged_df = merged_df[merged_df['LLM_yes_probs'] >= min_threshold]
    print(f"✅ Found {len(merged_df):,} high-quality connections (threshold: {min_threshold})")
    
    # Calculate patent-pollutant scores
    print("🧮 Calculating relevance scores...")
    patent_pollutant_scores = []
    unique_patents = merged_df['APPLN_ID'].unique()
    
    for patent_id in tqdm(unique_patents, desc="Processing patents"):
        patent_data = merged_df[merged_df['APPLN_ID'] == patent_id]
        patent_title = patent_data['APPLN_TITLE'].iloc[0]
        patent_year = patent_data['APPLN_YR'].iloc[0]
        
        for pollutant in patent_data['pollutant'].unique():
            pollutant_matches = patent_data[patent_data['pollutant'] == pollutant]
            max_score = pollutant_matches['LLM_yes_probs'].max()
            
            # Create bref_relevance dict
            bref_relevance = {}
            for _, row in pollutant_matches.iterrows():
                bref_relevance[row['bref_code']] = row['LLM_yes_probs']
            
            patent_pollutant_scores.append({
                'APPLN_ID': patent_id,
                'pollutant': pollutant,
                'score': max_score,
                'APPLN_TITLE': patent_title,
                'APPLN_YR': patent_year,
                'bref_relevance': bref_relevance
            })
    
    scores_df = pd.DataFrame(patent_pollutant_scores)
    print(f"✅ Created {len(scores_df):,} patent-pollutant pairs")
    
    return scores_df, unique_patents

def create_patent_chunks(scores_df, patent_coords):
    """Create patent chunks and index."""
    print("📦 Creating patent chunks and index...")
    
    # Filter to only patents with coordinates
    valid_patents = []
    patent_index = {}
    chunk_id = 0
    current_chunk = []
    
    for _, patent in scores_df.iterrows():
        patent_id = patent['APPLN_ID']
        
        if patent_id in patent_coords:
            coords = patent_coords[patent_id]
            
            patent_data = {
                "id": f"{patent_id}_abstract",
                "title": str(patent['APPLN_TITLE'])[:100],
                "score": float(patent['score']),
                "x": float(coords[0]),
                "y": float(coords[1]),
                "abstract": f"Patent ID {patent_id}_abstract from year {patent['APPLN_YR']}",
                "year": int(patent['APPLN_YR']),
                "pollutant": patent['pollutant'],
                "bref_relevance": patent['bref_relevance']
            }
            
            current_chunk.append(patent_data)
            patent_index[f"{patent_id}_abstract"] = {
                "chunk_id": chunk_id,
                "index_in_chunk": len(current_chunk) - 1,
                "x": float(coords[0]),
                "y": float(coords[1]),
                "title": str(patent['APPLN_TITLE'])[:100],
                "year": int(patent['APPLN_YR']),
                "abstract": f"Patent ID {patent_id}_abstract from year {patent['APPLN_YR']}"
            }
            
            if len(current_chunk) >= CONFIG['chunk_size']:
                # Save chunk
                chunk_path = f"{CONFIG['output_dir']}/optimized_data/patents_chunks/patents_chunk_{chunk_id}.json"
                with open(chunk_path, 'w') as f:
                    json.dump(current_chunk, f, indent=2)
                
                chunk_id += 1
                current_chunk = []
    
    # Save final chunk if not empty
    if current_chunk:
        chunk_path = f"{CONFIG['output_dir']}/optimized_data/patents_chunks/patents_chunk_{chunk_id}.json"
        with open(chunk_path, 'w') as f:
            json.dump(current_chunk, f, indent=2)
    
    # Save patent index
    index_path = f"{CONFIG['output_dir']}/optimized_data/indexes/patent_index.json"
    with open(index_path, 'w') as f:
        json.dump(patent_index, f, indent=2)
    
    print(f"✅ Created {chunk_id + 1} patent chunks and index")
    return patent_index

def process_pollutant_bref_hierarchies(scores_df, bref_hierarchy):
    """Create pollutant-specific BREF hierarchies."""
    print("🌳 Processing pollutant BREF hierarchies...")
    
    if not os.path.exists('bref_pollutant.csv'):
        print("⚠️  bref_pollutant.csv not found, skipping BREF hierarchy processing")
        return {}
    
    bref_pollutant_df = pd.read_csv('bref_pollutant.csv')
    
    # Create pollutant to BREF mapping
    pollutant_bref_matches = {}
    for _, row in bref_pollutant_df.iterrows():
        if int(row['label']) == 1:
            pollutant = row['pollutant']
            bref_code = row['code']
            
            if pollutant not in pollutant_bref_matches:
                pollutant_bref_matches[pollutant] = set()
            pollutant_bref_matches[pollutant].add(bref_code)
    
    def update_hierarchy_with_matches(node, matches, path=""):
        if not node or not isinstance(node, dict):
            return False
        
        node_id = node.get('id')
        has_match = False
        
        if node_id and node_id in matches:
            node['hasMatchForPollutant'] = True
            has_match = True
        else:
            node['hasMatchForPollutant'] = False
        
        children_with_matches = False
        if 'children' in node:
            if isinstance(node['children'], list):
                for child in node['children']:
                    if update_hierarchy_with_matches(child, matches, path):
                        children_with_matches = True
            elif isinstance(node['children'], dict):
                for _, child in node['children'].items():
                    if update_hierarchy_with_matches(child, matches, path):
                        children_with_matches = True
        
        if children_with_matches:
            node['hasChildrenWithMatchForPollutant'] = True
            has_match = True
        else:
            node['hasChildrenWithMatchForPollutant'] = False
        
        return has_match
    
    pollutant_filenames = {}
    unique_pollutants = scores_df['pollutant'].unique()
    
    for pollutant in tqdm(unique_pollutants, desc="Processing pollutant hierarchies"):
        pollutant_filename = clean_filename(pollutant)
        pollutant_filenames[pollutant] = pollutant_filename
        
        if pollutant in pollutant_bref_matches:
            matches = pollutant_bref_matches[pollutant]
            pollutant_hierarchy = copy.deepcopy(bref_hierarchy)
            
            # Update hierarchy with matches
            for bref_type, bref_content in pollutant_hierarchy.items():
                if isinstance(bref_content, dict):
                    bref_content['hasMatchForPollutant'] = False
                    bref_content['hasChildrenWithMatchForPollutant'] = False
                    update_hierarchy_with_matches(bref_content, matches, bref_type)
                elif isinstance(bref_content, list):
                    for item in bref_content:
                        if isinstance(item, dict):
                            item['hasMatchForPollutant'] = False
                            item['hasChildrenWithMatchForPollutant'] = False
                            update_hierarchy_with_matches(item, matches, bref_type)
            
            # Save pollutant-specific hierarchy
            output_path = f"{CONFIG['output_dir']}/optimized_data/pollutant_bref_hierarchies/{pollutant_filename}_bref_hierarchy.json"
            with open(output_path, 'w') as f:
                json.dump(pollutant_hierarchy, f, indent=2)
    
    # Save lookup table
    pollutant_bref_lookup = {p: list(m) for p, m in pollutant_bref_matches.items() if p in unique_pollutants}
    lookup_path = f"{CONFIG['output_dir']}/optimized_data/pollutant_bref_lookup.json"
    with open(lookup_path, 'w') as f:
        json.dump(pollutant_bref_lookup, f, indent=2)
    
    print(f"✅ Created BREF hierarchies for {len(unique_pollutants)} pollutants")
    return pollutant_filenames

def copy_sdg_data():
    """Copy existing SDG data files."""
    print("📊 Copying SDG data...")
    
    sdg_files = [
        'pollutant_sdg.csv',
        'optimized_data/sdgs/sdg_data.json',
        'optimized_data/pollutants_sdgs_json'
    ]
    
    for file_path in sdg_files:
        if os.path.exists(file_path):
            if os.path.isfile(file_path):
                if file_path.endswith('.json'):
                    dest_path = f"{CONFIG['output_dir']}/{file_path}"
                    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                    shutil.copy2(file_path, dest_path)
                    print(f"   ✓ Copied {file_path}")
            elif os.path.isdir(file_path):
                dest_path = f"{CONFIG['output_dir']}/{file_path}"
                if os.path.exists(dest_path):
                    shutil.rmtree(dest_path)
                shutil.copytree(file_path, dest_path)
                print(f"   ✓ Copied directory {file_path}")
        else:
            print(f"   ⚠️  SDG file not found: {file_path}")

def create_dashboard_files(scores_df, patent_coords, pollutant_filenames):
    """Create main dashboard files."""
    print("🎯 Creating dashboard files...")
    
    # Get unique pollutants with coordinates
    valid_patents = set()
    for patent_id in scores_df['APPLN_ID'].unique():
        if patent_id in patent_coords:
            valid_patents.add(patent_id)
    
    valid_scores_df = scores_df[scores_df['APPLN_ID'].isin(valid_patents)]
    unique_pollutants = valid_scores_df['pollutant'].unique()
    
    # Create pollutant files
    patents_kept = 0
    for pollutant in tqdm(unique_pollutants, desc="Creating pollutant files"):
        filename = pollutant_filenames.get(pollutant, clean_filename(pollutant))
        pollutant_data = valid_scores_df[valid_scores_df['pollutant'] == pollutant]
        
        # Sort by score and limit
        pollutant_data = pollutant_data.sort_values('score', ascending=False).head(CONFIG['max_patents_per_pollutant'])
        
        top_patents = []
        scores_dict = {}
        bref_relevance_dict = {}
        
        for _, patent in pollutant_data.iterrows():
            patent_id = patent['APPLN_ID']
            coords = patent_coords[patent_id]
            patents_kept += 1
            
            patent_entry = {
                "id": f"{patent_id}_abstract",
                "title": str(patent['APPLN_TITLE'])[:100],
                "score": float(patent['score']),
                "x": float(coords[0]),
                "y": float(coords[1]),
                "abstract": f"Patent ID {patent_id}_abstract from year {patent['APPLN_YR']}",
                "year": int(patent['APPLN_YR']),
                "bref_relevance": patent['bref_relevance']
            }
            
            top_patents.append(patent_entry)
            scores_dict[f"{patent_id}_abstract"] = float(patent['score'])
            bref_relevance_dict[f"{patent_id}_abstract"] = patent['bref_relevance']
        
        # Save files
        with open(f"{CONFIG['output_dir']}/optimized_data/pollutants/{filename}_top.json", 'w') as f:
            json.dump(top_patents, f, indent=2)
        
        with open(f"{CONFIG['output_dir']}/optimized_data/pollutants/{filename}_scores.json", 'w') as f:
            json.dump(scores_dict, f, indent=2)
        
        with open(f"{CONFIG['output_dir']}/optimized_data/bref_relevance/{filename}_bref_relevance.json", 'w') as f:
            json.dump(bref_relevance_dict, f, indent=2)
    
    # Create dashboard summary
    dashboard_summary = {
        "totalPatents": int(valid_scores_df['APPLN_ID'].nunique()),
        "totalPollutants": len(unique_pollutants),
        "relevanceThreshold": CONFIG['relevance_threshold'],
        "creation_date": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "pollutants": [{"name": pollutant, "filename": pollutant_filenames.get(pollutant, clean_filename(pollutant))} 
                      for pollutant in unique_pollutants],
        "totalChunks": len(valid_scores_df)
    }
    
    with open(f"{CONFIG['output_dir']}/optimized_data/dashboard_summary.json", 'w') as f:
        json.dump(dashboard_summary, f, indent=2)
    
    # Save pollutant filenames mapping
    with open(f"{CONFIG['output_dir']}/optimized_data/pollutant_filenames.json", 'w') as f:
        json.dump(pollutant_filenames, f, indent=2)
    
    print(f"✅ Created dashboard files for {len(unique_pollutants)} pollutants with {patents_kept:,} patents")

def create_package():
    """Create the final zip package."""
    print("📦 Creating final package...")
    
    zip_path = CONFIG['zip_filename']
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add all files from the output directory
        for root, _, files in os.walk(CONFIG['output_dir']):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, CONFIG['output_dir'])
                zipf.write(file_path, arcname)
    
    # Get package size
    size_mb = os.path.getsize(zip_path) / (1024 * 1024)
    print(f"✅ Created package: {zip_path} ({size_mb:.2f} MB)")
    
    return zip_path

def main():
    """Main processing function."""
    print("🚀 Starting Comprehensive Dashboard Preprocessing")
    print("=" * 60)
    
    try:
        # Setup
        setup_directories()
        
        # Load embeddings
        embeddings_df = load_embeddings()
        
        # Process BREF hierarchy
        bref_hierarchy, bref_flatmap, sections = process_bref_hierarchy()
        
        # Save BREF hierarchy
        bref_data = {
            'hierarchy': bref_hierarchy,
            'flatMap': bref_flatmap,
            'creation_date': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        with open(f"{CONFIG['output_dir']}/optimized_data/bref_hierarchy_optimized.json", 'w') as f:
            json.dump(bref_data, f, indent=2)
        
        # Create BREF texts CSV with full content
        create_bref_text_csv(sections)
        
        # Process patent data
        scores_df, unique_patents = process_patent_data()
        
        # Generate coordinates
        print("🗺️  Generating coordinates...")
        patent_coords = generate_coordinates(unique_patents, embeddings_df)
        
        # Create patent chunks and index
        patent_index = create_patent_chunks(scores_df, patent_coords)
        
        # Process pollutant-specific BREF hierarchies
        pollutant_filenames = process_pollutant_bref_hierarchies(scores_df, bref_hierarchy)
        
        # Copy SDG data
        copy_sdg_data()
        
        # Create dashboard files
        create_dashboard_files(scores_df, patent_coords, pollutant_filenames)
        
        # Create final package
        zip_path = create_package()
        
        print("\n🎉 SUCCESS! Comprehensive dashboard preprocessing completed.")
        print("=" * 60)
        print(f"📁 Package ready: {zip_path}")
        print(f"📊 Final stats:")
        print(f"   Total patents: {len([p for p in unique_patents if p in patent_coords]):,}")
        print(f"   Total pollutants: {len(scores_df['pollutant'].unique())}")
        print(f"   Patent chunks: {len([f for f in os.listdir(f'{CONFIG["output_dir"]}/optimized_data/patents_chunks') if f.endswith('.json')])}")
        print(f"   BREF sections: {len(bref_flatmap)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error in main processing: {e}")
        import traceback
        print(traceback.format_exc())
        return False

if __name__ == "__main__":
    success = main()
    if not success:
        print("\n💥 FAILED! Check error messages above")