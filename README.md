# AI Review Reply - Chrome Extension

A Chrome extension that uses AI to generate professional replies for Google Maps and Yelp reviews. Save time and improve customer engagement with smart, context-aware responses.

## Features

- 🤖 **AI-Powered Replies** - Generate context-aware responses using OpenAI GPT
- 🎯 **Multi-Platform Support** - Works on Google Business and Yelp
- 🎨 **Multiple Tones** - Choose from Professional, Friendly, Apologetic, or Grateful
- 📋 **One-Click Copy** - Copy replies to clipboard instantly
- ⚡ **Direct Insert** - Insert replies directly into reply boxes
- 💾 **Persistent Settings** - Your preferences are saved locally

## Installation

### From Source (Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ai-review-reply.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right

4. Click "Load unpacked" and select the extension directory

5. The extension icon will appear in your toolbar

### From Chrome Web Store (Coming Soon)

Visit the [Chrome Web Store](https://chrome.google.com/webstore) and search for "AI Review Reply"

## Setup

1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)

2. Click the extension icon and go to Settings

3. Enter your API key and click "Save"

4. You're ready to generate AI replies!

## Usage

1. Navigate to Google Business or Yelp review page

2. Click the extension icon in your toolbar

3. Click "Get Review from Page" or paste the review text

4. Select your preferred tone and platform

5. Click "Generate AI Reply"

6. Copy the reply or click "Insert to Page"

## Supported Platforms

- ✅ Google Business (business.google.com)
- ✅ Yelp (yelp.com)
- 🔜 TripAdvisor (coming soon)
- 🔜 Amazon (coming soon)

## Pricing

| Plan | Price | Features |
|------|-------|----------|
| Free | $0 | 200 uses/month |
| Pro | $9.9/month | Unlimited uses |
| Business | $29.9/month | Multi-user + API access |

## Development

### Project Structure

```
ai-review-reply/
├── manifest.json          # Extension manifest
├── popup/                 # Popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/              # Content scripts
│   ├── content.js
│   └── content.css
├── background/           # Background service worker
│   └── background.js
├── options/              # Settings page
│   ├── options.html
│   └── options.js
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### Building

No build step required. The extension runs directly from source.

### Testing

1. Load the unpacked extension in Chrome
2. Navigate to a supported review page
3. Test the extension functionality

## API Reference

The extension uses the OpenAI Chat Completions API:

- **Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Model**: `gpt-3.5-turbo`
- **Temperature**: 0.7
- **Max Tokens**: 500

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details

## Support

- 📧 Email: support@example.com
- 💬 Discord: [Join our community](https://discord.gg/example)
- 📖 Documentation: [docs.example.com](https://docs.example.com)

## Changelog

### v1.0.0 (2024-01-15)
- Initial release
- Google Business support
- Yelp support
- Multiple reply tones
- One-click copy and insert
