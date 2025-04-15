require('dotenv').config();
const telegramErrorChatId = process.env.TELEGRAM_ERROR_CHAT_ID || null;
const { Client, LocalAuth } = require('whatsapp-web.js');
const TelegramBot = require('node-telegram-bot-api');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Letakkan logError di sini, karena variabel global sudah tersedia.
function logError(context, error) {
  const errMsg = `[${new Date().toISOString()}] Error in ${context}: ${error.response?.data || error.message || error}`;
  console.error(errMsg);
  if (telegramErrorChatId && tgBot) {  
    tgBot.sendMessage(telegramErrorChatId, errMsg)
      .catch(e => console.error('Failed to send error to Telegram:', e));
  }
}


const imageStorageDir = path.join(__dirname, 'folder-foto');
const conversationsDir = path.join(__dirname, 'conversations');
const greetedUsersFile = path.join(__dirname, 'greeted_users.json');
const authorizedUsersFile = path.join(__dirname, 'authorized_users.json');

// Create directories if they do not exist
if (!fs.existsSync(imageStorageDir)) fs.mkdirSync(imageStorageDir, { recursive: true });
if (!fs.existsSync(conversationsDir)) fs.mkdirSync(conversationsDir, { recursive: true });

function logError(context, error) {
  const errMsg = `[${new Date().toISOString()}] Error in ${context}: ${error.response?.data || error.message || error}`;
  console.error(errMsg);
  // Send error to Telegram if TELEGRAM_ERROR_CHAT_ID is available
  if (telegramErrorChatId && tgBot) {
    tgBot.sendMessage(telegramErrorChatId, errMsg).catch(e => console.error('Failed to send error to Telegram:', e));
  }
}

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TEMPERATURE = 0.9;
let chatbotEnabled = true;

// File-based authorized users (with default data)
let authorizedUsers = {
  admin: ['6281234567890@c.us'],
  users: ['6285678935679@c.us']
};
function loadAuthorizedUsers() {
  try {
    if (fs.existsSync(authorizedUsersFile)) {
      const data = fs.readFileSync(authorizedUsersFile, 'utf8');
      authorizedUsers = JSON.parse(data);
      console.log('Authorized users loaded.');
    } else {
      fs.writeFileSync(authorizedUsersFile, JSON.stringify(authorizedUsers));
    }
  } catch (error) {
    logError('loadAuthorizedUsers', error);
  }
}
function saveAuthorizedUsers() {
  try {
    fs.writeFileSync(authorizedUsersFile, JSON.stringify(authorizedUsers, null, 2));
  } catch (error) {
    logError('saveAuthorizedUsers', error);
  }
}
loadAuthorizedUsers();
function isAuthorized(sender) {
  return (authorizedUsers.admin.includes(sender) || authorizedUsers.users.includes(sender));
}

// File-based greeted users
let greetedUsers = new Set();
try {
  if (fs.existsSync(greetedUsersFile)) {
    const data = fs.readFileSync(greetedUsersFile, 'utf8');
    JSON.parse(data).forEach(user => greetedUsers.add(user));
  }
} catch (error) {
  logError('greetedUsers', error);
}
function saveGreetedUsers() {
  try {
    fs.writeFileSync(greetedUsersFile, JSON.stringify(Array.from(greetedUsers)));
  } catch (error) {
    logError('saveGreetedUsers', error);
  }
}

function generateRandomID() {
  return Math.floor(Math.random() * 1e10).toString();
}

let geminiSettings = {
  safety: { harassment: false, hate: false, sexuallyExplicit: false, dangerousContent: false },
  generationConfig: { temperature: 0.9, topP: 0.95, topK: 40, maxOutputTokens: 2048 }
};

