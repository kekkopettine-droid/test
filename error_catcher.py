import http.server
import socketserver
import json
import threading

class ErrorHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/error':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            error_data = json.loads(post_data.decode('utf-8'))
            print(f"\n\n--- JAVASCRIPT ERROR CAUGHT ---\n{error_data}\n-------------------------------\n")
            self.send_response(200)
            self.end_headers()
            threading.Thread(target=self.server.shutdown).start()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

PORT = 8001
with socketserver.TCPServer(("", PORT), ErrorHandler) as httpd:
    print("Server waiting for error report...")
    httpd.serve_forever()
