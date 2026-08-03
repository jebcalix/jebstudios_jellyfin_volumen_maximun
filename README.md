# Volumen Maximum — plugin Jellyfin

Plugin para **Jellyfin 10.11+** que permite subir el volumen del **cliente web** por encima del 100% (ideal para películas con audio muy bajo).

Usa Web Audio API (`GainNode`) e inyecta el script en el HTML servido **sin modificar** `/usr/share/jellyfin/web/index.html` en disco.

## Características

- Boost configurable (por defecto hasta **300%**)
- Control deslizante en el OSD del reproductor
- Atajos de teclado: `]` subir / `[` bajar (pasos de 10%)
- Preferencia guardada en `localStorage`
- Página de configuración en el dashboard

## Instalación desde el catálogo

1. Abre Jellyfin → **Panel** → **Plugins** → **Repositorios** → **Nuevo repositorio**
2. Completa:
   - **Nombre:** `Volumen Maximum`
   - **URL:**

```text
https://raw.githubusercontent.com/jebcalix/jebstudios_jellyfin_volumen_maximun/main/manifest.json
```

3. Guarda, ve a **Catálogo**, busca **Volumen Maximum** e instálalo
4. **Reinicia** Jellyfin
5. Recarga el navegador (Ctrl+F5)
6. (Opcional) Configura el plugin en **Plugins** → **Volumen Maximum**

## Uso

1. Reproduce una película en el cliente web (`http://localhost:8096`)
2. En los controles del reproductor verás el slider **Boost**
3. Súbelo por encima de 100%, o usa `]` / `[`

> Valores altos pueden saturar (clipping) el audio.

## Instalación manual (prueba local)

```bash
./build.sh
# Copia el contenido del ZIP a la carpeta de plugins del servidor, p. ej.:
#   /var/lib/jellyfin/plugins/VolumenMaximum/
sudo systemctl restart jellyfin
```

## Desarrollo

Requisitos: .NET SDK 9.0

```bash
export PATH="$HOME/.dotnet:$PATH"
./build.sh
```

El ZIP y el `manifest.json` se generan en la raíz / `dist/`.

## Publicar un release

```bash
git tag v1.0.0.0
git push origin v1.0.0.0
```

El workflow de GitHub Actions compila, publica el release y actualiza `manifest.json`.

## Alcance

- Funciona en el **cliente web** de Jellyfin
- **No** aplica a Jellyfin Media Player (MPV) ni apps nativas

## Licencia

MIT