let API_PROVIDERS = [
  {
    name: 'Groq',
    apiKey: process.env.GROQ_API_KEY,
    models: [
      { name: 'llama-3.3-70b-specdec', id: generateRandomID(), available: true },
      { name: 'llama-3.3-70b-versatile', id: generateRandomID(), available: true },
      { name: 'llama3-70b-8192', id: generateRandomID(), available: true }
    ],
    visionModels: [
      { name: 'llama-3.3-70b-vision', id: generateRandomID(), available: true }
    ],
    currentModelIndex: 0,
    currentVisionModelIndex: 0,
    available: true
  },
  {
    name: 'Gemini',
    apiKey: process.env.GEMINI_API_KEY,
    models: [
      { name: 'gemini-1.5-pro', id: generateRandomID(), available: true },
      { name: 'gemini-1.5-flash', id: generateRandomID(), available: true }
    ],
    visionModels: [
      { name: 'gemini-1.5-pro-vision', id: generateRandomID(), available: true }
    ],
    currentModelIndex: 0,
    currentVisionModelIndex: 0,
    available: true
  }
];
let currentProviderIndex = 0;

const AUTHORIZED_GREETING = `Hello! Welcome to the AI Assistant service.
Use /history to view chat history, /settings to configure the model, /show_model to list available models, and /show to check the bot version.`;
const SYSTEM_PROMPT = `You are ROZEN AI, an assistant and AI agent.
Answer briefly and clearly.`;
const VISION_PROMPT = `Analyze this image and provide a brief but comprehensive description.`;
const OCR_PROMPT = `Extract the text visible in this image.`;

