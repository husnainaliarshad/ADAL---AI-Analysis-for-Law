"""Script to run tests and display output"""
import sys
import subprocess
from pathlib import Path

# Change to the adal-backend directory
test_dir = Path(__file__).parent / "test"

print("=" * 60)
print("Running Pytest Tests")
print("=" * 60)
print(f"Test directory: {test_dir}")
print()

# Run pytest with unbuffered output
result = subprocess.run(
    [sys.executable, "-m", "pytest", str(test_dir), "-v", "--tb=short", "-s"],
    cwd=Path(__file__).parent
)

print()
print("=" * 60)
print(f"Tests completed with exit code: {result.returncode}")
print("=" * 60)

sys.exit(result.returncode)
