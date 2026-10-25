import http.server
import socketserver
import os
import sys

PORT = 5173
DIRECTORY = os.path.abspath("apps/web/dist")

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, format, *args):
        pass

socketserver.TCPServer.allow_reuse_address = True
try:
    with socketserver.TCPServer(("127.0.0.1", PORT), SPAHandler) as httpd:
        print(f"Serving XplainAI Frontend on http://127.0.0.1:{PORT}", flush=True)
        httpd.serve_forever()
except Exception as e:
    print(f"Server error: {e}", file=sys.stderr, flush=True)
