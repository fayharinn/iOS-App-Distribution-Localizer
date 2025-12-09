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
export async function generateToken(keyId, issuerId, privateKeyContent) {
  const privateKey = await parsePrivateKey(privateKeyContent)

  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
    .setIssuer(issuerId)
    .setAudience('appstoreconnect-v1')
    .setExpirationTime('20m')
    .sign(privateKey)

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

  const data = await response.json()

  if (!response.ok) {
    const errorMessage = data.errors?.[0]?.detail || data.errors?.[0]?.title || 'API request failed'
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
export async function listApps(credentials) {
  const { keyId, issuerId, privateKey } = credentials
  const token = await generateToken(keyId, issuerId, privateKey)

  const data = await apiRequest('/apps?fields[apps]=name,bundleId&limit=200', token)

  return data.data.map(app => ({
    id: app.id,
    name: app.attributes.name,
    bundleId: app.attributes.bundleId,
  }))
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

// Update app info localization (name, subtitle)
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
