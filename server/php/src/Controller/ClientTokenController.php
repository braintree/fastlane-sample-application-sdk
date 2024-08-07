<?php

namespace App\Controller;

use BraintreeGateway;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;

class ClientTokenController extends AbstractController
{
    public function getClientToken()
    {
        $gateway = BraintreeGateway::getGateway();

        $clientToken = $gateway->clientToken()->generate();

        return new JsonResponse(["clientToken" => $clientToken]);
    }
}