function getConversationFilePath(sender) {
  const sanitized = sender.replace('@c.us', '');
  return path.join(conversationsDir, `conversation_${sanitized}.json`);
}
function loadConversation(sender) {
  const filepath = getConversationFilePath(sender);
  if (fs.existsSync(filepath)) {
    try {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch (error) {
      logError('loadConversation', error);
    }
  }
  return [{ role: 'system', content: SYSTEM_PROMPT }];
}
function saveConversation(sender, conversation) {
  const filepath = getConversationFilePath(sender);
  try {
    fs.writeFileSync(filepath, JSON.stringify(conversation, null, 2));
  } catch (error) {
    logError('saveConversation', error);
  }
}

async function saveImageFromMessage(msg) {
  try {
    if (msg.hasMedia) {
      const media = await msg.downloadMedia();
      if (media) {
        const fileName = `image_${Date.now()}.${media.mimetype.split('/')[1]}`;
        const filePath = path.join(imageStorageDir, fileName);
        fs.writeFileSync(filePath, media.data, 'base64');
        return { filePath, fileName, mediaType: media.mimetype, mediaData: media.data };
      }
    }
    return null;
  } catch (error) {
    logError('saveImageFromMessage', error);
    return null;
  }
}

const client = new Client({ authStrategy: new LocalAuth(), puppeteer: { headless: true } });
client.on('qr', (qr) => {
  console.log('QR Code for WhatsApp received, please scan:');
  qrcode.generate(qr, { small: true });
});
client.on('ready', () => { console.log('WhatsApp client is ready.'); });
client.initialize();

async function askAI(prompt, isVision = false, imageContent = null, conversation = null) {
  try {
    const provider = API_PROVIDERS[currentProviderIndex];
    if (!provider.apiKey) return "API key not available.";
    let modelName, apiUrl, payload;
    if (isVision && imageContent) {
      if (provider.name === 'Gemini') {
        modelName = provider.visionModels[provider.currentVisionModelIndex].name;
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${provider.apiKey}`;
        payload = {
          contents: [{
            parts: [
              { text: `${VISION_PROMPT}\n\n${prompt}` },
              { inline_data: { mime_type: "image/jpeg", data: imageContent } }
            ]
          }],
          safety_settings: Object.entries(geminiSettings.safety).map(([cat, blocked]) => ({
            category: cat.toUpperCase(), threshold: blocked ? "BLOCK_MEDIUM_AND_ABOVE" : "BLOCK_ONLY_HIGH"
          })),
          generation_config: geminiSettings.generationConfig
        };
      } else if (provider.name === 'Groq') {
        modelName = provider.visionModels[provider.currentVisionModelIndex].name;
        apiUrl = `https://api.groq.com/openai/v1/chat/completions`;
        payload = {
          model: modelName,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: [
              { type: "text", text: `${VISION_PROMPT}\n\n${prompt}` },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageContent}` } }
            ]}
          ],
          temperature: TEMPERATURE
        };
      }
    } else {
      if (provider.name === 'Gemini') {
        modelName = provider.models[provider.currentModelIndex].name;
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${provider.apiKey}`;
        const messages = conversation ? conversation.map(m => ({
          role: m.role === 'system' ? 'user' : m.role,
          parts: [{ text: m.content }]
        })) : [{ role: 'user', parts: [{ text: prompt }] }];
        payload = {
          contents: messages,
          safety_settings: Object.entries(geminiSettings.safety).map(([cat, blocked]) => ({
            category: cat.toUpperCase(), threshold: blocked ? "BLOCK_MEDIUM_AND_ABOVE" : "BLOCK_ONLY_HIGH"
          })),
          generation_config: geminiSettings.generationConfig
        };
      } else if (provider.name === 'Groq') {
        modelName = provider.models[provider.currentModelIndex].name;
        apiUrl = `https://api.groq.com/openai/v1/chat/completions`;
        const messages = conversation || [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ];
        payload = { model: modelName, messages: messages, temperature: TEMPERATURE };
      }
    }
    const headers = { 'Content-Type': 'application/json' };
    if (provider.name === 'Groq') headers['Authorization'] = `Bearer ${provider.apiKey}`;
    const response = await axios.post(apiUrl, payload, { headers });
    if (provider.name === 'Gemini') {
      if (response.data.candidates && response.data.candidates[0].content)
        return response.data.candidates[0].content.parts[0].text;
      else return "No response from Gemini API.";
    } else if (provider.name === 'Groq') {
      if (response.data.choices && response.data.choices[0].message)
        return response.data.choices[0].message.content;
      else return "No response from Groq API.";
    }
  } catch (error) {
    logError('askAI', error);
    return "Sorry, an error occurred.";
  }
}

client.on('message', async (msg) => {
  try {
    if (!chatbotEnabled || msg.from.endsWith('@g.us')) return;
    const sender = msg.from;
    if (!isAuthorized(sender)) return;
    if (!greetedUsers.has(sender)) {
      greetedUsers.add(sender);
      saveGreetedUsers();
      msg.reply(AUTHORIZED_GREETING);
      const conv = loadConversation(sender);
      saveConversation(sender, conv);
      return;
    }
    let conversation = loadConversation(sender);
    if (msg.hasMedia) {
      const imageInfo = await saveImageFromMessage(msg);
      if (imageInfo && imageInfo.mediaType.startsWith('image/')) {
        conversation.push({ role: 'user', content: msg.body || 'Analyze this image' });
        const aiResp = await askAI(msg.body || 'Analyze this image', true, imageInfo.mediaData, null);
        conversation.push({ role: 'assistant', content: aiResp });
        saveConversation(sender, conversation);
        msg.reply(aiResp);
        return;
      }
    }
    conversation.push({ role: 'user', content: msg.body });
    const aiResp = await askAI(msg.body, false, null, conversation);
    conversation.push({ role: 'assistant', content: aiResp });
    saveConversation(sender, conversation);
    msg.reply(aiResp);
  } catch (error) {
    logError('whatsapp-message', error);
  }
});

// ------- TELEGRAM AUTHORIZATION FIX ------- //

// Parse TELEGRAM_ADMIN_LIST correctly and convert to an array of strings
const telegramAdminList = process.env.TELEGRAM_ADMIN_LIST 
  ? process.env.TELEGRAM_ADMIN_LIST.split(',').map(s => s.trim()) 
  : [];

// Log admin list for debugging
console.log('Telegram Admin List (from .env):', telegramAdminList);

const tgBot = new TelegramBot(telegramToken, { polling: true });

// Improved validation function with logging
function isTelegramAuthorized(msg) {
  if (!msg || !msg.from) {
    console.log('Message or msg.from is empty');
    return false;
  }
  
  const userId = msg.from.id.toString();
  const isAuthorized = telegramAdminList.includes(userId);
  
  console.log(`Checking auth for Telegram user: ${msg.from.username || 'Unknown'}`);
  console.log(`User ID: ${userId}`);
  console.log(`Chat ID: ${msg.chat.id}`);
  console.log(`Admin list: [${telegramAdminList.join(', ')}]`);
  console.log(`Is authorized: ${isAuthorized}`);
  
  return isAuthorized;
}

// Command /myid for debugging
tgBot.onText(/\/myid/, (msg) => {
  const userId = msg.from?.id || 'unknown';
  const chatId = msg.chat?.id || 'unknown';
  const username = msg.from?.username || 'unknown';
  
  tgBot.sendMessage(msg.chat.id, 
    `Your Telegram Info:
User ID: ${userId}
Chat ID: ${chatId}
Username: @${username}
Is in admin list: ${telegramAdminList.includes(userId.toString()) ? 'Yes' : 'No'}
Admin list contents: ${telegramAdminList.join(', ')}`
  );
});

// Command /bypassauth for debugging (temporary bypass)
tgBot.onText(/\/bypassauth/, (msg) => {
  const originalAuthFunction = isTelegramAuthorized;
  isTelegramAuthorized = () => true;
  
  tgBot.sendMessage(msg.chat.id, "Authentication bypass enabled for 5 minutes. Use this time to check functionality.");
  
  setTimeout(() => {
    isTelegramAuthorized = originalAuthFunction;
    tgBot.sendMessage(msg.chat.id, "Authentication bypass disabled. Normal authentication restored.");
  }, 5 * 60 * 1000);
});

// Command to temporarily add your user ID to the admin list
tgBot.onText(/\/addmeasadmin/, (msg) => {
  if (msg.from) {
    const userId = msg.from.id.toString();
    if (!telegramAdminList.includes(userId)) {
      telegramAdminList.push(userId);
      tgBot.sendMessage(msg.chat.id, `Added your ID (${userId}) to the admin list temporarily. This is not saved between restarts.`);
    } else {
      tgBot.sendMessage(msg.chat.id, `Your ID (${userId}) is already in the admin list.`);
    }
  }
});

// Continue with existing commands
tgBot.onText(/\/show/, (msg) => { 
  if (isTelegramAuthorized(msg)) {
    tgBot.sendMessage(msg.chat.id, "Bot Version: 1.0.1"); 
  } else {
    console.log(`User ${msg.from?.id} attempted to use /show but is not authorized`);
  }
});

tgBot.onText(/\/version/, (msg) => { 
  if (isTelegramAuthorized(msg)) {
    tgBot.sendMessage(msg.chat.id, "Bot Version: 1.0.1"); 
  } else {
    console.log(`User ${msg.from?.id} attempted to use /version but is not authorized`);
  }
});

tgBot.onText(/\/show_model/, (msg) => {
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} attempted to use /show_model but is not authorized`);
    return;
  }
  let text = "List of Models:\n";
  API_PROVIDERS.forEach(provider => {
    text += `\nProvider: ${provider.name}\n`;
    provider.models.forEach(m => { text += `Model: ${m.name}, ID: ${m.id}\n`; });
    if (provider.visionModels && provider.visionModels.length > 0) {
      provider.visionModels.forEach(vm => { text += `Vision Model: ${vm.name}, ID: ${vm.id}\n`; });
    }
  });
  tgBot.sendMessage(msg.chat.id, text);
});

tgBot.onText(/\/settings(\s+(\S+)\s+(\S+))?/, (msg, match) => {
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} attempted to use /settings but is not authorized`);
    return;
  }
  const chatId = msg.chat.id;
  if (!match || !match[2] || !match[3]) {
    let s = `Model Settings:\n\n` +
      `Safety (Gemini):\n` +
      `• harassment: ${geminiSettings.safety.harassment ? 'ON' : 'OFF'}\n` +
      `• hate: ${geminiSettings.safety.hate ? 'ON' : 'OFF'}\n` +
      `• sexuallyExplicit: ${geminiSettings.safety.sexuallyExplicit ? 'ON' : 'OFF'}\n` +
      `• dangerousContent: ${geminiSettings.safety.dangerousContent ? 'ON' : 'OFF'}\n\n` +
      `Config (Gemini):\n` +
      `• temperature: ${geminiSettings.generationConfig.temperature}\n` +
      `• topP: ${geminiSettings.generationConfig.topP}\n` +
      `• topK: ${geminiSettings.generationConfig.topK}\n` +
      `• maxOutputTokens: ${geminiSettings.generationConfig.maxOutputTokens}\n\n` +
      `Example:\n/settings safety.harassment on\n/settings config.temperature 0.7`;
    tgBot.sendMessage(chatId, s);
    return;
  }
  const settingPath = match[2].trim();
  const value = match[3].trim().toLowerCase();
  if (settingPath.startsWith('safety.')) {
    const field = settingPath.split('.')[1];
    if (geminiSettings.safety.hasOwnProperty(field)) {
      geminiSettings.safety[field] = (value === 'on');
      tgBot.sendMessage(chatId, `Safety setting ${field} changed to ${value.toUpperCase()}.`);
    } else tgBot.sendMessage(chatId, `Setting '${field}' not recognized.`);
  } else if (settingPath.startsWith('config.')) {
    const field = settingPath.split('.')[1];
    if (geminiSettings.generationConfig.hasOwnProperty(field)) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        geminiSettings.generationConfig[field] = numValue;
        tgBot.sendMessage(chatId, `Generation config ${field} changed to ${numValue}.`);
      } else tgBot.sendMessage(chatId, `The value for ${field} must be a number.`);
    } else tgBot.sendMessage(chatId, `Setting '${field}' not recognized.`);
  } else {
    tgBot.sendMessage(chatId, `Invalid settings format.`);
  }
});

