# 🚀 App Store Toolkit

[![GitHub Stars](https://img.shields.io/github/stars/fayharinn/iOS-App-Distribution-Localizer.svg?style=flat)](https://github.com/fayharinn/iOS-App-Distribution-Localizer/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/fayharinn/iOS-App-Distribution-Localizer.svg?style=flat)](https://github.com/fayharinn/iOS-App-Distribution-Localizer/issues)
[![License: AGPLv3](https://img.shields.io/badge/License-AGPLv3-yellow.svg)](https://www.gnu.org/licenses/agpl-3.0.html)
[![Last Commit](https://img.shields.io/github/last-commit/fayharinn/iOS-App-Distribution-Localizer.svg?style=flat)](https://github.com/fayharinn/iOS-App-Distribution-Localizer/commits/main)

**The all-in-one toolkit to grow your iOS app globally.** Localize your App Store listing, optimize subscription pricing by country, and generate stunning screenshots — all connected directly to App Store Connect.

🌐 **Try it now:** [localizer.fayhe.com](https://localizer.fayhe.com/)

---

## Why App Store Toolkit?

Expanding your app internationally is painful:
- Translating metadata manually takes forever
- Pricing subscriptions fairly across 175 countries is guesswork
- Creating localized screenshots for every language is tedious

**App Store Toolkit solves all of this in one place.**

---

## ✨ Features

### 🌍 AI-Powered Localization

![App Store Connect](.github/aso.png)

Translate your entire App Store listing to 40+ languages in minutes, not days.

- One-click translation of app name, subtitle, description, keywords, and what's new
- AI-powered with OpenAI or AWS Bedrock (Claude)
- Protected words to keep brand names untranslated
- Direct sync with App Store Connect — no copy-paste needed

### 💰 Smart Subscription Pricing

![Price Optimization](.github/priceoptimization.png)

Stop leaving money on the table. Set fair prices based on each country's purchasing power.

- GDP-adjusted pricing recommendations for 40+ countries
- See current vs recommended prices at a glance
- One-click price updates directly to App Store Connect
- Automatic currency conversion and price point matching

### 📱 Screenshot Generator

![Screenshot Maker](.github/screenshots.png)

Create professional App Store screenshots with device mockups in seconds.

- 2D and 3D device frames (iPhone, Android)
- Multi-language headlines with AI translation
- Custom backgrounds, shadows, and layouts
- Batch export all languages as ZIP

---

## 🚀 Quick Start

### Online (Recommended)
Just visit **[localizer.fayhe.com](https://localizer.fayhe.com/)** — no installation needed.

### Self-Hosted
```bash
git clone https://github.com/fayharinn/iOS-App-Distribution-Localizer.git
cd iOS-App-Distribution-Localizer
npm install
npm run dev
```

---

## 🔐 Security First

Your credentials never leave your browser:
- `.p8` private keys are encrypted locally with your password
- JWT tokens are generated client-side
- No data is sent to any third-party server
- Open source — audit the code yourself

<details>
<summary>View authentication flow diagram</summary>

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         App Store Connect Auth Flow                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    password     ┌──────────────┐                              │
│  │  .p8 Key │ ──────────────► │  Encrypted   │ ◄─── Stored in localStorage  │
│  │  (file)  │    encrypt      │   .p8 Key    │      (persistent)            │
│  └────┬─────┘                 └──────┬───────┘                              │
│       │                              │                                      │
│       │ sign                         │ password                             │
│       │                              │ decrypt                              │
│       ▼                              ▼                                      │
│  ┌──────────┐                 ┌──────────────┐                              │
│  │   JWT    │ ◄───────────────│  Decrypted   │                              │
│  │  Token   │     sign        │   .p8 Key    │ ◄─── In memory only          │
│  └────┬─────┘                 └──────────────┘      (cleared on reload)     │
│       │                                                                     │
│       │ cache                                                               │
│       ▼                                                                     │
│  ┌──────────────┐                                                           │
│  │ sessionStorage│ ◄─── JWT cached for ~19 min                              │
│  │  (JWT only)   │      Auto-reconnect on page reload                       │
│  └──────┬───────┘       Timer shows remaining time                          │
│         │                                                                   │
│         │ Bearer token                                                      │
│         ▼                                                                   │
│  ┌──────────────┐                                                           │
│  │  App Store   │                                                           │
│  │ Connect API  │                                                           │
│  └──────────────┘                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

</details>

---

## ⚙️ Setup

### App Store Connect API
1. Go to [App Store Connect > API Keys](https://appstoreconnect.apple.com/access/integrations/api)
2. Create a key with Admin or App Manager role
3. Note your **Key ID** and **Issuer ID**
4. Download the `.p8` file
5. Enter credentials in the app sidebar

### AI Translation
Configure in the sidebar:
| Provider | API Key Format |
|----------|---------------|
| OpenAI | `sk-...` |
| AWS Bedrock | `ACCESS_KEY:SECRET_KEY` |

---

## 🛠 Tech Stack

- **React 19** + **Vite** — Fast, modern frontend
- **Tailwind CSS** + **shadcn/ui** — Beautiful UI components
- **Three.js** — 3D device mockups
- **jose** — JWT signing for App Store Connect

---

## 🌐 Deployment

The App Store Connect API doesn't support CORS. For production, deploy with Cloudflare:

```bash
# Deploy API proxy
wrangler deploy -c wrangler.proxy.jsonc

# Set proxy URL
echo "VITE_ASC_PROXY_URL=https://your-proxy.workers.dev" > .env.production

# Deploy site
npm run build
wrangler pages deploy dist
```

---

## 🤝 Contributing

Contributions welcome! Feel free to open issues or submit PRs.

---

## 📄 License

GNU AGPLv3 — Free to use, modify, and distribute with attribution.

---

## 🙏 Credits

Screenshot generator based on [appscreen](https://github.com/YUZU-Hub/appscreen) by Stefan from yuzuhub.com

## 👥 Contributors

- [isnine](https://github.com/isnine) — Azure OpenAI support
- [krrskl](https://github.com/krrskl) Github models support

---

[![Follow on X](https://img.shields.io/badge/Follow-@fayhecode-black?style=for-the-badge&logo=x)](https://x.com/fayhecode)
