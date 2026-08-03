#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$ROOT/Jellyfin.Plugin.VolumenMaximum"
VERSION="${VERSION:-1.0.3.0}"
OUT_DIR="$ROOT/dist"
PUBLISH_DIR="$PROJECT/bin/publish"
ZIP_NAME="jebstudios_jellyfin_volumen_maximun_${VERSION}.zip"

export PATH="${HOME}/.dotnet:${PATH:-}"
export DOTNET_ROOT="${HOME}/.dotnet"

echo "==> Publishing plugin ${VERSION}"
rm -rf "$PUBLISH_DIR"
dotnet publish "$PROJECT/Jellyfin.Plugin.VolumenMaximum.csproj" -c Release -o "$PUBLISH_DIR" \
  -p:Version="$VERSION" -p:AssemblyVersion="$VERSION" -p:FileVersion="$VERSION"

mkdir -p "$OUT_DIR"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cat > "$STAGE/meta.json" <<EOF
{
  "category": "General",
  "changelog": "Evita corromper playback-video-index-html chunk (regex index.html demasiado amplio).",
  "description": "Permite subir el volumen del reproductor web por encima del 100% usando Web Audio API.",
  "guid": "e9ec64b1-0ce9-44a7-9f80-37e97c823451",
  "name": "Volumen Maximum",
  "overview": "Boost de volumen para películas bajas de audio",
  "owner": "jebcalix",
  "targetAbi": "10.11.0.0",
  "timestamp": "${TIMESTAMP}",
  "version": "${VERSION}"
}
EOF

cp "$PUBLISH_DIR/Jellyfin.Plugin.VolumenMaximum.dll" "$STAGE/"

(
  cd "$STAGE"
  zip -qr "$OUT_DIR/$ZIP_NAME" .
)

CHECKSUM="$(md5sum "$OUT_DIR/$ZIP_NAME" | awk '{print toupper($1)}')"
echo "$CHECKSUM" > "$OUT_DIR/${ZIP_NAME}.md5"

SOURCE_URL="https://github.com/jebcalix/jebstudios_jellyfin_volumen_maximun/releases/download/v${VERSION}/${ZIP_NAME}"
MANIFEST_TS="$(date -u +"%Y-%m-%dT%H:%M:%S")"

python3 - "$ROOT/manifest.json" "$VERSION" "$SOURCE_URL" "$CHECKSUM" "$MANIFEST_TS" <<'PY'
import json
import sys
from pathlib import Path

manifest_path = Path(sys.argv[1])
version, source_url, checksum, timestamp = sys.argv[2:6]

# Preserve older versions if present
existing = []
if manifest_path.exists():
    try:
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        existing = []

versions = [
    {
        "version": version,
            "changelog": "Fix: no inyectar en chunks JS (playback-video-index-html). Solo index.html real.",
        "targetAbi": "10.11.0.0",
        "sourceUrl": source_url,
        "checksum": checksum,
        "timestamp": timestamp,
    }
]

if existing and isinstance(existing, list) and existing:
    for v in existing[0].get("versions", []):
        if v.get("version") != version:
            versions.append(v)

entry = {
    "guid": "e9ec64b1-0ce9-44a7-9f80-37e97c823451",
    "name": "Volumen Maximum",
    "description": "Permite subir el volumen del reproductor web por encima del 100% usando Web Audio API.",
    "overview": "Boost de volumen para películas bajas de audio",
    "owner": "jebcalix",
    "category": "General",
    "versions": versions,
}

manifest_path.write_text(json.dumps([entry], indent=2) + "\n", encoding="utf-8")
print(f"Wrote {manifest_path}")
print(f"Package: {manifest_path.parent / 'dist' / f'jebstudios_jellyfin_volumen_maximun_{version}.zip'}")
print(f"MD5: {checksum}")
PY
