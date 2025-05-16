# frozen_string_literal: true

require 'bundler/setup'
require 'dotenv/load'
require 'webrick'
require 'mustache'
require 'braintree'
require 'json'

Dotenv.load

views_root = File.expand_path '../shared/views'
client_root = File.expand_path '../../client/html/src'

#######################################################################
## Token generation helpers
#######################################################################

def get_braintree_gateway
  @braintree_gateway ||= Braintree::Gateway.new(
    environment: :sandbox,
    merchant_id: ENV['BRAINTREE_MERCHANT_ID'],
    public_key: ENV['BRAINTREE_PUBLIC_KEY'],
    private_key: ENV['BRAINTREE_PRIVATE_KEY']
  )
end

class ClientTokenServlet < WEBrick::HTTPServlet::AbstractServlet
  def do_GET(_request, response)
    client_token = get_braintree_gateway.client_token.generate

    response.status = 200
    response.content_type = 'application/json'
    response.header['Access-Control-Allow-Origin'] = '*'
    response.header['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, DELETE'
    response.body = { clientToken: client_token }.to_json
  end
end

#######################################################################
## Serve checkout page
#######################################################################

class CheckoutServlet < WEBrick::HTTPServlet::AbstractServlet
  def initialize(server, document_root)
    super(server)
    @document_root = document_root
  end

  def do_GET(request, response)
    is_flexible_integration = request.query.key?('flexible')

    data = {
      title: "Fastlane - Braintree SDK Integration#{is_flexible_integration ? ' (Flexible)' : ''}",
      prerequisiteScripts: '
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
        ',
      initScriptPath: is_flexible_integration ? '/public/init-fastlane-flexible.js' : '/public/init-fastlane.js',
      stylesheetPath: '/public/styles.css'
    }

    template_path = File.join(@document_root, is_flexible_integration ? 'checkout-flexible.html' : 'checkout.html')
    template = File.read(template_path)
    rendered_template = Mustache.render(template, data)

    response['Content-Type'] = 'text/html;charset=UTF-8'
    response.body = rendered_template
  end
end

#######################################################################
## Process transactions
#######################################################################

class TransactionServlet < WEBrick::HTTPServlet::AbstractServlet
  def do_POST(request, response)
    data = JSON.parse(request.body)

    email = data['email']
    name = data['name']
    payment_token = data['paymentToken']
    device_data = data['deviceData']

    billing_address = data["paymentToken"]["paymentSource"]["card"]["billingAddress"]

    payload = {
      :amount => "10.00",
      :payment_method_nonce => payment_token['id'],
      :billing => {
        :first_name => billing_address["firstName"],
        :last_name => billing_address["lastName"],
        :company => billing_address["company"],
        :street_address => billing_address["streetAddress"],
        :extended_address => billing_address["extendedAddress"],
        :locality => billing_address["locality"],
        :region => billing_address["region"],
        :postal_code => billing_address["postalCode"],
        :country_code_alpha2 => billing_address["countryCodeAlpha2"]
      },
      :device_data => device_data,
      :options => {
        :submit_for_settlement => true
      }
    }

    if data.key?("shippingAddress") && !data["shippingAddress"].to_s.empty?
      shipping_address = data["shippingAddress"]
      payload[:shipping] = {
        :first_name => shipping_address["firstName"],
        :last_name => shipping_address["lastName"],
        :company => shipping_address["company"],
        :street_address => shipping_address["streetAddress"],
        :extended_address => shipping_address["extendedAddress"],
        :locality => shipping_address["locality"],
        :region => shipping_address["region"],
        :postal_code => shipping_address["postalCode"],
        :country_code_alpha2 => shipping_address["countryCodeAlpha2"],
        :international_phone => {
          :country_code => shipping_address["internationalPhone"]["countryCode"],
          :national_number => shipping_address["internationalPhone"]["nationalNumber"]
        },
        :shipping_method => "ground"
      }
    end

    result = get_braintree_gateway.transaction.sale(payload)

    response.status = 201
    response.content_type = 'application/json'
    response.header['Access-Control-Allow-Origin'] = '*'
    response.header['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, DELETE'

    response.body = (result.success? ?
      { result: { success: result.success?, transaction: { id: result.transaction.id } } } :
      { result: { success: false, message: result.message } }).to_json
  end

  def do_OPTIONS(request, response)
    response.header['Access-Control-Allow-Origin'] = '*'
    response.header['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, DELETE'
    response.header['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
  end
end

#######################################################################
## Run the server
#######################################################################

server = WEBrick::HTTPServer.new Port: ENV['PORT'] || 8080, DocumentRoot: views_root

trap 'INT' do server.shutdown end

server.mount '/public', WEBrick::HTTPServlet::FileHandler, client_root
server.mount '/', CheckoutServlet, views_root
server.mount '/client-token', ClientTokenServlet
server.mount '/transaction', TransactionServlet

server.start
