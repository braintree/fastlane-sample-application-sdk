<?php

class BraintreeGateway
{
    private static $gateway = null;

    public static function getGateway()
    {
        if (self::$gateway === null) {
            self::$gateway = new Braintree\Gateway([
                "environment" => "sandbox",
                "merchantId" => Env::get("BRAINTREE_MERCHANT_ID"),
                "publicKey" => Env::get("BRAINTREE_PUBLIC_KEY"),
                "privateKey" => Env::get("BRAINTREE_PRIVATE_KEY"),
            ]);
        }

        return self::$gateway;
    }
}
