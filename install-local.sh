#!/usr/bin/env bash
set -euo pipefail

ZIP="${1:-/home/jairo/Documentos/Proyectos/jellyfin/jebstudios_jellyfin_volumen_maximun/dist/jebstudios_jellyfin_volumen_maximun_1.0.4.0.zip}"
PLUGINS="/var/lib/jellyfin/plugins"
TARGET="$PLUGINS/Volumen Maximum_1.0.4.0"

echo "==> Stopping jellyfin"
systemctl stop jellyfin

echo "==> Removing old Volumen Maximum versions"
rm -rf "$PLUGINS"/Volumen\ Maximum_*

echo "==> Installing $ZIP"
mkdir -p "$TARGET"
unzip -o "$ZIP" -d "$TARGET"
chown -R jellyfin:jellyfin "$TARGET"

echo "==> Starting jellyfin"
systemctl start jellyfin
sleep 6
systemctl is-active jellyfin

echo "==> Loaded version:"
journalctl -u jellyfin --since '30 sec ago' --no-pager | grep -i 'Loaded plugin: Volumen' || true

echo "==> Chunk clean check:"
if curl -s "http://127.0.0.1:8096/web/playback-video-index-html.fb812af814e8c8697a00.chunk.js" | grep -q VolumenMaximum; then
  echo "STILL CORRUPTED"
  exit 1
else
  echo "OK: chunk limpio"
fi

echo "==> index.html injection:"
sleep 5
curl -s http://127.0.0.1:8096/web/index.html | grep -o 'plugin="VolumenMaximum"[^>]*' || echo "(aún no inyectado; espera unos segundos y: curl -s http://127.0.0.1:8096/web/index.html | grep VolumenMaximum)"
