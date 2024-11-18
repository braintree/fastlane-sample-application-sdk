using Braintree;
using System.Text;
using Microsoft.AspNetCore.Mvc;

namespace dotnet.Controllers
{
    [ApiController]
    public class ServerController(BraintreeGateway _braintreeGateway, TemplatePathResolver _templatePathResolver) : Controller
    {

       /* ######################################################################
        * Token generation helpers
        * ###################################################################### */

        [HttpGet("client-token")]
        public IActionResult Get()
        {
            try
            {
                var clientToken = _braintreeGateway.ClientToken.Generate(new ClientTokenRequest());
                return Ok(new { clientToken });
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex);
                return StatusCode(500, new { error = ex.Message });
            }
        }

       /* ######################################################################
        * Serve checkout page
        * ###################################################################### */

        [HttpGet("/")]
        public async Task<IActionResult> SdkRender()
        {
            var isFlexibleIntegration = false;
            var queryParams = HttpContext.Request.Query;

            foreach (var param in queryParams)
            {
                if (param.Key == "flexible")
                {
                    isFlexibleIntegration = true;
                }
            }

            var locals = new Dictionary<string, string>
        {
            { "title", "Fastlane - Braintree SDK Integration" + (isFlexibleIntegration ? " (Flexible)" : "") },
            { "prerequisiteScripts", @"
                <script
                    src=""https://js.braintreegateway.com/web/3.106.0/js/client.min.js""
                    defer
                ></script>
                <script
                    src=""https://js.braintreegateway.com/web/3.106.0/js/data-collector.min.js""
                    defer
                ></script>
                <script
                    src=""https://js.braintreegateway.com/web/3.106.0/js/fastlane.min.js""
                    defer
                ></script>
            " },
            { "initScriptPath", isFlexibleIntegration ? "init-fastlane-flexible.js" : "init-fastlane.js" },
            { "stylesheetPath", "styles.css" }
        };

            var renderedHtml = await _templatePathResolver.RenderTemplateAsync(isFlexibleIntegration, locals);

            return Content(renderedHtml, "text/html", Encoding.UTF8);
        }

       /* ######################################################################
        * Process transactions
        * ###################################################################### */

        [HttpPost("transaction")]
        public IActionResult Post([FromBody] TransactionRequestModel requestBody)
        {
            try
            {
                var transactionRequest = new TransactionRequest
                {
                    Amount = 10.00M,
                    PaymentMethodNonce = requestBody.PaymentToken.Id,
                    DeviceData = requestBody.DeviceData,
                    Customer = new CustomerRequest
                    {
                        FirstName = requestBody.Name?.FirstName,
                        LastName = requestBody.Name?.LastName,
                        Email = requestBody.Email
                    },
                    BillingAddress = requestBody.PaymentToken.BillingAddress,
                    ShippingAddress = requestBody.ShippingAddress != null ? requestBody.ShippingAddress : null,
                    Options = new TransactionOptionsRequest
                    {
                        SubmitForSettlement = true
                    }
                };

                Result<Transaction> result = _braintreeGateway.Transaction.Sale(transactionRequest);

                if (!result.IsSuccess())
                {
                    var firstError = result.Errors.DeepAll().FirstOrDefault();
                    throw new Exception($"Code: {firstError.Code}, Message: {firstError.Message}");
                }

                var response = new
                {
                    transaction = result.Target,
                    success = result.IsSuccess()
                };

                return Ok(new { result = response });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(ex);
                return StatusCode(500, new { error = ex.Message });
            }
        }

       /* ######################################################################
        * Models
        * ###################################################################### */

        public class Name
        {
            public string? FirstName { get; set; }
            public string? LastName { get; set; }
        }
        public class PaymentToken
        {
            public string? Id { get; set; }
            public AddressRequest? BillingAddress { get; set; }
        }
        public class TransactionRequestModel
        {
            public required string DeviceData { get; set; }
            public required string Email { get; set; }
            public Name? Name { get; set; }
            public required PaymentToken PaymentToken { get; set; }
            public AddressRequest? ShippingAddress { get; set; }
        }
    }
}