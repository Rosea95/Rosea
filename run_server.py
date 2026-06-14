#!/usr/bin/env python3
import http.server
import socketserver
import os

PORT = 8888
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY + '/dist', **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

print(f'Server running at http://localhost:{PORT}/')
print(f'Serving directory: {DIRECTORY}/dist')
print('Press Ctrl+C to stop the server')

with socketserver.TCPServer(('', PORT), MyHTTPRequestHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
