# Volumen Maximum — plugin Jellyfin

Plugin para **Jellyfin 10.11+** que permite subir el volumen por encima del 100% (ideal para películas con audio muy bajo).

- **Navegador de escritorio:** Web Audio API (`GainNode`)
- **LG webOS / TVs:** boost en el **servidor** con filtro ffmpeg `volume=` (webOS no soporta `createMediaElementSource`)

Inyecta el script en el HTML vía el plugin **File Transformation** (recomendado).

> Tras instalar o actualizar desde el dashboard, usa `systemctl restart jellyfin` en lugar del botón "Reiniciar" de la web: ese botón apaga el servicio y systemd no lo vuelve a levantar (`Restart=on-failure`).

## Características

- Boost configurable (por defecto hasta **300%**)
- Control en el OSD del reproductor (icono + panel)
- Atajos de teclado: `]` subir / `[` bajar (pasos de 10%)
- Preferencia guardada en `localStorage`
- En TV: sincroniza el boost al servidor y fuerza transcode de audio
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
4. **Reinicia** Jellyfin (`sudo systemctl restart jellyfin`)
5. Recarga el cliente (en TV: cierra y abre la app / hard refresh)
6. (Opcional) Configura el plugin en **Plugins** → **Volumen Maximum**

## Uso

1. Reproduce una película en el cliente web (`http://localhost:8096`)
2. En los controles del reproductor verás el icono **Boost** (ecualizador)
3. Súbelo por encima de 100%, o usa `]` / `[`

### LG TV / webOS

En TV el icono y el porcentaje sí se muestran, pero el volumen **no** puede subirse en el navegador de la TV. A partir de **1.0.7** el boost se aplica en el servidor (ffmpeg). Tras cambiar el boost, **detén y vuelve a reproducir** para que arranque un stream con audio transcodificado.

> Valores altos pueden saturar (clipping) el audio. El boost en TV consume CPU del servidor (transcode de audio).

## Instalación manual (prueba local)

```bash
./build.sh
sudo ./install-local.sh
```

## Desarrollo

Requisitos: .NET SDK 9.0

```bash
export PATH="$HOME/.dotnet:$PATH"
./build.sh
```

El ZIP y el `manifest.json` se generan en la raíz / `dist/`.

## Alcance

- Cliente web de Jellyfin (desktop + TV webOS/Tizen vía servidor)
- **No** aplica a Jellyfin Media Player (MPV) ni apps nativas

## Licencia

MIT
