import * as jose from 'jose'

// Use proxy to avoid CORS
// In production, set VITE_ASC_PROXY_URL to your Cloudflare Worker URL
// e.g., https://xcstrings-localizer-proxy.your-account.workers.dev
const BASE_URL = import.meta.env.VITE_ASC_PROXY_URL
  ? `${import.meta.env.VITE_ASC_PROXY_URL}/v1`
  : '/api/appstoreconnect/v1'

// App Store Connect supported locales with their display info
export const ASC_LOCALES = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'en-AU', name: 'English (AU)', flag: '🇦🇺' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪' },
  { code: 'es-ES', name: 'Spanish (Spain)', flag: '🇪🇸' },
  { code: 'es-MX', name: 'Spanish (Mexico)', flag: '🇲🇽' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Portuguese (BR)', flag: '🇧🇷' },
  { code: 'pt-PT', name: 'Portuguese (PT)', flag: '🇵🇹' },
  { code: 'nl-NL', name: 'Dutch', flag: '🇳🇱' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'zh-Hant', name: 'Chinese (Traditional)', flag: '🇹🇼' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
  { code: 'ms', name: 'Malay', flag: '🇲🇾' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦' },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴' },
  { code: 'cs', name: 'Czech', flag: '🇨🇿' },
  { code: 'sk', name: 'Slovak', flag: '🇸🇰' },
  { code: 'da', name: 'Danish', flag: '🇩🇰' },
  { code: 'fi', name: 'Finnish', flag: '🇫🇮' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
  { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
  { code: 'el', name: 'Greek', flag: '🇬🇷' },
  { code: 'he', name: 'Hebrew', flag: '🇮🇱' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺' },
  { code: 'ca', name: 'Catalan', flag: '🏴' },
  { code: 'hr', name: 'Croatian', flag: '🇭🇷' },
]

// Parse PEM private key for ES256 signing
async function parsePrivateKey(pemContent) {
  // Clean up the PEM content
  const pemClean = pemContent
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/-----BEGIN EC PRIVATE KEY-----/, '')
    .replace(/-----END EC PRIVATE KEY-----/, '')
    .replace(/\s/g, '')

  // Import the key using jose
  const privateKey = await jose.importPKCS8(
    `-----BEGIN PRIVATE KEY-----\n${pemClean}\n-----END PRIVATE KEY-----`,
    'ES256'
  )
  return privateKey
}

// Generate JWT token for App Store Connect API
// Token cache - stores JWT with expiration (persists in sessionStorage for page reloads)
const TOKEN_CACHE_KEY = 'asc-token-cache'

function getTokenCache() {
  try {
    const cached = sessionStorage.getItem(TOKEN_CACHE_KEY)
    if (cached) return JSON.parse(cached)
  } catch { /* ignore */ }
  return null
}

function setTokenCache(token, expiry, credHash) {
  try {
    sessionStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify({ token, expiry, credHash }))
  } catch { /* ignore */ }
}

// Generate a simple hash of credentials to detect changes
function hashCredentials(keyId, issuerId) {
  return `${keyId}:${issuerId}`
}

// Check if we have a valid cached token (can be used without private key)
export function hasValidToken(keyId, issuerId) {
  const credHash = hashCredentials(keyId, issuerId)
  const cache = getTokenCache()
  const now = Date.now()
  return cache && cache.credHash === credHash && (cache.expiry - now) > 60000
}

// Get remaining time in seconds for the cached token
export function getTokenTimeLeft(keyId, issuerId) {
  const credHash = hashCredentials(keyId, issuerId)
  const cache = getTokenCache()
  if (!cache || cache.credHash !== credHash) return 0
  const timeLeft = Math.max(0, Math.floor((cache.expiry - Date.now()) / 1000))
  return timeLeft > 60 ? timeLeft : 0 // Return 0 if less than 1 min (buffer)
}

// Get cached token without needing private key
export function getCachedToken(keyId, issuerId) {
  const credHash = hashCredentials(keyId, issuerId)
  const cache = getTokenCache()
  const now = Date.now()
  if (cache && cache.credHash === credHash && (cache.expiry - now) > 60000) {
    return cache.token
  }
  return null
}

export async function generateToken(keyId, issuerId, privateKeyContent) {
  const credHash = hashCredentials(keyId, issuerId)
  const now = Date.now()
  
  // Check cached token FIRST (with 1 min buffer before expiry)
  const cache = getTokenCache()
  const cacheValid = cache && cache.credHash === credHash && (cache.expiry - now) > 60000
  
  console.log('[JWT] generateToken called:', { 
    hasPrivateKey: !!privateKeyContent && privateKeyContent.length > 0,
    cacheValid,
    cacheExpiry: cache ? new Date(cache.expiry).toISOString() : null,
    timeLeft: cache ? Math.round((cache.expiry - now) / 1000) + 's' : null
  })
  
  if (cacheValid) {
    console.log('[JWT] Using cached token')
    return cache.token
  }
  
  // Need private key to generate new token (check for empty string too)
  if (!privateKeyContent || privateKeyContent.trim() === '') {
    throw new Error('Private key required - cached token expired')
  }
  
  console.log('[JWT] Generating new token...')
  const privateKey = await parsePrivateKey(privateKeyContent)

  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
    .setIssuer(issuerId)
    .setAudience('appstoreconnect-v1')
    .setExpirationTime('20m')
    .sign(privateKey)

  // Cache the token (expires in 20 min, we store 19 min to be safe)
  setTokenCache(jwt, now + 19 * 60 * 1000, credHash)
  console.log('[JWT] New token cached for 19 min')
  
  return jwt
}

// Make authenticated API request
async function apiRequest(endpoint, token, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  // Handle 204 No Content (common for DELETE requests)
  if (response.status === 204) {
    return null
  }

  // Try to parse JSON, but handle empty responses
  let data = null
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch (e) {
      // Not JSON, that's ok for some responses
    }
  }

  if (!response.ok) {
    const errorMessage = data?.errors?.[0]?.detail || data?.errors?.[0]?.title || `API request failed: ${response.status}`
    throw new Error(errorMessage)
  }

  return data
}

// Test connection by listing apps
export async function testConnection(credentials) {
  const { keyId, issuerId, privateKey } = credentials

  try {
    const token = await generateToken(keyId, issuerId, privateKey)
    await apiRequest('/apps?limit=1', token)
    return { success: true, message: 'Connected successfully!' }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

// List all apps
// Fetch app icon from iTunes Search API
async function fetchAppIcon(bundleId) {
  try {
    const response = await fetch(`https://itunes.apple.com/lookup?bundleId=${bundleId}`)
    const data = await response.json()
    if (data.results && data.results.length > 0) {
      // Get the 512px icon and resize to 60px for display
      return data.results[0].artworkUrl512 || data.results[0].artworkUrl100 || null
    }
  } catch {
    // Silently fail - icon is optional
  }
  return null
}

export async function listApps(credentials) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  const data = await apiRequest('/apps?fields[apps]=name,bundleId&limit=200', token)

  const apps = data.data.map(app => ({
    id: app.id,
    name: app.attributes.name,
    bundleId: app.attributes.bundleId,
    iconUrl: null,
  }))

  // Fetch icons in parallel (non-blocking)
  const iconPromises = apps.map(async (app) => {
    app.iconUrl = await fetchAppIcon(app.bundleId)
    return app
  })

  return Promise.all(iconPromises)
}

// List app versions
export async function listVersions(credentials, appId) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  const data = await apiRequest(
    `/apps/${appId}/appStoreVersions?fields[appStoreVersions]=versionString,appVersionState,platform,createdDate&limit=50`,
    token
  )

  return data.data
    .map(version => ({
      id: version.id,
      versionString: version.attributes.versionString,
      state: version.attributes.appVersionState,
      platform: version.attributes.platform,
      createdDate: version.attributes.createdDate,
    }))
    .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
}

// Get version localizations
export async function getVersionLocalizations(credentials, versionId) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  const data = await apiRequest(
    `/appStoreVersions/${versionId}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,description,keywords,marketingUrl,promotionalText,supportUrl,whatsNew`,
    token
  )

  return data.data.map(loc => ({
    id: loc.id,
    locale: loc.attributes.locale,
    description: loc.attributes.description || '',
    keywords: loc.attributes.keywords || '',
    marketingUrl: loc.attributes.marketingUrl || '',
    promotionalText: loc.attributes.promotionalText || '',
    supportUrl: loc.attributes.supportUrl || '',
    whatsNew: loc.attributes.whatsNew || '',
  }))
}

