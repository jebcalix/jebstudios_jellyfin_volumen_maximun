using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.VolumenMaximum.Configuration;

/// <summary>
/// Plugin configuration for Volumen Maximum.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Initializes a new instance of the <see cref="PluginConfiguration"/> class.
    /// </summary>
    public PluginConfiguration()
    {
        Enabled = true;
        MaxBoostPercent = 300;
        DefaultBoostPercent = 100;
    }

    /// <summary>
    /// Gets or sets a value indicating whether volume boost is enabled.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Gets or sets the maximum allowed boost percentage (100-500).
    /// </summary>
    public int MaxBoostPercent { get; set; }

    /// <summary>
    /// Gets or sets the default boost percentage when no local preference exists.
    /// </summary>
    public int DefaultBoostPercent { get; set; }
}
