using System.Globalization;
using Jellyfin.Plugin.VolumenMaximum.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.VolumenMaximum;

/// <summary>
/// Jellyfin plugin that allows boosting web player volume above 100%.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    /// <summary>
    /// Plugin GUID.
    /// </summary>
    public static readonly Guid PluginGuid = Guid.Parse("e9ec64b1-0ce9-44a7-9f80-37e97c823451");

    /// <summary>
    /// Initializes a new instance of the <see cref="Plugin"/> class.
    /// </summary>
    /// <param name="applicationPaths">Application paths.</param>
    /// <param name="xmlSerializer">XML serializer.</param>
    /// <param name="configurationManager">Server configuration manager.</param>
    public Plugin(
        IApplicationPaths applicationPaths,
        IXmlSerializer xmlSerializer,
        IServerConfigurationManager configurationManager)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
        ServerConfigurationManager = configurationManager;
        WebPath = applicationPaths.WebPath;
    }

    /// <inheritdoc />
    public override string Name => "Volumen Maximum";

    /// <inheritdoc />
    public override string Description =>
        "Permite subir el volumen del reproductor web por encima del 100% para películas con audio bajo.";

    /// <inheritdoc />
    public override Guid Id => PluginGuid;

    /// <summary>
    /// Gets the current plugin instance.
    /// </summary>
    public static Plugin? Instance { get; private set; }

    /// <summary>
    /// Gets the server configuration manager.
    /// </summary>
    public IServerConfigurationManager ServerConfigurationManager { get; }

    /// <summary>
    /// Gets the jellyfin-web path.
    /// </summary>
    public string WebPath { get; }

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages()
    {
        return
        [
            new PluginPageInfo
            {
                Name = Name,
                EmbeddedResourcePath = string.Format(
                    CultureInfo.InvariantCulture,
                    "{0}.Configuration.configPage.html",
                    GetType().Namespace)
            }
        ];
    }
}
