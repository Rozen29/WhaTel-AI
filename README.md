# WhaTel-AI 🤖

**Seamless WhatsApp & Telegram AI Assistant powered by Groq & Gemini**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
<!-- Tambahkan badge lain jika relevan -->

---

**Choose Language / Pilih Bahasa:**

[**English**](#english-version) | [**Bahasa Indonesia**](#versi-bahasa-indonesia)

---

## English Version <a id="english-version"></a>

WhaTel-AI is a versatile bot integrating WhatsApp and Telegram with advanced AI services (Groq Llama & Google Gemini). It allows users to interact with AI via their preferred chat platform, while admins can manage users, settings, and rate limits centrally via Telegram.

> **Developer Note:** This project was largely developed through interactions with AI. We welcome bug reports and feature suggestions via [GitHub Issues](https://github.com/Rozen29/WhaTel-AI/issues).

### ✨ Key Features

*   **Multi-Platform Support:** Interact with AI via WhatsApp and Telegram.
*   **Multi-AI Integration:** Connects to Groq (Llama 3) and Google Gemini (Pro/Flash) APIs.
*   **Vision Capabilities:** Analyzes submitted images (descriptions & OCR) using AI vision models.
*   **WA User Management:** Admin controls via Telegram to add/remove authorized WhatsApp users.
*   **Persistent Data Storage:** Uses `lowdb` via a `db.js` helper module to store authorized users and conversation histories in a `db.json` file.
*   **Conversation History:** Stores chat history per user per platform for contextual AI responses.
*   **Per-User Rate Limiting:** WhatsApp users (non-admins) have a daily message limit, manageable by admins. Admins are exempt.
*   **Flexible Settings:** Admins can adjust AI parameters (temperature, safety, model) via Telegram.
*   **Centralized Administration:** All bot controls (WA connection, users, settings, rate limits) are handled through secure Telegram commands.
*   **Local File Storage:** Also uses local files for greeted user lists (`greeted_users.json`) and detailed rate limit tracking (`rate_limit.json`).

### 🛠️ Tech Stack

*   Node.js (ES Modules)
*   whatsapp-web.js
*   node-telegram-bot-api
*   axios
*   lowdb
*   qrcode / qrcode-terminal
*   dotenv
*   Groq API
*   Google Gemini API

### ✅ Prerequisites

*   **Node.js:** Version 18.0.0 or higher (due to ES Modules usage).
*   **npm:** Usually installed with Node.js.
*   **WhatsApp Account:** An active account to be used by the bot.
*   **Telegram Account:** An account to manage the bot.
*   **Telegram Bot:** Create a new bot via @BotFather on Telegram to get a token.
*   **API Keys:**
    *   Groq API Key (Optional, if you want to use Groq)
    *   Google AI Gemini API Key (Optional, if you want to use Gemini)

### 🚀 Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/Rozen29/WhaTel-AI.git
    cd WhaTel-AI
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Create `.env` File:**
    Create a file named `.env` in the project's root directory and populate it with the following variables. **Never** share this file or commit it to Git.

    ```dotenv
    # --- Telegram Settings ---
    TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
    # Comma-separated list of Telegram Admin User IDs (NO spaces) - REQUIRED (at least one)
    TELEGRAM_ADMIN_LIST=ADMIN_TELEGRAM_ID_1,ADMIN_TELEGRAM_ID_2
    # Telegram Chat ID to receive error notifications (optional)
    TELEGRAM_ERROR_CHAT_ID=YOUR_ERROR_CHAT_ID (optional)

    # --- WhatsApp Admin ---
    # Password for /add and /remove WA user commands via Telegram
    ADMIN_PASSWORD=CREATE_A_STRONG_PASSWORD

    # --- AI Provider API Keys (Fill one or both) ---
    GROQ_API_KEY=YOUR_GROQ_API_KEY (optional)
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY (optional)

    # --- (Other variables like ADMIN_USERNAME for daily login if used) ---
    # ADMIN_USERNAME=your_login_username (optional, for performDailyLogin if customized)
    ```

    *   **Get Telegram ID:** Send `/myid` to @userinfobot or a similar bot.
    *   **Get API Keys:** Visit the official Groq and Google AI Studio / Google Cloud websites.

4.  **Add `.env` to `.gitignore`:**
    Ensure your `.gitignore` file (create one if it doesn't exist) includes the following lines to prevent leaking credentials:
    ```gitignore
    node_modules/
    .env
    db.json
    rate_limit.json
    greeted_users.json
    folder-foto/
    *.log
    .wwebjs_auth/
    .last_login.json
    ```
    *(Note: `db.json`, `rate_limit.json`, and `greeted_users.json` store operational data. Back them up if important, but exclude from Git.)*

### ▶️ Running the Bot

1.  **Ensure `package.json` is set for ES Modules:**
    If your `WhaTel-AI.js` uses `import/export`, your `package.json` should have:
    ```json
    {
      "type": "module"
      // ... other settings
    }
    ```

2.  **Start the Bot:**
    The `npm start` command in your `package.json` should execute `WhaTel-AI.js`. For example:
    ```json
    "scripts": {
      "start": "node WhaTel-AI.js"
    }
    ```
    Then run:
    ```bash
    npm start
    ```

3.  **Scan WhatsApp QR Code (First Time):**
    On the first run, a QR code will appear in the terminal (and might be sent to the first Telegram admin if the bot can already send messages). Scan this code using your WhatsApp mobile app (Linked Devices -> Link a device).

4.  **Bot Ready:** Once connected, the bot will be ready to receive commands from admins on Telegram and respond to authorized WhatsApp users.

### 💬 Usage

The bot has two main interaction modes:

1.  **WhatsApp Users:** Users whose numbers have been added by an admin via Telegram can send text messages or images to the bot's WhatsApp number and receive AI responses. Non-admin users are subject to a daily message limit.
2.  **Telegram Admins:** Admins whose Telegram IDs are in `TELEGRAM_ADMIN_LIST` can control all aspects of the bot using commands in a private Telegram chat with the bot.

### 📜 Telegram Admin Commands

| Command                           | Description                                                                           |
| :-------------------------------- | :------------------------------------------------------------------------------------ |
| `/connect`                        | Connect/start connection to WhatsApp & display QR Code.                             |
| `/disconnect`                     | Disconnect from WhatsApp.                                                           |
| `/status`                         | Show WhatsApp connection, bot & AI provider status.                                 |
| `/start_chatbot`                  | Enable AI responses for WhatsApp users.                                             |
| `/stop_chatbot`                   | Disable AI responses for WhatsApp users.                                            |
| `/add [wa_number]`                | Add WhatsApp number to user list (e.g., `/add 6281...`). Requires admin password.     |
| `/remove [wa_number]`             | Remove WhatsApp number from user list. Requires admin password.                     |
| `/list`                           | Show list of authorized WhatsApp admins (no rate limit) and users (rate limited).   |
| `/resetratelimit [+wa_number]`    | Reset the daily message limit for a specific WA user (e.g., `/resetratelimit +6281...`).|
| `/show_model`                     | Show available and selected AI providers and models.                               |
| `/use_provider [index]`           | Change active AI provider (see index from `/show_model`).                           |
| `/use_model [index]`              | Change active AI text model (for current provider).                                 |
| `/use_vision_model [index]`       | Change active AI vision model (for current provider).                               |
| `/settings`                       | Show/change AI settings (safety & config, currently Gemini).                        |
| `/settings [path] [val]`          | Change specific setting (e.g., `/settings safety.hate block`).                      |
| `/history`                        | Show your recent Telegram conversation history with the bot.                        |
| `/clear_history`                  | Clear your Telegram conversation history with the bot.                              |
| `/ocr`                            | (Reply to image) Extract text from the replied image.                               |
| `/myid`                           | Show your Telegram user information.                                                |
| `/help`                           | Display this help message.                                                          |
| `/logs`                           | (Basic) Show basic log info (check console for details).                            |
| `/version` or `/show`           | Display the current bot version.                                                    |
| `/cancel`                         | Cancel the pending `/add` or `/remove` password entry process.                      |

### ⚙️ Configuration

*   **Core Variables:** Main configuration (tokens, API keys, admins) is done via the `.env` file.
*   **AI Prompts:** You can change the base AI behavior by editing the `SYSTEM_PROMPT`, `VISION_PROMPT`, and `OCR_PROMPT` constants within the `WhaTel-AI.js` file.
*   **AI Parameters:** Settings like *temperature* (for Groq, in `WhaTel-AI.js`) and *safety/generation settings* (for Gemini, via `/settings` in Telegram) can be adjusted.
*   **Daily Message Limit:** The `DAILY_MESSAGE_LIMIT` constant in `WhaTel-AI.js` controls the limit for non-admin WhatsApp users.

### 🗄️ Data Storage

This project uses a combination of `lowdb` for primary structured data and direct file system access for other operational data.

*   **`db.js` & `db.json` (Lowdb):**
    *   The `db.js` module provides helper functions to interact with `db.json`.
    *   `db.json` stores:
        *   `authorizedUsers`: An object with `admin` and `users` arrays containing WhatsApp IDs (`62xxxx@c.us`). Admins listed here bypass rate limits.
        *   `conversations`: An object where keys are `"platform:userId"` (e.g., `"whatsapp:62xxxx@c.us"` or `"telegram:12345678"`) and values are conversation history arrays.
    *   **Important:** It's recommended to back up `db.json` regularly but exclude it from Git. Do not manually edit `db.json` unless you are certain, as it can lead to data corruption.

*   **Other Files (Managed by `WhaTel-AI.js`):**
    *   `rate_limit.json`: Stores daily message counts for individual non-admin WhatsApp users. Structure: `{ "userId": { "messageCount": N, "lastResetDate": "ISO_DATE" } }`.
    *   `greeted_users.json`: A simple list of WhatsApp user IDs that have received the initial greeting.
    *   `.last_login.json`: Stores timestamp of the last successful "daily login" check.

### 📁 File Structure

```bash
WhaTel-AI/
├── WhaTel-AI.js # Main bot application code (ES Module)
├── db.js # Helper module for lowdb database interactions (ES Module)
├── db.json # Database file for users & conversations (auto-created by lowdb)
├── rate_limit.json # Stores WA user rate limit counts (auto-created)
├── greeted_users.json # List of greeted WA users (auto-created)
├── .last_login.json # Timestamp for daily login (auto-created)
├── .env # Environment variables (create this file!)
├── package.json # Project dependencies & scripts
├── package-lock.json # Locked dependency versions
├── README.md # This documentation
├── folder-foto/ # Image storage directory (auto-created)
└── .wwebjs_auth/ # WhatsApp session folder (auto-created)
```

### 🐛 Troubleshooting

*   **WhatsApp Connection Fails / QR Code Loops:**
    *   Delete the `.wwebjs_auth/` directory.
    *   Ensure the phone connected to WhatsApp has a stable internet connection.
    *   The `WhaTel-AI.js` includes extended Puppeteer arguments for stability; review them if issues persist.
    *   Try running in non-headless mode for debugging (`puppeteer: { headless: false }` in `WhaTel-AI.js`).
*   **AI API Errors (`401 Unauthorized`, `403 Forbidden`):**
    *   Double-check your API Keys in the `.env` file. Ensure no typos or extra spaces.
    *   Verify your API account is active and has sufficient quota/billing.
*   **Error `Cannot find module '...'`:** Run `npm install` again. Ensure the dependency exists in `package.json`.
*   **Telegram Commands Not Recognized:** Ensure you are a registered admin in `TELEGRAM_ADMIN_LIST` and your ID is correct. Use `/myid` to check.
*   **Markdown Parsing Error (`can't parse entities`):** Please report this bug! It might be due to an AI response or other text containing unbalanced Markdown characters.
*   **`SyntaxError: Cannot use import statement outside a module`**: Ensure your `package.json` has `"type": "module"` or you are running Node.js with the appropriate flags for ES Modules if your main file is `.js`.

### 🤝 Contributing

We welcome contributions! The best way to contribute currently is by:

1.  **Reporting Bugs:** If you find an error, please create a detailed report on [GitHub Issues](https://github.com/Rozen29/WhaTel-AI/issues). Include the error message, steps to reproduce, and your Node.js version.
2.  **Feature Suggestions:** Have ideas for new features? Propose them as a *feature request* on [GitHub Issues](https://github.com/Rozen29/WhaTel-AI/issues).

### 🗺️ Roadmap & Known Issues

*   **Integration of `db.js`**: The `WhaTel-AI.js` file needs to be fully updated to use the functions from `db.js` for managing authorized users and conversations, replacing its current file-based methods for these.
*   **`/logs` Feature:** Currently very basic, only directs to console logs. Further development needed to display relevant logs via Telegram.
*   **Function Calling/Tool Use:** Not yet implemented. This would be a major enhancement to the bot's capabilities.
*   **Error Handling:** Some error scenarios might not be gracefully handled yet.
*   **WA Group Support:** Currently ignored, could be added as an optional feature.

### 📄 License

This project is licensed under the MIT License - see the `LICENSE` file (if available) or the [MIT License](https://opensource.org/licenses/MIT) for details.

### 🙏 Acknowledgements

*   [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - For the excellent WhatsApp integration.
*   [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) - For the solid Telegram integration.
*   [lowdb](https://github.com/typicode/lowdb) - For the simple JSON database solution.
*   [Groq](https://groq.com) & [Google Gemini](https://ai.google.dev) - For the powerful AI services.

---

## Versi Bahasa Indonesia <a id="versi-bahasa-indonesia"></a>

WhaTel-AI adalah bot serbaguna yang mengintegrasikan WhatsApp dan Telegram dengan layanan AI canggih (Groq Llama & Google Gemini). Bot ini memungkinkan pengguna berinteraksi dengan AI melalui platform chat pilihan mereka, sementara admin dapat mengelola pengguna, pengaturan, dan batas penggunaan (rate limit) bot secara terpusat via Telegram.

> **Catatan Pengembang:** Proyek ini sebagian besar dikembangkan melalui interaksi dengan AI. Kami menyambut baik laporan bug dan saran fitur melalui [GitHub Issues](https://github.com/Rozen29/WhaTel-AI/issues).

### ✨ Fitur Utama

*   **Dukungan Multi-Platform:** Berinteraksi dengan AI via WhatsApp dan Telegram.
*   **Integrasi Multi-AI:** Terhubung ke API Groq (Llama 3) dan Google Gemini (Pro/Flash).
*   **Kemampuan Vision:** Menganalisis gambar yang dikirim (deskripsi & OCR) menggunakan model vision AI.
*   **Manajemen Pengguna WA:** Kontrol admin via Telegram untuk menambah/menghapus pengguna WhatsApp yang diotorisasi.
*   **Penyimpanan Data Persisten:** Menggunakan `lowdb` melalui modul helper `db.js` untuk menyimpan pengguna terotorisasi dan riwayat percakapan dalam file `db.json`.
*   **Riwayat Percakapan:** Menyimpan riwayat chat per pengguna per platform untuk respons AI yang kontekstual.
*   **Rate Limiting Per Pengguna:** Pengguna WhatsApp (non-admin) memiliki batas pesan harian, yang dapat dikelola oleh admin. Admin dikecualikan dari batas ini.
*   **Pengaturan Fleksibel:** Admin dapat menyesuaikan parameter AI (suhu, keamanan, model) via Telegram.
*   **Administrasi Terpusat:** Semua kontrol bot (koneksi WA, pengguna, pengaturan, rate limit) dilakukan melalui perintah Telegram yang aman.
*   **Penyimpanan File Lokal:** Juga menggunakan file lokal untuk daftar pengguna yang sudah disapa (`greeted_users.json`) dan pelacakan detail rate limit (`rate_limit.json`).

### 🛠️ Tumpukan Teknologi

*   Node.js (ES Modules)
*   whatsapp-web.js
*   node-telegram-bot-api
*   axios
*   lowdb
*   qrcode / qrcode-terminal
*   dotenv
*   Groq API
*   Google Gemini API

### ✅ Prasyarat

*   **Node.js:** Versi 18.0.0 atau lebih tinggi (karena menggunakan ES Modules).
*   **npm:** Biasanya terinstal bersama Node.js.
*   **Akun WhatsApp:** Akun aktif yang akan digunakan oleh bot.
*   **Akun Telegram:** Akun yang akan digunakan untuk mengelola bot.
*   **Bot Telegram:** Buat bot baru via @BotFather di Telegram untuk mendapatkan token.
*   **Kunci API:**
    *   Kunci API Groq (Opsional, jika ingin menggunakan Groq)
    *   Kunci API Google AI Gemini (Opsional, jika ingin menggunakan Gemini)

### 🚀 Instalasi & Setup

1.  **Clone Repositori:**
    ```bash
    git clone https://github.com/Rozen29/WhaTel-AI.git
    cd WhaTel-AI
    ```

2.  **Install Dependensi:**
    ```bash
    npm install
    ```

3.  **Buat File `.env`:**
    Buat file bernama `.env` di direktori utama proyek dan isi dengan variabel berikut. **Jangan pernah** membagikan file ini atau memasukkannya ke Git.

    ```dotenv
    # --- Pengaturan Telegram ---
    TELEGRAM_BOT_TOKEN=ISI_DENGAN_TOKEN_BOT_TELEGRAM_ANDA
    # Daftar ID User Telegram Admin (pisahkan dengan koma, TANPA spasi) - WAJIB ADA MINIMAL 1
    TELEGRAM_ADMIN_LIST=ID_TELEGRAM_ADMIN_1,ID_TELEGRAM_ADMIN_2
    # ID Chat Telegram untuk menerima notifikasi error (opsional)
    TELEGRAM_ERROR_CHAT_ID=ISI_JIKA_PERLU

    # --- Admin WhatsApp ---
    # Password untuk perintah /add dan /remove user WA via Telegram
    ADMIN_PASSWORD=BUAT_PASSWORD_YANG_KUAT

    # --- Kunci API Provider AI (Isi salah satu atau keduanya) ---
    GROQ_API_KEY=ISI_DENGAN_GROQ_API_KEY_ANDA (opsional)
    GEMINI_API_KEY=ISI_DENGAN_GEMINI_API_KEY_ANDA (opsional)

    # --- (Variabel lain seperti ADMIN_USERNAME untuk login harian jika dipakai) ---
    # ADMIN_USERNAME=username_login_anda (opsional, untuk performDailyLogin jika disesuaikan)
    ```

    *   **Cara Mendapatkan ID Telegram:** Kirim pesan `/myid` ke @userinfobot atau bot serupa.
    *   **Cara Mendapatkan Kunci API:** Kunjungi situs resmi Groq dan Google AI Studio / Google Cloud.

4.  **Tambahkan `.env` ke `.gitignore`:**
    Pastikan file `.gitignore` Anda (buat jika belum ada) berisi baris berikut untuk mencegah kebocoran kredensial:
    ```gitignore
    node_modules/
    .env
    db.json
    rate_limit.json
    greeted_users.json
    folder-foto/
    *.log
    .wwebjs_auth/
    .last_login.json
    ```
    *(Catatan: `db.json`, `rate_limit.json`, dan `greeted_users.json` menyimpan data operasional. Cadangkan jika penting, tetapi kecualikan dari Git.)*

### ▶️ Menjalankan Bot

1.  **Pastikan `package.json` diatur untuk ES Modules:**
    Jika `WhaTel-AI.js` Anda menggunakan `import/export`, `package.json` Anda seharusnya memiliki:
    ```json
    {
      "type": "module"
      // ... pengaturan lain
    }
    ```

2.  **Start Bot:**
    Perintah `npm start` di `package.json` Anda harus menjalankan `WhaTel-AI.js`. Contoh:
    ```json
    "scripts": {
      "start": "node WhaTel-AI.js"
    }
    ```
    Kemudian jalankan:
    ```bash
    npm start
    ```

3.  **Scan Kode QR WhatsApp (Pertama Kali):**
    Saat pertama kali dijalankan, sebuah kode QR akan muncul di terminal (dan mungkin dikirim ke admin Telegram pertama jika bot sudah bisa mengirim pesan). Scan kode QR ini menggunakan aplikasi WhatsApp di ponsel Anda (Perangkat Tertaut -> Tautkan perangkat).

4.  **Bot Siap:** Setelah terhubung, bot akan siap menerima perintah dari admin di Telegram dan merespons pengguna WhatsApp yang terotorisasi.

### 💬 Penggunaan

Bot memiliki dua mode interaksi utama:

1.  **Pengguna WhatsApp:** Pengguna yang nomornya telah ditambahkan oleh admin via Telegram dapat mengirim pesan teks atau gambar ke nomor WhatsApp bot dan akan menerima respons dari AI. Pengguna non-admin tunduk pada batas pesan harian.
2.  **Admin Telegram:** Admin yang ID Telegram-nya ada di `TELEGRAM_ADMIN_LIST` dapat mengontrol semua aspek bot menggunakan perintah di chat Telegram pribadi dengan bot.

### 📜 Perintah Admin Telegram

| Perintah                          | Deskripsi                                                                                   |
| :-------------------------------- | :------------------------------------------------------------------------------------------ |
| `/connect`                        | Menghubungkan/memulai koneksi ke WhatsApp & menampilkan Kode QR.                            |
| `/disconnect`                     | Memutuskan koneksi dari WhatsApp.                                                           |
| `/status`                         | Menampilkan status koneksi WhatsApp, status bot & provider AI.                              |
| `/start_chatbot`                  | Mengaktifkan respons AI untuk pengguna WhatsApp.                                            |
| `/stop_chatbot`                   | Menonaktifkan respons AI untuk pengguna WhatsApp.                                           |
| `/add [nomor_wa]`                 | Menambah nomor WhatsApp ke daftar pengguna (mis: `/add 6281...`). Meminta password admin.    |
| `/remove [nomor_wa]`              | Menghapus nomor WhatsApp dari daftar pengguna. Meminta password admin.                        |
| `/list`                           | Menampilkan daftar admin WhatsApp (tanpa batas penggunaan) dan pengguna (dengan batas penggunaan). |
| `/resetratelimit [+nomor_wa]`     | Mereset batas pesan harian untuk pengguna WA tertentu (mis: `/resetratelimit +6281...`).    |
| `/show_model`                     | Menampilkan daftar provider AI dan model yang tersedia & terpilih.                        |
| `/use_provider [index]`           | Mengganti provider AI aktif (lihat indeks dari `/show_model`).                               |
| `/use_model [index]`              | Mengganti model teks AI aktif (untuk provider saat ini).                                      |
| `/use_vision_model [index]`       | Mengganti model vision AI aktif (untuk provider saat ini).                                    |
| `/settings`                       | Menampilkan/mengubah pengaturan AI (safety & config, saat ini Gemini).                     |
| `/settings [path] [val]`          | Mengubah pengaturan spesifik (e.g., `/settings safety.hate block`).                         |
| `/history`                        | Menampilkan riwayat percakapan terakhir Anda di Telegram dengan bot.                       |
| `/clear_history`                  | Menghapus riwayat percakapan Anda di Telegram dengan bot.                                   |
| `/ocr`                            | (Balas ke gambar) Ekstrak teks dari gambar yang dibalas.                                   |
| `/myid`                           | Menampilkan informasi ID Telegram Anda.                                                     |
| `/help`                           | Menampilkan pesan bantuan ini.                                                              |
| `/logs`                           | (Dasar) Menunjukkan info log dasar (cek console untuk detail).                             |
| `/version` atau `/show`           | Menampilkan versi bot saat ini.                                                             |
| `/cancel`                         | Membatalkan proses `/add` atau `/remove` saat diminta password.                             |

### ⚙️ Konfigurasi

*   **Variabel Utama:** Konfigurasi utama (token, kunci API, admin) dilakukan melalui file `.env`.
*   **Prompt AI:** Anda dapat mengubah perilaku dasar AI dengan mengedit konstanta `SYSTEM_PROMPT`, `VISION_PROMPT`, dan `OCR_PROMPT` di dalam file `WhaTel-AI.js`.
*   **Parameter AI:** Pengaturan seperti *temperature* (untuk Groq, di `WhaTel-AI.js`) dan *safety/generation settings* (untuk Gemini, via `/settings` di Telegram) dapat disesuaikan.
*   **Batas Pesan Harian:** Konstanta `DAILY_MESSAGE_LIMIT` di `WhaTel-AI.js` mengontrol batas untuk pengguna WhatsApp non-admin.

### 🗄️ Penyimpanan Data

Proyek ini menggunakan kombinasi `lowdb` untuk data terstruktur utama dan akses sistem file langsung untuk data operasional lainnya.

*   **`db.js` & `db.json` (Lowdb):**
    *   Modul `db.js` menyediakan fungsi helper untuk berinteraksi dengan `db.json`.
    *   `db.json` menyimpan:
        *   `authorizedUsers`: Objek dengan array `admin` dan `users` yang berisi ID WhatsApp (`62xxxx@c.us`). Admin yang terdaftar di sini tidak terkena batas penggunaan.
        *   `conversations`: Objek di mana *key* adalah `"platform:userId"` (contoh: `"whatsapp:62xxxx@c.us"` atau `"telegram:12345678"`) dan *value* adalah array riwayat percakapan.
    *   **Penting:** Disarankan untuk mencadangkan `db.json` secara berkala tetapi kecualikan dari Git. Jangan mengedit `db.json` secara manual kecuali Anda yakin, karena dapat menyebabkan kerusakan data.

*   **File Lain (Dikelola oleh `WhaTel-AI.js`):**
    *   `rate_limit.json`: Menyimpan hitungan pesan harian untuk masing-masing pengguna WhatsApp non-admin. Struktur: `{ "userId": { "messageCount": N, "lastResetDate": "ISO_DATE" } }`.
    *   `greeted_users.json`: Daftar sederhana ID pengguna WhatsApp yang telah menerima sapaan awal.
    *   `.last_login.json`: Menyimpan timestamp dari pemeriksaan "login harian" terakhir yang berhasil.

### 📁 Struktur File

```bash
WhaTel-AI/
├── WhaTel-AI.js # Kode utama aplikasi bot (ES Module)
├── db.js # Modul helper untuk interaksi database lowdb (ES Module)
├── db.json # File database untuk pengguna & percakapan (dibuat otomatis oleh lowdb)
├── rate_limit.json # Menyimpan hitungan rate limit pengguna WA (dibuat otomatis)
├── greeted_users.json # Daftar user WA yang sudah disapa (dibuat otomatis)
├── .last_login.json # Timestamp untuk login harian (dibuat otomatis)
├── .env # Variabel lingkungan (buat file ini!)
├── package.json # Dependensi & skrip proyek
├── package-lock.json # Kunci versi dependensi
├── README.md # Dokumentasi ini
├── folder-foto/ # Direktori penyimpanan gambar (dibuat otomatis)
└── .wwebjs_auth/ # Folder sesi WhatsApp (dibuat otomatis)
```
### 🐛 Pemecahan Masalah

*   **Koneksi WhatsApp Gagal / Kode QR Terus Muncul:**
    *   Hapus folder `.wwebjs_auth/`.
    *   Pastikan ponsel yang terhubung ke WhatsApp memiliki koneksi internet stabil.
    *   File `WhaTel-AI.js` menyertakan argumen Puppeteer tambahan untuk stabilitas; tinjau jika masalah berlanjut.
    *   Coba jalankan di lingkungan dengan UI (non-headless) jika masalah berlanjut untuk debug (`puppeteer: { headless: false }` di `WhaTel-AI.js`).
*   **Error API AI (`401 Unauthorized`, `403 Forbidden`):**
    *   Periksa kembali Kunci API di file `.env`. Pastikan tidak ada typo atau spasi ekstra.
    *   Pastikan akun API Anda aktif dan memiliki kuota/billing yang cukup.
*   **Error `Cannot find module '...'`:** Jalankan `npm install` lagi. Pastikan dependensi ada di `package.json`.
*   **Perintah Telegram Tidak Dikenali:** Pastikan Anda adalah admin yang terdaftar di `TELEGRAM_ADMIN_LIST` dan ID Anda benar. Gunakan `/myid` untuk memeriksa.
*   **Error Parsing Markdown (`can't parse entities`):** Mohon laporkan bug ini! Mungkin ada respons AI atau teks lain yang berisi karakter Markdown yang tidak seimbang.
*   **`SyntaxError: Cannot use import statement outside a module`**: Pastikan `package.json` Anda memiliki `"type": "module"` atau Anda menjalankan Node.js dengan flag yang sesuai untuk ES Modules jika file utama Anda adalah `.js`.

### 🤝 Berkontribusi

Kami menyambut kontribusi! Cara terbaik untuk berkontribusi saat ini adalah dengan:

1.  **Melaporkan Bug:** Jika Anda menemukan error, buat laporan detail di [GitHub Issues](https://github.com/Rozen29/WhaTel-AI/issues). Sertakan pesan error, langkah-langkah untuk mereproduksi, dan versi Node.js yang digunakan.
2.  **Saran Fitur:** Punya ide untuk fitur baru? Ajukan sebagai *feature request* di [GitHub Issues](https://github.com/Rozen29/WhaTel-AI/issues).

### 🗺️ Roadmap & Masalah Diketahui

*   **Integrasi `db.js`**: File `WhaTel-AI.js` perlu diperbarui sepenuhnya untuk menggunakan fungsi-fungsi dari `db.js` dalam mengelola pengguna terotorisasi dan percakapan, menggantikan metode berbasis file saat ini untuk hal tersebut.
*   **Fitur `/logs`:** Saat ini sangat dasar, hanya memberikan info untuk cek console. Pengembangan lebih lanjut diperlukan untuk menampilkan log yang relevan via Telegram.
*   **Function Calling/Tool Use:** Belum diimplementasikan. Ini akan menjadi tambahan besar untuk kemampuan bot.
*   **Peningkatan Error Handling:** Beberapa skenario error mungkin belum ditangani dengan baik.
*   **Dukungan Grup WA:** Saat ini diabaikan, bisa ditambahkan sebagai fitur opsional.

### 📄 Lisensi

Proyek ini dilisensikan di bawah Lisensi MIT - lihat file `LICENSE` (jika ada) atau [Lisensi MIT](https://opensource.org/licenses/MIT) untuk detailnya.

### 🙏 Penghargaan

*   [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - Untuk integrasi WhatsApp yang luar biasa.
*   [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) - Untuk integrasi Telegram yang solid.
*   [lowdb](https://github.com/typicode/lowdb) - Untuk solusi database JSON yang simpel.
*   [Groq](https://groq.com) & [Google Gemini](https://ai.google.dev) - Untuk layanan AI yang canggih.