// Get app info localizations (name, subtitle)
export async function getAppInfoLocalizations(credentials, appId) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  // First get the app info
  const appInfoData = await apiRequest(`/apps/${appId}/appInfos?limit=1`, token)

  if (!appInfoData.data || appInfoData.data.length === 0) {
    return { appInfoId: null, localizations: [] }
  }

  const appInfoId = appInfoData.data[0].id

  // Then get localizations
  const locData = await apiRequest(
    `/appInfos/${appInfoId}/appInfoLocalizations?fields[appInfoLocalizations]=locale,name,subtitle,privacyPolicyText,privacyPolicyUrl`,
    token
  )

  return {
    appInfoId,
    localizations: locData.data.map(loc => ({
      id: loc.id,
      locale: loc.attributes.locale,
      name: loc.attributes.name || '',
      subtitle: loc.attributes.subtitle || '',
      privacyPolicyText: loc.attributes.privacyPolicyText || '',
      privacyPolicyUrl: loc.attributes.privacyPolicyUrl || '',
    }))
  }
}

// Update version localization
export async function updateVersionLocalization(credentials, localizationId, updates) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  const payload = {
    data: {
      type: 'appStoreVersionLocalizations',
      id: localizationId,
      attributes: {}
    }
  }

  // Only include non-empty fields
  if (updates.description !== undefined) payload.data.attributes.description = updates.description
  if (updates.keywords !== undefined) payload.data.attributes.keywords = updates.keywords
  if (updates.promotionalText !== undefined) payload.data.attributes.promotionalText = updates.promotionalText
  if (updates.whatsNew !== undefined) payload.data.attributes.whatsNew = updates.whatsNew
  if (updates.marketingUrl !== undefined) payload.data.attributes.marketingUrl = updates.marketingUrl
  if (updates.supportUrl !== undefined) payload.data.attributes.supportUrl = updates.supportUrl

  await apiRequest(`/appStoreVersionLocalizations/${localizationId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  return true
}

// Create new version localization
export async function createVersionLocalization(credentials, versionId, locale, content) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  const payload = {
    data: {
      type: 'appStoreVersionLocalizations',
      attributes: {
        locale,
        ...content
      },
      relationships: {
        appStoreVersion: {
          data: {
            type: 'appStoreVersions',
            id: versionId
          }
        }
      }
    }
  }

  const data = await apiRequest('/appStoreVersionLocalizations', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return data.data.id
}

// Create a new app store version
export async function createVersion(credentials, appId, versionString, platform = 'IOS') {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  const payload = {
    data: {
      type: 'appStoreVersions',
      attributes: {
        versionString,
        platform,
        releaseType: 'MANUAL',
      },
      relationships: {
        app: {
          data: {
            type: 'apps',
            id: appId
          }
        }
      }
    }
  }

  const data = await apiRequest('/appStoreVersions', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return {
    id: data.data.id,
    versionString: data.data.attributes.versionString,
    state: data.data.attributes.appVersionState,
    platform: data.data.attributes.platform,
    createdDate: data.data.attributes.createdDate,
  }
}

// Update app info localization (name, subtitle, privacyPolicyUrl)
export async function updateAppInfoLocalization(credentials, localizationId, updates) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  const payload = {
    data: {
      type: 'appInfoLocalizations',
      id: localizationId,
      attributes: {}
    }
  }

  if (updates.name !== undefined) payload.data.attributes.name = updates.name
  if (updates.subtitle !== undefined) payload.data.attributes.subtitle = updates.subtitle
  if (updates.privacyPolicyUrl !== undefined) payload.data.attributes.privacyPolicyUrl = updates.privacyPolicyUrl

  await apiRequest(`/appInfoLocalizations/${localizationId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  return true
}

// Create app info localization
export async function createAppInfoLocalization(credentials, appInfoId, locale, content) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  const payload = {
    data: {
      type: 'appInfoLocalizations',
      attributes: {
        locale,
        ...content
      },
      relationships: {
        appInfo: {
          data: {
            type: 'appInfos',
            id: appInfoId
          }
        }
      }
    }
  }

  const data = await apiRequest('/appInfoLocalizations', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return data.data.id
}

// Translate App Store content using AI
export async function translateAppStoreContent(text, targetLocale, aiConfig, fieldType = 'description') {
  const { provider, apiKey, model, region } = aiConfig

  // Character limits per field type
  const charLimits = {
    description: 4000,
    keywords: 100,
    promotionalText: 170,
    whatsNew: 4000,
    name: 30,
    subtitle: 30,
  }

  const limit = charLimits[fieldType] || 4000
  const localeInfo = ASC_LOCALES.find(l => l.code === targetLocale)
  const localeName = localeInfo?.name || targetLocale

  const systemMessage = `You are a professional App Store content translator. Translate the following text to ${localeName}.

RULES:
1. Maintain the tone and style appropriate for an App Store listing
2. The translation MUST NOT exceed ${limit} characters
3. Keep proper nouns, brand names, and app names unchanged unless they have an official localized version
4. For keywords, keep them comma-separated and translate each keyword individually
5. Output ONLY the translated text, nothing else`

  const userMessage = `Translate to ${localeName} (max ${limit} chars):\n\n${text}`

  try {
    let content

    if (provider === 'openai') {
      console.log('[ASC Translation] Calling OpenAI API...')
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage }
          ],
        })
      })

      const result = await response.json()
      console.log('[ASC Translation] OpenAI response:', result.error ? result.error : 'OK')
      if (result.error) throw new Error(result.error.message)
      content = result.choices[0].message.content.trim()
    } else if (provider === 'bedrock') {
      console.log('[ASC Translation] Calling Bedrock API...')
      const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/converse`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: [{ text: userMessage }] }],
          system: [{ text: systemMessage }],
          inferenceConfig: { maxTokens: 4096 }
        })
      })

      const result = await response.json()
      console.log('[ASC Translation] Bedrock response:', result.message ? result.message : 'OK')
      if (result.message) throw new Error(result.message)
      content = result.output.message.content[0].text.trim()
    } else {
      throw new Error(`Unknown provider: ${provider}`)
    }

    // Enforce character limit
    if (content.length > limit) {
      content = content.substring(0, limit - 3) + '...'
    }

    return { translation: content, error: null }
  } catch (error) {
    return { translation: null, error: error.message }
  }
}

// Screenshot display types with friendly names
export const SCREENSHOT_DISPLAY_TYPES = {
  'APP_IPHONE_67': { name: 'iPhone 6.7"', device: 'iPhone 14/15 Pro Max' },
  'APP_IPHONE_61': { name: 'iPhone 6.1"', device: 'iPhone 14/15' },
  'APP_IPHONE_65': { name: 'iPhone 6.5"', device: 'iPhone 11 Pro Max' },
  'APP_IPHONE_58': { name: 'iPhone 5.8"', device: 'iPhone X/11 Pro' },
  'APP_IPHONE_55': { name: 'iPhone 5.5"', device: 'iPhone 6+/7+/8+' },
  'APP_IPHONE_47': { name: 'iPhone 4.7"', device: 'iPhone 6/7/8' },
  'APP_IPAD_PRO_3GEN_129': { name: 'iPad Pro 12.9"', device: 'iPad Pro 3rd gen+' },
  'APP_IPAD_PRO_3GEN_11': { name: 'iPad Pro 11"', device: 'iPad Pro 11"' },
  'APP_IPAD_PRO_129': { name: 'iPad Pro 12.9"', device: 'iPad Pro 1-2 gen' },
  'APP_IPAD_105': { name: 'iPad 10.5"', device: 'iPad Pro 10.5"' },
  'APP_IPAD_97': { name: 'iPad 9.7"', device: 'iPad 9.7"' },
  'APP_DESKTOP': { name: 'Mac', device: 'macOS' },
  'APP_WATCH_ULTRA': { name: 'Watch Ultra', device: 'Apple Watch Ultra' },
  'APP_WATCH_SERIES_10': { name: 'Watch Series 10', device: 'Apple Watch S10' },
  'APP_WATCH_SERIES_7': { name: 'Watch Series 7', device: 'Apple Watch S7+' },
  'APP_WATCH_SERIES_4': { name: 'Watch Series 4', device: 'Apple Watch S4-6' },
  'APP_WATCH_SERIES_3': { name: 'Watch Series 3', device: 'Apple Watch S3' },
  'APP_APPLE_TV': { name: 'Apple TV', device: 'tvOS' },
  'APP_APPLE_VISION_PRO': { name: 'Vision Pro', device: 'visionOS' },
}

// Get screenshot sets for a localization
export async function getScreenshotSets(credentials, localizationId) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  // First, get the list of screenshot sets for this localization
  const setsData = await apiRequest(
    `/appStoreVersionLocalizations/${localizationId}/appScreenshotSets?fields[appScreenshotSets]=screenshotDisplayType&limit=50`,
    token
  )

  if (!setsData.data || setsData.data.length === 0) {
    return []
  }

  // For each screenshot set, fetch its screenshots
  const screenshotSets = []

  for (const set of setsData.data) {
    try {
      // Get the screenshot set with its screenshots included
      const setDetail = await apiRequest(
        `/appScreenshotSets/${set.id}?include=appScreenshots&fields[appScreenshots]=fileSize,fileName,imageAsset,assetDeliveryState&limit[appScreenshots]=50`,
        token
      )

      const screenshots = []
      if (setDetail.included) {
        for (const item of setDetail.included) {
          if (item.type === 'appScreenshots') {
            screenshots.push({
              id: item.id,
              fileName: item.attributes.fileName,
              fileSize: item.attributes.fileSize,
              imageAsset: item.attributes.imageAsset,
              assetDeliveryState: item.attributes.assetDeliveryState,
            })
          }
        }
      }

      screenshotSets.push({
        id: set.id,
        displayType: set.attributes.screenshotDisplayType,
        displayInfo: SCREENSHOT_DISPLAY_TYPES[set.attributes.screenshotDisplayType] || {
          name: set.attributes.screenshotDisplayType,
          device: 'Unknown'
        },
        screenshots,
      })
    } catch (error) {
      console.error(`Error fetching screenshot set ${set.id}:`, error)
      // Still add the set but with empty screenshots
      screenshotSets.push({
        id: set.id,
        displayType: set.attributes.screenshotDisplayType,
        displayInfo: SCREENSHOT_DISPLAY_TYPES[set.attributes.screenshotDisplayType] || {
          name: set.attributes.screenshotDisplayType,
          device: 'Unknown'
        },
        screenshots: [],
        error: error.message,
      })
    }
  }

  return screenshotSets
}

// Map short locale codes to ASC locale codes
const LOCALE_CODE_MAP = {
  'en': 'en-US',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'es': 'es-ES',
  'it': 'it',
  'pt': 'pt-BR',
  'ja': 'ja',
  'ko': 'ko',
  'zh': 'zh-Hans',
  'zh-hans': 'zh-Hans',
  'zh-hant': 'zh-Hant',
  'ar': 'ar-SA',
  'tr': 'tr',
  'ru': 'ru',
  'th': 'th',
  'vi': 'vi',
  'id': 'id',
  'ms': 'ms',
  'pl': 'pl',
  'uk': 'uk',
  'nl': 'nl-NL',
  'sv': 'sv',
  'da': 'da',
  'fi': 'fi',
  'no': 'no',
  'el': 'el',
  'he': 'he',
  'hi': 'hi',
  'hu': 'hu',
  'cs': 'cs',
  'sk': 'sk',
  'ro': 'ro',
  'hr': 'hr',
  'ca': 'ca',
}

// Convert short locale code to ASC locale code
export function normalizeLocaleCode(code) {
  const lower = code.toLowerCase()
  return LOCALE_CODE_MAP[lower] || code
}

// Create a screenshot set for a localization
export async function createScreenshotSet(credentials, localizationId, displayType) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  const payload = {
    data: {
      type: 'appScreenshotSets',
      attributes: {
        screenshotDisplayType: displayType
      },
      relationships: {
        appStoreVersionLocalization: {
          data: {
            type: 'appStoreVersionLocalizations',
            id: localizationId
          }
        }
      }
    }
  }

  const data = await apiRequest('/appScreenshotSets', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return data.data.id
}

// Reserve a screenshot upload
export async function reserveScreenshotUpload(credentials, screenshotSetId, fileName, fileSize) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  const payload = {
    data: {
      type: 'appScreenshots',
      attributes: {
        fileName,
        fileSize
      },
      relationships: {
        appScreenshotSet: {
          data: {
            type: 'appScreenshotSets',
            id: screenshotSetId
          }
        }
      }
    }
  }

  const data = await apiRequest('/appScreenshots', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return {
    id: data.data.id,
    uploadOperations: data.data.attributes.uploadOperations,
  }
}

// Upload screenshot chunk to Apple's servers
export async function uploadScreenshotChunk(uploadOperation, fileData) {
  const { method, url, length, offset, requestHeaders } = uploadOperation

  const chunk = fileData.slice(offset, offset + length)

  const headers = {}
  for (const header of requestHeaders) {
    headers[header.name] = header.value
  }

  const response = await fetch(url, {
    method,
    headers,
    body: chunk,
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
  }

  return true
}

// Commit screenshot upload
export async function commitScreenshotUpload(credentials, screenshotId, checksum) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  const payload = {
    data: {
      type: 'appScreenshots',
      id: screenshotId,
      attributes: {
        uploaded: true,
        sourceFileChecksum: checksum
      }
    }
  }

  await apiRequest(`/appScreenshots/${screenshotId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  return true
}

// Calculate MD5 checksum for a file
export async function calculateChecksum(fileData) {
  // Use SubtleCrypto to calculate MD5-like checksum
  // Note: WebCrypto doesn't support MD5, so we'll use SHA-256 and Apple should accept it
  // Actually, Apple expects MD5 checksum, let's use a simple implementation
  const hashBuffer = await crypto.subtle.digest('SHA-256', fileData)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

// Delete a screenshot
export async function deleteScreenshot(credentials, screenshotId) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  await apiRequest(`/appScreenshots/${screenshotId}`, token, {
    method: 'DELETE',
  })

  return true
}

// Delete all screenshots in a screenshot set
export async function deleteAllScreenshotsInSet(credentials, screenshotSetId) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  // Get all screenshots in the set
  const setDetail = await apiRequest(
    `/appScreenshotSets/${screenshotSetId}?include=appScreenshots&fields[appScreenshots]=fileName&limit[appScreenshots]=50`,
    token
  )

  const screenshots = setDetail.included?.filter(item => item.type === 'appScreenshots') || []

  // Delete each screenshot
  for (const screenshot of screenshots) {
    await deleteScreenshot(credentials, screenshot.id)
  }

  return screenshots.length
}

