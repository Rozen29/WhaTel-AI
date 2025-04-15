// db.js
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

// --- Struktur Data Default untuk Database ---
// Ini akan digunakan jika file db.json belum ada atau kosong
const defaultData = {
  // Menyimpan user WhatsApp yang diizinkan
  authorizedUsers: {
    admin: ["@c.us"], // Format: ["628xxxx@c.us", ...]
    users: ["@c.us"]  // Format: ["628yyyy@c.us", ...]
  },
  // Menyimpan riwayat percakapan
  // Key: "platform:userId" (e.g., "whatsapp:628xxxx@c.us", "telegram:12345678")
  // Value: Array percakapan [{ role: 'system', content: '...' }, { role: 'user', content: '...' }, ...]
  conversations: {}
}

// --- Setup Database Lowdb ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, 'db.json') // Nama file database

const adapter = new JSONFile(file)
const db = new Low(adapter, defaultData) // Gunakan defaultData jika file kosong/baru

// --- Fungsi Helper untuk Mengakses Database ---
// Fungsi ini akan memastikan data terbaru dibaca sebelum diakses/ditulis

/**
 * Mengambil data user yang diotorisasi (admin & users).
 * @returns {Promise<{admin: string[], users: string[]}>}
 */
export async function getAuthorizedUsers() {
    await db.read(); // Baca data terbaru dari file
    // Pastikan struktur default ada jika file ada tapi kosong
    db.data.authorizedUsers ??= { admin: [], users: [] };
    db.data.authorizedUsers.admin ??= [];
    db.data.authorizedUsers.users ??= [];
    return db.data.authorizedUsers;
}

/**
 * Menyimpan data user yang diotorisasi ke database.
 * @param {{admin: string[], users: string[]}} usersData - Objek berisi array admin dan users.
 */
export async function saveAuthorizedUsersDb(usersData) {
    // Validasi sederhana
    if (!usersData || !Array.isArray(usersData.admin) || !Array.isArray(usersData.users)) {
        console.error("Attempted to save invalid authorized users data structure.");
        return;
    }
    await db.read(); // Baca dulu untuk menghindari overwrite jika ada perubahan lain
    db.data.authorizedUsers = usersData;
    await db.write(); // Tulis perubahan ke file db.json
}

/**
 * Mengambil riwayat percakapan untuk user tertentu.
 * @param {string} platform - 'whatsapp' or 'telegram'.
 * @param {string} userId - ID unik user (WA: 62xxxx@c.us, TG: numeric ID).
 * @param {string} systemPrompt - Prompt sistem default untuk ditambahkan jika percakapan baru.
 * @returns {Promise<Array<{role: string, content: string}>>} - Array percakapan.
 */
export async function getConversation(platform, userId, systemPrompt) {
    await db.read();
    const key = `${platform}:${userId}`;
    db.data.conversations ??= {}; // Pastikan objek conversations ada
    // Jika user belum ada history, buat dengan system prompt
    if (!db.data.conversations[key]) {
        db.data.conversations[key] = [{ role: 'system', content: systemPrompt }];
        await db.write(); // Simpan struktur baru
    }
    // Kembalikan history yang ada (atau yang baru dibuat)
    return db.data.conversations[key];
}

/**
 * Menyimpan riwayat percakapan untuk user tertentu.
 * @param {string} platform - 'whatsapp' or 'telegram'.
 * @param {string} userId - ID unik user.
 * @param {Array<{role: string, content: string}>} conversationHistory - Array percakapan lengkap.
 */
export async function saveConversationDb(platform, userId, conversationHistory) {
    if (!conversationHistory || !Array.isArray(conversationHistory)) {
        console.error(`Attempted to save invalid conversation history for ${platform}:${userId}`);
        return;
    }
    const key = `${platform}:${userId}`;
    await db.read();
    db.data.conversations ??= {};

    // --- Pembatasan History (Opsional tapi direkomendasikan) ---
    const maxHistoryLength = 50; // Simpan 50 pesan terakhir + 1 pesan sistem
    if (conversationHistory.length > maxHistoryLength + 1) {
        // Asumsikan pesan sistem (jika ada) selalu di index 0
        const systemMessage = conversationHistory[0]?.role === 'system' ? [conversationHistory[0]] : [];
        const recentMessages = conversationHistory.slice(-(maxHistoryLength));
        conversationHistory = [...systemMessage, ...recentMessages];
        // console.log(`History pruned for ${key} to ${conversationHistory.length} messages.`);
    }
    // --- Akhir Pembatasan History ---

    db.data.conversations[key] = conversationHistory;
    await db.write();
}

// Ekspor instance db utama jika perlu akses langsung (jarang dibutuhkan jika pakai helper)
export default db;
