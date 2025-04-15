# WhaTel-AI 🤖

**Seamless WhatsApp & Telegram AI Assistant powered by Groq & Gemini**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
<!-- Tambahkan badge lain jika relevan -->

---

**Choose Language / Pilih Bahasa:**

[**English**](#english-version) | [**Bahasa Indonesia**](#versi-bahasa-indonesia)

---

## English Version <a id="english-version"></a>

WhaTel-AI is a versatile bot integrating WhatsApp and Telegram with advanced AI services (Groq Llama & Google Gemini). It allows users to interact with AI via their preferred chat platform, while admins can manage users and settings centrally via Telegram.

> **Developer Note:** This project was largely developed through interactions with AI. We welcome bug reports and feature suggestions via [GitHub Issues](https://github.com/Rozen29/WhaTel-AI/issues).

### ✨ Key Features

*   **Multi-Platform Support:** Interact with AI via WhatsApp and Telegram.
*   **Multi-AI Integration:** Connects to Groq (Llama 3) and Google Gemini (Pro/Flash) APIs.
*   **Vision Capabilities:** Analyzes submitted images (descriptions & OCR) using AI vision models.
*   **WA User Management:** Admin controls via Telegram to add/remove authorized WhatsApp users.
*   **Conversation History:** Stores chat history per user per platform in a `lowdb` database for contextual responses.
*   **Flexible Settings:** Admins can adjust AI parameters (temperature, safety, model) via Telegram.
*   **Centralized Administration:** All bot controls (WA connection, users, settings) are handled through secure Telegram commands.
*   **Local Storage:** Uses `lowdb` to store user and conversation data in a `db.json` file.

### 🛠️ Tech Stack

*   Node.js
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

    # --- (Other variables if added) ---
    ```

    *   **Get Telegram ID:** Send `/myid` to @userinfobot or a similar bot.
    *   **Get API Keys:** Visit the official Groq and Google AI Studio / Google Cloud websites.

4.  **Add `.env` to `.gitignore`:**
    Ensure your `.gitignore` file (create one if it doesn't exist) includes the following lines to prevent leaking credentials:
    ```gitignore
    node_modules/
    .env
    db.json
    folder-foto/
    *.log
    .wwebjs_auth/
    ```

### ▶️ Running the Bot

1.  **Start the Bot:**
    ```bash
    npm start
    ```

2.  **Scan WhatsApp QR Code (First Time):**
    On the first run, a QR code will appear in the terminal (and might be sent to the first Telegram admin if the bot can already send messages). Scan this code using your WhatsApp mobile app (Linked Devices -> Link a device).

3.  **Bot Ready:** Once connected, the bot will be ready to receive commands from admins on Telegram and respond to authorized WhatsApp users.

### 💬 Usage

The bot has two main interaction modes:

1.  **WhatsApp Users:** Users whose numbers have been added by an admin via Telegram can send text messages or images to the bot's WhatsApp number and receive AI responses.
2.  **Telegram Admins:** Admins whose Telegram IDs are in `TELEGRAM_ADMIN_LIST` can control all aspects of the bot using commands in a private Telegram chat with the bot.

### 📜 Telegram Admin Commands

| Command                   | Description                                                               |
| :------------------------ | :---------------------------------------------------------------------- |
| `/connect`                | Connect/start connection to WhatsApp & display QR Code.                 |
| `/disconnect`             | Disconnect from WhatsApp.                                               |
| `/status`                 | Show WhatsApp connection, bot & AI provider status.                     |
| `/start_chatbot`          | Enable AI responses for WhatsApp users.                                 |
| `/stop_chatbot`           | Disable AI responses for WhatsApp users.                                |
| `/add [wa_number]`        | Add WhatsApp number to user list (e.g., `/add 6281...`). Requires admin password. |
| `/remove [wa_number]`     | Remove WhatsApp number from user list. Requires admin password.         |
| `/list`                   | Show list of authorized WhatsApp admins and users.                      |
| `/show_model`             | Show available and selected AI providers and models.                   |
| `/use_provider [index]`   | Change active AI provider (see index from `/show_model`).               |
| `/use_model [index]`      | Change active AI text model (for current provider).                     |
| `/use_vision_model [index]`| Change active AI vision model (for current provider).                   |
| `/settings`               | Show/change AI settings (safety & config, currently Gemini).            |
| `/settings [path] [val]`| Change specific setting (e.g., `/settings safety.hate block`).          |
| `/history`                | Show your recent Telegram conversation history with the bot.            |
| `/clear_history`          | Clear your Telegram conversation history with the bot.                  |
| `/ocr`                    | (Reply to image) Extract text from the replied image.                   |
| `/myid`                   | Show your Telegram user information.                                    |
| `/help`                   | Display this help message.                                              |
| `/logs`                   | (Basic) Show basic log info (check console for details).                |
| `/version` or `/show`   | Display the current bot version.                                        |
| `/cancel`                 | Cancel the pending `/add` or `/remove` password entry process.          |

### ⚙️ Configuration

*   **Core Variables:** Main configuration (tokens, API keys, admins) is done via the `.env` file.
*   **AI Prompts:** You can change the base AI behavior by editing the `SYSTEM_PROMPT`, `VISION_PROMPT`, and `OCR_PROMPT` constants within the `node.js` file.
*   **AI Parameters:** Settings like *temperature* (for Groq, in `node.js`) and *safety/generation settings* (for Gemini, via `/settings` in Telegram) can be adjusted.

### 🗄️ Database (Lowdb)

This project uses `lowdb` to persist data in the `db.json` file. This file contains:

*   `authorizedUsers`: An object containing `admin` and `users` arrays of WhatsApp IDs (`62xxxx@c.us`).
*   `conversations`: An object where the *key* is `"platform:userId"` (e.g., `"whatsapp:62xxxx@c.us"` or `"telegram:12345678"`) and the *value* is the conversation history array.

**Important:** Do not manually edit `db.json` unless you know what you are doing, as it might corrupt the data structure. Include `db.json` in your `.gitignore`.

### 📁 File Structure

WhaTel-AI/

├── node.js # Main bot application code
├── db.js # Helper module for lowdb database interactions
├── db.json # Database file (auto-created by lowdb)
├── .env # Environment variables (create this file!)
├── package.json # Project dependencies & scripts
├── package-lock.json # Locked dependency versions
├── README.md # This documentation
├── greeted_users.json # List of greeted WA users (auto-created)
├── folder-foto/ # Image storage directory (auto-created)
└── .wwebjs_auth/ # WhatsApp session folder (auto-created)

### 🐛 Troubleshooting

*   **WhatsApp Connection Fails / QR Code Loops:**
    *   Delete the `.wwebjs_auth/` directory.
    *   Ensure the phone connected to WhatsApp has a stable internet connection.
    *   Try running in non-headless mode for debugging (`puppeteer: { headless: false }` in `node.js`).
*   **AI API Errors (`401 Unauthorized`, `403 Forbidden`):**
    *   Double-check your API Keys in the `.env` file. Ensure no typos or extra spaces.
    *   Verify your API account is active and has sufficient quota/billing.
*   **Error `Cannot find module '...'`:** Run `npm install` again. Ensure the dependency exists in `package.json`.
*   **Telegram Commands Not Recognized:** Ensure you are a registered admin in `TELEGRAM_ADMIN_LIST` and your ID is correct. Use `/myid` to check.
*   **Markdown Parsing Error (`can't parse entities`):** Please report this bug! It might be due to an AI response or other text containing unbalanced Markdown characters.

### 🤝 Contributing

We welcome contributions! The best way to contribute currently is by:

1.  **Reporting Bugs:** If you find an error, please create a detailed report on [GitHub Issues](https://github.com/Rozen29/WhaTel-AI/issues). Include the error message, steps to reproduce, and your Node.js version.
2.  **Feature Suggestions:** Have ideas for new features? Propose them as a *feature request* on [GitHub Issues](https://github.com/Rozen29/WhaTel-AI/issues).

### 🗺️ Roadmap & Known Issues

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

WhaTel-AI adalah bot serbaguna yang mengintegrasikan WhatsApp dan Telegram dengan layanan AI canggih (Groq Llama & Google Gemini). Bot ini memungkinkan pengguna berinteraksi dengan AI melalui platform chat pilihan mereka, sementara admin dapat mengelola pengguna dan pengaturan bot secara terpusat via Telegram.

> **Catatan Pengembang:** Proyek ini sebagian besar dikembangkan melalui interaksi dengan AI. Kami menyambut baik laporan bug dan saran fitur melalui [GitHub Issues](https://github.com/Rozen29/WhaTel-AI/issues).

### ✨ Fitur Utama

*   **Dukungan Multi-Platform:** Berinteraksi dengan AI via WhatsApp dan Telegram.
*   **Integrasi Multi-AI:** Terhubung ke API Groq (Llama 3) dan Google Gemini (Pro/Flash).
*   **Kemampuan Vision:** Menganalisis gambar yang dikirim (deskripsi & OCR) menggunakan model vision AI.
*   **Manajemen Pengguna WA:** Kontrol admin via Telegram untuk menambah/menghapus pengguna WhatsApp yang diotorisasi.
*   **Riwayat Percakapan:** Menyimpan riwayat chat per pengguna per platform dalam database `lowdb` untuk respons yang kontekstual.
*   **Pengaturan Fleksibel:** Admin dapat menyesuaikan parameter AI (suhu, keamanan, model) via Telegram.
*   **Administrasi Terpusat:** Semua kontrol bot (koneksi WA, pengguna, pengaturan) dilakukan melalui perintah Telegram yang aman.
*   **Penyimpanan Lokal:** Menggunakan `lowdb` untuk menyimpan data pengguna dan percakapan dalam file `db.json`.

### 🛠️ Tumpukan Teknologi

*   Node.js
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

    # --- (Variabel lain jika ada) ---
    ```

    *   **Cara Mendapatkan ID Telegram:** Kirim pesan `/myid` ke @userinfobot atau bot serupa.
    *   **Cara Mendapatkan Kunci API:** Kunjungi situs resmi Groq dan Google AI Studio / Google Cloud.

4.  **Tambahkan `.env` ke `.gitignore`:**
    Pastikan file `.gitignore` Anda (buat jika belum ada) berisi baris berikut untuk mencegah kebocoran kredensial:
    ```gitignore
    node_modules/
    .env
    db.json
    folder-foto/
    *.log
    .wwebjs_auth/
    ```

### ▶️ Menjalankan Bot

1.  **Start Bot:**
    ```bash
    npm start
    ```

2.  **Scan Kode QR WhatsApp (Pertama Kali):**
    Saat pertama kali dijalankan, sebuah kode QR akan muncul di terminal (dan mungkin dikirim ke admin Telegram pertama jika bot sudah bisa mengirim pesan). Scan kode QR ini menggunakan aplikasi WhatsApp di ponsel Anda (Perangkat Tertaut -> Tautkan perangkat).

3.  **Bot Siap:** Setelah terhubung, bot akan siap menerima perintah dari admin di Telegram dan merespons pengguna WhatsApp yang terotorisasi.

### 💬 Penggunaan

Bot memiliki dua mode interaksi utama:

1.  **Pengguna WhatsApp:** Pengguna yang nomornya telah ditambahkan oleh admin via Telegram dapat mengirim pesan teks atau gambar ke nomor WhatsApp bot dan akan menerima respons dari AI.
2.  **Admin Telegram:** Admin yang ID Telegram-nya ada di `TELEGRAM_ADMIN_LIST` dapat mengontrol semua aspek bot menggunakan perintah di chat Telegram pribadi dengan bot.

### 📜 Perintah Admin Telegram

| Perintah                  | Deskripsi                                                               |
| :------------------------ | :---------------------------------------------------------------------- |
| `/connect`                | Menghubungkan/memulai koneksi ke WhatsApp & menampilkan Kode QR.        |
| `/disconnect`             | Memutuskan koneksi dari WhatsApp.                                       |
| `/status`                 | Menampilkan status koneksi WhatsApp, status bot & provider AI.          |
| `/start_chatbot`          | Mengaktifkan respons AI untuk pengguna WhatsApp.                        |
| `/stop_chatbot`           | Menonaktifkan respons AI untuk pengguna WhatsApp.                       |
| `/add [nomor_wa]`         | Menambah nomor WhatsApp ke daftar pengguna (mis: `/add 6281...`). Meminta password admin. |
| `/remove [nomor_wa]`      | Menghapus nomor WhatsApp dari daftar pengguna. Meminta password admin.    |
| `/list`                   | Menampilkan daftar admin dan pengguna WhatsApp yang terotorisasi.       |
| `/show_model`             | Menampilkan daftar provider AI dan model yang tersedia & terpilih.    |
| `/use_provider [index]`   | Mengganti provider AI aktif (lihat indeks dari `/show_model`).           |
| `/use_model [index]`      | Mengganti model teks AI aktif (untuk provider saat ini).                  |
| `/use_vision_model [index]`| Mengganti model vision AI aktif (untuk provider saat ini).                |
| `/settings`               | Menampilkan/mengubah pengaturan AI (safety & config, saat ini Gemini). |
| `/settings [path] [val]`| Mengubah pengaturan spesifik (e.g., `/settings safety.hate block`).     |
| `/history`                | Menampilkan riwayat percakapan terakhir Anda di Telegram dengan bot.   |
| `/clear_history`          | Menghapus riwayat percakapan Anda di Telegram dengan bot.               |
| `/ocr`                    | (Balas ke gambar) Ekstrak teks dari gambar yang dibalas.               |
| `/myid`                   | Menampilkan informasi ID Telegram Anda.                                 |
| `/help`                   | Menampilkan pesan bantuan ini.                                          |
| `/logs`                   | (Dasar) Menunjukkan info log dasar (cek console untuk detail).         |
| `/version` atau `/show`   | Menampilkan versi bot saat ini.                                         |
| `/cancel`                 | Membatalkan proses `/add` atau `/remove` saat diminta password.         |

### ⚙️ Konfigurasi

*   **Variabel Utama:** Konfigurasi utama (token, kunci API, admin) dilakukan melalui file `.env`.
*   **Prompt AI:** Anda dapat mengubah perilaku dasar AI dengan mengedit konstanta `SYSTEM_PROMPT`, `VISION_PROMPT`, dan `OCR_PROMPT` di dalam file `node.js`.
*   **Parameter AI:** Pengaturan seperti *temperature* (untuk Groq, di `node.js`) dan *safety/generation settings* (untuk Gemini, via `/settings` di Telegram) dapat disesuaikan.

### 🗄️ Database (Lowdb)

Proyek ini menggunakan `lowdb` untuk menyimpan data secara persisten dalam file `db.json`. File ini berisi:

*   `authorizedUsers`: Objek berisi array `admin` dan `users` WhatsApp (`62xxxx@c.us`).
*   `conversations`: Objek di mana *key* adalah `"platform:userId"` (contoh: `"whatsapp:62xxxx@c.us"` atau `"telegram:12345678"`) dan *value* adalah array riwayat percakapan.

**Penting:** Jangan mengedit `db.json` secara manual kecuali Anda tahu apa yang Anda lakukan, karena dapat merusak struktur data. Sertakan `db.json` dalam `.gitignore` Anda.

### 📁 Struktur File

WhaTel-AI/

├── node.js # Kode utama aplikasi bot
├── db.js # Modul helper untuk interaksi database lowdb
├── db.json # File database (dibuat otomatis oleh lowdb)
├── .env # Variabel lingkungan (buat file ini!)
├── package.json # Dependensi & skrip proyek
├── package-lock.json # Kunci versi dependensi
├── README.md # Dokumentasi ini
├── greeted_users.json # Daftar user WA yang sudah disapa (dibuat otomatis)
├── folder-foto/ # Direktori penyimpanan gambar (dibuat otomatis)
└── .wwebjs_auth/ # Folder sesi WhatsApp (dibuat otomatis)

### 🐛 Pemecahan Masalah

*   **Koneksi WhatsApp Gagal / Kode QR Terus Muncul:**
    *   Hapus folder `.wwebjs_auth/`.
    *   Pastikan ponsel yang terhubung ke WhatsApp memiliki koneksi internet stabil.
    *   Coba jalankan di lingkungan dengan UI (non-headless) jika masalah berlanjut untuk debug (`puppeteer: { headless: false }` di `node.js`).
*   **Error API AI (`401 Unauthorized`, `403 Forbidden`):**
    *   Periksa kembali Kunci API di file `.env`. Pastikan tidak ada typo atau spasi ekstra.
    *   Pastikan akun API Anda aktif dan memiliki kuota/billing yang cukup.
*   **Error `Cannot find module '...'`:** Jalankan `npm install` lagi. Pastikan dependensi ada di `package.json`.
*   **Perintah Telegram Tidak Dikenali:** Pastikan Anda adalah admin yang terdaftar di `TELEGRAM_ADMIN_LIST` dan ID Anda benar. Gunakan `/myid` untuk memeriksa.
*   **Error Parsing Markdown (`can't parse entities`):** Mohon laporkan bug ini! Mungkin ada respons AI atau teks lain yang berisi karakter Markdown yang tidak seimbang.

### 🤝 Berkontribusi

Kami menyambut kontribusi! Cara terbaik untuk berkontribusi saat ini adalah dengan:

1.  **Melaporkan Bug:** Jika Anda menemukan error, buat laporan detail di [GitHub Issues](https://github.com/Rozen29/WhaTel-AI/issues). Sertakan pesan error, langkah-langkah untuk mereproduksi, dan versi Node.js yang digunakan.
2.  **Saran Fitur:** Punya ide untuk fitur baru? Ajukan sebagai *feature request* di [GitHub Issues](https://github.com/Rozen29/WhaTel-AI/issues).

### 🗺️ Roadmap & Masalah Diketahui

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
