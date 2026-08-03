using System.Reflection;
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
            DefaultBoostPercent = Clamp(config.DefaultBoostPercent, 100, 500)
        });
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
}