tgBot.onText(/\/history/, (msg) => {
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} attempted to use /history but is not authorized`);
    return;
  }
  const chatId = msg.chat.id;
  const conversationFilePath = path.join(conversationsDir, `conversation_${msg.from.id}.json`);
  let conversation;
  if (fs.existsSync(conversationFilePath)) {
    try {
      conversation = JSON.parse(fs.readFileSync(conversationFilePath, 'utf8'));
    } catch (error) {
      logError('telegram-history', error);
      conversation = [];
    }
  } else conversation = [];
  const lastEntries = conversation.slice(-10);
  if (lastEntries.length === 0)
    tgBot.sendMessage(chatId, "No conversation history.");
  else {
    let result = "Last conversation history:\n\n";
    lastEntries.forEach((line, idx) => {
      if (line.role !== 'system') {
        result += `${idx+1}. [${line.role}] ${line.content.substring(0, 100)}${line.content.length > 100 ? '...' : ''}\n\n`;
      }
    });
    tgBot.sendMessage(chatId, result);
  }
});

tgBot.onText(/\/start_chatbot/, (msg) => { 
  if (isTelegramAuthorized(msg)) { 
    chatbotEnabled = true; 
    tgBot.sendMessage(msg.chat.id, "Chatbot activated."); 
  } else {
    console.log(`User ${msg.from?.id} attempted to use /start_chatbot but is not authorized`);
  }
});

tgBot.onText(/\/stop_chatbot/, (msg) => { 
  if (isTelegramAuthorized(msg)) { 
    chatbotEnabled = false; 
    tgBot.sendMessage(msg.chat.id, "Chatbot deactivated."); 
  } else {
    console.log(`User ${msg.from?.id} attempted to use /stop_chatbot but is not authorized`);
  }
});

tgBot.onText(/\/list/, (msg) => {
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} attempted to use /list but is not authorized`);
    return;
  }
  const adminList = authorizedUsers.admin.join('\n');
  const userList = authorizedUsers.users.join('\n');
  tgBot.sendMessage(msg.chat.id, `Authorized Users List:\n\nAdmin:\n${adminList}\n\nUser:\n${userList}`);
});

