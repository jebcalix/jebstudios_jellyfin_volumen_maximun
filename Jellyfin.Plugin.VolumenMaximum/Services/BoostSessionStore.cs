using System.Collections.Concurrent;

namespace Jellyfin.Plugin.VolumenMaximum.Services;

/// <summary>
/// In-memory boost levels keyed by Jellyfin device id (and optional user id).
/// Used so server-side ffmpeg can apply gain on clients without Web Audio (e.g. LG webOS).
/// </summary>
public static class BoostSessionStore
{
    private static readonly ConcurrentDictionary<string, int> BoostByDevice = new(StringComparer.OrdinalIgnoreCase);
    private static readonly ConcurrentDictionary<string, int> BoostByUserDevice = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Sets the boost percent for a device (and optional user).
    /// </summary>
    /// <param name="deviceId">Client device id.</param>
    /// <param name="boostPercent">Boost percent (100 = no boost).</param>
    /// <param name="userId">Optional user id.</param>
    public static void Set(string? deviceId, int boostPercent, string? userId = null)
    {
        if (string.IsNullOrWhiteSpace(deviceId))
        {
            return;
        }

        var clamped = Clamp(boostPercent, 100, 500);
        BoostByDevice[deviceId] = clamped;

        if (!string.IsNullOrWhiteSpace(userId))
        {
            BoostByUserDevice[UserDeviceKey(userId, deviceId)] = clamped;
        }
    }

    /// <summary>
    /// Tries to resolve the active boost for an encoding job device.
    /// </summary>
    /// <param name="deviceId">Encoding request device id.</param>
    /// <param name="boostPercent">Resolved boost percent.</param>
    /// <returns>True when a boost above 100% is registered.</returns>
    public static bool TryGetActiveBoost(string? deviceId, out int boostPercent)
    {
        boostPercent = 100;
        if (string.IsNullOrWhiteSpace(deviceId))
        {
            return false;
        }

        if (BoostByDevice.TryGetValue(deviceId, out var value))
        {
            boostPercent = value;
            return value > 100;
        }

        return false;
    }

    /// <summary>
    /// Gets the stored boost for a device (defaults to 100).
    /// </summary>
    /// <param name="deviceId">Client device id.</param>
    /// <param name="userId">Optional user id.</param>
    /// <returns>Boost percent.</returns>
    public static int Get(string? deviceId, string? userId = null)
    {
        if (!string.IsNullOrWhiteSpace(userId) && !string.IsNullOrWhiteSpace(deviceId)
            && BoostByUserDevice.TryGetValue(UserDeviceKey(userId, deviceId), out var byUser))
        {
            return byUser;
        }

        if (!string.IsNullOrWhiteSpace(deviceId) && BoostByDevice.TryGetValue(deviceId, out var byDevice))
        {
            return byDevice;
        }

        return 100;
    }

    private static string UserDeviceKey(string userId, string deviceId)
        => userId + "|" + deviceId;

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
