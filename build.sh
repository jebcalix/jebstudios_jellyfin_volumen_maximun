#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$ROOT/Jellyfin.Plugin.VolumenMaximum"
VERSION="${VERSION:-1.0.0.0}"
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
  "changelog": "Versión inicial: boost de volumen en el cliente web.",
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

# Only ship plugin + third-party deps not provided by Jellyfin host
for f in \
  Jellyfin.Plugin.VolumenMaximum.dll \
  HttpResponseTransformer.dll \
  HtmlAgilityPack.dll \
  System.Xml.XPath.XmlDocument.dll
do
  if [[ -f "$PUBLISH_DIR/$f" ]]; then
    cp "$PUBLISH_DIR/$f" "$STAGE/"
  fi
done

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

entry = {
    "guid": "e9ec64b1-0ce9-44a7-9f80-37e97c823451",
    "name": "Volumen Maximum",
    "description": "Permite subir el volumen del reproductor web por encima del 100% usando Web Audio API.",
    "overview": "Boost de volumen para películas bajas de audio",
    "owner": "jebcalix",
    "category": "General",
    "versions": [
        {
            "version": version,
            "changelog": "Versión inicial: boost de volumen en el cliente web, control OSD y atajos [ ].",
            "targetAbi": "10.11.0.0",
            "sourceUrl": source_url,
            "checksum": checksum,
            "timestamp": timestamp,
        }
    ],
}

manifest_path.write_text(json.dumps([entry], indent=2) + "\n", encoding="utf-8")
print(f"Wrote {manifest_path}")
print(f"Package: {manifest_path.parent / 'dist' / f'jebstudios_jellyfin_volumen_maximun_{version}.zip'}")
print(f"MD5: {checksum}")
PY