tgBot.onText(/\/logs/, (msg) => { 
  if (isTelegramAuthorized(msg)) {
    tgBot.sendMessage(msg.chat.id, "Logs feature not implemented."); 
  } else {
    console.log(`User ${msg.from?.id} attempted to use /logs but is not authorized`);
  }
});

tgBot.onText(/\/status/, (msg) => {
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} attempted to use /status but is not authorized`);
    return;
  }
  const providerStatus = API_PROVIDERS.map(provider => `${provider.name}: ${provider.available ? 'Available' : 'Unavailable'}`).join('\n');
  const currentProvider = API_PROVIDERS[currentProviderIndex];
  const currentModel = currentProvider.models[currentProvider.currentModelIndex].name;
  const currentVisionModel = currentProvider.visionModels[currentProvider.currentVisionModelIndex].name;
  const response = `Chatbot Status:
Chatbot active: ${chatbotEnabled ? 'Yes' : 'No'}
Provider: ${currentProvider.name}
Model: ${currentModel}
Vision Model: ${currentVisionModel}

Provider Status:
${providerStatus}`;
  tgBot.sendMessage(msg.chat.id, response);
});

const pendingAddRequests = new Map();
tgBot.onText(/\/add\s+(\+?\d+)/, (msg, match) => {
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} attempted to use /add but is not authorized`);
    return;
  }
  const chatId = msg.chat.id;
  const newUser = `${match[1].replace(/\D/g, '')}@c.us`;
  pendingAddRequests.set(chatId, { newUser, attempt: 0 });
  tgBot.sendMessage(chatId, "Enter admin password to add a user:");
});

