"""Script to run each test individually and display results"""
import sys
import subprocess
from pathlib import Path

# Change to the adal-backend directory
base_dir = Path(__file__).parent
test_dir = base_dir / "test"

# List of test files and their test classes/functions
tests_to_run = [
    # Simple test
    "test/test_simple.py::test_simple",
    
    # Citation detection tests
    "test/test_citation_detection.py::TestCitationDetection::test_detect_pld_citations",
    "test/test_citation_detection.py::TestCitationDetection::test_detect_scmr_citations",
    "test/test_citation_detection.py::TestCitationDetection::test_detect_ppc_statutes",
    "test/test_citation_detection.py::TestCitationDetection::test_detect_constitution_articles",
    "test/test_citation_detection.py::TestCitationDetection::test_detect_cpc_statutes",
    "test/test_citation_detection.py::TestCitationDetection::test_jurisdiction_detection",
    "test/test_citation_detection.py::TestCitationDetection::test_citation_position_tracking",
    "test/test_citation_detection.py::TestCitationDetection::test_citation_context_extraction",
    
    # Dataset integration tests
    "test/test_citation_detection.py::TestDatasetIntegration::test_load_dataset_structure",
    "test/test_citation_detection.py::TestDatasetIntegration::test_extract_text_from_dataset_json",
    "test/test_citation_detection.py::TestDatasetIntegration::test_citation_detection_on_dataset_entry",
    
    # API integration tests
    "test/test_citation_detection.py::TestAPIIntegration::test_extract_citations_endpoint",
    
    # Edge case tests
    "test/test_citation_detection.py::TestEdgeCases::test_empty_text",
    "test/test_citation_detection.py::TestEdgeCases::test_text_without_citations",
    "test/test_citation_detection.py::TestEdgeCases::test_malformed_citations",
    "test/test_citation_detection.py::TestEdgeCases::test_multiple_citations_same_line",
    
    # Dataset format test
    "test/test_dataset_format.py::test_dataset_format",
]

print("=" * 80)
print("Running Tests Individually")
print("=" * 80)
print()

results = []
total_tests = len(tests_to_run)
passed = 0
failed = 0
skipped = 0

for i, test_path in enumerate(tests_to_run, 1):
    print(f"\n[{i}/{total_tests}] Running: {test_path}")
    print("-" * 80)
    
    result = subprocess.run(
        [sys.executable, "-m", "pytest", test_path, "-v", "--tb=short"],
        cwd=base_dir,
        capture_output=True,
        text=True
    )
    
    # Print output
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr, file=sys.stderr)
    
    # Track results
    if result.returncode == 0:
        passed += 1
        status = "PASSED"
    elif result.returncode == 1:
        failed += 1
        status = "FAILED"
    else:
        skipped += 1
        status = "SKIPPED/ERROR"
    
    results.append((test_path, status, result.returncode))
    print(f"Result: {status} (exit code: {result.returncode})")

# Print summary
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total tests: {total_tests}")
print(f"Passed: {passed}")
print(f"Failed: {failed}")
print(f"Skipped/Errors: {skipped}")
print()

print("Detailed Results:")
print("-" * 80)
for test_path, status, exit_code in results:
    symbol = "✓" if status == "PASSED" else "✗" if status == "FAILED" else "⊘"
    print(f"{symbol} {status:10} - {test_path}")

print("=" * 80)

# Exit with error if any tests failed
sys.exit(1 if failed > 0 else 0)
