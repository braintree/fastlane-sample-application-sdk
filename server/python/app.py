import os
from flask import Flask, send_from_directory, request
from dotenv import load_dotenv
from flask_cors import CORS

from controllers.render import braintree_sdk_render
from controllers.client_token import braintree_sdk_token
from controllers.transaction import braintree_sdk_transaction

load_dotenv("../.env")

app = Flask(__name__)
app.config["TEMPLATES_FOLDER"] = os.path.abspath(
    os.path.join(app.root_path, "../shared/views")
)
CORS(app)


@app.route("/")
def bt_sdk_render():
    return braintree_sdk_render(request.args, app.config["TEMPLATES_FOLDER"])


@app.route("/client-token")
def bt_sdk_token():
    return braintree_sdk_token()


@app.route("/transaction", methods=["POST"])
def bt_sdk_transaction():
    return braintree_sdk_transaction(request.json)


@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory(os.path.join(app.root_path, "../../client"), filename)


# Run the server
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
