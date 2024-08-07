# frozen_string_literal: true

require 'braintree'

def get_braintree_gateway
  @braintree_gateway ||= Braintree::Gateway.new(
    environment: :sandbox,
    merchant_id: ENV['BRAINTREE_MERCHANT_ID'],
    public_key: ENV['BRAINTREE_PUBLIC_KEY'],
    private_key: ENV['BRAINTREE_PRIVATE_KEY']
  )
end
