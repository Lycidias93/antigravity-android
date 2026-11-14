package com.agy.ui.webview;

import android.util.Log;
import android.webkit.WebView;

/** WebView resume/timer/memory lifecycle, kept out of the activity. */
public final class WebViewLifecycle {

    private static final String TAG = "WebViewHost";

    private WebViewLifecycle() {
    }

    /** Resume the page and tell it the host is back in front. */
    public static void resume(WebView webView) {
        if (webView == null) {
            return;
        }
        try {
            webView.onResume();
            webView.resumeTimers();
            webView.evaluateJavascript(
                    "(function(){ try { window.__AG_HOST_RESUMED__ = Date.now(); window.dispatchEvent(new CustomEvent('agy:host-resume', { detail: { timestamp: Date.now() } })); if (typeof window.__AG_ON_HOST_RESUME__ === 'function') { window.__AG_ON_HOST_RESUME__(); } } catch(e){} })();",
                    null);
        } catch (Exception e) {
            Log.w(TAG, "failed to resume webView", e);
        }
    }

    /** Pauses page callbacks while the host activity is not visible. */
    public static void pause(WebView webView) {
        if (webView == null) {
            return;
        }
        try {
            webView.onPause();
            // CRITICAL: Do NOT call webView.pauseTimers()!
            // Antigravity AI tasks run autonomously in background under Foreground Service
            // Partial WakeLock. Pausing JS timers halts WebSocket heartbeats and stream readers,
            // causing completed background trajectories to get stuck in UI when returning to the app.
        } catch (Exception e) {
            Log.w(TAG, "failed to pause webView", e);
        }
    }

    public static void freeMemory(WebView webView) {
        if (webView == null) {
            return;
        }
        try {
            webView.freeMemory();
        } catch (Exception e) {
            Log.w(TAG, "freeMemory failed", e);
        }
    }
}
