from flask import Flask
import os

app = Flask(__name__)

@app.route('/')
def hello():
    return "Hello from Cloud Run (listening on port {})!".format(os.environ.get("PORT", "8080"))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