const pendingRemoveRequests = new Map();
tgBot.onText(/\/remove\s+(\+?\d+)/, (msg, match) => {
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} attempted to use /remove but is not authorized`);
    return;
  }
  const chatId = msg.chat.id;
  const targetUser = `${match[1].replace(/\D/g, '')}@c.us`;
  pendingRemoveRequests.set(chatId, { targetUser, attempt: 0 });
  tgBot.sendMessage(chatId, "Enter admin password to remove a user:");
});

tgBot.on('message', async (msg) => {
  // Log all incoming Telegram messages for debugging
  console.log(`Received message from Telegram: ${msg.from?.id} (${msg.from?.username || 'no username'}): ${msg.text || '[no text]'}`);
  
  if (!msg.text || msg.text.startsWith('/') || pendingAddRequests.has(msg.chat.id) || pendingRemoveRequests.has(msg.chat.id)) return;
  
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} sent a message but is not authorized`);
    return;
  }
  
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const conversationFilePath = path.join(conversationsDir, `conversation_${userId}.json`);
  
  let conversation;
  if (fs.existsSync(conversationFilePath)) {
    try {
      conversation = JSON.parse(fs.readFileSync(conversationFilePath, 'utf8'));
    } catch (error) {
      logError('telegram-message-history', error);
      conversation = [{ role: 'system', content: SYSTEM_PROMPT }];
    }
  } else {
    conversation = [{ role: 'system', content: SYSTEM_PROMPT }];
  }
  
  try {
    if (msg.photo && msg.photo.length > 0) {
      const photo = msg.photo[msg.photo.length - 1];
      const fileId = photo.file_id;
      const processingMsg = await tgBot.sendMessage(chatId, "Processing image...");
      const fileInfo = await tgBot.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${telegramToken}/${fileInfo.file_path}`;
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data, 'binary');
      const base64Image = imageBuffer.toString('base64');
      const caption = msg.caption || 'Analyze this image';
      conversation.push({ role: 'user', content: caption });
      const aiResp = await askAI(caption, true, base64Image, null);
      conversation.push({ role: 'assistant', content: aiResp });
      fs.writeFileSync(conversationFilePath, JSON.stringify(conversation, null, 2));
      tgBot.editMessageText(aiResp, { chat_id: chatId, message_id: processingMsg.message_id })
        .catch(e => {
          tgBot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
          tgBot.sendMessage(chatId, aiResp);
        });
      
    } else {
      tgBot.sendChatAction(chatId, "typing");
      conversation.push({ role: 'user', content: msg.text });
      const aiResp = await askAI(msg.text, false, null, conversation);
      conversation.push({ role: 'assistant', content: aiResp });
      fs.writeFileSync(conversationFilePath, JSON.stringify(conversation, null, 2));
      tgBot.sendMessage(chatId, aiResp);
    }
  } catch (error) {
    logError('telegram-message', error);
    tgBot.sendMessage(chatId, "Sorry, an error occurred while processing your message.");
  }
});

tgBot.onText(/\/use_provider\s+(\d+)/, (msg, match) => {
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} attempted to use /use_provider but is not authorized`);
    return;
  }
  
  const index = parseInt(match[1]);
  if (isNaN(index) || index < 0 || index >= API_PROVIDERS.length) {
    tgBot.sendMessage(msg.chat.id, `Invalid index. Please use 0-${API_PROVIDERS.length - 1}`);
    return;
  }
  
  currentProviderIndex = index;
  tgBot.sendMessage(msg.chat.id, `Provider changed to ${API_PROVIDERS[currentProviderIndex].name}`);
});