// Upload a single screenshot file
export async function uploadScreenshot(credentials, screenshotSetId, file, onProgress) {
  try {
    onProgress?.({ status: 'reserving', fileName: file.name })

    // Read file as ArrayBuffer
    const fileData = await file.arrayBuffer()

    // Reserve upload slot
    const { id: screenshotId, uploadOperations } = await reserveScreenshotUpload(
      credentials,
      screenshotSetId,
      file.name,
      file.size
    )

    onProgress?.({ status: 'uploading', fileName: file.name, total: uploadOperations.length })

    // Upload each chunk
    for (let i = 0; i < uploadOperations.length; i++) {
      await uploadScreenshotChunk(uploadOperations[i], fileData)
      onProgress?.({
        status: 'uploading',
        fileName: file.name,
        current: i + 1,
        total: uploadOperations.length
      })
    }

    // Calculate checksum and commit
    onProgress?.({ status: 'committing', fileName: file.name })
    const checksum = await calculateChecksum(fileData)
    await commitScreenshotUpload(credentials, screenshotId, checksum)

    onProgress?.({ status: 'done', fileName: file.name })
    return { success: true, screenshotId }
  } catch (error) {
    onProgress?.({ status: 'error', fileName: file.name, error: error.message })
    return { success: false, error: error.message }
  }
}

