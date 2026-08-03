using System.Reflection;
using System.Runtime.Loader;
using Jellyfin.Plugin.VolumenMaximum.Helpers;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.VolumenMaximum.Services;

/// <summary>
/// Registers the index.html transformation at server startup.
/// </summary>
public class StartupService : IScheduledTask
{
    private readonly ILogger<StartupService> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="StartupService"/> class.
    /// </summary>
    /// <param name="logger">Logger.</param>
    public StartupService(ILogger<StartupService> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public string Name => "Volumen Maximum Startup";

    /// <inheritdoc />
    public string Key => "Jellyfin.Plugin.VolumenMaximum.Startup";

    /// <inheritdoc />
    public string Description => "Registra la inyección del script de Volumen Maximum.";

    /// <inheritdoc />
    public string Category => "Startup Services";

    /// <inheritdoc />
    public Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        JObject payload = new()
        {
            // Must be anchored: "index.html" as regex also matches
            // playback-video-index-html.*.chunk.js and corrupts the player.
            { "id", "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
            { "fileNamePattern", "^index\\.html$" },
            { "callbackAssembly", GetType().Assembly.FullName },
            { "callbackClass", typeof(IndexHtmlInjector).FullName },
            { "callbackMethod", nameof(IndexHtmlInjector.FileTransformer) }
        };

        Assembly? fileTransformationAssembly = AssemblyLoadContext.All
            .SelectMany(static x => x.Assemblies)
            .FirstOrDefault(static x => x.FullName?.Contains(".FileTransformation", StringComparison.Ordinal) == true);

        if (fileTransformationAssembly is null)
        {
            _logger.LogWarning("[VolumenMaximum] File Transformation no está disponible. Intentando inyección directa.");
            IndexHtmlInjector.Direct(_logger);
            return Task.CompletedTask;
        }

        Type? pluginInterfaceType = fileTransformationAssembly.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
        if (pluginInterfaceType is null)
        {
            _logger.LogWarning("[VolumenMaximum] PluginInterface de File Transformation no encontrado. Intentando inyección directa.");
            IndexHtmlInjector.Direct(_logger);
            return Task.CompletedTask;
        }

        _logger.LogInformation("[VolumenMaximum] Registrando transformación con File Transformation.");
        pluginInterfaceType.GetMethod("RegisterTransformation")?.Invoke(null, [payload]);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
    {
        yield return new TaskTriggerInfo
        {
            Type = TaskTriggerInfoType.StartupTrigger
        };
    }
}
