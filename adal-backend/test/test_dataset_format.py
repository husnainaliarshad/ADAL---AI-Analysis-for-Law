"""
Simple test to verify dataset format and create sample test data
"""
import json
from pathlib import Path
import pytest

# Dataset path
DATASET_PATH = Path(__file__).parent.parent.parent / "Dataset" / "Pakistan_Laws_Dataset" / "pdf_data.json"


def test_dataset_format():
    """Verify the dataset format matches expected structure"""
    print(f"Checking dataset at: {DATASET_PATH}")
    
    if not DATASET_PATH.exists():
        pytest.skip(f"Dataset file not found at {DATASET_PATH}")
    
    try:
        with open(DATASET_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"✅ Dataset loaded successfully")
        print(f"   Total entries: {len(data)}")
        
        if len(data) == 0:
            pytest.fail("Dataset is empty")
        
        # Check first entry
        first_entry = data[0]
        print(f"\n📋 First entry structure:")
        print(f"   Keys: {list(first_entry.keys())}")
        
        # Verify required fields (dataset uses 'text' instead of 'content')
        required_fields = ['file_name']
        missing_fields = [field for field in required_fields if field not in first_entry]
        
        # Check for text field (dataset uses 'text', but code handles both)
        if 'text' not in first_entry and 'content' not in first_entry:
            pytest.fail("Missing text field (expected 'text' or 'content')")
        
        if missing_fields:
            pytest.fail(f"Missing required fields: {missing_fields}")
        
        print(f"✅ All required fields present")
        
        # Show sample
        text_content = first_entry.get('text') or first_entry.get('content', '')
        print(f"\n📄 Sample entry:")
        print(f"   File name: {first_entry['file_name']}")
        print(f"   Content length: {len(text_content)} characters")
        print(f"   Content preview (first 300 chars):")
        print(f"   {text_content[:300]}...")
        
        # Check for citations in sample
        content = text_content
        import re
        
        # Check for Pakistani citation patterns
        pld_pattern = r'PLD\s+\d{4}\s+(?:SC|Lah\.|Kar\.|Isl\.|Pes\.|Quetta)?\s*\d{1,4}'
        scmr_pattern = r'\d{4}\s+SCMR\s+\d{1,4}'
        ppc_pattern = r'Pakistan\s+Penal\s+Code|PPC|S\.\d+'
        
        pld_matches = re.findall(pld_pattern, content[:5000], re.IGNORECASE)
        scmr_matches = re.findall(scmr_pattern, content[:5000], re.IGNORECASE)
        ppc_matches = re.findall(ppc_pattern, content[:5000], re.IGNORECASE)
        
        print(f"\n🔍 Citation patterns found in first 5000 chars:")
        print(f"   PLD citations: {len(pld_matches)}")
        if pld_matches:
            print(f"      Examples: {pld_matches[:3]}")
        print(f"   SCMR citations: {len(scmr_matches)}")
        if scmr_matches:
            print(f"      Examples: {scmr_matches[:3]}")
        print(f"   PPC references: {len(ppc_matches)}")
        if ppc_matches:
            print(f"      Examples: {ppc_matches[:3]}")
        
        # Check a few more entries
        print(f"\n📊 Checking additional entries...")
        entries_with_content = 0
        entries_with_citations = 0
        
        for i, entry in enumerate(data[:10]):  # Check first 10
            text_content = entry.get('text') or entry.get('content', '')
            if len(text_content) > 100:
                entries_with_content += 1
                # Quick citation check
                if re.search(pld_pattern, text_content[:2000], re.IGNORECASE) or \
                   re.search(scmr_pattern, text_content[:2000], re.IGNORECASE):
                    entries_with_citations += 1
        
        print(f"   Entries with substantial content (>100 chars): {entries_with_content}/10")
        print(f"   Entries with citations: {entries_with_citations}/10")
        
        assert True
        
    except json.JSONDecodeError as e:
        pytest.fail(f"Invalid JSON: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        pytest.fail(f"Unexpected dataset format error: {e}")


def create_sample_test_data():
    """Create a sample test JSON file based on dataset format"""
    sample_data = [
        {
            "file_name": "test_constitution.pdf",
            "content": """
            The Constitution of Pakistan 1973 establishes the fundamental rights of citizens.
            Article 25 states that all citizens are equal before law. This principle was 
            affirmed in PLD 2025 SC 123. The Supreme Court held that discrimination on any 
            basis is unconstitutional. See also 2025 SCMR 456 for related jurisprudence.
            
            The Lahore High Court in PLD 2025 Lah. 321 further elaborated on this principle.
            As per Pakistan Penal Code (XLV of 1860), S.302, murder is a serious offense.
            The Criminal Procedure Code (V of 1898), S.154 governs the investigation process.
            """
        },
        {
            "file_name": "test_penal_code.pdf",
            "content": """
            Pakistan Penal Code (XLV of 1860) defines various criminal offenses.
            Section 302 deals with punishment for murder. Section 307 covers attempt to murder.
            The Supreme Court in PLD 2024 SC 789 interpreted these sections.
            Refer to 2024 YLR 123 for case law on criminal procedure.
            """
        }
    ]
    
    output_path = Path(__file__).parent / "sample_dataset.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(sample_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Created sample test data at: {output_path}")
    return output_path


if __name__ == "__main__":
    print("=" * 60)
    print("Dataset Format Verification")
    print("=" * 60)
    
    success = test_dataset_format()
    
    if success:
        print("\n" + "=" * 60)
        print("Creating sample test data...")
        print("=" * 60)
        create_sample_test_data()
        print("\n✅ All checks passed!")
    else:
        print("\n❌ Dataset format verification failed")
