using System.Reflection;
using Jellyfin.Plugin.VolumenMaximum.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.VolumenMaximum.Api;

/// <summary>
/// API endpoints for Volumen Maximum.
/// </summary>
[ApiController]
[Route("VolumenMaximum")]
public class VolumenMaximumController : ControllerBase
{
    private const string DeviceIdClaim = "Jellyfin-DeviceId";
    private const string UserIdClaim = "Jellyfin-UserId";

    private readonly Assembly _assembly = typeof(Plugin).Assembly;
    private readonly string _scriptResourcePath = $"{typeof(Plugin).Namespace}.Web.volumenmaximum.js";

    /// <summary>
    /// Gets the embedded client script.
    /// </summary>
    /// <returns>JavaScript payload.</returns>
    [HttpGet("ClientScript")]
    [AllowAnonymous]
    [Produces("application/javascript")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult GetClientScript()
    {
        Stream? scriptStream = _assembly.GetManifestResourceStream(_scriptResourcePath);
        if (scriptStream is null)
        {
            return NotFound();
        }

        return File(scriptStream, "application/javascript");
    }

    /// <summary>
    /// Gets the current plugin configuration for the web client.
    /// </summary>
    /// <returns>Client-facing configuration.</returns>
    [HttpGet("Configuration")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public ActionResult<ClientConfigurationDto> GetConfiguration()
    {
        var plugin = Plugin.Instance;
        if (plugin is null)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        var config = plugin.Configuration;
        return Ok(new ClientConfigurationDto
        {
            Enabled = config.Enabled,
            MaxBoostPercent = Clamp(config.MaxBoostPercent, 100, 500),
            DefaultBoostPercent = Clamp(config.DefaultBoostPercent, 100, 500),
            ServerBoostAvailable = true
        });
    }

    /// <summary>
    /// Gets the boost currently registered for this device (server-side path).
    /// </summary>
    /// <returns>Boost state.</returns>
    [HttpGet("Boost")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public ActionResult<BoostDto> GetBoost()
    {
        var deviceId = ResolveDeviceId();
        if (string.IsNullOrWhiteSpace(deviceId))
        {
            return BadRequest(new { Message = "DeviceId no disponible en la sesión." });
        }

        var userId = User.FindFirst(UserIdClaim)?.Value;
        return Ok(new BoostDto
        {
            DeviceId = deviceId,
            BoostPercent = BoostSessionStore.Get(deviceId, userId),
            Mode = "server"
        });
    }

    /// <summary>
    /// Registers boost for this device so ffmpeg can apply volume on TV clients.
    /// </summary>
    /// <param name="request">Boost payload.</param>
    /// <returns>Stored boost.</returns>
    [HttpPut("Boost")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public ActionResult<BoostDto> PutBoost([FromBody] BoostRequest request)
    {
        var plugin = Plugin.Instance;
        if (plugin is null)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        var deviceId = ResolveDeviceId();
        if (string.IsNullOrWhiteSpace(deviceId))
        {
            return BadRequest(new { Message = "DeviceId no disponible en la sesión." });
        }

        var max = Clamp(plugin.Configuration.MaxBoostPercent, 100, 500);
        var boost = Clamp(request.BoostPercent, 100, max);
        var userId = User.FindFirst(UserIdClaim)?.Value;
        BoostSessionStore.Set(deviceId, boost, userId);

        return Ok(new BoostDto
        {
            DeviceId = deviceId,
            BoostPercent = boost,
            Mode = "server"
        });
    }

    private string? ResolveDeviceId()
    {
        var fromClaim = User.FindFirst(DeviceIdClaim)?.Value;
        if (!string.IsNullOrWhiteSpace(fromClaim))
        {
            return fromClaim;
        }

        // Fallback: parse Emby/Jellyfin auth header
        if (Request.Headers.TryGetValue("X-Emby-Authorization", out var values)
            || Request.Headers.TryGetValue("Authorization", out values))
        {
            var header = values.ToString();
            const string marker = "DeviceId=\"";
            var idx = header.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (idx >= 0)
            {
                var start = idx + marker.Length;
                var end = header.IndexOf('"', start);
                if (end > start)
                {
                    return header[start..end];
                }
            }
        }

        return null;
    }

    private static int Clamp(int value, int min, int max)
    {
        if (value < min)
        {
            return min;
        }

        if (value > max)
        {
            return max;
        }

        return value;
    }
}

/// <summary>
/// Client-facing configuration DTO.
/// </summary>
public class ClientConfigurationDto
{
    /// <summary>
    /// Gets or sets a value indicating whether boost is enabled.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Gets or sets the maximum boost percent.
    /// </summary>
    public int MaxBoostPercent { get; set; }

    /// <summary>
    /// Gets or sets the default boost percent.
    /// </summary>
    public int DefaultBoostPercent { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether server-side boost is available.
    /// </summary>
    public bool ServerBoostAvailable { get; set; }
}

/// <summary>
/// Boost update request.
/// </summary>
public class BoostRequest
{
    /// <summary>
    /// Gets or sets the desired boost percent.
    /// </summary>
    public int BoostPercent { get; set; } = 100;
}

/// <summary>
/// Boost state response.
/// </summary>
public class BoostDto
{
    /// <summary>
    /// Gets or sets the device id.
    /// </summary>
    public string DeviceId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the boost percent.
    /// </summary>
    public int BoostPercent { get; set; }

    /// <summary>
    /// Gets or sets the boost mode label.
    /// </summary>
    public string Mode { get; set; } = "server";
}
