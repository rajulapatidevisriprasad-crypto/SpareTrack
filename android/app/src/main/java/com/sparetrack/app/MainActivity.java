package com.sparetrack.app;

import android.os.Bundle;
import com.chaquo.python.PyObject;
import com.chaquo.python.Python;
import com.chaquo.python.android.AndroidPlatform;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity — starts the embedded Python (Chaquopy) copy of the existing
 * Flask backend (backend/app.py) on 127.0.0.1 before the WebView loads, so
 * the bundled frontend (which already calls http://localhost:5000) works
 * completely offline. Data (database.db, images, backups) is stored in the
 * app's private, persistent storage folder (getFilesDir()), so nothing is
 * lost between app restarts, app updates, or phone reboots.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startEmbeddedServer();
    }

    private void startEmbeddedServer() {
        if (!Python.isStarted()) {
            Python.start(new AndroidPlatform(this));
        }
        final String dataDir = getFilesDir().getAbsolutePath();
        // Run Flask's blocking app.run() on a background thread so it never
        // touches the UI thread.
        new Thread(() -> {
            try {
                Python py = Python.getInstance();
                PyObject appModule = py.getModule("app");
                appModule.callAttr("run_server", dataDir, 5000);
            } catch (Exception e) {
                // If the server is already running (e.g. Activity recreated
                // after a rotation) Flask will throw an "address in use"
                // error, which is safe to ignore here.
                e.printStackTrace();
            }
        }, "sparetrack-backend").start();
    }
}
