"""
Simple test script for claim segmentation.
Run this after starting the server to test the claim segmentation feature.
"""
import requests
import json
import time
import sys

BASE_URL = "http://localhost:8001/api"

def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def test_claim_segmentation(document_id: int = 1):
    """Test the full claim segmentation workflow."""
    
    print_section("Testing Claim Segmentation")
    print(f"Using document_id: {document_id}")
    
    # Step 1: Check if document exists and has OCR text
    print("\n[1/5] Checking document...")
    try:
        # Note: You may need to adjust this endpoint based on your API
        # For now, we'll proceed assuming the document exists
        print("✓ Document check skipped (assuming document exists)")
    except Exception as e:
        print(f"✗ Error checking document: {e}")
        return
    
    # Step 2: Extract citations (optional but recommended)
    print("\n[2/5] Extracting citations...")
    try:
        response = requests.post(
            f"{BASE_URL}/citations/documents/{document_id}/extract",
            timeout=30
        )
        if response.status_code == 200:
            citations = response.json()
            print(f"✓ Found {citations.get('total_citations', 0)} citations")
        else:
            print(f"⚠ Citation extraction returned status {response.status_code}")
            print(f"  Response: {response.text[:200]}")
    except Exception as e:
        print(f"⚠ Citation extraction error: {e}")
        print("  Continuing without citations...")
    
    # Step 3: Segment claims
    print("\n[3/5] Segmenting claims (this may take 30-60 seconds on first run)...")
    print("  (InLegalBERT model will download automatically if needed)")
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{BASE_URL}/claims/documents/{document_id}/segment",
            params={"use_citation_guidance": True},
            timeout=120  # Longer timeout for first run
        )
        
        elapsed_time = time.time() - start_time
        
        if response.status_code == 200:
            claims = response.json()
            print(f"✓ Claim segmentation completed in {elapsed_time:.2f} seconds")
            print(f"✓ Found {claims.get('total_claims', 0)} claims")
            
            # Display claims
            if claims.get('claims'):
                print("\n" + "-"*60)
                print("  DETECTED CLAIMS:")
                print("-"*60)
                for i, claim in enumerate(claims['claims'], 1):
                    print(f"\n  Claim {i}:")
                    print(f"    ID: {claim.get('id', 'N/A')}")
                    print(f"    Type: {claim.get('claim_type', 'N/A')}")
                    print(f"    Confidence: {claim.get('confidence_score', 'N/A')}")
                    print(f"    Position: {claim.get('position_start', 'N/A')}-{claim.get('position_end', 'N/A')}")
                    text_preview = claim.get('claim_text', '')[:150]
                    print(f"    Text: {text_preview}...")
        else:
            print(f"✗ Claim segmentation failed!")
            print(f"  Status Code: {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            return
        
    except requests.exceptions.Timeout:
        print("✗ Request timed out. The model may still be downloading.")
        print("  Please wait and try again, or check server logs.")
        return
    except Exception as e:
        print(f"✗ Error during claim segmentation: {e}")
        return
    
    # Step 4: Get claim-citation mappings
    if response.status_code == 200:
        claims = response.json()
        if claims.get('claims'):
            claim_id = claims['claims'][0].get('id')
            print(f"\n[4/5] Getting citations for claim {claim_id}...")
            try:
                response = requests.get(
                    f"{BASE_URL}/claims/{claim_id}/citations",
                    timeout=10
                )
                if response.status_code == 200:
                    mappings = response.json()
                    print(f"✓ Found {len(mappings)} citation mappings")
                    if mappings:
                        print(f"  First mapping: Claim {mappings[0].get('claim_id')} <-> Citation {mappings[0].get('citation_id')}")
                else:
                    print(f"⚠ Could not get mappings: {response.status_code}")
            except Exception as e:
                print(f"⚠ Error getting mappings: {e}")
    
    # Step 5: Summary
    print_section("Test Summary")
    print("✓ Claim segmentation test completed!")
    print("\nNext steps:")
    print("  - Check the Swagger UI at http://localhost:8001/docs")
    print("  - Review the segmented claims for accuracy")
    print("  - Test with different documents")


if __name__ == "__main__":
    # Get document_id from command line or use default
    if len(sys.argv) > 1:
        try:
            document_id = int(sys.argv[1])
        except ValueError:
            print("Error: document_id must be a number")
            sys.exit(1)
    else:
        document_id = 1
        print("No document_id provided, using default: 1")
        print("Usage: python test_claims.py <document_id>")
        print()
    
    # Check if server is running
    try:
        response = requests.get(f"{BASE_URL.replace('/api', '')}/docs", timeout=5)
        print("✓ Server is running")
    except Exception as e:
        print("✗ Cannot connect to server!")
        print("  Make sure the server is running on http://localhost:8001")
        print("  Start it with: python -m app.main")
        sys.exit(1)
    
    # Run the test
    test_claim_segmentation(document_id)


