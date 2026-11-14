// web/src/patches/matrix_core.js
// MATRIX CORE - Antigravity Android Native Control Center
// Matrix Core settings screen is natively rendered by React inside the Settings stack.
// This companion patch purges legacy header badges and exposes runtime utilities.

(function () {
  'use strict';

  var OLD_ROOT_BADGE_ID = 'agy-root-indicator-badge';
  var OLD_ROOT_MODAL_ID = 'agy-root-diagnostic-modal';

  function purgeLegacyBadge() {
    var b = document.getElementById(OLD_ROOT_BADGE_ID);
    if (b) b.remove();
    var m = document.getElementById(OLD_ROOT_MODAL_ID);
    if (m) m.remove();
  }

  function getRootStatus() {
    var active = false;
    var available = false;
    var provider = 'Unknown';
    var suPath = '/system/bin/su';

    try {
      if (window.__APP_CONFIG__) {
        active = Boolean(window.__APP_CONFIG__.rootActive);
        available = Boolean(window.__APP_CONFIG__.rootAvailable);
        provider = window.__APP_CONFIG__.rootProvider || 'Unknown';
      }
      if (window.Android && typeof window.Android.isRootActive === 'function') {
        active = window.Android.isRootActive();
      }
      if (window.Android && typeof window.Android.isRootAvailable === 'function') {
        available = window.Android.isRootAvailable();
      }
      if (window.Android && typeof window.Android.getRootProvider === 'function') {
        var p = window.Android.getRootProvider();
        if (p && p !== 'None') provider = p;
      }
      if (window.Android && typeof window.Android.getRootStatusJson === 'function') {
        var info = JSON.parse(window.Android.getRootStatusJson());
        if (info.suPath) suPath = info.suPath;
      }
    } catch (e) {
      console.warn('[MatrixCore] Error reading root status:', e);
    }

    return {
      active: active,
      available: available,
      provider: provider,
      suPath: suPath
    };
  }

  function setupObserver() {
    purgeLegacyBadge();
    if (window.MutationObserver && document.body) {
      var observer = new MutationObserver(purgeLegacyBadge);
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // --- Background Execution & Host Resume Supervisor ---
  // When user switches apps while AI task is running in background:
  // 1. Android runs language_server under Foreground Service Partial WakeLock.
  // 2. If WebView socket stalls or misses termination frames while hidden,
  //    this supervisor detects resume, unblocks stalled streams, and forces resync.
  var lastBackgroundTime = 0;
  var isBackground = false;

  function onAppPause() {
    isBackground = true;
    lastBackgroundTime = Date.now();
  }

  function onAppResume(source) {
    var wasBackground = isBackground;
    var duration = lastBackgroundTime > 0 ? (Date.now() - lastBackgroundTime) : 0;
    isBackground = false;
    lastBackgroundTime = 0;

    console.log('[MatrixCore] Host resume triggered (' + source + '), background duration: ' + duration + 'ms');

    // If app was backgrounded for >1000ms or explicit host-resume arrived:
    if (wasBackground || source === 'agy:host-resume') {
      try {
        var transport = window.__AG_TRANSPORT__;
        if (transport) {
          var activeStreamsCount = 0;
          if (transport.JSC$9267_activeStreams) {
            activeStreamsCount = transport.JSC$9267_activeStreams.size || 0;
          }
          var lastFrameAge = window.__AG_LAST_FRAME_TIME__ ? (Date.now() - window.__AG_LAST_FRAME_TIME__) : 999999;

          // If there are active streams and socket has been silent for > 2000ms,
          // reconnect the socket cleanly so the stream reader catches up immediately.
          if (activeStreamsCount > 0 && lastFrameAge > 2000) {
            console.log('[MatrixCore] Stalled stream detected on resume (active streams: ' + activeStreamsCount + ', silence: ' + lastFrameAge + 'ms). Reconnecting...');
            if (typeof transport.reconnect === 'function') {
              transport.reconnect('host_resume_stalled_stream');
            }
          }
        }

        if (typeof window.__AG_RESYNC_TRAJECTORIES__ === 'function') {
          setTimeout(function() {
            try {
              window.__AG_RESYNC_TRAJECTORIES__();
            } catch(e) {
              console.warn('[MatrixCore] Trajectory resync error:', e);
            }
          }, 100);
        }
      } catch (err) {
        console.warn('[MatrixCore] Resume recovery error:', err);
      }
    }
  }

  window.__AG_ON_HOST_RESUME__ = function () {
    onAppResume('agy:host-resume');
  };

  window.addEventListener('agy:host-resume', function () {
    onAppResume('agy:host-resume');
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      onAppPause();
    } else if (document.visibilityState === 'visible') {
      onAppResume('visibilitychange');
    }
  });

  window.addEventListener('focus', function () {
    onAppResume('focus');
  });

  window.MatrixCore = {
    getRootStatus: getRootStatus,
    openSettings: function () {
      if (typeof window.openSettings === 'function') {
        window.openSettings();
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupObserver);
  } else {
    setupObserver();
  }
})();
