using HttpResponseTransformer;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.VolumenMaximum;

/// <summary>
/// Registers HTTP response transforms to inject the client script without modifying index.html on disk.
/// </summary>
public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    /// <inheritdoc />
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddResponseTransformer(builder => builder
            .TransformDocument(document => document
                .When(IsWebIndexRequest)
                .InjectScript(script => script
                    .FromEmbeddedResource(
                        "Jellyfin.Plugin.VolumenMaximum.Web.volumenmaximum.js",
                        typeof(PluginServiceRegistrator).Assembly)
                    .AsDeferred())));
    }

    private static bool IsWebIndexRequest(Microsoft.AspNetCore.Http.HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;
        if (path.Equals("/web", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/web/", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return path.EndsWith("/web/index.html", StringComparison.OrdinalIgnoreCase)
               || path.EndsWith("index.html", StringComparison.OrdinalIgnoreCase)
                  && path.Contains("/web", StringComparison.OrdinalIgnoreCase);
    }
}
