<?php

namespace App\Controller;

use Mustache_Engine;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Braintree\Gateway;

class ServerController extends AbstractController
{
    private $mustache;

    public function __construct()
    {
        $this->mustache = new Mustache_Engine(["entity_flags" => ENT_QUOTES]);
    }

    /* ######################################################################
     * Token generation helpers
     * ###################################################################### */

    public function getClientToken()
    {
        $gateway = BraintreeGateway::getGateway();

        $clientToken = $gateway->clientToken()->generate();

        return new JsonResponse(["clientToken" => $clientToken]);
    }

    /* ######################################################################
     * Serve checkout page
     * ###################################################################### */

    public function index(Request $request)
    {
        $isFlexibleIntegration = $request->query->get("flexible", false);

        $locals = [
            "title" =>
                "Fastlane - Braintree SDK Integration" .
                ($isFlexibleIntegration ? " (Flexible)" : ""),
            "prerequisiteScripts" => '
                <script
                    src="https://js.braintreegateway.com/web/3.106.0/js/client.min.js"
                    defer
                ></script>
                <script
                    src="https://js.braintreegateway.com/web/3.106.0/js/data-collector.min.js"
                    defer
                ></script>
                <script
                    src="https://js.braintreegateway.com/web/3.106.0/js/fastlane.min.js"
                    defer
                ></script>
            ',
            "initScriptPath" => $isFlexibleIntegration
                ? "init-fastlane-flexible.js"
                : "init-fastlane.js",
            "stylesheetPath" => "styles.css",
        ];

        $htmlTemplate = file_get_contents(
            __DIR__ .
                "/../../../shared/views/" .
                ($isFlexibleIntegration
                    ? "checkout-flexible.html"
                    : "checkout.html")
        );

        $template = $this->mustache->render($htmlTemplate, $locals);

        return new Response($template);
    }

    /* ######################################################################
     * Process transactions
     * ###################################################################### */

    public function createTransaction(Request $request)
    {
        $data = $request->toArray();

        $gateway = BraintreeGateway::getGateway();

        $result = $gateway->transaction()->sale([
            "amount" => "10.00",
            "paymentMethodNonce" => $data["paymentToken"]["id"],
            "deviceData" => $data["deviceData"],
            "options" => [
                "submitForSettlement" => true,
            ],
        ]);

        return new JsonResponse(["result" => $result]);
    }
}

class BraintreeGateway
{
    private static $gateway = null;

    public static function getGateway()
    {
        if (self::$gateway === null) {
            self::$gateway = new Gateway([
                "environment" => "sandbox",
                "merchantId" => Env::get("BRAINTREE_MERCHANT_ID"),
                "publicKey" => Env::get("BRAINTREE_PUBLIC_KEY"),
                "privateKey" => Env::get("BRAINTREE_PRIVATE_KEY"),
            ]);
        }

        return self::$gateway;
    }
}

class Env
{
    static function get(string $key): string|null
    {
        return $_ENV[$key] ?? null;
    }
}
