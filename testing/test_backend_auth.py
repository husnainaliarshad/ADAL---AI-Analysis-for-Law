import requests
import json

BASE_URL = "http://localhost:9006"

# Configuration for a test user
test_user = {
    "username": "test_engineer",
    "email": "tester@example.com",
    "password": "SecurePassword123!",
    "first_name": "Test",
    "last_name": "User"
}

class AuthTester:
    def __init__(self):
        self.token = None
        self.refresh_token = None

    def log_result(self, name, response):
        status = "✅ SUCCESS" if 200 <= response.status_code < 300 else "❌ FAILED"
        print(f"--- {name} ---")
        print(f"Status: {response.status_code} {status}")
        try:
            print(json.dumps(response.json(), indent=2))
        except:
            print(f"Body: {response.text}")
        print("\n")

    def register(self):
        url = f"{BASE_URL}/api/auth/register"
        # We send the full test_user dict as the JSON body
        res = requests.post(url, json=test_user)
        self.log_result("Registration", res)

    def login(self):
        url = f"{BASE_URL}/api/auth/login"
        payload = {
            "email": test_user["email"],
            "password": test_user["password"],
            "remember": True
        }
        res = requests.post(url, json=payload)
        self.log_result("Login", res)
        
        # Save tokens if the login was successful
        if res.status_code == 200:
            data = res.json()
            # Adjust these keys based on your actual API response structure
            self.token = data.get("access_token") 
            self.refresh_token = data.get("refresh_token")

    def get_profile(self):
        if not self.token: return
        url = f"{BASE_URL}/api/auth/profile"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.get(url, headers=headers)
        self.log_result("Get Profile", res)

    def update_profile(self):
        if not self.token: return
        url = f"{BASE_URL}/api/auth/profile"
        headers = {"Authorization": f"Bearer {self.token}"}
        payload = {
            "email": test_user["email"],
            "username": "updated_tester",
            "first_name": "Updated",
            "last_name": "Name"
        }
        res = requests.put(url, json=payload, headers=headers)
        self.log_result("Update Profile", res)

    def logout(self):
        if not self.token: return
        url = f"{BASE_URL}/api/auth/logout"
        headers = {"Authorization": f"Bearer {self.token}"}
        res = requests.post(url, headers=headers)
        self.log_result("Logout", res)

    def request_password_reset(self):
        url = f"{BASE_URL}/api/auth/request-password-reset"
        res = requests.post(url, json={"email": test_user["email"]})
        self.log_result("Request Password Reset", res)

if __name__ == "__main__":
    tester = AuthTester()
    
    # 1. Create account
    tester.register()
    
    # 2. Login to get Bearer Token
    tester.login()
    
    # 3. Use Token to view/edit profile
    tester.get_profile()
    tester.update_profile()
    
    # 4. Test background services
    tester.request_password_reset()
    
    # 5. End session
    tester.logout()