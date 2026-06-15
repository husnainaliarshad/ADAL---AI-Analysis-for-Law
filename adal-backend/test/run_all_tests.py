"""Run all tests using pytest programmatic API"""
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

import pytest

# Change to the adal-backend directory
base_dir = Path(__file__).parent
test_dir = base_dir / "test"

print("=" * 80)
print("RUNNING ALL TESTS")
print("=" * 80)
print()

# Run pytest programmatically
exit_code = pytest.main([
    str(test_dir),
    "-v",
    "--tb=short",
    "-s",  # Don't capture output
    "--color=yes"
])

print()
print("=" * 80)
print(f"Tests completed with exit code: {exit_code}")
print("=" * 80)

sys.exit(exit_code)
