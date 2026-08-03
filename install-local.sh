#!/usr/bin/env bash
set -euo pipefail

ZIP="${1:-/home/jairo/Documentos/Proyectos/jellyfin/jebstudios_jellyfin_volumen_maximun/dist/jebstudios_jellyfin_volumen_maximun_1.0.6.0.zip}"
PLUGINS="/var/lib/jellyfin/plugins"
TARGET="$PLUGINS/Volumen Maximum_1.0.6.0"

if [[ ! -f "$ZIP" ]]; then
  echo "No existe: $ZIP" >&2
  exit 1
fi

echo "==> Stopping jellyfin"
systemctl stop jellyfin

echo "==> Removing old Volumen Maximum versions"
rm -rf "$PLUGINS"/Volumen\ Maximum_*

echo "==> Installing $ZIP -> $TARGET"
mkdir -p "$TARGET"
unzip -o "$ZIP" -d "$TARGET"
chown -R jellyfin:jellyfin "$TARGET"
ls -la "$TARGET"

echo "==> Starting jellyfin"
systemctl start jellyfin
sleep 8
systemctl is-active jellyfin

echo "==> Loaded version:"
journalctl -u jellyfin --since '45 sec ago' --no-pager | grep -i 'Loaded plugin: Volumen' || true
journalctl -u jellyfin --since '45 sec ago' --no-pager | grep -i 'VolumenMaximum' || true

echo "==> Chunk clean check:"
if curl -s "http://127.0.0.1:8096/web/playback-video-index-html.fb812af814e8c8697a00.chunk.js" | grep -q VolumenMaximum; then
  echo "STILL CORRUPTED"
  exit 1
else
  echo "OK: chunk limpio"
fi

echo "==> index.html injection:"
for i in 1 2 3 4 5 6; do
  if curl -s http://127.0.0.1:8096/web/index.html | grep -q 'plugin="VolumenMaximum"'; then
    curl -s http://127.0.0.1:8096/web/index.html | grep -o 'plugin="VolumenMaximum"[^>]*'
    exit 0
  fi
  sleep 2
done
echo "NO INJECTED YET — revisa logs"
journalctl -u jellyfin --since '60 sec ago' --no-pager | grep -i Volumen || true
exit 1
