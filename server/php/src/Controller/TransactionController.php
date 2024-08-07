<?php

namespace App\Controller;

use BraintreeGateway;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

class TransactionController extends AbstractController
{
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
