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
        panelOpen: false
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
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)'
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
            var msg = 'Boost: ' + next + '%';
            if (next >= Math.min(state.maxBoost, 200)) {
                msg += ' (posible saturación)';
            }
            showToast(msg);
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
            // Re-attach if OSD was re-rendered and our node was orphaned
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

        // Insert right after the native volume controls, before Settings
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
            btn.title = 'Boost audio: ' + state.boostPercent + '% ([ / ])';
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

        var video = findVideo();
        if (video) {
            ensureUi();
            if (state.boostPercent > 100) {
                applyGain();
            } else if (state.boundVideo && state.boundVideo !== video) {
                disconnectAudioGraph();
            }
        } else if (state.boundVideo || document.getElementById('volumenMaximumControl')) {
            disconnectAudioGraph();
            removeUi();
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
            document.addEventListener('click', onDocumentClick, true);

            var observer = new MutationObserver(function () {
                if (findButtonsRow() || findVolumeButtons()) {
                    ensureUi();
                }
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });

            setInterval(tick, 800);
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
