using System.Globalization;
using HarmonyLib;
using Jellyfin.Plugin.VolumenMaximum.Services;
using MediaBrowser.Controller.MediaEncoding;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.VolumenMaximum.Patches;

/// <summary>
/// Harmony patches that apply server-side ffmpeg volume boost for TV/webOS clients.
/// </summary>
public static class EncodingBoostPatches
{
    private static bool _applied;
    private static ILogger? _logger;

    /// <summary>
    /// Applies Harmony patches once.
    /// </summary>
    /// <param name="logger">Logger.</param>
    public static void Apply(ILogger logger)
    {
        if (_applied)
        {
            return;
        }

        _logger = logger;

        try
        {
            var harmony = new Harmony("Jellyfin.Plugin.VolumenMaximum.EncodingBoost");
            harmony.PatchAll(typeof(EncodingBoostPatches).Assembly);
            _applied = true;
            logger.LogInformation("[VolumenMaximum] Parches ffmpeg (boost en servidor) aplicados.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[VolumenMaximum] No se pudieron aplicar los parches de boost en servidor.");
        }
    }

    /// <summary>
    /// Forces audio re-encode when a device has boost &gt; 100%.
    /// </summary>
    [HarmonyPatch(typeof(EncodingHelper), nameof(EncodingHelper.CanStreamCopyAudio))]
    public static class CanStreamCopyAudioPatch
    {
        /// <summary>
        /// Prefix: deny audio stream copy when boost is active for the device.
        /// </summary>
        /// <param name="state">Encoding job.</param>
        /// <param name="__result">Forced result.</param>
        /// <returns>False to skip original when forcing transcode.</returns>
        public static bool Prefix(EncodingJobInfo state, ref bool __result)
        {
            if (BoostSessionStore.TryGetActiveBoost(state?.BaseRequest?.DeviceId, out _))
            {
                __result = false;
                return false;
            }

            return true;
        }
    }

    /// <summary>
    /// Injects ffmpeg <c>volume=</c> when boost is active.
    /// </summary>
    [HarmonyPatch(typeof(EncodingHelper), nameof(EncodingHelper.GetAudioFilterParam))]
    public static class GetAudioFilterParamPatch
    {
        /// <summary>
        /// Postfix: append volume filter for the requesting device.
        /// </summary>
        /// <param name="state">Encoding job.</param>
        /// <param name="__result">Audio filter argument string.</param>
        public static void Postfix(EncodingJobInfo state, ref string __result)
        {
            if (!BoostSessionStore.TryGetActiveBoost(state?.BaseRequest?.DeviceId, out var boostPercent))
            {
                return;
            }

            var volume = (boostPercent / 100d).ToString("0.###", CultureInfo.InvariantCulture);
            var filter = "volume=" + volume;
            __result ??= string.Empty;

            if (string.IsNullOrWhiteSpace(__result))
            {
                __result = " -af \"" + filter + "\"";
                _logger?.LogDebug("[VolumenMaximum] Añadido {Filter} para device {DeviceId}", filter, state?.BaseRequest?.DeviceId);
                return;
            }

            // Typical form:  -af "existing,filters"
            var closing = __result.LastIndexOf('"');
            if (closing > 0)
            {
                __result = __result.Insert(closing, "," + filter);
            }
            else
            {
                __result += " -af \"" + filter + "\"";
            }

            _logger?.LogDebug("[VolumenMaximum] Inyectado {Filter} en -af para device {DeviceId}", filter, state?.BaseRequest?.DeviceId);
        }
    }

    /// <summary>
    /// Ensures progressive video audio path never returns early with copy when boost is on.
    /// </summary>
    [HarmonyPatch(typeof(EncodingHelper), nameof(EncodingHelper.GetProgressiveVideoAudioArguments))]
    public static class GetProgressiveVideoAudioArgumentsPatch
    {
        /// <summary>
        /// Prefix: force AAC output codec when boost is active.
        /// </summary>
        /// <param name="state">Encoding job.</param>
        public static void Prefix(EncodingJobInfo state)
        {
            if (state?.BaseRequest is null)
            {
                return;
            }

            if (!BoostSessionStore.TryGetActiveBoost(state.BaseRequest.DeviceId, out _))
            {
                return;
            }

            state.BaseRequest.AllowAudioStreamCopy = false;

            if (string.IsNullOrWhiteSpace(state.OutputAudioCodec)
                || string.Equals(state.OutputAudioCodec, "copy", StringComparison.OrdinalIgnoreCase))
            {
                state.OutputAudioCodec = "aac";
            }
        }
    }
}
