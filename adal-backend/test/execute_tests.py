#!/usr/bin/env python
"""Execute all tests and print results"""
import sys
import io
from pathlib import Path

# Add to path
sys.path.insert(0, str(Path(__file__).parent))

# Import pytest
try:
    import pytest
except ImportError:
    print("ERROR: pytest is not installed. Install it with: pip install pytest pytest-asyncio")
    sys.exit(1)

# Test specifications
test_files = [
    "test/test_simple.py",
    "test/test_citation_detection.py",
    "test/test_dataset_format.py",
]

print("=" * 80)
print("EXECUTING ALL TESTS")
print("=" * 80)
print()

# Capture stdout
old_stdout = sys.stdout
sys.stdout = buffer = io.StringIO()

# Run tests
exit_code = pytest.main([
    *test_files,
    "-v",
    "--tb=short",
    "--color=no",  # Disable color for better text capture
])

# Get output
output = buffer.getvalue()
sys.stdout = old_stdout

# Print output
print(output)

# Print summary
print("=" * 80)
if exit_code == 0:
    print("✓ ALL TESTS PASSED")
else:
    print(f"✗ SOME TESTS FAILED (exit code: {exit_code})")
print("=" * 80)

sys.exit(exit_code)
