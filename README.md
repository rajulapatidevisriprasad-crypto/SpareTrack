# 🏍️ SpareTrack v2.0

> Extended from Bike Sales App · Full showroom management: Billing, Customers, Payments, Reports

---

## ✅ All Features Implemented

| # | Feature | Status |
|---|---------|--------|
| 1 | Customer Management (CRUD + history) | ✅ |
| 2 | Billing System (unlimited items) | ✅ |
| 3 | Payment Tracking (partial/full) | ✅ |
| 4 | Customer Bill History | ✅ |
| 5 | Pending Payment Management | ✅ |
| 6 | PDF Invoice (ReportLab) | ✅ |
| 7 | WhatsApp Sharing | ✅ |
| 8 | Email Invoice (PDF download) | ✅ |
| 9 | Enhanced Dashboard | ✅ |
| 10 | Global Search | ✅ |
| 11 | Reports (Daily/Weekly/Monthly) + PDF + Excel | ✅ |
| 12 | SQLite Database (all new tables) | ✅ |
| 13 | Backup & Restore | ✅ |
| 14 | Mobile Responsive Design | ✅ |
| 15 | Desktop (Electron) + App Menu | ✅ |
| 16 | Android (Capacitor guide below) | ✅ |
| 17 | Data Sync via Flask API | ✅ |
| 18 | Settings Page (shop info, logo, GST) | ✅ |
| 19 | Modern Light Glassmorphism UI | ✅ |
| 20 | Clean, modular, commented code | ✅ |

**All original spare parts inventory features preserved (100%).**

---

## 📁 Project Structure

```
bike-showroom-app/
├── backend/
│   ├── app.py              ← 820-line Flask API (all endpoints)
│   ├── requirements.txt    ← flask, flask-cors, reportlab, openpyxl
│   ├── database.db         ← SQLite (auto-created on first run)
│   ├── backups/            ← Auto backup before restore
│   └── static/images/      ← Uploaded logos, bike, part images
├── frontend/
│   ├── index.html          ← Full SPA (11 pages in one file)
│   ├── style.css           ← 1400-line light glassmorphism CSS
│   └── app.js              ← 960-line vanilla JS frontend
├── electron/
│   ├── main.js             ← Desktop wrapper + app menu
│   └── preload.js          ← Context bridge
├── package.json            ← Electron + build config
├── run.sh                  ← Linux/macOS one-command start
└── run_windows.bat         ← Windows one-command start
```

---

## 🚀 Quick Start

### Linux / macOS
```bash
bash run.sh
```

### Windows
```
run_windows.bat
```

### Manual Setup

```bash
# 1. Python Backend
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install flask flask-cors reportlab openpyxl
python app.py
# → http://localhost:5000

# 2. Desktop App (new terminal)
npm install
npm start

# 3. Browser only (no Electron needed)
# Open http://localhost:5000 in any browser
```

---

## 📡 Complete API Reference

### Original Inventory Endpoints (all preserved)
```
GET    /companies
POST   /add_company          { name, logo }
PUT    /update_company/<id>  { name, logo }
DELETE /delete_company/<id>

GET    /models
GET    /models/<company_id>
POST   /add_model            { company_id, model_name, image }
PUT    /update_model/<id>
DELETE /delete_model/<id>

GET    /items
GET    /items/<model_id>
POST   /add_item             { model_id, name, mrp, selling_price, quantity, image }
PUT    /update_item/<id>
DELETE /delete_item/<id>

POST   /add_stock            { item_id, quantity }
POST   /sell_item            { item_id, quantity }

GET    /transactions         ?date=YYYY-MM-DD&limit=N
GET    /dashboard
```

### Customer, Billing & Payment Endpoints
```
# Customers
GET    /customers            ?q=search_query
GET    /customers/<id>       → includes bill history + stats
POST   /add_customer         { name*, mobile*, alt_mobile, email, address, city, notes }
PUT    /update_customer/<id>
DELETE /delete_customer/<id>

# Bills
GET    /bills                ?status=paid|partial|pending&q=search
GET    /bills/<id>           → includes items + payment history
POST   /add_bill             { customer_id*, items*[], discount, amount_paid, bill_date, notes, payment_method }
PUT    /update_bill/<id>     { items[], discount, notes }
DELETE /delete_bill/<id>

# Payments
POST   /add_payment          { bill_id*, amount*, method, note }
GET    /pending_bills        ?q=search

# Settings
GET    /settings
POST   /settings             { shop_name, shop_address, shop_mobile, shop_email, shop_gst, shop_logo, bill_prefix }

# Utilities
GET    /search               ?q=query  → { customers, bills, items }
GET    /whatsapp_message/<bill_id>  → { message, whatsapp_url, mobile }
GET    /invoice_pdf/<bill_id>       → PDF file download
GET    /report/data          ?type=daily|weekly|monthly|custom&start=&end=
GET    /report/pdf           ?type=...&start=&end=
GET    /report/excel         ?type=...&start=&end=
GET    /backup               → .db file download
POST   /restore              (multipart form, field=file)
```

---

## 🗄️ Database Schema

