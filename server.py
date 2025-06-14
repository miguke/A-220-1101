import http.server
import socketserver
import os
import webbrowser

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler

# Add CORS headers to allow loading resources
class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.end_headers()

if __name__ == '__main__':
    web_dir = os.path.join(os.path.dirname(__file__), '.')
    os.chdir(web_dir)
    
    with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        webbrowser.open(f'http://localhost:{PORT}/index.html')
        httpd.serve_forever()
