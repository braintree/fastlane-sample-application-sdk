# frozen_string_literal: true

require 'webrick'
require_relative '../lib/gateway'

class ClientTokenServlet < WEBrick::HTTPServlet::AbstractServlet
  def do_GET(_request, response)
    client_token = get_braintree_gateway.client_token.generate

    response.status = 200
    response.content_type = 'application/json'
    response.body = { clientToken: client_token }.to_json
  end
end
