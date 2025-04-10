require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const TelegramBot = require('node-telegram-bot-api');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const imageStorageDir = path.join(__dirname, 'folder-foto');
const conversationsDir = path.join(__dirname, 'conversations');
const greetedUsersFile = path.join(__dirname, 'greeted_users.json');
const authorizedUsersFile = path.join(__dirname, 'authorized_users.json');

if (!fs.existsSync(imageStorageDir)) {
  fs.mkdirSync(imageStorageDir, { recursive: true });
}
if (!fs.existsSync(conversationsDir)) {
  fs.mkdirSync(conversationsDir, { recursive: true });
}

function logError(context, error) {
  console.error(`[${new Date().toISOString()}] Error in ${context}:`, error.response?.data || error.message || error);
}

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const MODEL_CHANGE_PASSWORD = process.env.MODEL_CHANGE_PASSWORD || 'admin123';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TEMPERATURE = 0.9;
let chatbotEnabled = true;

let authorizedUsers = {
  admin: ['6280987564456@c.us'],
  users: ['6281234567890@c.us']
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

const greetedUsers = new Set();
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
  safety: {
    harassment: false,
    hate: false,
    sexuallyExplicit: false,
    dangerousContent: false
  },
  generationConfig: {
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048
  }
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
You can use /history to view your chat history, /settings to configure the model, /show_model to view the list of models, and /version to check the bot version.`;

const SYSTEM_PROMPT = `You are ROZEN AI, an assistant and AI agent on WhatsApp.
- Provide brief, concise, and useful answers.
- Answer in the same language as the question.
- If you do not know the answer, be honest.
- Do not provide incorrect or misleading information.
- Avoid overly lengthy responses, but if the user wants detailed and complex answers, provide them.
- Remember the previous conversation context to give personalized and relevant answers.
- Use references from previous conversations when relevant.`;

const VISION_PROMPT = `Analyze this image and provide a brief but comprehensive description.
Focus on the main elements in the image.
Answer in English unless requested otherwise.
Provide factual and relevant information.`;

const OCR_PROMPT = `Extract all visible text from this image.
Preserve the original text formatting as much as possible.
If any text is unclear, mark it as [unreadable].`;

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

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true }
});

client.on('qr', (qr) => {
  console.log('QR Code for WhatsApp received, please scan the following:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('WhatsApp client is ready.');
});
client.initialize();

async function askAI(prompt, isVision = false, imageContent = null, conversation = null) {
  try {
    const provider = API_PROVIDERS[currentProviderIndex];
    if (!provider.apiKey) {
      return "Sorry, the API key is not available for this provider.";
    }
    let modelName, apiUrl, payload;
    if (isVision && imageContent) {
      if (provider.name === 'Gemini') {
        modelName = provider.visionModels[provider.currentVisionModelIndex].name;
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${provider.apiKey}`;
        payload = {
          contents: [
            {
              parts: [
                { text: `${VISION_PROMPT}\n\n${prompt}` },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: imageContent
                  }
                }
              ]
            }
          ],
          safety_settings: Object.entries(geminiSettings.safety).map(([category, blocked]) => ({
            category: category.toUpperCase(),
            threshold: blocked ? "BLOCK_MEDIUM_AND_ABOVE" : "BLOCK_ONLY_HIGH"
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
        const messages = conversation ? conversation.map(msg => ({
          role: msg.role === 'system' ? 'user' : msg.role,
          parts: [{ text: msg.content }]
        })) : [{ role: 'user', parts: [{ text: prompt }] }];
        payload = {
          contents: messages,
          safety_settings: Object.entries(geminiSettings.safety).map(([category, blocked]) => ({
            category: category.toUpperCase(),
            threshold: blocked ? "BLOCK_MEDIUM_AND_ABOVE" : "BLOCK_ONLY_HIGH"
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
        payload = {
          model: modelName,
          messages: messages,
          temperature: TEMPERATURE
        };
      }
    }
    const headers = { 'Content-Type': 'application/json' };
    if (provider.name === 'Groq') {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }
    const response = await axios.post(apiUrl, payload, { headers });
    if (provider.name === 'Gemini') {
      if (response.data.candidates && response.data.candidates[0].content) {
        return response.data.candidates[0].content.parts[0].text;
      } else {
        return "Sorry, no response received from the Gemini API.";
      }
    } else if (provider.name === 'Groq') {
      if (response.data.choices && response.data.choices[0].message) {
        return response.data.choices[0].message.content;
      } else {
        return "Sorry, no response received from the Groq API.";
      }
    }
  } catch (error) {
    logError('askAI', error);
    return `Sorry, an error occurred: ${error.message || 'Unknown error'}`;
  }
}

client.on('message', async (msg) => {
  if (!chatbotEnabled) return;
  if (msg.from.endsWith('@g.us')) return;
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
});

const tgBot = new TelegramBot(telegramToken, { polling: true });
const authenticatedChats = new Set();
const pendingStartAuth = new Map();
const startAuthSuspend = new Map();

tgBot.onText(/\/version/, (msg) => {
  tgBot.sendMessage(msg.chat.id, "Bot Version: 1.0.0");
});

tgBot.onText(/\/show_model/, (msg) => {
  let text = "List of Models:\n";
  for (let provider of API_PROVIDERS) {
    text += `\nProvider: ${provider.name}\n`;
    provider.models.forEach(m => { text += `Model: ${m.name}, ID: ${m.id}\n`; });
    if (provider.visionModels && provider.visionModels.length > 0) {
      provider.visionModels.forEach(vm => { text += `Vision Model: ${vm.name}, ID: ${vm.id}\n`; });
    }
  }
  tgBot.sendMessage(msg.chat.id, text);
});

tgBot.onText(/\/settings(\s+(\S+)\s+(\S+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  if (!match || !match[2] || !match[3]) {
    let s = `📊 Model Settings:\n\n`;
    s += `1️⃣ Safety Settings (Gemini):\n`;
    s += `• harassment: ${geminiSettings.safety.harassment ? 'ON' : 'OFF'}\n`;
    s += `• hate: ${geminiSettings.safety.hate ? 'ON' : 'OFF'}\n`;
    s += `• sexuallyExplicit: ${geminiSettings.safety.sexuallyExplicit ? 'ON' : 'OFF'}\n`;
    s += `• dangerousContent: ${geminiSettings.safety.dangerousContent ? 'ON' : 'OFF'}\n\n`;
    s += `2️⃣ Generation Config (Gemini):\n`;
    s += `• temperature: ${geminiSettings.generationConfig.temperature}\n`;
    s += `• topP: ${geminiSettings.generationConfig.topP}\n`;
    s += `• topK: ${geminiSettings.generationConfig.topK}\n`;
    s += `• maxOutputTokens: ${geminiSettings.generationConfig.maxOutputTokens}\n\n`;
    s += `Usage instructions:\n`;
    s += `• For Safety: /settings safety.[field] on/off\n`;
    s += `  Example: /settings safety.harassment on\n\n`;
    s += `• For Config: /settings config.[field] [value]\n`;
    s += `  Example: /settings config.temperature 0.7\n`;
    tgBot.sendMessage(chatId, s);
    return;
  }
  const settingPath = match[2].trim();
  const value = match[3].trim().toLowerCase();
  if (settingPath.startsWith('safety.')) {
    const field = settingPath.split('.')[1];
    if (geminiSettings.safety.hasOwnProperty(field)) {
      geminiSettings.safety[field] = (value === 'on');
      tgBot.sendMessage(chatId, `✅ Safety setting ${field} changed to ${value.toUpperCase()}.`);
    } else {
      tgBot.sendMessage(chatId, `⚠️ Setting '${field}' not recognized.`);
    }
  } else if (settingPath.startsWith('config.')) {
    const field = settingPath.split('.')[1];
    if (geminiSettings.generationConfig.hasOwnProperty(field)) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        geminiSettings.generationConfig[field] = numValue;
        tgBot.sendMessage(chatId, `✅ Generation config ${field} changed to ${numValue}.`);
      } else {
        tgBot.sendMessage(chatId, `⚠️ The value for ${field} must be a number.`);
      }
    } else {
      tgBot.sendMessage(chatId, `⚠️ Setting '${field}' not recognized.`);
    }
  } else {
    tgBot.sendMessage(chatId, `⚠️ Invalid settings format. Use /settings to see the correct format.`);
  }
});

tgBot.onText(/\/history/, (msg) => {
  const chatId = msg.chat.id;
  const userNumber = msg.from?.id?.toString() || '';
  const conversationFilePath = path.join(conversationsDir, `conversation_${userNumber}.json`);
  try {
    let conversation;
    if (fs.existsSync(conversationFilePath)) {
      conversation = JSON.parse(fs.readFileSync(conversationFilePath, 'utf8'));
    } else {
      conversation = [];
    }
    const lastEntries = conversation.slice(-10);
    if (lastEntries.length === 0) {
      tgBot.sendMessage(chatId, "No chat history recorded yet.");
    } else {
      let result = "Recent chat history:\n\n";
      lastEntries.forEach((line, idx) => {
        if (line.role !== 'system') {
          result += `${idx+1}. [${line.role}] ${line.content.substring(0, 100)}${line.content.length > 100 ? '...' : ''}\n\n`;
        }
      });
      tgBot.sendMessage(chatId, result);
    }
  } catch (error) {
    logError('history', error);
    tgBot.sendMessage(chatId, "An error occurred while retrieving chat history.");
  }
});

tgBot.onText(/\/start_chatbot/, (msg) => {
  chatbotEnabled = true;
  tgBot.sendMessage(msg.chat.id, "Chatbot activated.");
});
tgBot.onText(/\/stop_chatbot/, (msg) => {
  chatbotEnabled = false;
  tgBot.sendMessage(msg.chat.id, "Chatbot deactivated.");
});

tgBot.onText(/\/help/, (msg) => {
  const helpMessage = `📌 List of Commands:

/start - Start the bot and initial authentication (if not already authenticated).
/start_chatbot - Activate the chatbot.
/stop_chatbot - Deactivate the chatbot.
/add [number] - Add a new user (with password verification).
/remove [number] - Remove a user (with password verification; admin users cannot be removed via the bot).
/show_model - Display the list of models and each startup's unique model IDs.
/settings - Display all available settings.
/settings safety.[field] on/off - Change Gemini Safety Settings.
/settings config.[field] [value] - Change Gemini Generation Config.
/history - Display recent chat history.
/version - Display the bot version.
/list - Display the list of authorized users.
/logs - Display logs (placeholder).
/status - Display chatbot and provider status.
`;
  tgBot.sendMessage(msg.chat.id, helpMessage);
});

tgBot.onText(/\/list/, (msg) => {
  const adminList = authorizedUsers.admin.join('\n');
  const userList = authorizedUsers.users.join('\n');
  const response = `📋 Authorized Users List:\n\nAdmin:\n${adminList}\n\nUser:\n${userList}`;
  tgBot.sendMessage(msg.chat.id, response);
});

tgBot.onText(/\/logs/, (msg) => {
  tgBot.sendMessage(msg.chat.id, "ℹ️ Logs feature has not been fully implemented yet.");
});
tgBot.onText(/\/status/, (msg) => {
  const providerStatus = API_PROVIDERS.map(provider => `${provider.name}: ${provider.available ? 'Available' : 'Unavailable'}`).join('\n');
  const currentProvider = API_PROVIDERS[currentProviderIndex];
  const currentModel = currentProvider.models[currentProvider.currentModelIndex].name;
  const currentVisionModel = currentProvider.visionModels[currentProvider.currentVisionModelIndex].name;
  const response = `🤖 Chatbot Status:
Chatbot active: ${chatbotEnabled ? 'Yes' : 'No'}
Current provider: ${currentProvider.name}
Current text model: ${currentModel}
Current vision model: ${currentVisionModel}

Provider Status:
${providerStatus}`;
  tgBot.sendMessage(msg.chat.id, response);
});

const pendingAddRequests = new Map();
tgBot.onText(/\/add\s+(\+?\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const newUser = `${match[1].replace(/\D/g, '')}@c.us`;
  pendingAddRequests.set(chatId, { newUser, attempt: 0, timestamp: Date.now() });
  tgBot.sendMessage(chatId, "Please enter the admin password to add a user:");
});

const pendingRemoveRequests = new Map();
tgBot.onText(/\/remove\s+(\+?\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const targetUser = `${match[1].replace(/\D/g, '')}@c.us`;
  pendingRemoveRequests.set(chatId, { targetUser, attempt: 0, timestamp: Date.now() });
  tgBot.sendMessage(chatId, "Please enter the admin password to remove a user:");
});

tgBot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (!msg.text || msg.text.startsWith('/')) return;
  if (pendingAddRequests.has(chatId)) {
    const pending = pendingAddRequests.get(chatId);
    if (msg.text.trim() === ADMIN_PASSWORD) {
      if (!authorizedUsers.users.includes(pending.newUser)) {
        authorizedUsers.users.push(pending.newUser);
        saveAuthorizedUsers();
        tgBot.sendMessage(chatId, `✅ User ${pending.newUser} has been successfully added.`);
      } else {
        tgBot.sendMessage(chatId, `⚠️ User ${pending.newUser} is already registered.`);
      }
      pendingAddRequests.delete(chatId);
    } else {
      pending.attempt++;
      if (pending.attempt >= 5) {
        tgBot.sendMessage(chatId, "🚫 Incorrect password 5 times. /add action canceled.");
        pendingAddRequests.delete(chatId);
      } else {
        tgBot.sendMessage(chatId, `Incorrect password! Attempt ${pending.attempt}. Please enter the correct password:`);
      }
    }
  }
  if (pendingRemoveRequests.has(chatId)) {
    const pending = pendingRemoveRequests.get(chatId);
    if (msg.text.trim() === ADMIN_PASSWORD) {
      if (authorizedUsers.admin.includes(pending.targetUser)) {
        tgBot.sendMessage(chatId, "⚠️ Cannot remove an admin user via this command.");
      } else {
        const index = authorizedUsers.users.indexOf(pending.targetUser);
        if (index !== -1) {
          authorizedUsers.users.splice(index, 1);
          saveAuthorizedUsers();
          tgBot.sendMessage(chatId, `✅ User ${pending.targetUser} has been successfully removed.`);
        } else {
          tgBot.sendMessage(chatId, `⚠️ User ${pending.targetUser} not found.`);
        }
      }
      pendingRemoveRequests.delete(chatId);
    } else {
      pending.attempt++;
      if (pending.attempt >= 5) {
        tgBot.sendMessage(chatId, "🚫 Incorrect password 5 times. /remove action canceled.");
        pendingRemoveRequests.delete(chatId);
      } else {
        tgBot.sendMessage(chatId, `Incorrect password! Attempt ${pending.attempt}. Please enter the correct password:`);
      }
    }
  }
});
