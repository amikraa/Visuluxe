import requests
import json
import uuid

# Test the Flux API directly with your working format
API_URL = "https://api-preview.apirouter.ai/api/v1/deepimg/flux-1-dev"

HEADERS = {
    "accept": "*/*",
    "content-type": "application/json",
    "origin": "https://deepimg.ai",
    "referer": "https://deepimg.ai/",
    "user-agent": "Mozilla/5.0 (Linux; Android 15; POCO F5) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36"
}

def test_flux_api():
    payload = {
        "device_id": str(uuid.uuid4()),
        "prompt": "cyberpunk city",
        "size": "1024x1024",
        "n": 1,
        "output_format": "png"
    }
    
    print(f"Testing Flux API with payload:")
    print(json.dumps(payload, indent=2))
    
    try:
        response = requests.post(API_URL, json=payload, headers=HEADERS, timeout=120)
        print(f"\nStatus Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nSuccess Response:")
            print(json.dumps(result, indent=2))
            return True
        else:
            print(f"\nError Response:")
            print(response.text)
            return False
            
    except Exception as e:
        print(f"Request failed: {e}")
        return False

if __name__ == "__main__":
    test_flux_api()