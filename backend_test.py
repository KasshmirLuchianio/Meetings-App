#!/usr/bin/env python3
"""
GAL MEETINGS Backend API Testing
Tests all API endpoints for the Romanian meeting transcription app.
"""

import requests
import json
import sys
from datetime import datetime

class GALMeetingsAPITester:
    def __init__(self, base_url="https://gal-transcribe.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_meeting_id = "69cbb35021eb3b0130d417c8"  # Existing test meeting

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict):
                        if 'meetings' in response_data:
                            print(f"   Found {len(response_data['meetings'])} meetings")
                        elif 'localities' in response_data:
                            print(f"   Found {len(response_data['localities'])} localities")
                        elif '_id' in response_data:
                            print(f"   Meeting ID: {response_data['_id']}")
                        elif 'status' in response_data:
                            print(f"   Status: {response_data['status']}")
                except:
                    pass
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text[:200]}")

            return success, response

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, None

    def test_health(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )
        return success

    def test_get_meetings(self):
        """Test get meetings list"""
        success, response = self.run_test(
            "Get Meetings List",
            "GET",
            "api/meetings",
            200
        )
        return success

    def test_get_localities(self):
        """Test get localities list"""
        success, response = self.run_test(
            "Get Localities List",
            "GET",
            "api/localities",
            200
        )
        return success

    def test_create_meeting(self):
        """Test create new meeting"""
        success, response = self.run_test(
            "Create New Meeting",
            "POST",
            "api/meetings",
            200,
            data={"title": "Test Meeting", "locality": "Test Location"}
        )
        if success and response:
            try:
                data = response.json()
                return success, data.get('_id')
            except:
                pass
        return success, None

    def test_get_meeting_detail(self, meeting_id):
        """Test get single meeting detail"""
        success, response = self.run_test(
            f"Get Meeting Detail ({meeting_id})",
            "GET",
            f"api/meetings/{meeting_id}",
            200
        )
        return success

    def test_update_meeting(self, meeting_id):
        """Test update meeting locality"""
        success, response = self.run_test(
            f"Update Meeting Locality ({meeting_id})",
            "PATCH",
            f"api/meetings/{meeting_id}",
            200,
            data={"locality": "Updated Location"}
        )
        return success

    def test_toggle_action(self, meeting_id, action_id):
        """Test toggle action completion"""
        success, response = self.run_test(
            f"Toggle Action ({action_id})",
            "PATCH",
            f"api/meetings/{meeting_id}/actions/{action_id}",
            200
        )
        return success

    def test_regenerate_meeting(self, meeting_id):
        """Test regenerate meeting processing"""
        success, response = self.run_test(
            f"Regenerate Meeting ({meeting_id})",
            "POST",
            f"api/meetings/{meeting_id}/regenerate",
            200
        )
        return success

    def test_export_pdf(self, meeting_id):
        """Test PDF export"""
        success, response = self.run_test(
            f"Export PDF ({meeting_id})",
            "GET",
            f"api/meetings/{meeting_id}/export/pdf",
            200
        )
        if success and response:
            content_type = response.headers.get('content-type', '')
            if 'pdf' in content_type:
                print(f"   ✅ PDF content type: {content_type}")
            else:
                print(f"   ⚠️  Unexpected content type: {content_type}")
        return success

    def test_export_docx(self, meeting_id):
        """Test DOCX export"""
        success, response = self.run_test(
            f"Export DOCX ({meeting_id})",
            "GET",
            f"api/meetings/{meeting_id}/export/docx",
            200
        )
        if success and response:
            content_type = response.headers.get('content-type', '')
            if 'officedocument' in content_type:
                print(f"   ✅ DOCX content type: {content_type}")
            else:
                print(f"   ⚠️  Unexpected content type: {content_type}")
        return success

    def get_meeting_actions(self, meeting_id):
        """Get actions from a meeting for testing"""
        try:
            url = f"{self.base_url}/api/meetings/{meeting_id}"
            response = requests.get(url)
            if response.status_code == 200:
                data = response.json()
                actions = data.get('actions', [])
                return actions
        except Exception as e:
            print(f"Error getting meeting actions: {e}")
        return []

def main():
    print("🚀 GAL MEETINGS Backend API Testing")
    print("=" * 50)
    
    tester = GALMeetingsAPITester()
    
    # Test basic endpoints
    print("\n📋 BASIC API TESTS")
    tester.test_health()
    tester.test_get_meetings()
    tester.test_get_localities()
    
    # Test CRUD operations
    print("\n📝 CRUD OPERATIONS")
    success, new_meeting_id = tester.test_create_meeting()
    
    # Test with existing meeting
    print("\n🔍 EXISTING MEETING TESTS")
    tester.test_get_meeting_detail(tester.test_meeting_id)
    tester.test_update_meeting(tester.test_meeting_id)
    
    # Test action toggling with existing meeting
    actions = tester.get_meeting_actions(tester.test_meeting_id)
    if actions:
        first_action_id = actions[0].get('id')
        if first_action_id:
            tester.test_toggle_action(tester.test_meeting_id, first_action_id)
        else:
            print("⚠️  No action ID found in first action")
    else:
        print("⚠️  No actions found in test meeting")
    
    # Test regeneration
    print("\n🔄 AI PROCESSING TESTS")
    tester.test_regenerate_meeting(tester.test_meeting_id)
    
    # Test exports
    print("\n📄 EXPORT TESTS")
    tester.test_export_pdf(tester.test_meeting_id)
    tester.test_export_docx(tester.test_meeting_id)
    
    # Test with new meeting if created
    if new_meeting_id:
        print(f"\n🆕 NEW MEETING TESTS ({new_meeting_id})")
        tester.test_get_meeting_detail(new_meeting_id)
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())