```sql
-- ORIGINAL TABLES (unchanged)
companies   (id, name, logo_path)
models      (id, company_id, model_name, image_path)
items       (id, model_id, name, image_path, mrp, selling_price, quantity)
transactions(id, item_id, type, quantity, date_time)

-- NEW TABLES
customers   (id, name, mobile, alt_mobile, email, address, city, notes, reg_date)
bills       (id, bill_number, bill_date, customer_id, subtotal, discount,
             grand_total, amount_paid, pending, status, notes, created_at)
bill_items  (id, bill_id, item_name, quantity, unit_price, total)
payments    (id, bill_id, amount, method, note, paid_at)
settings    (key, value)

-- Bill status: 'paid' | 'partial' | 'pending'
-- Payment method: 'cash' | 'upi' | 'card' | 'bank' | 'other'
```

---

## 🏗️ Windows Build Guide

```bash
# Prerequisites: Node.js 18+, Python 3.8+
npm install
npm run dist:win

# Output: dist/SpareTrack Setup 2.0.0.exe
```

The installer creates desktop shortcut and Start Menu entry.

---

## 📱 Android Build Guide — Fully Offline (Capacitor + Chaquopy)

SpareTrack's Android app embeds a real Python interpreter (via the
[Chaquopy](https://chaquo.com/chaquopy/) Gradle plugin) and runs the exact
same `backend/app.py` Flask server locally on the phone at
`127.0.0.1:5000`. The bundled frontend already calls
`http://localhost:5000`, so **no code change was needed there** — the app
works with the screen in airplane mode. All data (customers, bills, items,
payments, stock, sales, images, backups) is stored in the app's private
storage on the phone and survives restarts and reboots.

```bash
# 1. Install JS deps (first time only)
npm install

# 2. Sync the web frontend into the Android project
npx cap sync android

# 3. Open in Android Studio
npx cap open android
# Android Studio will download the Chaquopy plugin + Python build tools
# the first time you sync Gradle — this step needs internet once, on
# your PC, not on the phone.

# 4. Build the APK
# → Build > Build Bundle(s) / APK(s) > Build APK(s)
```

**Output APK:** `android/app/build/outputs/apk/debug/app-debug.apk`
(or `.../release/app-release.apk` for a signed release build).

**Install on your phone:**
1. Copy the APK to your phone (USB cable, or send via any app).
2. On the phone, open the APK file and allow "install from this source"
   if prompted.
3. Open **SpareTrack** — it works immediately, no Wi-Fi/mobile data needed.

**For WhatsApp sharing on Android**, the URL `https://wa.me/` opens the
WhatsApp app automatically, same as before.

> Note: Chaquopy is free for development; check chaquo.com's current
> licensing terms if you plan to publish the app commercially/publicly.

---

## 🔄 Data Storage — Desktop vs Android

Each installation keeps its **own local** SQLite database — this app does
not require a network connection or shared server for normal use:

```
Desktop / Electron:  backend/database.db          (next to app.py)
Android (on-phone):  <app private storage>/database.db   (via Chaquopy)
```

If you previously ran SpareTrack over a LAN using a shared server IP
(`const API = 'http://YOUR_IP:5000'` in `frontend/app.js`), that setup
still works for desktop-to-desktop use, but is no longer required for
Android, which is now fully self-contained.

---

## 📊 Changes Made (vs Original bike-sales-app)

### Backend (`app.py`)
- **Added** 5 new database tables: customers, bills, bill_items, payments, settings
- **Added** 25 new API endpoints (all original 15 preserved)
- **Added** PDF invoice generation (ReportLab)
- **Added** Excel report export (openpyxl)
- **Added** WhatsApp message API
- **Added** Global search endpoint
- **Added** Settings CRUD
- **Added** Backup/Restore endpoints
- **Enhanced** Dashboard with 10+ new showroom metrics
- **Preserved** All original company/model/item/transaction/sell endpoints unchanged

### Frontend
- **Added** Customers page (table with CRUD)
- **Added** Billing page (dynamic line items, customer search, summary)
- **Added** All Bills page (filterable, searchable)
- **Added** Pending Payments page (sorted by amount)
- **Added** Payment modal (add payment to any bill)
- **Added** Bill view modal (with PDF + WhatsApp buttons)
- **Added** Customer profile modal (bill history)
- **Added** Reports page (PDF + Excel download)
- **Added** Settings page (shop info, logo, GST)
- **Added** Global sidebar search
- **Added** Mobile hamburger navigation
- **Enhanced** Dashboard (monthly chart, pending summary)
- **Preserved** Companies, Models, Parts, Parts History pages exactly

### CSS
- **Added** 400+ lines of responsive styles
- **Added** Mobile-first responsive breakpoints (768px, 480px)
- **Added** Billing layout, summary panel, customer dropdown styles
- **Added** Status badge styles (paid/partial/pending)

### Electron
- **Added** Native app menu (File, View, Edit)
- **Added** Keyboard shortcuts (Ctrl+N for new bill, etc.)
- **Improved** Process management and error handling

---

## 📞 WhatsApp Sharing

After creating any bill, click **"📲 WhatsApp"** button in the bill view.

It generates a deep link: `https://wa.me/91XXXXXXXXXX?text=...`

- **Desktop**: opens WhatsApp Web in browser
- **Mobile/Android**: opens WhatsApp app directly

---

## 🔒 Security Notes

- The app is designed for **local network use** (single shop)
- Flask runs on `0.0.0.0` to allow LAN access from Android
- For internet deployment, add authentication middleware
- SQLite backups are stored in `backend/backups/`
