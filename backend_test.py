import requests
import sys
import json
from datetime import datetime

class SmartRetailAPITester:
    def __init__(self, base_url="https://stock-tracker-477.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_product_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "status": "PASSED" if success else "FAILED",
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test(name, success, details)
            return success, response.json() if success and response.content else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        return self.run_test("API Root", "GET", "", 200)

    def test_create_product(self):
        """Test product creation"""
        product_data = {
            "name": "Test Product",
            "category": "Electronics",
            "current_stock": 50,
            "max_capacity": 100,
            "low_stock_threshold": 10,
            "unit": "units",
            "weight_per_unit": 0.5,
            "price": 29.99
        }
        success, response = self.run_test("Create Product", "POST", "products", 200, product_data)
        if success and 'id' in response:
            self.created_product_id = response['id']
        return success, response

    def test_get_products(self):
        """Test get all products"""
        return self.run_test("Get Products", "GET", "products", 200)

    def test_get_single_product(self):
        """Test get single product"""
        if not self.created_product_id:
            self.log_test("Get Single Product", False, "No product ID available")
            return False, {}
        return self.run_test("Get Single Product", "GET", f"products/{self.created_product_id}", 200)

    def test_update_product(self):
        """Test product update"""
        if not self.created_product_id:
            self.log_test("Update Product", False, "No product ID available")
            return False, {}
        
        update_data = {
            "current_stock": 75,
            "price": 34.99
        }
        return self.run_test("Update Product", "PUT", f"products/{self.created_product_id}", 200, update_data)

    def test_simulate_sensor(self):
        """Test sensor simulation"""
        if not self.created_product_id:
            self.log_test("Simulate Sensor", False, "No product ID available")
            return False, {}
        return self.run_test("Simulate Sensor", "POST", f"sensors/simulate/{self.created_product_id}", 200)

    def test_get_sensor_readings(self):
        """Test get sensor readings"""
        if not self.created_product_id:
            self.log_test("Get Sensor Readings", False, "No product ID available")
            return False, {}
        return self.run_test("Get Sensor Readings", "GET", f"sensors/readings/{self.created_product_id}", 200)

    def test_get_alerts(self):
        """Test get alerts"""
        return self.run_test("Get Alerts", "GET", "alerts", 200)

    def test_get_unread_alerts(self):
        """Test get unread alerts"""
        return self.run_test("Get Unread Alerts", "GET", "alerts?unread_only=true", 200)

    def test_get_predictions(self):
        """Test get predictions"""
        return self.run_test("Get Predictions", "GET", "predictions", 200)

    def test_get_single_prediction(self):
        """Test get single product prediction"""
        if not self.created_product_id:
            self.log_test("Get Single Prediction", False, "No product ID available")
            return False, {}
        return self.run_test("Get Single Prediction", "GET", f"predictions/{self.created_product_id}", 200)

    def test_dashboard_stats(self):
        """Test dashboard stats"""
        return self.run_test("Dashboard Stats", "GET", "dashboard/stats", 200)

    def test_stock_trends(self):
        """Test stock trends"""
        return self.run_test("Stock Trends", "GET", "dashboard/stock-trends", 200)

    def test_delete_product(self):
        """Test product deletion"""
        if not self.created_product_id:
            self.log_test("Delete Product", False, "No product ID available")
            return False, {}
        return self.run_test("Delete Product", "DELETE", f"products/{self.created_product_id}", 200)

    def run_all_tests(self):
        """Run all API tests"""
        print(f"🚀 Starting Smart Retail API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)

        # Test API root
        self.test_root_endpoint()

        # Test Products CRUD
        self.test_create_product()
        self.test_get_products()
        self.test_get_single_product()
        self.test_update_product()

        # Test Sensor functionality
        self.test_simulate_sensor()
        self.test_get_sensor_readings()

        # Test Alerts
        self.test_get_alerts()
        self.test_get_unread_alerts()

        # Test Predictions
        self.test_get_predictions()
        self.test_get_single_prediction()

        # Test Dashboard
        self.test_dashboard_stats()
        self.test_stock_trends()

        # Cleanup - Delete test product
        self.test_delete_product()

        # Print summary
        print("=" * 60)
        print(f"📊 Test Summary:")
        print(f"   Total Tests: {self.tests_run}")
        print(f"   Passed: {self.tests_passed}")
        print(f"   Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = SmartRetailAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_reports/backend_api_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_tests': tester.tests_run,
            'passed_tests': tester.tests_passed,
            'success_rate': (tester.tests_passed/tester.tests_run)*100 if tester.tests_run > 0 else 0,
            'results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())