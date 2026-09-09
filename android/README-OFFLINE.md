# SpareTrack — Android Offline Architecture

SpareTrack's Android app is fully offline. Here's how, in one page.

## How it works

1. `android/app/build.gradle` applies the **Chaquopy** plugin, which embeds
   a real Python 3.11 interpreter + pip packages (`flask`, `flask-cors`,
   `reportlab`, `openpyxl`) into the APK.
2. Chaquopy's `python.srcDirs` points straight at the existing
   `backend/` folder — the same `app.py` used by Electron/desktop is
   reused unmodified (no duplicate copy to maintain).
3. `MainActivity.java` starts Python on app launch and calls the new
   `app.run_server(data_dir, 5000)` function (added to `app.py`) on a
   background thread. This binds Flask to `127.0.0.1:5000` — loopback
   only, no real network/internet needed.
4. `data_dir` is `getFilesDir()` — the app's private, persistent phone
   storage. All data (customers, bills, bill items, payments, spare
   parts, stock, sales, images, backups) lives there in `database.db`
   and survives app restarts and phone reboots.
5. The bundled frontend (`frontend/app.js`) already calls
   `http://localhost:5000` for every API request — that line did not
   need to change for this to work.
6. `network_security_config.xml` allows plain HTTP only to
   `localhost`/`127.0.0.1` (required since Android 9+ blocks cleartext
   HTTP by default) — everything else still requires HTTPS.

## What this means for you

- No server to run on your PC. No Wi-Fi or mobile data required after
  install. Turn on airplane mode and the app still works.
- Your data stays on your phone. Use the existing Backup/Restore
  screen in Settings to export a `.db` file (e.g. to Google Drive or
  email) as an extra safety copy.
- Building the APK requires internet **once**, on your development
  machine, so Gradle/Android Studio can download the Chaquopy plugin
  and Python build tools.
