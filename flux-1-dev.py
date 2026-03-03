import requests
import json
import uuid
from flask import Flask, request, Response, abort

app = Flask(__name__)

API_URL = "https://api-preview.apirouter.ai/api/v1/deepimg/flux-1-dev"

HEADERS = {
    "accept": "*/*",
    "content-type": "application/json",
    "origin": "https://deepimg.ai",
    "referer": "https://deepimg.ai/",
    "user-agent": "Mozilla/5.0 (Linux; Android 15; POCO F5) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36"
}

def generate_image(prompt, size="1024x1024", n=1, output_format="png"):
    if not prompt or not isinstance(prompt, str) or len(prompt.strip()) == 0:
        abort(400, "prompt is required and must be a non-empty string")

    payload = {
        "device_id": str(uuid.uuid4()),
        "prompt": prompt.strip(),
        "size": size,
        "n": n,
        "output_format": output_format
    }

    try:
        r = requests.post(API_URL, json=payload, headers=HEADERS, timeout=60)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        abort(502, f"API request failed: {str(e)}")
    except json.JSONDecodeError:
        abort(502, "Invalid JSON response from API")


@app.route("/", methods=["GET", "POST", "OPTIONS"])
def handle_request():
    if request.method == "OPTIONS":
        return Response(
            status=204,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400"
            }
        )

    prompt = None
    size = "1024x1024"
    n = 1
    output_format = "png"

    if request.method == "GET":
        prompt = request.args.get("prompt")
        size = request.args.get("size", size)
        n = int(request.args.get("n", n))
        output_format = request.args.get("output_format", output_format)
    elif request.method == "POST":
        if request.is_json:
            data = request.get_json(silent=True) or {}
            prompt = data.get("prompt")
            size = data.get("size", size)
            n = data.get("n", n)
            output_format = data.get("output_format", output_format)
        else:
            form = request.form
            prompt = form.get("prompt")
            size = form.get("size", size)
            n = int(form.get("n", n))
            output_format = form.get("output_format", output_format)

    if not prompt:
        abort(400, "prompt is required")

    result = generate_image(prompt, size, n, output_format)

    return Response(
        json.dumps(result, indent=2),
        mimetype="application/json",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@app.errorhandler(400)
@app.errorhandler(502)
def handle_error(e):
    code = e.code if hasattr(e, "code") else 500
    msg = str(e.description) if hasattr(e, "description") else str(e)
    return Response(
        json.dumps({"error": msg}, indent=2),
        status=code,
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": "*"}
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)


## // http://localhost:5000/?prompt=cyberpunk%20city&size=1024x1024&n=1&output_format=png