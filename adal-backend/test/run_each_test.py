"""Run each test and write results to file"""
import sys
import subprocess
from pathlib import Path
import io

base_dir = Path(__file__).parent
output_file = base_dir / "test_results.txt"

# Get all test functions using pytest collection
print("Collecting tests...")
collect_result = subprocess.run(
    [sys.executable, "-m", "pytest", "test/", "--collect-only", "-q"],
    cwd=base_dir,
    capture_output=True,
    text=True
)

# Extract test names from collection output
test_names = []
for line in collect_result.stdout.split('\n'):
    if '::' in line and 'test_' in line:
        # Extract test path
        test_path = line.strip()
        if test_path.startswith('<') or test_path.startswith('>'):
            continue
        if test_path and not test_path.startswith('='):
            test_names.append(test_path)

print(f"Found {len(test_names)} tests")

# Run each test
with open(output_file, 'w', encoding='utf-8') as f:
    f.write("=" * 80 + "\n")
    f.write("INDIVIDUAL TEST RESULTS\n")
    f.write("=" * 80 + "\n\n")
    
    for i, test_name in enumerate(test_names, 1):
        f.write(f"\n[{i}/{len(test_names)}] {test_name}\n")
        f.write("-" * 80 + "\n")
        f.flush()
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", test_name, "-v", "--tb=short"],
            cwd=base_dir,
            capture_output=True,
            text=True
        )
        
        f.write(result.stdout)
        if result.stderr:
            f.write("\nSTDERR:\n" + result.stderr)
        
        status = "PASSED" if result.returncode == 0 else "FAILED"
        f.write(f"\n>>> {status} (exit code: {result.returncode})\n")
        f.flush()

print(f"\nResults written to: {output_file}")
print("Reading results...\n")

# Read and display results
with open(output_file, 'r', encoding='utf-8') as f:
    print(f.read())
