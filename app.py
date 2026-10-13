"""Serve the chatbot website and forward chat requests to local Ollama."""

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


HOST = "127.0.0.1"
PORT = 8000
OLLAMA_CHAT_URL = "http://127.0.0.1:11434/api/chat"
MAX_REQUEST_BYTES = 1_000_000


class ChatbotHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)

    def do_POST(self):
        if self.path != "/api/chat":
            self.send_error(404, "Not found")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"error": "Invalid Content-Length header."})
            return

        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            self._send_json(400, {"error": "Request body is empty or too large."})
            return

        try:
            payload = json.loads(self.rfile.read(content_length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"error": "Request body must contain valid JSON."})
            return

        if not isinstance(payload, dict) or not isinstance(payload.get("messages"), list):
            self._send_json(400, {"error": "Request must include a messages list."})
            return

        request = Request(
            OLLAMA_CHAT_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urlopen(request, timeout=120) as ollama_response:
                response_body = ollama_response.read()
                self.send_response(ollama_response.status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(response_body)))
                self.end_headers()
                self.wfile.write(response_body)
        except HTTPError as error:
            response_body = error.read()
            self.send_response(error.code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body)
        except URLError as error:
            self._send_json(502, {"error": f"Could not connect to Ollama: {error.reason}"})

    def _send_json(self, status, data):
        response_body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_body)))
        self.end_headers()
        self.wfile.write(response_body)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), ChatbotHandler)
    print(f"Chatbot server is running at http://{HOST}:{PORT}")
    print("Keep this window open while you chat. Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping chatbot server.")
        server.server_close()
