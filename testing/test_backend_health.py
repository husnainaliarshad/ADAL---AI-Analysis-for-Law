import requests
import json

# Base URL - change this to your actual backend URL
BASE_URL = "http://localhost:9006"

# List of health endpoints to check
endpoints = [
    "/api/health",
    "/api/health/db_conn_live",
    "/api/health/live",
    "/api/health/ready",
    "/api/health/redis"
]

def call_endpoints():
    print("=" * 60)
    print("ADAL BACKEND HEALTH CHECK")
    print("=" * 60)
    print()
    
    results = []  # To store summary info

    for endpoint in endpoints:
        url = f"{BASE_URL}{endpoint}"
        print(f"📡 Calling: {endpoint}")
        print("-" * 40)
        
        status_text = "FAILED"
        status_code = "N/A"

        try:
            response = requests.get(url, timeout=10)
            status_code = response.status_code
            
            # Check if status code is in the 2xx range
            if 200 <= response.status_code < 300:
                status_text = "SUCCESS"
            
            print(f"✅ Status Code: {status_code}")
            
            try:
                data = response.json()
                print(f"📦 Response:")
                print(json.dumps(data, indent=2))
            except:
                print(f"📝 Response: {response.text}")
                
        except requests.exceptions.ConnectionError:
            print(f"❌ Error: Failed to connect to {BASE_URL}")
            status_text = "CONN_ERROR"
        except requests.exceptions.Timeout:
            print(f"❌ Error: Request timeout")
            status_text = "TIMEOUT"
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            status_text = "ERROR"
        
        # Save result for the final summary
        results.append((endpoint, status_code, status_text))
        print()
    
    # --- FINAL SUMMARY SECTION ---
    print("=" * 60)
    print(f"{'ENDPOINT':<30} | {'CODE':<6} | {'RESULT'}")
    print("-" * 60)
    for endpoint, code, status in results:
        # Simple color-like indicator (text-based)
        icon = "OK" if status == "SUCCESS" else "!! "
        print(f"{endpoint:<30} | {str(code):<6} | {icon} {status}")
    print("=" * 60)

if __name__ == "__main__":
    call_endpoints()