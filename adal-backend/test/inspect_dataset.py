"""Script to inspect the dataset format"""
import json
import sys
from pathlib import Path

# Path to dataset
dataset_path = Path(__file__).parent.parent.parent / "Dataset" / "Pakistan_Laws_Dataset" / "pdf_data.json"

try:
    with open(dataset_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Total entries: {len(data)}")
    print(f"\nFirst entry structure:")
    if data:
        first_entry = data[0]
        print(f"Keys: {list(first_entry.keys())}")
        print(f"\nSample entry (first 1000 characters):")
        print(json.dumps(first_entry, indent=2, ensure_ascii=False)[:1000])
        
        # Check if there are citations in the content
        if 'content' in first_entry:
            content = first_entry['content']
            print(f"\nContent length: {len(content)} characters")
            print(f"Content preview (first 500 chars):")
            print(content[:500])
            
            # Check for Pakistani citations
            import re
            pld_pattern = r'PLD\s+\d{4}\s+(?:SC|Lah\.|Kar\.|Isl\.|Pes\.|Quetta)?\s*\d{1,4}'
            scmr_pattern = r'\d{4}\s+SCMR\s+\d{1,4}'
            ppc_pattern = r'Pakistan\s+Penal\s+Code|PPC|S\.\d+'
            
            pld_matches = re.findall(pld_pattern, content[:2000], re.IGNORECASE)
            scmr_matches = re.findall(scmr_pattern, content[:2000], re.IGNORECASE)
            ppc_matches = re.findall(ppc_pattern, content[:2000], re.IGNORECASE)
            
            print(f"\nCitation patterns found in first 2000 chars:")
            print(f"PLD citations: {len(pld_matches)} - {pld_matches[:3]}")
            print(f"SCMR citations: {len(scmr_matches)} - {scmr_matches[:3]}")
            print(f"PPC references: {len(ppc_matches)} - {ppc_matches[:3]}")
    
    print(f"\n\nSecond entry (if exists):")
    if len(data) > 1:
        second_entry = data[1]
        print(f"Keys: {list(second_entry.keys())}")
        if 'file_name' in second_entry:
            print(f"File name: {second_entry['file_name']}")
        if 'content' in second_entry:
            print(f"Content length: {len(second_entry['content'])} characters")
            print(f"Content preview: {second_entry['content'][:300]}")
            
except FileNotFoundError:
    print(f"Dataset file not found at: {dataset_path}")
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
