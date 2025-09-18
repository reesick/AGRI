#!/usr/bin/env python3
"""
FastAPI Endpoint Testing for Crop Contract App
Make sure your FastAPI server is running on http://localhost:8000
"""

import requests
import json
import uuid
from datetime import datetime, date, timedelta

# Configuration
API_BASE_URL = "http://localhost:8000"

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.test_data = {}

    def log_test(self, test_name, success, message, response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"   {message}")
        if response_data:
            print(f"   Response: {json.dumps(response_data, indent=2, default=str)}")
        print("-" * 60)

    def test_health_check(self):
        """Test basic server health"""
        try:
            response = self.session.get(f"{API_BASE_URL}/health")
            if response.status_code == 200:
                data = response.json()
                self.log_test("Health Check", True, "Server is running", data)
                return True
            else:
                self.log_test("Health Check", False, f"Server returned {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Health Check", False, f"Cannot connect to server: {str(e)}")
            return False

    def test_root_endpoint(self):
        """Test root endpoint"""
        try:
            response = self.session.get(f"{API_BASE_URL}/")
            if response.status_code == 200:
                data = response.json()
                self.log_test("Root Endpoint", True, "Root endpoint working", data)
                return True
            else:
                self.log_test("Root Endpoint", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Error: {str(e)}")
            return False

    def test_create_user_profile(self):
        """Test user profile creation with valid UUIDs"""
        try:
            # generate valid UUIDs for user_id
            farmer_id = str(uuid.uuid4())
            buyer_id = str(uuid.uuid4())

            # create farmer
            farmer_data = {
                "name": "Test Farmer",
                "role": "farmer"
            }
            response = self.session.post(
                f"{API_BASE_URL}/users?user_id={farmer_id}",
                json=farmer_data
            )
            if response.status_code == 200:
                data = response.json()
                self.test_data['farmer_id'] = data['data']['id']
                self.log_test("Create Farmer Profile", True, "Farmer created successfully", data)
                farmer_success = True
            else:
                self.log_test("Create Farmer Profile", False, f"Status: {response.status_code}, Response: {response.text}")
                farmer_success = False

            # create buyer
            buyer_data = {
                "name": "Test Buyer",
                "role": "buyer"
            }
            response = self.session.post(
                f"{API_BASE_URL}/users?user_id={buyer_id}",
                json=buyer_data
            )
            if response.status_code == 200:
                data = response.json()
                self.test_data['buyer_id'] = data['data']['id']
                self.log_test("Create Buyer Profile", True, "Buyer created successfully", data)
                buyer_success = True
            else:
                self.log_test("Create Buyer Profile", False, f"Status: {response.status_code}, Response: {response.text}")
                buyer_success = False

            return farmer_success and buyer_success

        except Exception as e:
            self.log_test("Create User Profiles", False, f"Error: {str(e)}")
            return False

    def test_add_funds_to_wallet(self):
        """Test adding funds to wallet"""
        try:
            if 'buyer_id' not in self.test_data:
                self.log_test("Add Funds", False, "No buyer ID available from previous tests")
                return False

            wallet_data = {
                "user_id": self.test_data['buyer_id'],
                "amount": 1000.00
            }

            response = self.session.post(
                f"{API_BASE_URL}/wallet/add-funds",
                json=wallet_data
            )

            if response.status_code == 200:
                data = response.json()
                self.log_test("Add Funds to Wallet", True, "Funds added successfully", data)
                return True
            else:
                self.log_test("Add Funds to Wallet", False, f"Status: {response.status_code}, Response: {response.text}")
                return False

        except Exception as e:
            self.log_test("Add Funds to Wallet", False, f"Error: {str(e)}")
            return False

    def test_create_listing(self):
        """Test creating a crop listing"""
        try:
            if 'farmer_id' not in self.test_data:
                self.log_test("Create Listing", False, "No farmer ID available from previous tests")
                return False
            listing_data = {
                "crop_type": "Rice",
                "quantity": 100,
                "delivery_date": (date.today() + timedelta(days=30)).isoformat(),
                "expected_price": 500.00
            }
            response = self.session.post(
                f"{API_BASE_URL}/listings?farmer_id={self.test_data['farmer_id']}",
                json=listing_data
            )
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('data'):
                    self.test_data['listing_id'] = data['data']['id']
                    self.log_test("Create Listing", True, "Listing created successfully", data)
                    return True
                else:
                    self.log_test("Create Listing", False, "Invalid response format", data)
                    return False
            else:
                self.log_test("Create Listing", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Create Listing", False, f"Error: {str(e)}")
            return False

    def test_get_all_listings(self):
        """Test getting all listings"""
        try:
            response = self.session.get(f"{API_BASE_URL}/listings")
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else len(data.get('data', []))
                self.log_test("Get All Listings", True, f"Retrieved {count} listings", {"count": count})
                return True
            else:
                self.log_test("Get All Listings", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Get All Listings", False, f"Error: {str(e)}")
            return False

    def test_create_proposal(self):
        """Test creating a proposal"""
        try:
            if 'buyer_id' not in self.test_data or 'listing_id' not in self.test_data:
                self.log_test("Create Proposal", False, "Missing buyer_id or listing_id from previous tests")
                return False
            proposal_data = {
                "listing_id": self.test_data['listing_id'],
                "price": 450.00,
                "payment_terms": "Payment within 7 days of delivery"
            }
            response = self.session.post(
                f"{API_BASE_URL}/proposals?buyer_id={self.test_data['buyer_id']}",
                json=proposal_data
            )
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('data'):
                    self.test_data['proposal_id'] = data['data']['id']
                    self.log_test("Create Proposal", True, "Proposal created successfully", data)
                    return True
                else:
                    self.log_test("Create Proposal", False, "Invalid response format", data)
                    return False
            else:
                self.log_test("Create Proposal", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Create Proposal", False, f"Error: {str(e)}")
            return False

    def test_accept_proposal(self):
        """Test accepting a proposal"""
        try:
            if 'proposal_id' not in self.test_data:
                self.log_test("Accept Proposal", False, "No proposal_id from previous tests")
                return False
            response = self.session.put(f"{API_BASE_URL}/proposals/{self.test_data['proposal_id']}/accept")
            if response.status_code == 200:
                data = response.json()
                self.log_test("Accept Proposal", True, "Proposal accepted successfully", data)
                return True
            else:
                self.log_test("Accept Proposal", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Accept Proposal", False, f"Error: {str(e)}")
            return False

    def test_generate_contract(self):
        """Test contract generation with Gemini"""
        try:
            if 'proposal_id' not in self.test_data:
                self.log_test("Generate Contract", False, "No proposal_id from previous tests")
                return False
            contract_data = {"proposal_id": self.test_data['proposal_id']}
            response = self.session.post(f"{API_BASE_URL}/contracts/generate", json=contract_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('data'):
                    self.test_data['contract_id'] = data['data']['id']
                    self.log_test("Generate Contract", True, "Contract generated with Gemini AI", data)
                    return True
                else:
                    self.log_test("Generate Contract", False, "Invalid response format", data)
                    return False
            else:
                self.log_test("Generate Contract", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Generate Contract", False, f"Error: {str(e)}")
            return False

    def test_farmer_dashboard(self):
        """Test farmer dashboard"""
        try:
            if 'farmer_id' not in self.test_data:
                self.log_test("Farmer Dashboard", False, "No farmer_id from previous tests")
                return False
            response = self.session.get(f"{API_BASE_URL}/dashboard/farmer/{self.test_data['farmer_id']}")
            if response.status_code == 200:
                data = response.json()
                self.log_test("Farmer Dashboard", True, "Dashboard data retrieved", {"keys": list(data.get('data', {}).keys())})
                return True
            else:
                self.log_test("Farmer Dashboard", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Farmer Dashboard", False, f"Error: {str(e)}")
            return False

    def test_buyer_dashboard(self):
        """Test buyer dashboard"""
        try:
            if 'buyer_id' not in self.test_data:
                self.log_test("Buyer Dashboard", False, "No buyer_id from previous tests")
                return False
            response = self.session.get(f"{API_BASE_URL}/dashboard/buyer/{self.test_data['buyer_id']}")
            if response.status_code == 200:
                data = response.json()
                self.log_test("Buyer Dashboard", True, "Dashboard data retrieved", {"keys": list(data.get('data', {}).keys())})
                return True
            else:
                self.log_test("Buyer Dashboard", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Buyer Dashboard", False, f"Error: {str(e)}")
            return False


def main():
    """Run all API tests"""
    print("=" * 80)
    print("🚀 CROP CONTRACT API - ENDPOINT TESTING")
    print("=" * 80)
    print("Make sure your FastAPI server is running on http://localhost:8000")
    print("Start server with: uvicorn main:app --reload --port 8000")
    print("=" * 80)

    tester = APITester()
    tests = [
        ("Health Check", tester.test_health_check),
        ("Root Endpoint", tester.test_root_endpoint),
        ("Create User Profiles", tester.test_create_user_profile),
        ("Add Funds to Wallet", tester.test_add_funds_to_wallet),
        ("Create Listing", tester.test_create_listing),
        ("Get All Listings", tester.test_get_all_listings),
        ("Create Proposal", tester.test_create_proposal),
        ("Accept Proposal", tester.test_accept_proposal),
        ("Generate Contract (Gemini)", tester.test_generate_contract),
        ("Farmer Dashboard", tester.test_farmer_dashboard),
        ("Buyer Dashboard", tester.test_buyer_dashboard)
    ]

    passed = 0
    total = len(tests)
    for test_name, test_func in tests:
        if test_func():
            passed += 1

    print("=" * 80)
    print("📋 TEST SUMMARY:")
    print("=" * 80)
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    if passed != total:
        print("⚠️  Some tests failed. Check the details above.")
    print("=" * 80)

    if tester.test_data:
        print("\n📋 Generated Test Data:")
        for key, value in tester.test_data.items():
            print(f"   {key}: {value}")

if __name__ == "__main__":
    main()
