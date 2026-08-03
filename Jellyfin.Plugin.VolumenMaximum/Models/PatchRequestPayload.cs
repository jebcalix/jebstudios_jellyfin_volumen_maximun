using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.VolumenMaximum.Models;

/// <summary>
/// Payload received from the File Transformation plugin.
/// </summary>
public class PatchRequestPayload
{
    /// <summary>
    /// Gets or sets the current file contents.
    /// </summary>
    [JsonPropertyName("contents")]
    public string? Contents { get; set; }
}
