#!/usr/bin/env python3
"""
EP-00·ST-003: Backend API Contract Validation
Validează că toate endpoint-urile sunt consumabile din React Native.
"""

import requests
import json
import sys
from typing import Dict, List, Tuple

# Backend URL (modifică dacă testezi local)
BASE_URL = "https://gal-transcribe.preview.emergentagent.com"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_section(title: str):
    print(f"\n{Colors.BLUE}{'='*60}")
    print(f"{title}")
    print(f"{'='*60}{Colors.END}\n")

def validate_endpoint(method: str, path: str, expected_content_type: str = "application/json") -> Tuple[bool, str]:
    """Validează un endpoint."""
    url = f"{BASE_URL}{path}"
    
    try:
        if method == "GET":
            response = requests.get(url, timeout=10)
        elif method == "POST":
            response = requests.post(url, json={}, timeout=10)
        else:
            return False, f"Method {method} not supported in validator"
        
        # Check status code (orice sub 500 e OK pentru validator)
        if response.status_code >= 500:
            return False, f"Status {response.status_code} (server error)"
        
        # Check Content-Type
        content_type = response.headers.get('Content-Type', '')
        if expected_content_type not in content_type:
            return False, f"Content-Type mismatch: got '{content_type}', expected '{expected_content_type}'"
        
        # Check CORS headers
        if 'Access-Control-Allow-Origin' not in response.headers:
            return False, "Missing CORS headers (Access-Control-Allow-Origin)"
        
        return True, f"✓ Status {response.status_code}, Content-Type OK, CORS OK"
        
    except requests.exceptions.Timeout:
        return False, "Timeout (>10s)"
    except requests.exceptions.ConnectionError:
        return False, "Connection error (backend down?)"
    except Exception as e:
        return False, f"Error: {str(e)}"

def main():
    print_section("Backend API Contract Validation")
    print(f"Target: {BASE_URL}\n")
    
    # Endpoints to validate (from PRD)
    endpoints = [
        ("GET", "/api/health", "Health check"),
        ("GET", "/api/v1/verticals", "Vertical configs"),
        ("GET", "/api/meetings", "List meetings"),
        ("GET", "/api/meetings/calendar-dates?year=2025&month=4", "Calendar dates"),
        ("GET", "/api/localities", "List localities"),
    ]
    
    results = []
    passed = 0
    failed = 0
    
    for method, path, description in endpoints:
        print(f"Testing: {description}")
        print(f"  {method} {path}")
        
        success, message = validate_endpoint(method, path)
        
        if success:
            print(f"  {Colors.GREEN}{message}{Colors.END}")
            passed += 1
        else:
            print(f"  {Colors.RED}✗ {message}{Colors.END}")
            failed += 1
        
        results.append((description, success, message))
        print()
    
    # Summary
    print_section("Validation Summary")
    print(f"Total endpoints tested: {len(endpoints)}")
    print(f"{Colors.GREEN}Passed: {passed}{Colors.END}")
    print(f"{Colors.RED}Failed: {failed}{Colors.END}\n")
    
    # Detailed results
    if failed > 0:
        print(f"{Colors.YELLOW}Failed endpoints:{Colors.END}")
        for desc, success, msg in results:
            if not success:
                print(f"  - {desc}: {msg}")
        print()
    
    # CORS specific validation
    print_section("CORS Configuration Check")
    try:
        response = requests.options(f"{BASE_URL}/api/health", headers={
            'Origin': 'exp://192.168.1.100:19000',
            'Access-Control-Request-Method': 'GET',
        })
        
        if response.status_code == 200:
            print(f"{Colors.GREEN}✓ CORS preflight (OPTIONS) working{Colors.END}")
            print(f"  Allow-Origin: {response.headers.get('Access-Control-Allow-Origin', 'N/A')}")
            print(f"  Allow-Methods: {response.headers.get('Access-Control-Allow-Methods', 'N/A')}")
        else:
            print(f"{Colors.RED}✗ CORS preflight failed (status {response.status_code}){Colors.END}")
    except Exception as e:
        print(f"{Colors.RED}✗ CORS check error: {e}{Colors.END}")
    
    # Accept-Ranges check (R-004 from PRD)
    print_section("HTTP 206 Range Support (R-004)")
    try:
        response = requests.head(f"{BASE_URL}/api/health")
        if 'Accept-Ranges' in response.headers or 'Content-Range' in response.headers:
            print(f"{Colors.GREEN}✓ Range support headers present{Colors.END}")
        else:
            print(f"{Colors.YELLOW}⚠ Range headers not detected (might be endpoint-specific){Colors.END}")
    except:
        pass
    
    print()
    
    # Exit code
    if failed > 0:
        print(f"{Colors.RED}Validation FAILED. Fix backend issues before deploying to mobile.{Colors.END}\n")
        sys.exit(1)
    else:
        print(f"{Colors.GREEN}All validations PASSED. Backend is mobile-ready.{Colors.END}\n")
        sys.exit(0)

if __name__ == "__main__":
    main()
