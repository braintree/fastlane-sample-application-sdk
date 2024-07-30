using System.Text;
using Microsoft.AspNetCore.Mvc;

public class RenderController : Controller
{
    private readonly TemplatePathResolver _templatePathResolver;

    public RenderController(TemplatePathResolver templatePathResolver)
    {
        _templatePathResolver = templatePathResolver;
    }

    [HttpGet("/")]
    public async Task<IActionResult> SdkRender()
    {
        var isFlexibleIntegration = false;
        var queryParams = HttpContext.Request.Query;

        foreach (var param in queryParams)
        {
            if (param.Key == "flexible") {
                isFlexibleIntegration = true;
            }
        }

        var locals = new Dictionary<string, string>
        {
            { "title", "Fastlane - Braintree SDK Integration" + (isFlexibleIntegration ? " (Flexible)" : "") },
            { "prerequisiteScripts", @"
                <script
                    src=""https://js.braintreegateway.com/web/3.104.0/js/client.min.js""
                    defer
                ></script>
                <script
                    src=""https://js.braintreegateway.com/web/3.104.0/js/data-collector.min.js""
                    defer
                ></script>
                <script
                    src=""https://js.braintreegateway.com/web/3.104.0/js/fastlane.min.js""
                    defer
                ></script>
            " },
            { "initScriptPath", isFlexibleIntegration ? "init-fastlane-flexible.js" : "init-fastlane.js" },
            { "stylesheetPath", "styles.css" }
        };

        var renderedHtml = await _templatePathResolver.RenderTemplateAsync(isFlexibleIntegration, locals);

        return Content(renderedHtml, "text/html", Encoding.UTF8);
    }
}