tgBot.onText(/\/use_model\s+(\d+)/, (msg, match) => {
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} attempted to use /use_model but is not authorized`);
    return;
  }
  
  const provider = API_PROVIDERS[currentProviderIndex];
  const index = parseInt(match[1]);
  
  if (isNaN(index) || index < 0 || index >= provider.models.length) {
    tgBot.sendMessage(msg.chat.id, `Invalid index. Please use 0-${provider.models.length - 1}`);
    return;
  }
  
  provider.currentModelIndex = index;
  tgBot.sendMessage(msg.chat.id, `Model for ${provider.name} changed to ${provider.models[index].name}`);
});

tgBot.onText(/\/use_vision_model\s+(\d+)/, (msg, match) => {
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} attempted to use /use_vision_model but is not authorized`);
    return;
  }
  
  const provider = API_PROVIDERS[currentProviderIndex];
  const index = parseInt(match[1]);
  
  if (!provider.visionModels || provider.visionModels.length === 0) {
    tgBot.sendMessage(msg.chat.id, `Provider ${provider.name} does not have a vision model`);
    return;
  }
  
  if (isNaN(index) || index < 0 || index >= provider.visionModels.length) {
    tgBot.sendMessage(msg.chat.id, `Invalid index. Please use 0-${provider.visionModels.length - 1}`);
    return;
  }
  
  provider.currentVisionModelIndex = index;
  tgBot.sendMessage(msg.chat.id, `Vision model for ${provider.name} changed to ${provider.visionModels[index].name}`);
});

tgBot.onText(/\/ocr/, async (msg) => {
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} attempted to use /ocr but is not authorized`);
    return;
  }
  
  if (!msg.reply_to_message || !msg.reply_to_message.photo) {
    tgBot.sendMessage(msg.chat.id, "Please reply to a photo message with /ocr to extract text.");
    return;
  }
  
  try {
    const photo = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1];
    const fileId = photo.file_id;
    const processingMsg = await tgBot.sendMessage(msg.chat.id, "Extracting text from image...");
    const fileInfo = await tgBot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${telegramToken}/${fileInfo.file_path}`;
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');
    const base64Image = imageBuffer.toString('base64');
    const ocrResult = await askAI(OCR_PROMPT, true, base64Image, null);
    tgBot.editMessageText(`📄 Extracted Text:\n\n${ocrResult}`, { chat_id: msg.chat.id, message_id: processingMsg.message_id })
      .catch(e => {
        tgBot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => {});
        tgBot.sendMessage(msg.chat.id, `📄 Extracted Text:\n\n${ocrResult}`);
      });
  } catch (error) {
    logError('telegram-ocr', error);
    tgBot.sendMessage(msg.chat.id, "Sorry, an error occurred while extracting text from the image.");
  }
});

