using System.Reflection;
using System.Text.RegularExpressions;
using Jellyfin.Plugin.VolumenMaximum.Models;
using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Configuration;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.VolumenMaximum.Helpers;

/// <summary>
/// Injects the Volumen Maximum client script into index.html.
/// </summary>
public static class IndexHtmlInjector
{
    private const string ScriptMarker = "plugin=\"VolumenMaximum\"";
    private static readonly Regex ExistingScriptRegex = new(
        "<script[^>]*plugin=[\"']VolumenMaximum[\"'][^>]*>\\s*</script>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>
    /// File Transformation callback.
    /// </summary>
    /// <param name="payload">Current HTML contents.</param>
    /// <returns>Patched HTML.</returns>
    public static string FileTransformer(PatchRequestPayload payload)
    {
        string indexContents = payload.Contents ?? string.Empty;
        if (string.IsNullOrEmpty(indexContents))
        {
            return indexContents;
        }

        string scriptElement = GetScriptElement();
        indexContents = ExistingScriptRegex.Replace(indexContents, string.Empty);

        if (indexContents.Contains(ScriptMarker, StringComparison.Ordinal))
        {
            return indexContents;
        }

        int bodyClosing = indexContents.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
        if (bodyClosing == -1)
        {
            return indexContents + scriptElement;
        }

        return indexContents.Insert(bodyClosing, scriptElement);
    }

    /// <summary>
    /// Fallback: write the script tag directly into index.html on disk.
    /// </summary>
    /// <param name="logger">Logger.</param>
    public static void Direct(ILogger logger)
    {
        var plugin = Plugin.Instance;
        if (plugin?.ApplicationPaths is null || string.IsNullOrWhiteSpace(plugin.ApplicationPaths.WebPath))
        {
            return;
        }

        string indexFile = Path.Combine(plugin.ApplicationPaths.WebPath, "index.html");
        if (!File.Exists(indexFile))
        {
            return;
        }

        string indexContents = File.ReadAllText(indexFile);
        string scriptElement = GetScriptElement();
        if (indexContents.Contains(ScriptMarker, StringComparison.Ordinal))
        {
            return;
        }

        indexContents = ExistingScriptRegex.Replace(indexContents, string.Empty);
        int bodyClosing = indexContents.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
        if (bodyClosing == -1)
        {
            logger.LogWarning("[VolumenMaximum] No se encontró </body> en {IndexFile}", indexFile);
            return;
        }

        indexContents = indexContents.Insert(bodyClosing, scriptElement);
        try
        {
            File.WriteAllText(indexFile, indexContents);
            logger.LogInformation("[VolumenMaximum] Script inyectado directamente en {IndexFile}", indexFile);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[VolumenMaximum] No se pudo escribir {IndexFile}", indexFile);
        }
    }

    private static string GetScriptElement()
    {
        string basePath = string.Empty;
        try
        {
            IServerConfigurationManager? configManager = Plugin.Instance?.ServerConfigurationManager;
            if (configManager is not null)
            {
                NetworkConfiguration networkConfiguration = configManager.GetNetworkConfiguration();
                string? confBasePath = networkConfiguration.BaseUrl?.Trim('/');
                if (!string.IsNullOrEmpty(confBasePath))
                {
                    basePath = "/" + confBasePath;
                }
            }
        }
        catch
        {
            basePath = string.Empty;
        }

        string versionTag = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0.0";
        return $"<script plugin=\"VolumenMaximum\" version=\"{versionTag}\" src=\"{basePath}/VolumenMaximum/ClientScript\" defer></script>";
    }
}
