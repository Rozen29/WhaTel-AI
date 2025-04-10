# WhaTel-AI

> **NOTE:** This project was fully developed by AI with approximately 1 month of work.
> If this project has many shortcomings and bugs or errors, please report them and they will be fixed immediately.

## WhatsApp-Telegram AI Integration Bot

This project integrates WhatsApp and Telegram messaging platforms with AI services (Groq and Gemini) to create a versatile AI assistant. The bot can handle text conversations and image analysis across both platforms, with centralized administration via Telegram.

## Features

- **Dual Platform Support**: Works on both WhatsApp and Telegram
- **AI Integration**: Connects with Groq and Gemini API services
- **Image Analysis**: Processes and analyzes images through vision AI models
- **User Management**: Admin controls for adding/removing authorized users
- **Conversation History**: Maintains chat history for context-aware responses
- **Customizable Settings**: Adjustable AI parameters (temperature, safety settings, etc.)
- **Secure Authentication**: Password protection for admin functions

## Requirements

- Node.js (v18+)
- NPM or Yarn
- WhatsApp account
- Telegram account
- API keys for Groq and Gemini

## Dependencies

- whatsapp-web.js
- node-telegram-bot-api
- axios
- qrcode-terminal
- dotenv
- fs (built-in)
- path (built-in)

## Installation

1. Clone the repository:
   ```
   https://github.com/Rozen29/WhaTel-AI.git
   cd WhaTel-AI
   ```

2. Install dependencies:
   ```
   npm install whatsapp-web.js axios qrcode-terminal dotenv node-telegram-bot-api
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   GROQ_API_KEY=your_groq_api_key
   GEMINI_API_KEY=your_gemini_api_key
   ADMIN_PASSWORD=your_admin_password
   MODEL_CHANGE_PASSWORD=your_model_change_password
   ```

## Usage

1. Start the bot:
   ```
   npm start
   ```

2. Scan the QR code with WhatsApp to authenticate.

3. The bot will now respond to messages from authorized users on WhatsApp.

4. Use Telegram to administer the bot with the following commands:

### Telegram Commands

- `/start` - Start bot and initial authentication
- `/start_chatbot` - Enable the chatbot
- `/stop_chatbot` - Disable the chatbot
- `/add [phone_number]` - Add a new authorized user (requires admin password)
- `/remove [phone_number]` - Remove an authorized user (requires admin password)
- `/show_model` - Display available AI models
- `/settings` - Show all available settings
- `/settings safety.[field] [on/off]` - Modify Gemini safety settings
- `/settings config.[field] [value]` - Modify Gemini generation configuration
- `/history` - Show recent conversation history
- `/version` - Display bot version
- `/list` - Show authorized users
- `/status` - Show chatbot and provider status
- `/help` - Display all available commands

## File Structure

```
whatel-ai/
├── index.js              # Main application file
├── .env                  # Environment variables (create this)
├── package.json          # Project dependencies
├── README.md             # Project documentation
├── folder-foto/          # Image storage directory (auto-created)
├── conversations/        # Conversation history storage (auto-created)
├── greeted_users.json    # Record of greeted users (auto-created)
└── authorized_users.json # List of authorized users (auto-created)
```

## Security Considerations

- Keep your `.env` file secure and never commit it to version control
- Change default admin passwords
- Regularly review authorized users list
- Be mindful of data storage (conversations, images)

## Customization

- Edit the `SYSTEM_PROMPT` and `VISION_PROMPT` variables to change AI behavior
- Modify temperature and other generation parameters via Telegram commands
- Adjust safety settings to control AI response filtering

## Troubleshooting

- If WhatsApp authentication fails, delete the `.wwebjs_auth` directory and restart
- Check internet connectivity if API requests fail
- Verify API keys if AI services return authorization errors
- Ensure proper phone number format when adding users (include country code)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) for WhatsApp integration
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) for Telegram integration
- [Groq](https://groq.com) and [Gemini](https://ai.google.dev) for AI services
