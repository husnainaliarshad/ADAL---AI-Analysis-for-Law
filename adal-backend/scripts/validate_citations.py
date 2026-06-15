#!/usr/bin/env python3
"""
Citation Detection Validation Script

Compares detected citations with ground truth to calculate accuracy metrics.
"""
import json
import sys
from pathlib import Path
from typing import List, Dict, Tuple
from collections import defaultdict

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.citation_service import detect_citations
from app.models.citation_model import Citation


def load_ground_truth(ground_truth_path: Path) -> Dict:
    """Load ground truth citations from JSON file."""
    with open(ground_truth_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def normalize_citation(citation: Dict) -> Tuple:
    """Normalize citation for comparison (text, position, type)."""
    return (
        citation.get('citation_text', '').strip().lower(),
        citation.get('position_start', 0),
        citation.get('position_end', 0),
        citation.get('citation_type', '')
    )


def match_citations(detected: List[Dict], ground_truth: List[Dict], 
                   position_tolerance: int = 50) -> Tuple[List, List, List, List]:
    """
    Match detected citations with ground truth.
    
    Returns:
        true_positives: Correctly detected citations
        false_positives: Detected but not in ground truth
        false_negatives: In ground truth but not detected
        matches: Detailed match information
    """
    true_positives = []
    false_positives = []
    false_negatives = []
    matches = []
    
    # Normalize all citations
    detected_norm = [normalize_citation(c) for c in detected]
    gt_norm = [normalize_citation(c) for c in ground_truth]
    
    # Track which ground truth citations have been matched
    gt_matched = [False] * len(ground_truth)
    
    # Try to match each detected citation
    for i, det_citation in enumerate(detected):
        det_norm = normalize_citation(det_citation)
        matched = False
        
        # Try exact text match first
        for j, gt_citation in enumerate(ground_truth):
            if gt_matched[j]:
                continue
                
            gt_norm = normalize_citation(gt_citation)
            
            # Check if text matches (case-insensitive)
            if det_norm[0] == gt_norm[0]:
                true_positives.append(det_citation)
                gt_matched[j] = True
                matched = True
                matches.append({
                    'detected': det_citation,
                    'ground_truth': gt_citation,
                    'match_type': 'exact_text'
                })
                break
        
        # Try position-based match if text didn't match
        if not matched:
            for j, gt_citation in enumerate(ground_truth):
                if gt_matched[j]:
                    continue
                
                gt_pos_start = gt_citation.get('position_start', 0)
                gt_pos_end = gt_citation.get('position_end', 0)
                det_pos_start = det_citation.get('position_start', 0)
                det_pos_end = det_citation.get('position_end', 0)
                
                # Check if positions overlap within tolerance
                if (abs(det_pos_start - gt_pos_start) < position_tolerance or
                    abs(det_pos_end - gt_pos_end) < position_tolerance or
                    (det_pos_start <= gt_pos_end and det_pos_end >= gt_pos_start)):
                    true_positives.append(det_citation)
                    gt_matched[j] = True
                    matched = True
                    matches.append({
                        'detected': det_citation,
                        'ground_truth': gt_citation,
                        'match_type': 'position'
                    })
                    break
        
        # If no match found, it's a false positive
        if not matched:
            false_positives.append(det_citation)
    
    # Any unmatched ground truth citations are false negatives
    for j, gt_citation in enumerate(ground_truth):
        if not gt_matched[j]:
            false_negatives.append(gt_citation)
    
    return true_positives, false_positives, false_negatives, matches


def calculate_metrics(true_positives: List, false_positives: List, 
                     false_negatives: List) -> Dict:
    """Calculate precision, recall, and F1-score."""
    tp = len(true_positives)
    fp = len(false_positives)
    fn = len(false_negatives)
    
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    
    return {
        'precision': round(precision, 4),
        'recall': round(recall, 4),
        'f1_score': round(f1_score, 4),
        'true_positives': tp,
        'false_positives': fp,
        'false_negatives': fn,
        'total_detected': tp + fp,
        'total_actual': tp + fn
    }


def calculate_per_type_metrics(matches: List[Dict], false_positives: List[Dict],
                               false_negatives: List[Dict]) -> Dict:
    """Calculate metrics per citation type."""
    type_stats = defaultdict(lambda: {'tp': 0, 'fp': 0, 'fn': 0})
    
    # Count true positives by type
    for match in matches:
        gt_type = match['ground_truth'].get('citation_type', 'unknown')
        type_stats[gt_type]['tp'] += 1
    
    # Count false positives by type
    for fp in false_positives:
        fp_type = fp.get('citation_type', 'unknown')
        type_stats[fp_type]['fp'] += 1
    
    # Count false negatives by type
    for fn in false_negatives:
        fn_type = fn.get('citation_type', 'unknown')
        type_stats[fn_type]['fn'] += 1
    
    # Calculate metrics per type
    per_type_metrics = {}
    for citation_type, stats in type_stats.items():
        tp = stats['tp']
        fp = stats['fp']
        fn = stats['fn']
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        
        per_type_metrics[citation_type] = {
            'precision': round(precision, 4),
            'recall': round(recall, 4),
            'f1_score': round(f1, 4),
            'true_positives': tp,
            'false_positives': fp,
            'false_negatives': fn
        }
    
    return per_type_metrics


def validate_document(document_id: int, document_text: str, 
                     ground_truth: Dict) -> Dict:
    """Validate citations for a single document."""
    # Detect citations
    detected_citations = detect_citations(document_text, document_id)
    
    # Get ground truth citations for this document
    gt_citations = ground_truth.get('citations', [])
    
    # Match citations
    tp, fp, fn, matches = match_citations(detected_citations, gt_citations)
    
    # Calculate overall metrics
    metrics = calculate_metrics(tp, fp, fn)
    
    # Calculate per-type metrics
    per_type_metrics = calculate_per_type_metrics(matches, fp, fn)
    
    return {
        'document_id': document_id,
        'document_name': ground_truth.get('document_name', f'document_{document_id}'),
        'metrics': metrics,
        'per_type_metrics': per_type_metrics,
        'true_positives': tp,
        'false_positives': fp,
        'false_negatives': fn,
        'matches': matches
    }


def main():
    """Main validation function."""
    print("=" * 60)
    print("Citation Detection Validation")
    print("=" * 60)
    print()
    
    # Paths
    base_dir = Path(__file__).parent.parent
    ground_truth_path = base_dir / "validation_data" / "citation_ground_truth.json"
    results_path = base_dir / "validation_results" / "citation_validation_report.json"
    
    # Check if ground truth exists
    if not ground_truth_path.exists():
        print(f"❌ Ground truth file not found: {ground_truth_path}")
        print()
        print("💡 To create ground truth:")
        print("   1. Create validation_data/ directory")
        print("   2. Manually annotate citations in your test documents")
        print("   3. Save as citation_ground_truth.json")
        print()
        print("   Format:")
        print('   {')
        print('     "documents": [')
        print('       {')
        print('         "document_id": 4,')
        print('         "document_name": "sample.pdf",')
        print('         "citations": [...]')
        print('       }')
        print('     ]')
        print('   }')
        return
    
    # Load ground truth
    print(f"📂 Loading ground truth from: {ground_truth_path}")
    with open(ground_truth_path, 'r', encoding='utf-8') as f:
        ground_truth_data = json.load(f)
    
    documents = ground_truth_data.get('documents', [])
    print(f"✅ Loaded {len(documents)} documents")
    print()
    
    # Validate each document
    results = []
    overall_tp = 0
    overall_fp = 0
    overall_fn = 0
    
    for doc_data in documents:
        document_id = doc_data['document_id']
        document_name = doc_data.get('document_name', f'document_{document_id}')
        
        print(f"📄 Validating: {document_name} (ID: {document_id})")
        
        # Get document text (you'll need to load this from database or file)
        # For now, we'll use a placeholder - you'll need to implement this
        document_text = ""  # TODO: Load from database or file
        
        if not document_text:
            print(f"   ⚠️  Document text not available, skipping...")
            continue
        
        # Validate
        result = validate_document(document_id, document_text, doc_data)
        results.append(result)
        
        # Accumulate counts
        overall_tp += result['metrics']['true_positives']
        overall_fp += result['metrics']['false_positives']
        overall_fn += result['metrics']['false_negatives']
        
        # Print metrics
        m = result['metrics']
        print(f"   Precision: {m['precision']:.2%}")
        print(f"   Recall: {m['recall']:.2%}")
        print(f"   F1-Score: {m['f1_score']:.2%}")
        print()
    
    # Calculate overall metrics
    overall_precision = overall_tp / (overall_tp + overall_fp) if (overall_tp + overall_fp) > 0 else 0.0
    overall_recall = overall_tp / (overall_tp + overall_fn) if (overall_tp + overall_fn) > 0 else 0.0
    overall_f1 = 2 * (overall_precision * overall_recall) / (overall_precision + overall_recall) if (overall_precision + overall_recall) > 0 else 0.0
    
    # Create report
    report = {
        'date': str(Path(__file__).stat().st_mtime),
        'total_documents': len(results),
        'overall_metrics': {
            'precision': round(overall_precision, 4),
            'recall': round(overall_recall, 4),
            'f1_score': round(overall_f1, 4),
            'true_positives': overall_tp,
            'false_positives': overall_fp,
            'false_negatives': overall_fn
        },
        'per_document_results': results
    }
    
    # Save report
    results_path.parent.mkdir(parents=True, exist_ok=True)
    with open(results_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total Documents: {len(results)}")
    print(f"Overall Precision: {overall_precision:.2%}")
    print(f"Overall Recall: {overall_recall:.2%}")
    print(f"Overall F1-Score: {overall_f1:.2%}")
    print()
    print(f"📊 Report saved to: {results_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()

