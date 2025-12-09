# XCStrings Localizer

A modern web application for translating iOS/macOS `.xcstrings` files and App Store Connect metadata using AI.

## Quick Start

### Try it Online
Visit the live demo: **https://xcstrings-localizer.pages.dev**

### Run Locally
```bash
git clone https://github.com/yourusername/xcstrings-localizer.git
cd xcstrings-localizer
npm install
npm run dev
```

Open http://localhost:5173 - that's it! The dev server includes a proxy for App Store Connect API (no CORS issues).

## Features

### XCStrings Translation
- Upload and parse `.xcstrings` localization files
- Translate to 35+ languages using AI (OpenAI, AWS Bedrock)
- Protected words that won't be translated (brand names, app names)
- Batch processing with configurable concurrency
- View and edit translations in a table editor
- Export translated files

### App Store Connect Integration
- Connect to App Store Connect API with your credentials
- Browse apps and versions
- Auto-translate app metadata (description, what's new, keywords, promotional text)
- Create new app versions
- Edit localizations directly

## Tech Stack

- **React 18** + **Vite**
- **Tailwind CSS** + **shadcn/ui**
- **jose** for JWT signing (App Store Connect API auth)

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/xcstrings-localizer.git
cd xcstrings-localizer

# Install dependencies
npm install

# Start development server
npm run dev
```

## Configuration

### AI Provider

Configure your AI provider in the sidebar:

| Provider | API Key Format | Models |
|----------|---------------|--------|
| OpenAI | `sk-...` | GPT-5-mini, GPT-5-nano |
| AWS Bedrock | `ACCESS_KEY:SECRET_KEY` | Claude Haiku/Sonnet/Opus 4.5 |

### App Store Connect

1. Go to [App Store Connect > API Keys](https://appstoreconnect.apple.com/access/integrations/api)
2. Create a new API key with appropriate permissions
3. Note your **Key ID** and **Issuer ID**
4. Download the `.p8` private key file
5. Enter credentials in the sidebar and upload the `.p8` file

> **Note:** The private key is never saved to localStorage for security. You'll need to upload it each session.

## Development

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── AppSidebar.jsx   # Main sidebar with configuration
│   └── AppStoreConnect.jsx  # ASC page
├── services/
│   ├── translationService.js    # AI translation logic
│   └── appStoreConnectService.js # ASC API client
├── utils/
│   └── xcstringsParser.js  # .xcstrings file parser
├── hooks/
│   └── use-mobile.js    # Responsive hook
├── lib/
│   └── utils.js         # Utility functions
└── App.jsx              # Main application
```

## Production Deployment

### CORS Issue

The App Store Connect API doesn't support CORS. In development, we use Vite's proxy. For production, you have several options:

#### Option 1: Vercel Serverless Function

Create `api/asc/[...path].js`:

```javascript
export const config = { runtime: 'edge' }

export default async function handler(request) {
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/asc', '')

  const response = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method: request.method,
    headers: {
      'Authorization': request.headers.get('Authorization'),
      'Content-Type': 'application/json',
    },
    body: request.method !== 'GET' ? await request.text() : undefined,
  })

  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  })
}
```

#### Option 2: Cloudflare (Recommended)

Deploy both the site and API proxy to Cloudflare:

```bash
# Install Wrangler CLI
npm install -g wrangler
wrangler login

# 1. Deploy the API proxy (worker/)
wrangler deploy -c wrangler.proxy.jsonc
# Note the URL: https://xcstrings-localizer-proxy.YOUR_ACCOUNT.workers.dev

# 2. Set the proxy URL for production build
echo "VITE_ASC_PROXY_URL=https://xcstrings-localizer-proxy.YOUR_ACCOUNT.workers.dev" > .env.production

# 3. Build and deploy the site
npm run build
wrangler pages deploy dist --project-name=xcstrings-localizer
```

Your site will be live at `https://xcstrings-localizer.pages.dev`

#### Option 3: Desktop App

Convert to a desktop app using Tauri or Electron (no CORS restrictions).

#### Option 4: Run Locally

Use `npm run dev` locally - the Vite proxy handles CORS.

## Contributing

Contributions are welcome! Here's how to get started:

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run linting: `npm run lint`
5. Build to check for errors: `npm run build`
6. Commit your changes: `git commit -m "Add my feature"`
7. Push to your fork: `git push origin feature/my-feature`
8. Open a Pull Request

### Guidelines

- Follow the existing code style
- Use meaningful commit messages
- Add comments for complex logic
- Test your changes thoroughly
- Update documentation if needed

### Ideas for Contribution

- [ ] Add more AI providers (Mistral, Cohere, etc.)
- [ ] Support for other localization file formats (`.strings`, `.xliff`)
- [ ] Batch translation progress persistence
- [ ] Translation memory / glossary support
- [ ] Dark/light theme toggle
- [ ] Export translation reports
- [ ] Keyboard shortcuts
- [ ] Offline support with service workers

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components
- [Lucide](https://lucide.dev/) for icons
- [jose](https://github.com/panva/jose) for JWT handling

---

Made with care by Fayhe
