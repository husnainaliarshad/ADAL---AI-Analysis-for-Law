"""Run all tests and save detailed output"""
import sys
import subprocess
from pathlib import Path
from datetime import datetime

base_dir = Path(__file__).parent
output_file = base_dir / "test_output_detailed.txt"

# List of all test files and specific tests
test_specs = [
    "test/test_simple.py",
    "test/test_citation_detection.py::TestCitationDetection::test_detect_pld_citations",
    "test/test_citation_detection.py::TestCitationDetection::test_detect_scmr_citations",
    "test/test_citation_detection.py::TestCitationDetection::test_detect_ppc_statutes",
    "test/test_citation_detection.py::TestCitationDetection::test_detect_constitution_articles",
    "test/test_citation_detection.py::TestCitationDetection::test_detect_cpc_statutes",
    "test/test_citation_detection.py::TestCitationDetection::test_jurisdiction_detection",
    "test/test_citation_detection.py::TestCitationDetection::test_citation_position_tracking",
    "test/test_citation_detection.py::TestCitationDetection::test_citation_context_extraction",
    "test/test_citation_detection.py::TestDatasetIntegration::test_load_dataset_structure",
    "test/test_citation_detection.py::TestDatasetIntegration::test_extract_text_from_dataset_json",
    "test/test_citation_detection.py::TestDatasetIntegration::test_citation_detection_on_dataset_entry",
    "test/test_citation_detection.py::TestAPIIntegration::test_extract_citations_endpoint",
    "test/test_citation_detection.py::TestEdgeCases::test_empty_text",
    "test/test_citation_detection.py::TestEdgeCases::test_text_without_citations",
    "test/test_citation_detection.py::TestEdgeCases::test_malformed_citations",
    "test/test_citation_detection.py::TestEdgeCases::test_multiple_citations_same_line",
    "test/test_dataset_format.py::test_dataset_format",
]

with open(output_file, 'w', encoding='utf-8') as f:
    f.write("=" * 80 + "\n")
    f.write(f"TEST EXECUTION REPORT - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    f.write("=" * 80 + "\n\n")
    
    results = []
    
    for i, test_spec in enumerate(test_specs, 1):
        test_name = test_spec.split('::')[-1] if '::' in test_spec else Path(test_spec).stem
        f.write(f"\n[{i}/{len(test_specs)}] Running: {test_spec}\n")
        f.write("-" * 80 + "\n")
        f.flush()
        
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pytest", test_spec, "-v", "--tb=short"],
                cwd=base_dir,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            f.write(result.stdout)
            if result.stderr:
                f.write("\n--- STDERR ---\n")
                f.write(result.stderr)
            
            status = "✓ PASSED" if result.returncode == 0 else "✗ FAILED"
            f.write(f"\n>>> {status} (exit code: {result.returncode})\n")
            results.append((test_spec, result.returncode == 0, result.returncode))
            
        except subprocess.TimeoutExpired:
            f.write(">>> ⏱ TIMEOUT\n")
            results.append((test_spec, False, -1))
        except Exception as e:
            f.write(f">>> ✗ ERROR: {e}\n")
            results.append((test_spec, False, -2))
        
        f.flush()
    
    # Summary
    f.write("\n" + "=" * 80 + "\n")
    f.write("SUMMARY\n")
    f.write("=" * 80 + "\n\n")
    
    passed = sum(1 for _, success, _ in results if success)
    failed = len(results) - passed
    
    f.write(f"Total tests: {len(results)}\n")
    f.write(f"Passed: {passed}\n")
    f.write(f"Failed: {failed}\n\n")
    
    f.write("Detailed Results:\n")
    f.write("-" * 80 + "\n")
    for test_spec, success, exit_code in results:
        status = "✓ PASSED" if success else "✗ FAILED"
        f.write(f"{status:12} - {test_spec}\n")

print(f"Test execution complete. Results saved to: {output_file}")
print(f"\nReading results...\n")

# Read and print the file
try:
    with open(output_file, 'r', encoding='utf-8') as f:
        content = f.read()
        print(content)
except Exception as e:
    print(f"Error reading output file: {e}")
