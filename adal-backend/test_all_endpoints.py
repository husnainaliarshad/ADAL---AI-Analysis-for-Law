"""
Test All API Endpoints

Comprehensive test script for all ADAL backend endpoints.
Tests basic functionality without requiring complex setup.
"""

import requests
import json
import time
from typing import Dict, List, Any

class EndpointTester:
    def __init__(self, base_url: str = "http://127.0.0.1:9006"):
        self.base_url = base_url
        self.results = []
        
    def log_result(self, method: str, endpoint: str, status: int, success: bool, details: str = ""):
        """Log test result."""
        result = {
            "method": method,
            "endpoint": endpoint,
            "status_code": status,
            "success": success,
            "details": details,
            "timestamp": time.strftime("%H:%M:%S")
        }
        self.results.append(result)
        
        status_icon = "✅" if success else "❌"
        print(f"{status_icon} {method} {endpoint} - {status} - {details}")
    
    def test_endpoint(self, method: str, endpoint: str, data: Dict = None, params: Dict = None, expected_status: int = 200) -> bool:
        """Test a single endpoint."""
        # Add /api prefix if not present
        if not endpoint.startswith("/api"):
            endpoint = f"/api{endpoint}"
        
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, params=params, timeout=10)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, params=params, timeout=10)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, params=params, timeout=10)
            elif method.upper() == "DELETE":
                response = requests.delete(url, params=params, timeout=10)
            else:
                self.log_result(method, endpoint, 0, False, f"Unsupported method: {method}")
                return False
            
            success = response.status_code == expected_status
            details = ""
            
            if success:
                try:
                    json_data = response.json()
                    if isinstance(json_data, dict):
                        if "message" in json_data:
                            details = json_data["message"]
                        elif "detail" in json_data:
                            details = json_data["detail"]
                        elif "response" in json_data:
                            details = json_data["response"][:50] + "..." if len(json_data["response"]) > 50 else json_data["response"]
                        else:
                            details = f"Keys: {list(json_data.keys())}"
                    else:
                        details = f"Type: {type(json_data).__name__}"
                except:
                    details = "Non-JSON response"
            else:
                try:
                    error_data = response.json()
                    details = error_data.get("detail", f"HTTP {response.status_code}")
                except:
                    details = f"HTTP {response.status_code}"
            
            self.log_result(method, endpoint, response.status_code, success, details)
            return success
            
        except requests.exceptions.ConnectionError:
            self.log_result(method, endpoint, 0, False, "Connection refused - server not running?")
            return False
        except requests.exceptions.Timeout:
            self.log_result(method, endpoint, 0, False, "Request timeout")
            return False
        except Exception as e:
            self.log_result(method, endpoint, 0, False, f"Error: {str(e)}")
            return False
    
    def test_health_endpoints(self):
        """Test health check endpoints."""
        print("\n🏥 Testing Health Endpoints")
        print("=" * 50)
        
        endpoints = [
            ("GET", "/health", None, None, 200),
            ("GET", "/health/live", None, None, 200),
            ("GET", "/health/ready", None, None, 200),
            ("GET", "/health/db_conn_live", None, None, 200),
            ("GET", "/health/redis", None, None, 200),
        ]
        
        for method, endpoint, data, params, expected in endpoints:
            self.test_endpoint(method, endpoint, data, params, expected)
    
    def test_auth_endpoints(self):
        """Test authentication endpoints."""
        print("\n🔐 Testing Auth Endpoints")
        print("=" * 50)
        
        endpoints = [
            ("POST", "/auth/register", {"email": "test@example.com", "password": "password123", "username": "testuser"}, None, 200),
            ("POST", "/auth/login", {"email": "test@example.com", "password": "password123"}, None, 200),
            ("GET", "/auth/me", None, None, 401),  # Should fail without token
        ]
        
        for method, endpoint, data, params, expected in endpoints:
            self.test_endpoint(method, endpoint, data, params, expected)
    
    def test_document_endpoints(self):
        """Test document endpoints."""
        print("\n📄 Testing Document Endpoints")
        print("=" * 50)
        
        endpoints = [
            ("GET", "/files", None, None, 200),
            ("GET", "/files/1", None, None, 404),  # Likely doesn't exist
        ]
        
        for method, endpoint, data, params, expected in endpoints:
            self.test_endpoint(method, endpoint, data, params, expected)
    
    def test_citation_endpoints(self):
        """Test citation endpoints."""
        print("\n📚 Testing Citation Endpoints")
        print("=" * 50)
        
        endpoints = [
            ("GET", "/citations", None, None, 200),
            ("GET", "/citations/1", None, None, 404),  # Likely doesn't exist
        ]
        
        for method, endpoint, data, params, expected in endpoints:
            self.test_endpoint(method, endpoint, data, params, expected)
    
    def test_claim_endpoints(self):
        """Test claim endpoints."""
        print("\n⚖️ Testing Claim Endpoints")
        print("=" * 50)
        
        endpoints = [
            ("GET", "/claims", None, None, 200),
            ("GET", "/claims/1", None, None, 404),  # Likely doesn't exist
        ]
        
        for method, endpoint, data, params, expected in endpoints:
            self.test_endpoint(method, endpoint, data, params, expected)
    
    def test_evidence_endpoints(self):
        """Test evidence endpoints."""
        print("\n🔍 Testing Evidence Endpoints")
        print("=" * 50)
        
        endpoints = [
            ("GET", "/evidence", None, None, 200),
            ("GET", "/evidence/1", None, None, 404),  # Likely doesn't exist
        ]
        
        for method, endpoint, data, params, expected in endpoints:
            self.test_endpoint(method, endpoint, data, params, expected)
    
    def test_verification_endpoints(self):
        """Test verification endpoints."""
        print("\n✅ Testing Verification Endpoints")
        print("=" * 50)
        
        endpoints = [
            ("GET", "/verification", None, None, 200),
            ("GET", "/verification/1", None, None, 404),  # Likely doesn't exist
        ]
        
        for method, endpoint, data, params, expected in endpoints:
            self.test_endpoint(method, endpoint, data, params, expected)
    
    def test_summary_endpoints(self):
        """Test summary endpoints."""
        print("\n📝 Testing Summary Endpoints")
        print("=" * 50)
        
        endpoints = [
            ("GET", "/summary", None, None, 200),
        ]
        
        for method, endpoint, data, params, expected in endpoints:
            self.test_endpoint(method, endpoint, data, params, expected)
    
    def test_embedding_endpoints(self):
        """Test embedding endpoints."""
        print("\n🔢 Testing Embedding Endpoints")
        print("=" * 50)
        
        endpoints = [
            ("GET", "/embeddings", None, None, 200),
            ("POST", "/embeddings/search", {"query": "test query", "limit": 5}, None, 200),
        ]
        
        for method, endpoint, data, params, expected in endpoints:
            self.test_endpoint(method, endpoint, data, params, expected)
    
    def test_chat_endpoints(self):
        """Test chat endpoints."""
        print("\n💬 Testing Chat Endpoints")
        print("=" * 50)
        
        endpoints = [
            ("POST", "/chat/", {"message": "Hello, this is a test!", "user_id": 1}, None, 200),
        ]
        
        for method, endpoint, data, params, expected in endpoints:
            self.test_endpoint(method, endpoint, data, params, expected)
    
    def test_admin_endpoints(self):
        """Test admin endpoints."""
        print("\n👑 Testing Admin Endpoints")
        print("=" * 50)
        
        endpoints = [
            ("GET", "/admin/stats", None, None, 200),
            ("GET", "/admin/users", None, None, 200),
        ]
        
        for method, endpoint, data, params, expected in endpoints:
            self.test_endpoint(method, endpoint, data, params, expected)
    
    def run_all_tests(self):
        """Run all endpoint tests."""
        print("🚀 Starting Comprehensive Endpoint Testing")
        print("=" * 60)
        print(f"Base URL: {self.base_url}")
        print("=" * 60)
        
        # Test all endpoint groups
        self.test_health_endpoints()
        self.test_auth_endpoints()
        self.test_document_endpoints()
        self.test_citation_endpoints()
        self.test_claim_endpoints()
        self.test_evidence_endpoints()
        self.test_verification_endpoints()
        self.test_summary_endpoints()
        self.test_embedding_endpoints()
        self.test_chat_endpoints()
        self.test_admin_endpoints()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary."""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total = len(self.results)
        successful = sum(1 for r in self.results if r["success"])
        failed = total - successful
        
        print(f"Total Tests: {total}")
        print(f"✅ Successful: {successful}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(successful/total*100):.1f}%")
        
        if failed > 0:
            print("\n❌ Failed Tests:")
            for result in self.results:
                if not result["success"]:
                    print(f"   {result['method']} {result['endpoint']} - {result['details']}")
        
        print("\n🎉 Testing completed!")

def main():
    """Run the endpoint tests."""
    import sys
    
    # Allow custom base URL
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:9006"
    
    tester = EndpointTester(base_url)
    tester.run_all_tests()

if __name__ == "__main__":
    main()
