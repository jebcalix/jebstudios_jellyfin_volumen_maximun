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
        toastTimer: null,
        panelOpen: false,
        // client = Web Audio GainNode; server = ffmpeg volume (LG webOS / TVs)
        mode: 'client',
        serverBoostAvailable: true,
        gainFailed: false,
        syncTimer: null,
        interceptInstalled: false,
        lastAnnouncedMode: null
    };

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function isTvClient() {
        try {
            if (window.webOS || window.PalmSystem || window.tizen) {
                return true;
            }
        } catch (e) { /* ignore */ }

        var ua = navigator.userAgent || '';
        return /Web0S|webOS|WebOS|LG Browser|NetCast|Tizen|SmartTV|SMART-TV|BRAVIA|Viera|AppleTV|CrKey|TV Safari|HbbTV/i.test(ua);
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
            /* ignore */
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
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
            maxWidth: '80%',
            textAlign: 'center'
        });
        document.body.appendChild(toast);

        if (state.toastTimer) {
            clearTimeout(state.toastTimer);
        }
        state.toastTimer = setTimeout(function () {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 2200);
    }

    function useServerBoost() {
        return state.mode === 'server' || isTvClient() || state.gainFailed;
    }

    function ensureAudioGraph(video) {
        if (!video || useServerBoost()) {
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
                switchToServerMode('Web Audio no disponible');
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
            console.warn('[VolumenMaximum] createMediaElementSource no soportado; modo servidor:', err);
            switchToServerMode('TV sin Web Audio gain');
            return false;
        }
    }

    function switchToServerMode(reason) {
        state.gainFailed = true;
        state.mode = 'server';
        disconnectAudioGraph();
        installStreamInterceptor();
        syncBoostToServer(state.boostPercent);

        if (state.lastAnnouncedMode !== 'server') {
            state.lastAnnouncedMode = 'server';
            console.info('[VolumenMaximum] Modo servidor activo:', reason || '');
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

        if (useServerBoost()) {
            updateUi();
            return;
        }

        if (boost <= 100) {
            if (state.gainNode) {
                state.gainNode.gain.value = 1;
            }
            updateUi();
            return;
        }

        if (!ensureAudioGraph(video)) {
            updateUi();
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
        var changed = next !== state.boostPercent;
        state.boostPercent = next;
        saveLocalBoost(next);
        applyGain();
        scheduleSyncBoost(next);

        if (announce) {
            var msg = 'Boost: ' + next + '%';
            if (useServerBoost()) {
                msg += ' (TV: reinicia la reproducción)';
            } else if (next >= Math.min(state.maxBoost, 200)) {
                msg += ' (posible saturación)';
            }
            showToast(msg);
        } else if (changed && useServerBoost() && next > 100) {
            // Quiet reminder once in a while is enough via announce path
        }
    }

    function findVideo() {
        return document.querySelector('.htmlvideoplayer video')
            || document.querySelector('#videoOsdPage video')
            || document.querySelector('video')
            || null;
    }

    function findButtonsRow() {
        var osd = document.querySelector('.videoOsdBottom .buttons')
            || document.querySelector('#videoOsdPage .buttons')
            || document.querySelector('.videoOsdBottom-maincontrols')
            || null;
        return osd;
    }

    function findVolumeButtons() {
        return document.querySelector('.videoOsdBottom .volumeButtons')
            || document.querySelector('#videoOsdPage .volumeButtons')
            || null;
    }

    function ensureStyles() {
        if (document.getElementById('volumenMaximumStyles')) {
            return;
        }

        var style = document.createElement('style');
        style.id = 'volumenMaximumStyles';
        style.textContent = [
            '.volumenMaximumButtons{display:flex;align-items:center;margin:0 .35em 0 0;position:relative;}',
            '.volumenMaximumButtons .btnBoostAudio{position:relative;}',
            '.volumenMaximumButtons .btnBoostAudio.active{color:#00a4dc;}',
            '.volumenMaximumButtons .volumenMaximumBadge{position:absolute;right:-2px;bottom:2px;font-size:9px;line-height:1;background:rgba(0,0,0,.75);padding:1px 3px;border-radius:3px;pointer-events:none;}',
            '.volumenMaximumPanel{display:none;position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:rgba(28,28,28,.96);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 12px;min-width:190px;z-index:100001;box-shadow:0 8px 24px rgba(0,0,0,.45);}',
            '.volumenMaximumPanel.open{display:block;}',
            '.volumenMaximumPanelLabel{display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:8px;opacity:.95;}',
            '.volumenMaximumPanelHint{font-size:11px;opacity:.75;margin:0 0 8px;line-height:1.3;}',
            '.volumenMaximumPanel input[type=range]{width:100%;accent-color:#00a4dc;}',
            '.volumenMaximumPanelActions{display:flex;gap:6px;margin-top:8px;}',
            '.volumenMaximumPanelActions button{flex:1;background:rgba(255,255,255,.08);border:0;color:#fff;border-radius:6px;padding:6px 0;cursor:pointer;font-size:12px;}',
            '.volumenMaximumPanelActions button:hover{background:rgba(0,164,220,.35);}',
            '@media (max-width:43em){.volumenMaximumButtons .volumenMaximumPanel{left:auto;right:0;transform:none;}}'
        ].join('');
        document.head.appendChild(style);
    }

    function ensureUi() {
        if (!state.enabled) {
            removeUi();
            return;
        }

        ensureStyles();

        var existing = document.getElementById('volumenMaximumControl');
        if (existing) {
            if (!existing.isConnected) {
                existing.remove();
            } else {
                updateUi();
                return;
            }
        }

        var buttonsRow = findButtonsRow();
        var volumeButtons = findVolumeButtons();
        if (!buttonsRow && !volumeButtons) {
            return;
        }

        var wrap = document.createElement('div');
        wrap.id = 'volumenMaximumControl';
        wrap.className = 'volumenMaximumButtons volumeButtons';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'volumenMaximumButton';
        btn.className = 'btnBoostAudio paper-icon-button-light autoSize';
        btn.setAttribute('is', 'paper-icon-button-light');
        btn.title = 'Boost audio ([ / ])';
        btn.setAttribute('aria-label', 'Boost audio');
        btn.innerHTML = '<span class="xlargePaperIconButton material-icons graphic_eq" aria-hidden="true"></span>'
            + '<span class="volumenMaximumBadge" id="volumenMaximumBadge">100</span>';

        var panel = document.createElement('div');
        panel.id = 'volumenMaximumPanel';
        panel.className = 'volumenMaximumPanel';
        panel.innerHTML = ''
            + '<div class="volumenMaximumPanelLabel"><span>Boost audio</span><strong id="volumenMaximumValue">100%</strong></div>'
            + '<div class="volumenMaximumPanelHint" id="volumenMaximumHint"></div>'
            + '<input id="volumenMaximumSlider" type="range" min="100" step="' + STEP + '" max="' + state.maxBoost + '" value="' + state.boostPercent + '" />'
            + '<div class="volumenMaximumPanelActions">'
            +   '<button type="button" data-boost="100">100%</button>'
            +   '<button type="button" data-boost="150">150%</button>'
            +   '<button type="button" data-boost="200">200%</button>'
            + '</div>';

        wrap.appendChild(btn);
        wrap.appendChild(panel);

        btn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            state.panelOpen = !state.panelOpen;
            panel.classList.toggle('open', state.panelOpen);
        });

        panel.addEventListener('click', function (event) {
            event.stopPropagation();
        });

        var slider = panel.querySelector('#volumenMaximumSlider');
        slider.addEventListener('input', function () {
            setBoost(parseInt(slider.value, 10) || 100, false);
        });
        slider.addEventListener('change', function () {
            setBoost(parseInt(slider.value, 10) || 100, true);
        });

        panel.querySelectorAll('[data-boost]').forEach(function (quickBtn) {
            quickBtn.addEventListener('click', function () {
                var value = parseInt(quickBtn.getAttribute('data-boost'), 10) || 100;
                setBoost(value, true);
            });
        });

        if (volumeButtons && volumeButtons.parentElement) {
            if (volumeButtons.nextSibling) {
                volumeButtons.parentElement.insertBefore(wrap, volumeButtons.nextSibling);
            } else {
                volumeButtons.parentElement.appendChild(wrap);
            }
        } else {
            var settingsBtn = buttonsRow.querySelector('.btnVideoOsdSettings');
            if (settingsBtn) {
                buttonsRow.insertBefore(wrap, settingsBtn);
            } else {
                buttonsRow.appendChild(wrap);
            }
        }

        updateUi();
    }

    function removeUi() {
        var existing = document.getElementById('volumenMaximumControl');
        if (existing) {
            existing.remove();
        }
        state.panelOpen = false;
    }

    function updateUi() {
        var slider = document.getElementById('volumenMaximumSlider');
        var value = document.getElementById('volumenMaximumValue');
        var badge = document.getElementById('volumenMaximumBadge');
        var btn = document.getElementById('volumenMaximumButton');
        var panel = document.getElementById('volumenMaximumPanel');
        var hint = document.getElementById('volumenMaximumHint');

        if (slider) {
            slider.max = String(state.maxBoost);
            slider.value = String(state.boostPercent);
        }
        if (value) {
            value.textContent = state.boostPercent + '%';
        }
        if (badge) {
            badge.textContent = String(state.boostPercent);
        }
        if (btn) {
            btn.classList.toggle('active', state.boostPercent > 100);
            btn.title = 'Boost audio: ' + state.boostPercent + '% ([ / ])'
                + (useServerBoost() ? ' — modo TV/servidor' : '');
        }
        if (hint) {
            hint.textContent = useServerBoost()
                ? 'En TV el boost va por el servidor. Detén y vuelve a reproducir para aplicarlo.'
                : '';
        }
        if (panel) {
            panel.classList.toggle('open', state.panelOpen);
        }
    }

    function onDocumentClick(event) {
        var control = document.getElementById('volumenMaximumControl');
        if (!control || !state.panelOpen) {
            return;
        }
        if (!control.contains(event.target)) {
            state.panelOpen = false;
            updateUi();
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

        try {
            var video = findVideo();
            var onPlayer = !!document.querySelector('#videoOsdPage, .videoOsdBottom');

            if (onPlayer && video) {
                ensureUi();
                if (isTvClient() && state.mode !== 'server') {
                    switchToServerMode('cliente TV detectado');
                }
                if (state.boostPercent > 100) {
                    applyGain();
                } else if (state.boundVideo && state.boundVideo !== video) {
                    disconnectAudioGraph();
                }
            } else if (state.boundVideo || document.getElementById('volumenMaximumControl')) {
                disconnectAudioGraph();
                removeUi();
            }
        } catch (err) {
            console.warn('[VolumenMaximum] tick error:', err);
        }
    }

    function authHeaders() {
        var headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
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

    function apiUrl(path) {
        try {
            if (typeof ApiClient !== 'undefined' && ApiClient.getUrl) {
                return ApiClient.getUrl(path);
            }
        } catch (e) {
            /* ignore */
        }
        return '/' + path;
    }

    function scheduleSyncBoost(percent) {
        if (state.syncTimer) {
            clearTimeout(state.syncTimer);
        }
        state.syncTimer = setTimeout(function () {
            syncBoostToServer(percent);
        }, 250);
    }

    function syncBoostToServer(percent) {
        if (!state.serverBoostAvailable && !useServerBoost()) {
            return Promise.resolve();
        }

        return fetch(apiUrl('VolumenMaximum/Boost'), {
            method: 'PUT',
            credentials: 'same-origin',
            headers: authHeaders(),
            body: JSON.stringify({ BoostPercent: clamp(percent, 100, state.maxBoost) })
        }).then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        }).catch(function (err) {
            console.warn('[VolumenMaximum] No se pudo sincronizar boost al servidor:', err);
        });
    }

    function shouldForceAudioTranscodeParams(name, params) {
        if (!useServerBoost() || state.boostPercent <= 100 || !params) {
            return false;
        }

        var target = String(name || '');
        return /Videos|Audio|master\.m3u8|main\.m3u8|LiveStreams|PlaybackInfo/i.test(target)
            || (typeof params === 'object' && (
                'AudioCodec' in params
                || 'AllowAudioStreamCopy' in params
                || 'VideoCodec' in params
                || 'MediaSourceId' in params
            ));
    }

    function applyForceAudioParams(params) {
        if (!params || typeof params !== 'object') {
            return params;
        }
        params.AllowAudioStreamCopy = false;
        if (!params.AudioCodec) {
            params.AudioCodec = 'aac';
        }
        return params;
    }

    function installStreamInterceptor() {
        if (state.interceptInstalled) {
            return;
        }
        state.interceptInstalled = true;

        try {
            if (typeof ApiClient !== 'undefined' && ApiClient.getUrl) {
                var originalGetUrl = ApiClient.getUrl.bind(ApiClient);
                ApiClient.getUrl = function (name, params) {
                    if (shouldForceAudioTranscodeParams(name, params)) {
                        params = applyForceAudioParams(params || {});
                    }
                    return originalGetUrl(name, params);
                };
            }
        } catch (e) {
            console.warn('[VolumenMaximum] No se pudo interceptar ApiClient.getUrl:', e);
        }

        try {
            if (typeof ApiClient !== 'undefined' && ApiClient.ajax) {
                var originalAjax = ApiClient.ajax.bind(ApiClient);
                ApiClient.ajax = function (request) {
                    if (request && useServerBoost() && state.boostPercent > 100) {
                        var url = String(request.url || '');
                        if (/PlaybackInfo|Videos\/|Audio\//i.test(url)) {
                            request.data = request.data || {};
                            if (typeof request.data === 'object') {
                                applyForceAudioParams(request.data);
                            }
                        }
                    }
                    return originalAjax(request);
                };
            }
        } catch (e) {
            console.warn('[VolumenMaximum] No se pudo interceptar ApiClient.ajax:', e);
        }
    }

    function loadServerConfig() {
        return fetch(apiUrl('VolumenMaximum/Configuration'), {
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
            state.serverBoostAvailable = config.ServerBoostAvailable !== false;
            state.boostPercent = loadLocalBoost(state.defaultBoost, state.maxBoost);

            if (isTvClient()) {
                switchToServerMode('cliente TV al iniciar');
            } else if (state.boostPercent > 100) {
                // Pre-register on server in case this device later fails GainNode
                syncBoostToServer(state.boostPercent);
            }
        }).catch(function () {
            state.enabled = true;
            state.maxBoost = 300;
            state.defaultBoost = 100;
            state.boostPercent = loadLocalBoost(100, 300);
            if (isTvClient()) {
                switchToServerMode('cliente TV (config offline)');
            }
        });
    }

    function start() {
        setTimeout(function () {
            loadServerConfig().finally(function () {
                try {
                    document.addEventListener('keydown', onKeyDown, true);
                    document.addEventListener('click', onDocumentClick, true);
                    setInterval(tick, 1500);
                    tick();
                    console.info(
                        '[VolumenMaximum] listo — boost',
                        state.boostPercent + '%',
                        '(máx ' + state.maxBoost + '%, modo ' + (useServerBoost() ? 'servidor' : 'cliente') + ')'
                    );
                } catch (err) {
                    console.warn('[VolumenMaximum] start error:', err);
                }
            });
        }, 2500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
