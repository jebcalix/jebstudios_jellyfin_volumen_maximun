(function () {
    'use strict';

    if (window.__VolumenMaximumLoaded) {
        return;
    }
    window.__VolumenMaximumLoaded = true;

    var STORAGE_KEY = 'volumenMaximum.boostPercent';
    var STEP = 10;
    var state = {
        enabled: true,
        maxBoost: 300,
        defaultBoost: 100,
        boostPercent: 100,
        audioCtx: null,
        source: null,
        gainNode: null,
        boundVideo: null,
        toastTimer: null
    };

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function loadLocalBoost(defaultBoost, maxBoost) {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw == null) {
                return clamp(defaultBoost, 100, maxBoost);
            }
            var parsed = parseInt(raw, 10);
            if (isNaN(parsed)) {
                return clamp(defaultBoost, 100, maxBoost);
            }
            return clamp(parsed, 100, maxBoost);
        } catch (e) {
            return clamp(defaultBoost, 100, maxBoost);
        }
    }

    function saveLocalBoost(value) {
        try {
            localStorage.setItem(STORAGE_KEY, String(value));
        } catch (e) {
            /* ignore quota / private mode */
        }
    }

    function showToast(message) {
        var existing = document.getElementById('volumenMaximumToast');
        if (existing) {
            existing.remove();
        }

        var toast = document.createElement('div');
        toast.id = 'volumenMaximumToast';
        toast.textContent = message;
        toast.setAttribute('role', 'status');
        Object.assign(toast.style, {
            position: 'fixed',
            left: '50%',
            bottom: '18%',
            transform: 'translateX(-50%)',
            background: 'rgba(20, 20, 20, 0.88)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: '8px',
            zIndex: '100000',
            fontSize: '14px',
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)'
        });
        document.body.appendChild(toast);

        if (state.toastTimer) {
            clearTimeout(state.toastTimer);
        }
        state.toastTimer = setTimeout(function () {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 1400);
    }

    function ensureAudioGraph(video) {
        if (!video) {
            return false;
        }

        if (state.boundVideo === video && state.gainNode) {
            return true;
        }

        disconnectAudioGraph();

        try {
            var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextCtor) {
                console.warn('[VolumenMaximum] Web Audio API no disponible');
                return false;
            }

            var ctx = new AudioContextCtor();
            var source = ctx.createMediaElementSource(video);
            var gain = ctx.createGain();
            source.connect(gain);
            gain.connect(ctx.destination);

            state.audioCtx = ctx;
            state.source = source;
            state.gainNode = gain;
            state.boundVideo = video;

            if (ctx.state === 'suspended') {
                var resume = function () {
                    ctx.resume().catch(function () { /* ignore */ });
                };
                video.addEventListener('play', resume, { once: true });
                document.addEventListener('click', resume, { once: true });
            }

            return true;
        } catch (err) {
            console.warn('[VolumenMaximum] No se pudo crear GainNode:', err);
            disconnectAudioGraph();
            return false;
        }
    }

    function disconnectAudioGraph() {
        try {
            if (state.source) {
                state.source.disconnect();
            }
        } catch (e) { /* ignore */ }
        try {
            if (state.gainNode) {
                state.gainNode.disconnect();
            }
        } catch (e) { /* ignore */ }
        try {
            if (state.audioCtx && state.audioCtx.state !== 'closed') {
                state.audioCtx.close();
            }
        } catch (e) { /* ignore */ }

        state.audioCtx = null;
        state.source = null;
        state.gainNode = null;
        state.boundVideo = null;
    }

    function applyGain() {
        var video = findVideo();
        if (!video || !state.enabled) {
            return;
        }

        var boost = clamp(state.boostPercent, 100, state.maxBoost);
        state.boostPercent = boost;

        if (boost <= 100) {
            if (state.gainNode) {
                state.gainNode.gain.value = 1;
            }
            updateUi();
            return;
        }

        if (!ensureAudioGraph(video)) {
            return;
        }

        state.gainNode.gain.value = boost / 100;
        updateUi();
    }

    function setBoost(percent, announce) {
        if (!state.enabled) {
            return;
        }

        var next = clamp(percent, 100, state.maxBoost);
        state.boostPercent = next;
        saveLocalBoost(next);
        applyGain();

        if (announce) {
            var msg = 'Volumen: ' + next + '%';
            if (next >= Math.min(state.maxBoost, 200)) {
                msg += ' (posible saturación)';
            }
            showToast(msg);
        }
    }

    function findVideo() {
        return document.querySelector('video') || document.querySelector('.htmlvideoplayer video') || null;
    }

    function findOsdBottom() {
        return document.querySelector('.videoOsdBottom-maincontrols')
            || document.querySelector('.videoOsdBottom')
            || document.querySelector('.osdControls')
            || null;
    }

    function ensureUi() {
        if (!state.enabled) {
            var existingOff = document.getElementById('volumenMaximumControl');
            if (existingOff) {
                existingOff.remove();
            }
            return;
        }

        if (document.getElementById('volumenMaximumControl')) {
            updateUi();
            return;
        }

        var host = findOsdBottom();
        if (!host) {
            return;
        }

        var wrap = document.createElement('div');
        wrap.id = 'volumenMaximumControl';
        wrap.className = 'volumenMaximumControl flex flex-direction-row align-items-center';
        Object.assign(wrap.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: '10px',
            minWidth: '160px'
        });

        var label = document.createElement('span');
        label.id = 'volumenMaximumLabel';
        label.textContent = 'Boost';
        label.style.fontSize = '12px';
        label.style.opacity = '0.9';
        label.style.whiteSpace = 'nowrap';

        var slider = document.createElement('input');
        slider.id = 'volumenMaximumSlider';
        slider.type = 'range';
        slider.min = '100';
        slider.max = String(state.maxBoost);
        slider.step = String(STEP);
        slider.value = String(state.boostPercent);
        slider.title = 'Boost de volumen (] / [)';
        slider.style.width = '100px';
        slider.style.accentColor = '#00a4dc';

        var value = document.createElement('span');
        value.id = 'volumenMaximumValue';
        value.textContent = state.boostPercent + '%';
        value.style.fontSize = '12px';
        value.style.minWidth = '42px';

        slider.addEventListener('input', function () {
            setBoost(parseInt(slider.value, 10) || 100, false);
        });
        slider.addEventListener('change', function () {
            setBoost(parseInt(slider.value, 10) || 100, true);
        });

        wrap.appendChild(label);
        wrap.appendChild(slider);
        wrap.appendChild(value);

        // Prefer placing near volume controls if present
        var volumeButton = host.querySelector('.volumeButtons') || host.querySelector('.btnVolume');
        if (volumeButton && volumeButton.parentElement) {
            volumeButton.parentElement.appendChild(wrap);
        } else {
            host.appendChild(wrap);
        }

        updateUi();
    }

    function updateUi() {
        var slider = document.getElementById('volumenMaximumSlider');
        var value = document.getElementById('volumenMaximumValue');
        if (slider) {
            slider.max = String(state.maxBoost);
            slider.value = String(state.boostPercent);
        }
        if (value) {
            value.textContent = state.boostPercent + '%';
        }
    }

    function onKeyDown(event) {
        if (!state.enabled) {
            return;
        }

        var tag = (event.target && event.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target.isContentEditable) {
            return;
        }

        if (!findVideo()) {
            return;
        }

        if (event.key === ']') {
            event.preventDefault();
            setBoost(state.boostPercent + STEP, true);
        } else if (event.key === '[') {
            event.preventDefault();
            setBoost(state.boostPercent - STEP, true);
        }
    }

    function tick() {
        if (!state.enabled) {
            return;
        }

        var video = findVideo();
        if (video) {
            ensureUi();
            if (state.boostPercent > 100) {
                applyGain();
            } else if (state.boundVideo && state.boundVideo !== video) {
                disconnectAudioGraph();
            }
        } else if (state.boundVideo) {
            disconnectAudioGraph();
            var control = document.getElementById('volumenMaximumControl');
            if (control) {
                control.remove();
            }
        }
    }

    function authHeaders() {
        var headers = { Accept: 'application/json' };
        try {
            if (typeof ApiClient !== 'undefined' && ApiClient.getAuthorizationHeader) {
                var auth = ApiClient.getAuthorizationHeader();
                if (auth) {
                    Object.keys(auth).forEach(function (key) {
                        headers[key] = auth[key];
                    });
                }
            }
        } catch (e) {
            /* ignore */
        }
        return headers;
    }

    function configUrl() {
        try {
            if (typeof ApiClient !== 'undefined' && ApiClient.getUrl) {
                return ApiClient.getUrl('VolumenMaximum/Configuration');
            }
        } catch (e) {
            /* ignore */
        }
        return '/VolumenMaximum/Configuration';
    }

    function loadServerConfig() {
        return fetch(configUrl(), {
            credentials: 'same-origin',
            headers: authHeaders()
        }).then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        }).then(function (config) {
            state.enabled = config.Enabled !== false;
            state.maxBoost = clamp(parseInt(config.MaxBoostPercent, 10) || 300, 100, 500);
            state.defaultBoost = clamp(parseInt(config.DefaultBoostPercent, 10) || 100, 100, state.maxBoost);
            state.boostPercent = loadLocalBoost(state.defaultBoost, state.maxBoost);
        }).catch(function (err) {
            console.warn('[VolumenMaximum] No se pudo cargar la configuración del servidor:', err);
            state.enabled = true;
            state.maxBoost = 300;
            state.defaultBoost = 100;
            state.boostPercent = loadLocalBoost(100, 300);
        });
    }

    function start() {
        loadServerConfig().then(function () {
            document.addEventListener('keydown', onKeyDown, true);
            setInterval(tick, 1000);
            tick();
            console.info('[VolumenMaximum] listo — boost', state.boostPercent + '% (máx ' + state.maxBoost + '%)');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
