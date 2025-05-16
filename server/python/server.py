import os
import braintree
import chevron

from flask import Flask, send_from_directory, request, jsonify, make_response
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv("../.env")

app = Flask(__name__)

app.config["TEMPLATES_FOLDER"] = os.path.abspath(
    os.path.join(app.root_path, "../shared/views")
)

CORS(app)

braintreeInstance = None


#######################################################################
## Token generation helpers
#######################################################################


def braintree_gateway():
    global braintreeInstance
    if braintreeInstance is None:
        braintreeInstance = braintree.BraintreeGateway(
            braintree.Configuration(
                environment=braintree.Environment.Sandbox,  # use braintree.Environment.Production for production environment
                merchant_id=os.getenv("BRAINTREE_MERCHANT_ID"),
                public_key=os.getenv("BRAINTREE_PUBLIC_KEY"),
                private_key=os.getenv("BRAINTREE_PRIVATE_KEY"),
            )
        )

    return braintreeInstance


def braintree_sdk_token():
    try:
        DOMAINS = os.getenv("DOMAINS", "").split(",")
        client_token = braintree_gateway().client_token.generate({"domains": DOMAINS})
        return jsonify(clientToken=client_token)
    except Exception as error:
        print(error)
        return make_response(jsonify(error=str(error)), 500)


#######################################################################
## Serve checkout page
#######################################################################


def braintree_sdk_render(args, templates_folder):
    is_flexible_integration = "flexible" in args

    locals = {
        "title": "Fastlane - Braintree SDK Integration"
        + (" (Flexible)" if is_flexible_integration else ""),
        "prerequisiteScripts": """
            <script
                src="https://js.braintreegateway.com/web/3.116.2/js/client.min.js"
                defer
            ></script>
            <script
                src="https://js.braintreegateway.com/web/3.116.2/js/data-collector.min.js"
                defer
            ></script>
            <script
                src="https://js.braintreegateway.com/web/3.116.2/js/fastlane.min.js"
                defer
            ></script>
        """,
        "initScriptPath": (
            "init-fastlane-flexible.js"
            if is_flexible_integration
            else "init-fastlane.js"
        ),
        "stylesheetPath": "styles.css",
    }

    template_name = (
        "checkout-flexible.html" if is_flexible_integration else "checkout.html"
    )
    template_path = os.path.join(templates_folder, template_name)

    with open(template_path, "r") as f:
        template = f.read()

    html = chevron.render(template, locals)
    return html


#######################################################################
## Process transactions
#######################################################################


def braintree_sdk_transaction(transactionData):
    try:
        deviceData = transactionData.get("deviceData")
        email = transactionData.get("email")
        name = transactionData.get("name")
        billingAddress = transactionData["paymentToken"]["paymentSource"]["card"][
            "billingAddress"
        ]
        shippingAddress = transactionData.get("shippingAddress", None)

        # Convert information to snake_case for Braintree python gateway.
        saleRequest = {
            "amount": "10.00",
            "payment_method_nonce": transactionData["paymentToken"]["id"],
            "device_data": deviceData,
            "customer": {
                "email": email,
                **(
                    {
                        "first_name": name.get("firstName"),
                        "last_name": name.get("lastName"),
                    }
                    if name
                    else {}
                ),
            },
            "billing": {
                "street_address": billingAddress.get("streetAddress"),
                "extended_address": billingAddress.get("extendedAddress"),
                "locality": billingAddress.get("locality"),
                "region": billingAddress.get("region"),
                "postal_code": billingAddress.get("postalCode"),
                "country_code_alpha2": billingAddress.get("countryCodeAlpha2"),
            },
            "shipping": (
                {
                    "street_address": shippingAddress.get("streetAddress"),
                    "extended_address": shippingAddress.get("extendedAddress"),
                    "locality": shippingAddress.get("locality"),
                    "region": shippingAddress.get("region"),
                    "postal_code": shippingAddress.get("postalCode"),
                    "country_code_alpha2": shippingAddress.get("countryCodeAlpha2"),
                    "shipping_method": "ground",
                }
                if shippingAddress
                else {}
            ),
            "options": {"submit_for_settlement": True},
        }

        result = braintree_gateway().transaction.sale(saleRequest)

        if not result.is_success:
            raise Exception(result.message)

        return jsonify(
            result={
                "success": True,
                "transaction": {
                    "id": result.transaction.id,
                    "status": result.transaction.status,
                    "type": result.transaction.type,
                },
            }
        )
    except Exception as error:
        print(str(error))
        return make_response(jsonify(error=str(error)), 500)


#######################################################################
## Run the server
#######################################################################


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
    return send_from_directory(
        os.path.join(app.root_path, "../../client/html/src"), filename
    )


# Run the server
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
