using System.Text.Json.Serialization;
using Newtonsoft.Json;

namespace Jellyfin.Plugin.VolumenMaximum.Models;

/// <summary>
/// Payload received from the File Transformation plugin.
/// </summary>
public class PatchRequestPayload
{
    /// <summary>
    /// Gets or sets the current file contents.
    /// </summary>
    [JsonProperty("contents")]
    [JsonPropertyName("contents")]
    public string? Contents { get; set; }
}
