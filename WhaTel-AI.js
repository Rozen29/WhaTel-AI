import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import TelegramBot from 'node-telegram-bot-api';
import qrcodeTerminal from 'qrcode-terminal';
import qrImageGenerator from 'qrcode';
import axios from 'axios';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const telegramErrorChatId = process.env.TELEGRAM_ERROR_CHAT_ID || null;

let tgBot = null; 

function escapeMarkdownV2Global(text) { // Renamed for clarity if used before mainInit's escapeMarkdownV2
    if (typeof text !== 'string') return '';
    return text.replace(/([_*\[\]()~`>#+-=|{}.!])/g, '\\$1');
}

function logError(context, error) {
  const errorMsgDetail = error.response?.data?.error?.message || error.response?.data || error.message || error.toString();
  const errMsg = `[${new Date().toISOString()}] Error in ${context}: ${errorMsgDetail}`;
  console.error(errMsg);
  if (error.stack) console.error(error.stack);
  if (telegramErrorChatId && tgBot) { 
    const telegramMessage = errMsg.length > 4000 ? errMsg.substring(0, 4000) + "..." : errMsg;
    tgBot.sendMessage(telegramErrorChatId, escapeMarkdownV2Global(telegramMessage), { parse_mode: 'MarkdownV2' })
      .catch(e => console.error('Failed to send error to Telegram:', e.message || e));
  }
}

const lastLoginFile = path.join(__dirname, '.last_login.json'); 
const ADMIN_USERNAME_LOGIN = process.env.ADMIN_USERNAME || 'admin'; // Renamed to avoid conflict
const ADMIN_PASSWORD_LOGIN = process.env.ADMIN_PASSWORD || 'admin123'; // Renamed to avoid conflict

function getLastLoginTime() { 
  try {
    if (fs.existsSync(lastLoginFile)) {
      const data = JSON.parse(fs.readFileSync(lastLoginFile, 'utf8'));
      return data.lastLogin || 0;
    }
  } catch (err) { logError('getLastLoginTime', err); }
  return 0;
}

function setLastLoginTime(timestamp) { 
  try {
    fs.writeFileSync(lastLoginFile, JSON.stringify({ lastLogin: timestamp }), 'utf8');
  } catch (err) { logError('setLastLoginTime', err); }
}

async function performDailyLogin() { 
  const now = Date.now();
  const lastLogin = getLastLoginTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (now - lastLogin < oneDayMs) {
    console.log('[AUTH] Already logged in today.');
    return true;
  }
  try {
    setLastLoginTime(now);
    console.log(`[AUTH] Daily login successful for user ${ADMIN_USERNAME_LOGIN}`);
    return true;
  } catch (err) {
    logError('performDailyLogin', err);
    return false;
  }
}

const imageStorageDir = path.join(__dirname, 'folder-foto');
const conversationsDir = path.join(__dirname, 'conversations');
const greetedUsersFile = path.join(__dirname, 'greeted_users.json');
const authorizedUsersFile = path.join(__dirname, 'authorized_users.json');

if (!fs.existsSync(imageStorageDir)) fs.mkdirSync(imageStorageDir, { recursive: true });
if (!fs.existsSync(conversationsDir)) fs.mkdirSync(conversationsDir, { recursive: true });

(async () => {
  const loginOk = await performDailyLogin(); 
  if (!loginOk) {
    console.error('[AUTH] Autentikasi harian gagal. Aplikasi dihentikan.');
    process.exit(1);
  }
  mainInit(); 
})();

let client = null;
let whatsAppClientState = 'UNINITIALIZED';
let currentTelegramChatIdForWA = null;
let qrCodeMessageTelegramData = null;
let authorizedUsers = { admin: [], users: [] }; // Moved to be accessible by rate limit functions earlier

function mainInit() {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  // This ADMIN_PASSWORD is for TG commands like /add, /remove
  const ADMIN_PASSWORD_CMD = process.env.ADMIN_PASSWORD || 'admin123'; 

  function escapeMarkdownV2(text) {
      if (typeof text !== 'string') return '';
      return text.replace(/([_*\[\]()~`>#+-=|{}.!])/g, '\\$1');
  }
  
  if (telegramToken) {
    tgBot = new TelegramBot(telegramToken, { polling: true });
  } else {
    console.warn("TELEGRAM_BOT_TOKEN missing. TG features disabled.");
  }

  // Moved authorizedUsers loading to happen once mainInit starts, before rate limit functions might need it.
  // Actually, rate limit functions need it earlier, so moved authorizedUsers declaration globally and load here.
  function loadAuthorizedUsers() {
    try {
      if (fs.existsSync(authorizedUsersFile)) {
        authorizedUsers = JSON.parse(fs.readFileSync(authorizedUsersFile, 'utf8'));
        console.log('Authorized users loaded.');
      } else { 
        authorizedUsers = { admin: ['6282183206692@c.us'], users: ['6285678935679@c.us'] }; // Default examples
        fs.writeFileSync(authorizedUsersFile, JSON.stringify(authorizedUsers, null, 2));
        console.log('Default authorized_users.json created with examples.');
      }
    } catch (error) { logError('loadAuthorizedUsers', error); }
  }
  loadAuthorizedUsers(); // Load them now

  function saveAuthorizedUsers() {
    try { fs.writeFileSync(authorizedUsersFile, JSON.stringify(authorizedUsers, null, 2)); }
    catch (error) { logError('saveAuthorizedUsers', error); }
  }

  // This function checks if a user is generally allowed to interact with the bot features
  // (either as an admin or a registered user).
  // Rate limit exemption for admins is handled separately in checkAndUpdateRateLimit.
  function isAuthorized(sender) {
    return (authorizedUsers.admin.includes(sender) || authorizedUsers.users.includes(sender));
  }
  
  // --- START OF RATE LIMITING LOGIC ---
  const DAILY_MESSAGE_LIMIT = 20;
  const rateLimitFile = path.join(__dirname, 'rate_limit.json');

  function loadRateLimitData() {
    try {
      if (fs.existsSync(rateLimitFile)) {
        const data = fs.readFileSync(rateLimitFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) { logError('loadRateLimitData', error); }
    return {};
  }

  function saveRateLimitData(data) {
    try {
      fs.writeFileSync(rateLimitFile, JSON.stringify(data, null, 2));
    } catch (error) { logError('saveRateLimitData', error); }
  }

  function checkAndUpdateRateLimit(userId) {
    if (authorizedUsers.admin.includes(userId)) {
      return true; 
    }

    const allUsersRateLimitData = loadRateLimitData();
    let userRateData = allUsersRateLimitData[userId];
    const today = new Date().toISOString().split('T')[0];

    if (!userRateData || (userRateData.lastResetDate && new Date(userRateData.lastResetDate).toISOString().split('T')[0] !== today)) {
      userRateData = { messageCount: 0, lastResetDate: new Date().toISOString() };
    }

    if (userRateData.messageCount >= DAILY_MESSAGE_LIMIT) {
      allUsersRateLimitData[userId] = userRateData; 
      saveRateLimitData(allUsersRateLimitData);
      return false; 
    }

    userRateData.messageCount++;
    allUsersRateLimitData[userId] = userRateData; 
    saveRateLimitData(allUsersRateLimitData);
    return true; 
  }

  function resetRateLimitForUser(userIdToReset) {
    const allUsersRateLimitData = loadRateLimitData();
    const sanitizedUserId = userIdToReset.endsWith('@c.us') ? userIdToReset : `${userIdToReset.replace(/\D/g, '')}@c.us`;


    if (authorizedUsers.admin.includes(sanitizedUserId)) {
      return `User \`${escapeMarkdownV2(sanitizedUserId)}\` is an admin and is not subject to rate limits.`;
    }

    if (allUsersRateLimitData[sanitizedUserId]) {
      allUsersRateLimitData[sanitizedUserId].messageCount = 0;
      allUsersRateLimitData[sanitizedUserId].lastResetDate = new Date().toISOString();
      saveRateLimitData(allUsersRateLimitData);
      return `Rate limit for user \`${escapeMarkdownV2(sanitizedUserId)}\` has been reset successfully.`;
    } else {
      allUsersRateLimitData[sanitizedUserId] = {
          messageCount: 0,
          lastResetDate: new Date().toISOString()
      };
      saveRateLimitData(allUsersRateLimitData);
      return `User \`${escapeMarkdownV2(sanitizedUserId)}\` was not found in rate limit data or had no usage; their limit is now explicitly reset/set to 0.`;
    }
  }
  // --- END OF RATE LIMITING LOGIC ---


  let TEMPERATURE = 0.9;
  let chatbotEnabled = true;

  let greetedUsers = new Set();
  try { if (fs.existsSync(greetedUsersFile)) JSON.parse(fs.readFileSync(greetedUsersFile, 'utf8')).forEach(user => greetedUsers.add(user)); }
  catch (error) { logError('greetedUsersLoad', error); }
  function saveGreetedUsers() {
    try { fs.writeFileSync(greetedUsersFile, JSON.stringify(Array.from(greetedUsers))); }
    catch (error) { logError('saveGreetedUsers', error); }
  }

  function generateRandomID() { return Math.floor(Math.random() * 1e10).toString(); }

  let geminiSettings = {
    safety: { harassment: false, hate: false, sexuallyExplicit: false, dangerousContent: false },
    generationConfig: { temperature: 0.9, topP: 0.95, topK: 40, maxOutputTokens: 2048 }
  };
  let API_PROVIDERS = [
    { name: 'Groq', apiKey: process.env.GROQ_API_KEY, models: [{ name: 'llama3-70b-8192', id: generateRandomID() }, { name: 'llama3-8b-8192', id: generateRandomID() }], visionModels: [{ name: 'llava-v1.5-7b', id: generateRandomID() }], currentModelIndex: 0, currentVisionModelIndex: 0, available: true },
    { name: 'Gemini', apiKey: process.env.GEMINI_API_KEY, models: [{ name: 'gemini-1.5-pro-latest', id: generateRandomID() }, { name: 'gemini-1.5-flash-latest', id: generateRandomID() }], visionModels: [{ name: 'gemini-1.5-pro-latest', id: generateRandomID() }], currentModelIndex: 0, currentVisionModelIndex: 0, available: true }
  ];
  let currentProviderIndex = 0;

  const AUTHORIZED_GREETING = `Hello! Welcome to the ROZEN AI Assistant service.\nUse /history, /settings, /show_model, /show.\nType /clear_history to clear conversation.`;
  const SYSTEM_PROMPT = `You are ROZEN AI, an assistant by Rozen. Answer briefly.`;
  const VISION_PROMPT = `Analyze this image briefly but comprehensively.`;
  const OCR_PROMPT = `Extract all text visible in this image. Provide only the extracted text.`;

  function getConversationFilePath(sender) {
    const sanitized = sender.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return path.join(conversationsDir, `conversation_${sanitized}.json`);
  }
  function loadConversation(sender) {
    const filepath = getConversationFilePath(sender);
    if (fs.existsSync(filepath)) {
      try {
        const conv = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        if (Array.isArray(conv) && conv.length > 0 && conv[0].role === 'system') return conv;
        return [{ role: 'system', content: SYSTEM_PROMPT }, ...(conv?.filter(m => m.role !== 'system') || [])];
      } catch (error) { logError('loadConversation-parse', error); }
    }
    return [{ role: 'system', content: SYSTEM_PROMPT }];
  }
  function saveConversation(sender, conversation) {
    const filepath = getConversationFilePath(sender);
    try {
      if (!conversation || conversation.length === 0 || (conversation[0] && conversation[0].role !== 'system')) {
        conversation = [{ role: 'system', content: SYSTEM_PROMPT }, ...(conversation?.filter(m => m.role !== 'system') || [])];
      }
      fs.writeFileSync(filepath, JSON.stringify(conversation, null, 2));
    } catch (error) { logError('saveConversation', error); }
  }

  async function saveImageFromMessage(msg) {
    try {
      if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        if (media && media.mimetype && media.mimetype.startsWith('image/')) {
          const ext = media.mimetype.split('/')[1] || 'jpg';
          const fileName = `image_${Date.now()}.${ext}`;
          fs.writeFileSync(path.join(imageStorageDir, fileName), media.data, 'base64');
          return { mediaType: media.mimetype, mediaData: media.data };
        }
      }
    } catch (error) { logError('saveImageFromMessage', error); }
    return null;
  }

  async function askAI(prompt, isVision = false, imageContent = null, conversationHistory = null) {
    try {
      const provider = API_PROVIDERS[currentProviderIndex];
      if (!provider.apiKey) return "API key not available for current provider.";
      let modelName, apiUrl, payload;
      const headers = { 'Content-Type': 'application/json' };
      if (isVision && imageContent) {
        if (provider.name === 'Gemini') {
          modelName = provider.visionModels[provider.currentVisionModelIndex].name;
          apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${provider.apiKey}`;
          payload = { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: imageContent } }] }], safety_settings: Object.entries(geminiSettings.safety).map(([c, b]) => ({ category: `HARM_CATEGORY_${c.toUpperCase().replace(/\s+/g, '_')}`, threshold: b ? "BLOCK_MEDIUM_AND_ABOVE" : "BLOCK_ONLY_HIGH" })), generation_config: geminiSettings.generationConfig };
        } else if (provider.name === 'Groq') {
          modelName = provider.visionModels[provider.currentVisionModelIndex].name;
          apiUrl = `https://api.groq.com/openai/v1/chat/completions`; headers['Authorization'] = `Bearer ${provider.apiKey}`;
          payload = { model: modelName, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageContent}` } }] }], temperature: TEMPERATURE, max_tokens: geminiSettings.generationConfig.maxOutputTokens };
        } else return "Current provider misconfigured for vision.";
      } else {
        // Ensure currentConversation is an array and has the system prompt if it's new or empty
        let currentConversation = conversationHistory ? [...conversationHistory] : [{ role: "system", content: SYSTEM_PROMPT }];
        if (currentConversation.length === 0 || currentConversation[0].role !== 'system') {
            currentConversation.unshift({ role: "system", content: SYSTEM_PROMPT });
        }
        
        // Add user prompt if it's not already the last message from the user
        if (prompt && (currentConversation.length === 0 || currentConversation[currentConversation.length -1].role !== 'user' || currentConversation[currentConversation.length -1].content !== prompt)) { 
            currentConversation.push({role: 'user', content: prompt}); 
        }

        if (provider.name === 'Gemini') {
          modelName = provider.models[provider.currentModelIndex].name;
          apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${provider.apiKey}`;
          const geminiMsgs = currentConversation.map(m=>({role:m.role==='assistant'?'model':(m.role==='system'?'user':m.role),parts:[{text:m.content}]})).filter(m=>m.parts[0].text.trim()!=="");
          if (geminiMsgs.length > 0 && geminiMsgs[0].role === 'model' && currentConversation[0].role === 'system') {
             // Gemini API expects user role for the first message if a system prompt is converted to user.
             // Or, better: filter out system prompt if it's the only one and was just for context.
             // For simplicity, let's ensure the API gets correctly structured messages.
             // The current mapping already converts 'system' to 'user' for Gemini, which is okay.
          }
          payload = { contents: geminiMsgs, safety_settings: Object.entries(geminiSettings.safety).map(([c,b])=>({category:`HARM_CATEGORY_${c.toUpperCase().replace(/\s+/g, '_')}`,threshold:b?"BLOCK_MEDIUM_AND_ABOVE":"BLOCK_ONLY_HIGH"})), generation_config: geminiSettings.generationConfig };
        } else if (provider.name === 'Groq') {
          modelName = provider.models[provider.currentModelIndex].name;
          apiUrl = `https://api.groq.com/openai/v1/chat/completions`; headers['Authorization'] = `Bearer ${provider.apiKey}`;
          payload = { model: modelName, messages: currentConversation.filter(m=>m.content.trim()!==""), temperature: TEMPERATURE, max_tokens: geminiSettings.generationConfig.maxOutputTokens };
        } else return "Current provider misconfigured for text.";
      }
      const response = await axios.post(apiUrl, payload, { headers });
      if (provider.name === 'Gemini') {
        if (response.data.candidates?.[0]?.content?.parts) return response.data.candidates[0].content.parts[0].text;
        if (response.data.promptFeedback?.blockReason) { logError('askAI-Gemini-Blocked', `Blocked: ${response.data.promptFeedback.blockReason}`); return `Blocked by Gemini: ${response.data.promptFeedback.blockReason}.`; }
        logError('askAI-Gemini-NoResponse', JSON.stringify(response.data)); return "No valid Gemini response.";
      } else if (provider.name === 'Groq') {
        if (response.data.choices?.[0]?.message) return response.data.choices[0].message.content;
        logError('askAI-Groq-NoResponse', JSON.stringify(response.data)); return "No valid Groq response.";
      }
    } catch (error) { logError(`askAI-${API_PROVIDERS[currentProviderIndex].name}`, error); return "AI error. Check logs."; }
    return "AI Error.";
  }
  
  async function whatsAppMessageHandler(msg) {
    if (whatsAppClientState !== 'READY') { console.log(`WA msg ignored (State: ${whatsAppClientState}).`); return; }
    try {
      const senderId = msg.from;
  
      if (msg.body === '/clear' || msg.body === '/clear_history') {
        if (isAuthorized(senderId)) { saveConversation(senderId, []); msg.reply("History cleared."); } // Pass empty array to saveConversation
        else msg.reply("Not authorized."); return;
      }
  
      if (!chatbotEnabled || senderId.endsWith('@g.us') || (!authorizedUsers.users.includes(senderId) && !authorizedUsers.admin.includes(senderId))) {
          return; 
      }
  
      if (!greetedUsers.has(senderId)) { 
          greetedUsers.add(senderId); 
          saveGreetedUsers(); 
          msg.reply(AUTHORIZED_GREETING); 
          saveConversation(senderId, loadConversation(senderId)); 
          return; 
      }
      
      if (!checkAndUpdateRateLimit(senderId)) {
          console.log(`Daily message limit reached for ${senderId}.`);
          msg.reply("Sorry, your daily message limit for the AI has been reached. Please try again tomorrow.");
          return; 
      }
      
      let conversation = loadConversation(senderId);
  
      if (msg.hasMedia) {
        const imageInfo = await saveImageFromMessage(msg);
        if (imageInfo) {
          const prompt = msg.body || VISION_PROMPT; 
          // Add user message with image prompt to conversation
          if (conversation.length === 0 || conversation[conversation.length -1].role !== 'user' || conversation[conversation.length -1].content !== prompt) {
            conversation.push({ role: 'user', content: prompt + " (with image)" }); // Indicate image for history
          }
          const aiResp = await askAI(prompt, true, imageInfo.mediaData, null); // Vision calls are often standalone, not using full history
          conversation.push({ role: 'assistant', content: aiResp });
          saveConversation(senderId, conversation); 
          msg.reply(aiResp); 
          return;
        }
      }
      
      if (msg.body) { 
        if (conversation.length === 0 || conversation[conversation.length -1].role !== 'user' || conversation[conversation.length -1].content !== msg.body) {
          conversation.push({ role: 'user', content: msg.body });
        }
        const aiResp = await askAI(null, false, null, conversation); // Pass null for prompt if it's already in conversation
        conversation.push({ role: 'assistant', content: aiResp });
        saveConversation(senderId, conversation); 
        msg.reply(aiResp);
      }
    } catch (error) { logError('whatsAppMessageHandler', error); if (msg?.reply) msg.reply("Error processing message."); }
  }

  async function initializeWhatsAppClient(telegramChatId) {
    currentTelegramChatIdForWA = telegramChatId;
    if (['INITIALIZING', 'READY', 'AUTHENTICATED', 'QR_RECEIVED'].includes(whatsAppClientState)) {
      if (tgBot) tgBot.sendMessage(currentTelegramChatIdForWA, escapeMarkdownV2(`WA client already ${whatsAppClientState}. Use /status.`), { parse_mode: 'MarkdownV2' });
      return;
    }
    if (tgBot) tgBot.sendMessage(currentTelegramChatIdForWA, "Initializing WhatsApp client\\.\\.\\.", { parse_mode: 'MarkdownV2' });
    whatsAppClientState = 'INITIALIZING';
    if (client) { try { await client.destroy(); console.log("Previous WA client destroyed."); } catch (e) { logError('WA Pre-destroy', e); } }
    
    client = new Client({
      authStrategy: new LocalAuth({dataPath: path.join(__dirname, '.wwebjs_auth')}),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=site-per-process',
          '--window-size=1280,800'
        ],
        timeout: 60000, // 60 seconds max for browser launch
        slowMo: 0
      },
      takeoverOnConflict: true,
      takeoverTimeoutMs: 3000
    });

    client.on('qr', async (qr) => {
      whatsAppClientState = 'QR_RECEIVED';
      console.log(`[${new Date().toISOString()}] WA QR (console):`);
      qrcodeTerminal.generate(qr, { small: true });
      if (tgBot && currentTelegramChatIdForWA) {
        try {
          const qrBuffer = await qrImageGenerator.toBuffer(qr);
          const caption = "Scan this QR with WhatsApp. It will refresh if not scanned.";
          if (qrCodeMessageTelegramData && qrCodeMessageTelegramData.chatId === currentTelegramChatIdForWA) {
            try { await tgBot.deleteMessage(qrCodeMessageTelegramData.chatId, qrCodeMessageTelegramData.messageId); console.log('Old TG QR msg deleted.'); }
            catch (delErr) { logError('WA QR Delete Old TG', delErr); }
          }
          const newMessage = await tgBot.sendPhoto(currentTelegramChatIdForWA, qrBuffer, { caption: caption });
          qrCodeMessageTelegramData = { chatId: currentTelegramChatIdForWA, messageId: newMessage.message_id };
          console.log(`[${new Date().toISOString()}] New/Updated TG QR msg sent.`);
        } catch (e) { logError('WA QR to TG Proc', e); tgBot.sendMessage(currentTelegramChatIdForWA, "QR send error\\. Check console\\.", { parse_mode: 'MarkdownV2' }); qrCodeMessageTelegramData = null; }
      }
    });
    client.on('authenticated', () => {
      whatsAppClientState = 'AUTHENTICATED';
      console.log(`[${new Date().toISOString()}] WA authenticated!`);
      if (tgBot && currentTelegramChatIdForWA) tgBot.sendMessage(currentTelegramChatIdForWA, "WhatsApp client authenticated\\!", { parse_mode: 'MarkdownV2' });
      if (qrCodeMessageTelegramData && qrCodeMessageTelegramData.chatId === currentTelegramChatIdForWA) {
        tgBot.deleteMessage(qrCodeMessageTelegramData.chatId, qrCodeMessageTelegramData.messageId).then(()=>console.log("TG QR msg deleted on auth.")).catch(e => logError('WA QR Del Auth', e));
        qrCodeMessageTelegramData = null;
      }
    });
    client.on('ready', () => {
      whatsAppClientState = 'READY';
      console.log(`[${new Date().toISOString()}] WA client ready!`);
      if (tgBot && currentTelegramChatIdForWA) tgBot.sendMessage(currentTelegramChatIdForWA, "*WhatsApp client READY\\!*", { parse_mode: 'MarkdownV2' });
      if (telegramErrorChatId && tgBot && currentTelegramChatIdForWA !== telegramErrorChatId) tgBot.sendMessage(telegramErrorChatId, "*WhatsApp client connected & READY\\!*", { parse_mode: 'MarkdownV2' });
      client.on('message', whatsAppMessageHandler);
    });
    client.on('auth_failure', (msg) => {
      whatsAppClientState = 'AUTH_FAILURE'; logError('WA Auth Failure', msg);
      const failMsg = escapeMarkdownV2(`WA auth failed: ${msg}. Try /connect.`);
      if (tgBot && currentTelegramChatIdForWA) tgBot.sendMessage(currentTelegramChatIdForWA, failMsg, { parse_mode: 'MarkdownV2' });
      if (telegramErrorChatId && tgBot) tgBot.sendMessage(telegramErrorChatId, escapeMarkdownV2(`*CRITICAL: WA Auth Failed!* ${msg}`), { parse_mode: 'MarkdownV2' });
      if (qrCodeMessageTelegramData && qrCodeMessageTelegramData.chatId === currentTelegramChatIdForWA) {
          tgBot.deleteMessage(qrCodeMessageTelegramData.chatId, qrCodeMessageTelegramData.messageId).catch(e => logError('WA QR Del AuthFail', e));
          qrCodeMessageTelegramData = null;
      }
    });
    client.on('disconnected', (reason) => {
      whatsAppClientState = 'DISCONNECTED'; logError('WA Disconnected', `Reason: ${reason}`);
      const discMsg = escapeMarkdownV2(`WA disconnected: ${reason}. Use /connect.`);
      if (tgBot && currentTelegramChatIdForWA) tgBot.sendMessage(currentTelegramChatIdForWA, discMsg, { parse_mode: 'MarkdownV2' });
      if (telegramErrorChatId && tgBot) tgBot.sendMessage(telegramErrorChatId, escapeMarkdownV2(`*WARNING: WA Disconnected!* ${reason}`), { parse_mode: 'MarkdownV2' });
      if (qrCodeMessageTelegramData && qrCodeMessageTelegramData.chatId === currentTelegramChatIdForWA) {
          tgBot.deleteMessage(qrCodeMessageTelegramData.chatId, qrCodeMessageTelegramData.messageId).catch(e => logError('WA QR Del Disconnect', e));
          qrCodeMessageTelegramData = null;
      }
    });
    client.on('change_state', state => {
      if (['UNPAIRED', 'CONFLICT', 'PROXYBLOCK', 'TOSBLOCK', 'SMB_TOSBLOCK', 'DEPRECATED_VERSION'].includes(state)) {
          logError('WA State Change', `State: ${state}`);
          whatsAppClientState = state.toUpperCase();
          const msgContent = escapeMarkdownV2(`WA state: *${state}*. /connect if needed.`);
          if (tgBot && currentTelegramChatIdForWA)
              tgBot.sendMessage(currentTelegramChatIdForWA, msgContent, { parse_mode: 'MarkdownV2' });
          if (telegramErrorChatId && tgBot)
              tgBot.sendMessage(telegramErrorChatId, escapeMarkdownV2(`*WARNING: WA State Change ${state}!* May need intervention.`), { parse_mode: 'MarkdownV2' });
      } else {
          console.log(`[${new Date().toISOString()}] WA State Change: ${state}`);
      }
    });

    try {
        await client.initialize();
    } catch (initError) {
        logError('WA Client Initialize', initError);
        whatsAppClientState = 'UNINITIALIZED'; 
        if (tgBot && currentTelegramChatIdForWA) {
            tgBot.sendMessage(currentTelegramChatIdForWA, escapeMarkdownV2(`Failed to initialize WhatsApp client: ${initError.message}. Check logs.`), { parse_mode: 'MarkdownV2' });
        }
    }
  }

  /* --- Express.js comment --- */

  const telegramAdminList = process.env.TELEGRAM_ADMIN_LIST ? process.env.TELEGRAM_ADMIN_LIST.split(',').map(s => s.trim()).filter(id => id) : [];
  console.log('Telegram Admin List:', telegramAdminList);
  function isTelegramAdmin(msg) { return tgBot && msg?.from && telegramAdminList.includes(msg.from.id.toString()); }

  if (tgBot) {
      tgBot.onText(/\/connect/, async (msg) => {
          if (!isTelegramAdmin(msg)) { tgBot.sendMessage(msg.chat.id, "Not authorized\\.", { parse_mode: 'MarkdownV2' }); return; }
          await initializeWhatsAppClient(msg.chat.id.toString());
      });
      // ... (other /myid, /status, /show, /show_model, /settings, /history, /start_chatbot, /stop_chatbot, /list, /add, /remove, /use_provider, /use_model, /use_vision_model, /ocr, /clear_history, /help handlers are assumed to be here and correct)
      tgBot.onText(/\/myid/, (msg) => {
        const uid = msg.from?.id || 'unknown'; const cid = msg.chat?.id || 'unknown'; const user = msg.from?.username || 'N/A';
        tgBot.sendMessage(msg.chat.id, `ID: \`${uid}\`\nChat: \`${cid}\`\nUser: @${escapeMarkdownV2(user)}\nAdmin: ${isTelegramAdmin(msg)?'Yes':'No'}`, { parse_mode: 'MarkdownV2'});
      });
      tgBot.onText(/\/status/, (msg) => {
        if (!isTelegramAdmin(msg)) { tgBot.sendMessage(msg.chat.id, "Not authorized\\."); return; }
        const pStatus = API_PROVIDERS.map(p=>`*${escapeMarkdownV2(p.name)}*: ${p.apiKey?(p.available?'Ok':'Fail'):'_KEY MISSING_'}`).join('\n');
        const cp = API_PROVIDERS[currentProviderIndex]; const cm = escapeMarkdownV2(cp.models[cp.currentModelIndex].name);
        const cvm = cp.visionModels.length > 0 ? escapeMarkdownV2(cp.visionModels[cp.currentVisionModelIndex].name) : "N/A";
        let waS = escapeMarkdownV2(whatsAppClientState);
        if (whatsAppClientState === 'UNINITIALIZED') waS = "Not Connected \\(/connect\\)";
        else if (whatsAppClientState === 'READY') waS = "*WA Connected & Ready*";
        else if (whatsAppClientState === 'QR_RECEIVED') waS = "WA QR Active";
        else if (whatsAppClientState === 'DISCONNECTED') waS = "_WA Disconnected_";
        const res = `*Bot Status:*\nLogic: \`${chatbotEnabled?'Active':'Inactive'}\`\nWA: ${waS}\n\n*AI:*\nProvider: \`${escapeMarkdownV2(cp.name)}\`\nText: \`${cm}\`\nVision: \`${cvm}\`\nAll:\n${pStatus}`;
        tgBot.sendMessage(msg.chat.id, res, { parse_mode: 'MarkdownV2' });
      });
      tgBot.onText(/\/show|\/version/, (msg) => {
        if (isTelegramAdmin(msg)) tgBot.sendMessage(msg.chat.id, `Bot Ver: ${escapeMarkdownV2('1.0.8 (Per-User Rate Limit)')}`, { parse_mode: 'MarkdownV2'});
        else tgBot.sendMessage(msg.chat.id, "Not authorized\\.");
      });
      tgBot.onText(/\/show_model/, (msg) => {
        if (!isTelegramAdmin(msg)) { tgBot.sendMessage(msg.chat.id, "Not authorized\\."); return; }
        let txt = "*AI Models:*\n"; API_PROVIDERS.forEach((p, pI) => {
          txt += `\nProv ${pI}: *${escapeMarkdownV2(p.name)}*${pI===currentProviderIndex?' \\(Current\\)':''}\n Txt:\n`;
          p.models.forEach((m, mI) => { txt += `  ${mI}: \`${escapeMarkdownV2(m.name)}\`${mI===p.currentModelIndex?' \\(Cur\\)':''}\n`; });
          if (p.visionModels?.length) { txt += ` Vis:\n`; p.visionModels.forEach((vm, vmI) => { txt += `  ${vmI}: \`${escapeMarkdownV2(vm.name)}\`${vmI===p.currentVisionModelIndex?' \\(Cur\\)':''}\n`; });}
        }); tgBot.sendMessage(msg.chat.id, txt, { parse_mode: 'MarkdownV2' });
      });
      tgBot.onText(/\/settings(\s+(\S+)\s+(\S+))?/, (msg, match) => {
        if (!isTelegramAdmin(msg)) { tgBot.sendMessage(msg.chat.id, "Not authorized\\."); return; }
        if (!match?.[2] || !match?.[3]) {
          let s = `*Settings:*\n\n*Safety* \\(Gemini\\):\n`+Object.entries(geminiSettings.safety).map(([k,v])=>`• ${escapeMarkdownV2(k)}: \`${v?'BLOCK':'MORE'}\``).join('\n')+
          `\n\n*GenConf* \\(Gemini\\):\n`+Object.entries(geminiSettings.generationConfig).map(([k,v])=>`• ${escapeMarkdownV2(k)}: \`${v}\``).join('\n')+
          `\n\n*Temp* \\(Groq\\): \`${TEMPERATURE}\`\n\n*Ex:*\n\`/settings safety.harassment block\`\n\`/settings config.temp 0.7\`\n\`/settings groq.temp 0.8\``;
          tgBot.sendMessage(msg.chat.id, s, {parse_mode:'MarkdownV2'}); return;
        }
        const p = match[2].trim(); const v = match[3].trim().toLowerCase();
        if (p.startsWith('safety.')) {const f=p.split('.')[1]; if(geminiSettings.safety.hasOwnProperty(f)){geminiSettings.safety[f]=(v==='block');tgBot.sendMessage(msg.chat.id,`Gemini safety \`${escapeMarkdownV2(f)}\` = \`${v.toUpperCase()}\`\\.`,{parse_mode:'MarkdownV2'});}else tgBot.sendMessage(msg.chat.id,`Safety '\`${escapeMarkdownV2(f)}\`' invalid\\.`,{parse_mode:'MarkdownV2'});
        } else if (p.startsWith('config.')) {const f=p.split('.')[1]; if(geminiSettings.generationConfig.hasOwnProperty(f)){const nV=parseFloat(v);if(!isNaN(nV)){geminiSettings.generationConfig[f]=nV; tgBot.sendMessage(msg.chat.id,`Gemini conf \`${escapeMarkdownV2(f)}\` = \`${nV}\`\\.`,{parse_mode:'MarkdownV2'});}else tgBot.sendMessage(msg.chat.id,`Val for \`${escapeMarkdownV2(f)}\` must be num\\.`,{parse_mode:'MarkdownV2'});}else tgBot.sendMessage(msg.chat.id,`Conf '\`${escapeMarkdownV2(f)}\`' invalid\\.`,{parse_mode:'MarkdownV2'});
        } else if (p==='groq.temperature'||p==='groq.temp'){const nV=parseFloat(v);if(!isNaN(nV)&&nV>=0&&nV<=2){TEMPERATURE=nV;tgBot.sendMessage(msg.chat.id,`Groq temp = \`${nV}\`\\.`,{parse_mode:'MarkdownV2'});}else tgBot.sendMessage(msg.chat.id,`Invalid Groq temp \\(0\\-2\\)\\.`,{parse_mode:'MarkdownV2'});
        } else tgBot.sendMessage(msg.chat.id,`Invalid settings path\\.`,{parse_mode:'MarkdownV2'});
      });
      tgBot.onText(/\/history/, (msg) => {
        if (!isTelegramAdmin(msg)) { tgBot.sendMessage(msg.chat.id, "Not authorized\\."); return; }
        const convId = `telegram_${msg.from.id}`; let conv = loadConversation(convId); const last = conv.slice(-10);
        if (last.length <= 1 && last[0]?.role === 'system') { tgBot.sendMessage(msg.chat.id, "No history\\."); }
        else { let res = "*History* \\(last 10\\):\n\n"; last.forEach((l, i) => { if (l.role !== 'system') res += `${i+1}\\. \\[${escapeMarkdownV2(l.role)}\\] ${escapeMarkdownV2(l.content.substring(0,150))}${l.content.length>150?'...':''}\n\n`; }); tgBot.sendMessage(msg.chat.id, res, { parse_mode: 'MarkdownV2' }); }
      });
      tgBot.onText(/\/start_chatbot/, (msg) => { if (isTelegramAdmin(msg)) { chatbotEnabled = true; tgBot.sendMessage(msg.chat.id, "Chatbot ON\\.", { parse_mode: 'MarkdownV2' }); } else tgBot.sendMessage(msg.chat.id, "Not authorized\\.");});
      tgBot.onText(/\/stop_chatbot/, (msg) => { if (isTelegramAdmin(msg)) { chatbotEnabled = false; tgBot.sendMessage(msg.chat.id, "Chatbot OFF\\.", { parse_mode: 'MarkdownV2' }); } else tgBot.sendMessage(msg.chat.id, "Not authorized\\.");});
      tgBot.onText(/\/list/, (msg) => {
        if (!isTelegramAdmin(msg)) { tgBot.sendMessage(msg.chat.id, "Not authorized\\."); return; }
        const adminL = authorizedUsers.admin.map(u => escapeMarkdownV2(u)).join('\n') || "_None_"; 
        const userL = authorizedUsers.users.map(u => escapeMarkdownV2(u)).join('\n') || "_None_";
        tgBot.sendMessage(msg.chat.id, `*WA Auth Users:*\nAdmin \\(No Rate Limit\\):\n${adminL}\n\nUser \\(Rate Limited\\):\n${userL}`, { parse_mode: 'MarkdownV2' });
      });
      const pendingAddRequests = new Map();
      tgBot.onText(/\/add\s+(\+?\d+)/, (msg, match) => {
        if (!isTelegramAdmin(msg)) { tgBot.sendMessage(msg.chat.id, "Not authorized\\."); return; }
        const newUser = `${match[1].replace(/\D/g,'')}@c.us`; pendingAddRequests.set(msg.chat.id,{newUser,attempt:0,originalUserId:msg.from.id});
        tgBot.sendMessage(msg.chat.id, "Admin pass for WA user \\(or /cancel\\):", { parse_mode: 'MarkdownV2' });
      });
      const pendingRemoveRequests = new Map();
      tgBot.onText(/\/remove\s+(\+?\d+)/, (msg, match) => {
        if (!isTelegramAdmin(msg)) { tgBot.sendMessage(msg.chat.id, "Not authorized\\."); return; }
        const targetUser = `${match[1].replace(/\D/g,'')}@c.us`; pendingRemoveRequests.set(msg.chat.id,{targetUser,attempt:0,originalUserId:msg.from.id});
        tgBot.sendMessage(msg.chat.id, "Admin pass to remove WA user \\(or /cancel\\):", { parse_mode: 'MarkdownV2' });
      });
      tgBot.onText(/\/use_provider\s+(\d+)/, (msg, match) => {
        if (!isTelegramAdmin(msg)) { tgBot.sendMessage(msg.chat.id, "Not authorized\\."); return; } const idx = parseInt(match[1]);
        if (isNaN(idx)||idx<0||idx>=API_PROVIDERS.length) { tgBot.sendMessage(msg.chat.id,`Invalid idx\\. 0\\-${API_PROVIDERS.length-1}`,{parse_mode:'MarkdownV2'});return;}
        currentProviderIndex=idx; tgBot.sendMessage(msg.chat.id,`AI provider: \`${escapeMarkdownV2(API_PROVIDERS[idx].name)}\``,{parse_mode:'MarkdownV2'});
      });
      tgBot.onText(/\/use_model\s+(\d+)/, (msg, match) => {
        if (!isTelegramAdmin(msg)) { tgBot.sendMessage(msg.chat.id, "Not authorized\\."); return; } const p=API_PROVIDERS[currentProviderIndex];const idx=parseInt(match[1]);
        if(isNaN(idx)||idx<0||idx>=p.models.length){tgBot.sendMessage(msg.chat.id,`Invalid model idx for \`${escapeMarkdownV2(p.name)}\`\\. 0\\-${p.models.length-1}`,{parse_mode:'MarkdownV2'});return;}
        p.currentModelIndex=idx;tgBot.sendMessage(msg.chat.id,`Txt model for \`${escapeMarkdownV2(p.name)}\`: \`${escapeMarkdownV2(p.models[idx].name)}\``,{parse_mode:'MarkdownV2'});
      });
      tgBot.onText(/\/use_vision_model\s+(\d+)/, (msg, match) => {
        if(!isTelegramAdmin(msg)){tgBot.sendMessage(msg.chat.id,"Not authorized\\.");return;}const p=API_PROVIDERS[currentProviderIndex];const idx=parseInt(match[1]);
        if(!p.visionModels?.length){tgBot.sendMessage(msg.chat.id,`Provider \`${escapeMarkdownV2(p.name)}\` no vision models\\.`,{parse_mode:'MarkdownV2'});return;}
        if(isNaN(idx)||idx<0||idx>=p.visionModels.length){tgBot.sendMessage(msg.chat.id,`Invalid vision idx for \`${escapeMarkdownV2(p.name)}\`\\. 0\\-${p.visionModels.length-1}`,{parse_mode:'MarkdownV2'});return;}
        p.currentVisionModelIndex=idx;tgBot.sendMessage(msg.chat.id,`Vision model for \`${escapeMarkdownV2(p.name)}\`: \`${escapeMarkdownV2(p.visionModels[idx].name)}\``,{parse_mode:'MarkdownV2'});
      });
      tgBot.onText(/\/ocr/, async (msg) => {
        if(!isTelegramAdmin(msg)){tgBot.sendMessage(msg.chat.id,"Not authorized\\.");return;}
        if(!msg.reply_to_message?.photo){tgBot.sendMessage(msg.chat.id,"Reply to photo with /ocr\\.",{parse_mode:'MarkdownV2'});return;}
        try{const photo=msg.reply_to_message.photo.pop();const fId=photo.file_id;
        const procMsg=await tgBot.sendMessage(msg.chat.id," OCRing\\.\\.\\.",{parse_mode:'MarkdownV2'});
        const fInfo=await tgBot.getFile(fId);const fUrl=`https://api.telegram.org/file/bot${telegramToken}/${fInfo.file_path}`;
        const imgRes=await axios.get(fUrl,{responseType:'arraybuffer'});const b64=Buffer.from(imgRes.data,'binary').toString('base64');
        const ocrRes=await askAI(OCR_PROMPT,true,b64,null);
        tgBot.editMessageText(`*Extracted:*\n\n${escapeMarkdownV2(ocrRes)}`,{chat_id:msg.chat.id,message_id:procMsg.message_id,parse_mode:'MarkdownV2'})
        .catch(e=>{logError('tg-ocr-edit',e);tgBot.deleteMessage(msg.chat.id,procMsg.message_id).catch(()=>{});tgBot.sendMessage(msg.chat.id,`*Extracted:*\n\n${escapeMarkdownV2(ocrRes)}`,{parse_mode:'MarkdownV2'});});
        }catch(err){logError('tg-ocr-proc',err);tgBot.sendMessage(msg.chat.id,"OCR error\\.",{parse_mode:'MarkdownV2'});}
      });
      tgBot.onText(/\/clear_history/, (msg) => { // For Telegram AI history
        if(!isTelegramAdmin(msg)){tgBot.sendMessage(msg.chat.id,"Not authorized\\.");return;}
        const convId=`telegram_${msg.from.id}`;saveConversation(convId,[]); // Pass empty array to saveConversation
        tgBot.sendMessage(msg.chat.id,"TG AI history cleared\\.",{parse_mode:'MarkdownV2'});
      });
      tgBot.onText(/\/help/, (msg) => {
        if(!isTelegramAdmin(msg)){tgBot.sendMessage(msg.chat.id,"Not authorized\\.");return;}
        const helpText=`*ROZEN AI Commands*\n\n*WA Mngmt:*\n/connect \\- Init WA & QR\n\n*General:*\n/show \\- Ver\n/status \\- Status\n/help \\- This\n/myid \\- Your ID\n\n*TG Convo:*\n/history\n/clear\\_history\n\n*AI Settings:*\n/show\\_model\n/use\\_provider \\[idx\\]\n/use\\_model \\[idx\\]\n/use\\_vision\\_model \\[idx\\]\n/settings\n/settings safety\\.\\[p\\] \\[block\\|allow\\_more\\]\n/settings config\\.\\[p\\] \\[v\\]\n/settings groq\\.temp \\[v\\]\n\n*WA Users* \\(Admin\\):\n/list\n/add \\[\\+n\\]\n/remove \\[\\+n\\]\n\n*Rate Limit* \\(Admin\\):\n/resetratelimit \\[\\+wa\\_number\\]\n\n*Func:*\n/ocr \\(reply to img\\)\n\n*Bot Ctrl* \\(Admin\\):\n/start\\_chatbot\n/stop\\_chatbot\n\n_Chat with AI via TG/WA\\._`;
        tgBot.sendMessage(msg.chat.id,helpText,{parse_mode:'MarkdownV2'})
        .catch(err=>{logError('tg-help-mdv2',err);const plain=helpText.replace(/\\([_*\[\]()~`>#+-=|{}.!])/g,"$1");tgBot.sendMessage(msg.chat.id,"Formatted help err\\. Plain:\n\n"+plain,{parse_mode:'MarkdownV2'});});
      });
      
      tgBot.onText(/\/resetratelimit(?:\s+(\+?\d+))?/, (msg, match) => { // Updated Regex
          if (!isTelegramAdmin(msg)) {
            tgBot.sendMessage(msg.chat.id, "Not authorized\\.", { parse_mode: 'MarkdownV2' });
            return;
          }
          const phoneNumberInput = match[1]; 
          if (!phoneNumberInput) {
            tgBot.sendMessage(msg.chat.id, "Please specify a WhatsApp number to reset\\. Usage: `/resetratelimit +1234567890`", { parse_mode: 'MarkdownV2' });
            return;
          }
          const targetUserId = `${phoneNumberInput.replace(/\D/g, '')}@c.us`;
          const resetMessage = resetRateLimitForUser(targetUserId); // Use the new function
          tgBot.sendMessage(msg.chat.id, escapeMarkdownV2(resetMessage), { parse_mode: 'MarkdownV2' });
      });

      tgBot.on('message', async (msg) => {
        const chatId=msg.chat.id;const tgUserId=msg.from.id.toString();
        // Password for adding/removing users (ADMIN_PASSWORD_CMD)
        if(pendingAddRequests.has(chatId)){const req=pendingAddRequests.get(chatId);
          if(msg.from.id.toString()===req.originalUserId.toString()&&msg.text){ // Ensure originalUserId is compared as string
            if(msg.text.toLowerCase()==='/cancel'){tgBot.sendMessage(chatId,"Add WA cancelled\\.",{parse_mode:'MarkdownV2'});pendingAddRequests.delete(chatId);return;}
            if(!msg.text.startsWith('/')){if(msg.text===ADMIN_PASSWORD_CMD){if(!authorizedUsers.users.includes(req.newUser)&&!authorizedUsers.admin.includes(req.newUser)){authorizedUsers.users.push(req.newUser);saveAuthorizedUsers();tgBot.sendMessage(chatId,`WA user \`${escapeMarkdownV2(req.newUser)}\` added\\.`,{parse_mode:'MarkdownV2'});}else tgBot.sendMessage(chatId,`WA \`${escapeMarkdownV2(req.newUser)}\` already auth\\.`,{parse_mode:'MarkdownV2'});pendingAddRequests.delete(chatId);}else{req.attempt++;if(req.attempt>=3){tgBot.sendMessage(chatId,"Max attempts\\. Add cancelled\\.",{parse_mode:'MarkdownV2'});pendingAddRequests.delete(chatId);}else{tgBot.sendMessage(chatId,`Wrong pass\\. ${3-req.attempt} left\\. Or /cancel\\.`,{parse_mode:'MarkdownV2'});pendingAddRequests.set(chatId,req);}}return;}}}
        if(pendingRemoveRequests.has(chatId)){const req=pendingRemoveRequests.get(chatId);
          if(msg.from.id.toString()===req.originalUserId.toString()&&msg.text){ // Ensure originalUserId is compared as string
            if(msg.text.toLowerCase()==='/cancel'){tgBot.sendMessage(chatId,"Remove WA cancelled\\.",{parse_mode:'MarkdownV2'});pendingRemoveRequests.delete(chatId);return;}
            if(!msg.text.startsWith('/')){if(msg.text===ADMIN_PASSWORD_CMD){let rem=false;authorizedUsers.users=authorizedUsers.users.filter(u=>u!==req.targetUser||((rem=true),false));authorizedUsers.admin=authorizedUsers.admin.filter(u=>u!==req.targetUser||((rem=true),false));if(rem){saveAuthorizedUsers();tgBot.sendMessage(chatId,`WA user \`${escapeMarkdownV2(req.targetUser)}\` removed\\.`,{parse_mode:'MarkdownV2'});}else tgBot.sendMessage(chatId,`WA \`${escapeMarkdownV2(req.targetUser)}\` not found\\.`,{parse_mode:'MarkdownV2'});pendingRemoveRequests.delete(chatId);}else{req.attempt++;if(req.attempt>=3){tgBot.sendMessage(chatId,"Max attempts\\. Remove cancelled\\.",{parse_mode:'MarkdownV2'});pendingRemoveRequests.delete(chatId);}else{tgBot.sendMessage(chatId,`Wrong pass\\. ${3-req.attempt} left\\. Or /cancel\\.`,{parse_mode:'MarkdownV2'});pendingRemoveRequests.set(chatId,req);}}return;}}}
        
        if(msg.text?.startsWith('/'))return;if(!isTelegramAdmin(msg))return;if(!chatbotEnabled)return;if(!msg.text&&!msg.photo?.length)return;
        
        const convId=`telegram_${tgUserId}`;let conv=loadConversation(convId);
        try{
            if(msg.photo?.length){
                const pic=msg.photo.pop();const fId=pic.file_id;
                const procMsg=await tgBot.sendMessage(chatId,"⏳ Processing img\\.\\.\\.",{parse_mode:'MarkdownV2'});
                const fInfo=await tgBot.getFile(fId);const fUrl=`https://api.telegram.org/file/bot${telegramToken}/${fInfo.file_path}`;
                const imgRes=await axios.get(fUrl,{responseType:'arraybuffer'});const b64=Buffer.from(imgRes.data,'binary').toString('base64');
                const cap=msg.caption||VISION_PROMPT;
                // Add user message for image to TG conversation
                if (conv.length === 0 || conv[conv.length -1].role !== 'user' || conv[conv.length -1].content !== cap) {
                    conv.push({role:'user',content:cap + " (with image)"});
                }
                const aiRes=await askAI(cap,true,b64,null); // Vision for TG also typically standalone history
                conv.push({role:'assistant',content:aiRes});saveConversation(convId,conv);
                tgBot.editMessageText(escapeMarkdownV2(aiRes),{chat_id:chatId,message_id:procMsg.message_id,parse_mode:'MarkdownV2'})
                .catch(e=>{logError('tg-editMsg-photo',e);tgBot.deleteMessage(chatId,procMsg.message_id).catch(()=>{});tgBot.sendMessage(chatId,escapeMarkdownV2(aiRes),{parse_mode:'MarkdownV2'});});
            } else if(msg.text){
                tgBot.sendChatAction(chatId,"typing");
                if (conv.length === 0 || conv[conv.length -1].role !== 'user' || conv[conv.length -1].content !== msg.text) {
                    conv.push({role:'user',content:msg.text});
                }
                const aiRes=await askAI(null,false,null,conv); // Pass null for prompt as it's in conv
                conv.push({role:'assistant',content:aiRes});saveConversation(convId,conv);
                tgBot.sendMessage(chatId,escapeMarkdownV2(aiRes),{parse_mode:'MarkdownV2'});
            }
        }catch(err){logError('tg-msg-ai-proc',err);tgBot.sendMessage(chatId,"AI proc error\\.",{parse_mode:'MarkdownV2'});}
      });

      tgBot.on('polling_error',(e)=>logError('tg-polling',e));
      tgBot.on('webhook_error',(e)=>logError('tg-webhook',e));
      tgBot.on('error',(e)=>logError('tg-general-error',e));
      console.log("TG bot init & handlers set.");
  } 

  process.on('SIGINT',async()=>{console.log('SIGINT. Shutting down...');if(client?.destroy){try{await client.destroy();console.log('WA destroyed.');}catch(e){logError('SIGINT-WA-destroy',e);}}if(tgBot?.stopPolling){try{await tgBot.stopPolling({cancel:true});console.log('TG polling stopped.');}catch(e){logError('SIGINT-TG-stop',e);}}process.exit(0);});
  process.on('SIGTERM',async()=>{console.log('SIGTERM. Shutting down...');if(client?.destroy){try{await client.destroy();console.log('WA destroyed.');}catch(e){logError('SIGTERM-WA-destroy',e);}}if(tgBot?.stopPolling){try{await tgBot.stopPolling({cancel:true});console.log('TG polling stopped.');}catch(e){logError('SIGTERM-TG-stop',e);}}process.exit(0);});

  console.log("WhaTel-AI running. Use /connect in Telegram with admin account.");

}
