# frozen_string_literal: true

require 'webrick'
require 'json'
require_relative '../lib/gateway'

class TransactionServlet < WEBrick::HTTPServlet::AbstractServlet
  def do_POST(request, response)
    data = JSON.parse(request.body)

    email = data['email']
    name = data['name']
    shipping_address = data['shippingAddress']
    payment_token = data['paymentToken']
    device_data = data['deviceData']

    result = get_braintree_gateway.transaction.sale(
      :amount => "10.00",
      :payment_method_nonce => payment_token['id'],
      :device_data => device_data,
      :options => {
        :submit_for_settlement => true
      }
    )

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