async function askAIWithFallback(prompt, isVision = false, imageContent = null, conversation = null) {
  const originalProviderIndex = currentProviderIndex;
  let attempts = 0;
  let error = null;
  
  while (attempts < API_PROVIDERS.length * 2) {
    try {
      const result = await askAI(prompt, isVision, imageContent, conversation);
      if (result && !result.includes("Sorry, an error occurred") && !result.includes("API key not available")) {
        return result;
      }
      currentProviderIndex = (currentProviderIndex + 1) % API_PROVIDERS.length;
    } catch (err) {
      error = err;
      currentProviderIndex = (currentProviderIndex + 1) % API_PROVIDERS.length;
    }
    attempts++;
  }
  
  currentProviderIndex = originalProviderIndex;
  return "All AI providers are currently unavailable. Please try again later.";
}

tgBot.onText(/\/clear_history/, (msg) => {
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} attempted to use /clear_history but is not authorized`);
    return;
  }
  
  const userId = msg.from.id.toString();
  const conversationFilePath = path.join(conversationsDir, `conversation_${userId}.json`);
  
  try {
    const newConversation = [{ role: 'system', content: SYSTEM_PROMPT }];
    fs.writeFileSync(conversationFilePath, JSON.stringify(newConversation, null, 2));
    tgBot.sendMessage(msg.chat.id, "Conversation history has been cleared.");
  } catch (error) {
    logError('clear-history', error);
    tgBot.sendMessage(msg.chat.id, "Failed to clear conversation history.");
  }
});

client.on('message', async (msg) => {
  if (msg.body === '/clear' || msg.body === '/clear_history') {
    const sender = msg.from;
    if (isAuthorized(sender)) {
      try {
        const newConversation = [{ role: 'system', content: SYSTEM_PROMPT }];
        saveConversation(sender, newConversation);
        msg.reply("Conversation history has been cleared.");
      } catch (error) {
        logError('whatsapp-clear-history', error);
        msg.reply("Failed to clear conversation history.");
      }
    }
  }
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  client.destroy().then(() => {
    console.log('WhatsApp client destroyed.');
    process.exit(0);
  }).catch(err => {
    console.error('Error shutting down WhatsApp client:', err);
    process.exit(1);
  });
});

tgBot.onText(/\/help/, (msg) => {
  if (!isTelegramAuthorized(msg)) {
    console.log(`User ${msg.from?.id} attempted to use /help but is not authorized`);
    return;
  }
  
  const helpText = `
*ROZEN AI Bot - Available Commands*

*General Commands:*
/show or /version - Display bot version
/status - Display bot and provider status
/help - Display this help message

*Conversation Management:*
/history - View conversation history
/clear_history - Clear conversation history

*Model Settings:*
/show_model - Display list of available models
/use_provider [index] - Change the AI provider
/use_model [index] - Change the AI model
/use_vision_model [index] - Change the AI vision model

*Security Settings:*
/settings - Show model and safety settings
/settings safety.[param] on/off - Change safety settings
/settings config.[param] [value] - Change generation settings

*User Management:*
/list - List authorized users
/add [number] - Add a new user
/remove [number] - Remove a user

*Functionality:*
/ocr - Extract text from an image (reply to a photo with this command)
/myid - Display your Telegram ID information

*Admin:*
/start_chatbot - Activate the bot
/stop_chatbot - Deactivate the bot

_To send a message to the AI, simply type a regular message or send a photo._
`;

  tgBot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});