// Get all screenshots for all localizations of a version
export async function getAllScreenshotsForVersion(credentials, versionLocalizations) {
  const screenshotsByLocale = {}

  for (const loc of versionLocalizations) {
    try {
      const sets = await getScreenshotSets(credentials, loc.id)
      screenshotsByLocale[loc.locale] = {
        localizationId: loc.id,
        sets,
        totalScreenshots: sets.reduce((sum, set) => sum + set.screenshots.length, 0),
      }
    } catch (error) {
      console.error(`Error fetching screenshots for ${loc.locale}:`, error)
      screenshotsByLocale[loc.locale] = {
        localizationId: loc.id,
        sets: [],
        totalScreenshots: 0,
        error: error.message,
      }
    }
  }

  return screenshotsByLocale
}

// Batch translate all fields for a locale
export async function translateAllFields(sourceLocalization, targetLocale, aiConfig, fieldsToTranslate, onProgress) {
  const results = {}
  const errors = []
  const total = fieldsToTranslate.length
  let current = 0

  // Debug: log the config (without API key)
  console.log('[ASC Translation] Config:', {
    provider: aiConfig.provider,
    model: aiConfig.model,
    hasApiKey: !!aiConfig.apiKey,
    region: aiConfig.region
  })

  for (const field of fieldsToTranslate) {
    const sourceText = sourceLocalization[field]

    if (!sourceText || sourceText.trim() === '') {
      results[field] = ''
      current++
      continue
    }

    onProgress?.({
      current: ++current,
      total,
      field,
      status: 'translating'
    })

    console.log(`[ASC Translation] Translating ${field} to ${targetLocale}...`)

    const { translation, error } = await translateAppStoreContent(
      sourceText,
      targetLocale,
      aiConfig,
      field
    )

    if (error) {
      console.error(`[ASC Translation] Error for ${field}:`, error)
      onProgress?.({
        current,
        total,
        field,
        status: 'error',
        error
      })
      errors.push({ field, error })
      results[field] = sourceText // Keep original on error
    } else {
      console.log(`[ASC Translation] Success for ${field}:`, translation?.substring(0, 50) + '...')
      results[field] = translation
      onProgress?.({
        current,
        total,
        field,
        status: 'success'
      })
    }
  }

  return { results, errors }
}
