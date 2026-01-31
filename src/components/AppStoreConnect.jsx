import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Store, Link2, AppWindow, Layers, Languages, Sparkles, CheckCircle2, AlertCircle, Clock, Terminal, Plus, Edit3, Globe, Loader2, Copy, ChevronDown, Search, TrendingUp, RefreshCw, Image, Smartphone, Tablet, Monitor, Watch, Upload, FolderOpen, X } from 'lucide-react'
import {
  testConnection,
  listApps,
  listVersions,
  getVersionLocalizations,
  getAppInfoLocalizations,
  updateVersionLocalization,
  createVersionLocalization,
  updateAppInfoLocalization,
  createAppInfoLocalization,
  translateAllFields,
  createVersion,
  getScreenshotSets,
  getAllScreenshotsForVersion,
  createScreenshotSet,
  uploadScreenshot,
  deleteAllScreenshotsInSet,
  normalizeLocaleCode,
  hasValidToken,
  getTokenTimeLeft,
  SCREENSHOT_DISPLAY_TYPES,
  ASC_LOCALES,
} from '@/services/appStoreConnectService'
import { PROVIDERS } from '@/services/translationService'
import { decrypt } from '@/utils/crypto'

const ENCRYPTED_KEY_STORAGE = 'asc-encrypted-p8-key'

export default function AppStoreConnect({ credentials, onCredentialsChange, aiConfig }) {

  // Connection state
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [sessionTimeLeft, setSessionTimeLeft] = useState(0)
  
  // Timer for session countdown
  useEffect(() => {
    const updateTimer = () => {
      if (credentials.keyId && credentials.issuerId) {
        setSessionTimeLeft(getTokenTimeLeft(credentials.keyId, credentials.issuerId))
      }
    }
    
    updateTimer() // Initial update
    const interval = setInterval(updateTimer, 1000) // Update every second
    return () => clearInterval(interval)
  }, [credentials.keyId, credentials.issuerId])
  
  // Format seconds to mm:ss
  const formatTimeLeft = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  // Encrypted key unlock state
  const [hasStoredKey] = useState(() => {
    if (typeof window === 'undefined') return false
    return !!window.localStorage.getItem(ENCRYPTED_KEY_STORAGE)
  })
  const [unlockPassword, setUnlockPassword] = useState('')
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState('')

  // Unlock encrypted key
  const handleUnlockKey = async () => {
    if (!unlockPassword) {
      setUnlockError('Enter password')
      return
    }
    
    const stored = localStorage.getItem(ENCRYPTED_KEY_STORAGE)
    if (!stored) {
      setUnlockError('No stored key found')
      return
    }
    
    setIsUnlocking(true)
    setUnlockError('')
    
    const result = await decrypt(stored, unlockPassword)
    
    if (result.success) {
      onCredentialsChange(prev => ({ ...prev, privateKey: result.data }))
      setUnlockPassword('')
      toast.success('Private key unlocked!')
    } else {
      setUnlockError('Wrong password')
    }
    
    setIsUnlocking(false)
  }

  // Apps & Versions
  const [apps, setApps] = useState([])
  const [selectedApp, setSelectedApp] = useState(null)
  const [versions, setVersions] = useState([])
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [isLoadingApps, setIsLoadingApps] = useState(false)
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)

  // Save selected app/version to sessionStorage
  useEffect(() => {
    if (selectedApp) {
      sessionStorage.setItem('asc-selected-app', JSON.stringify({ id: selectedApp.id, name: selectedApp.name, bundleId: selectedApp.bundleId }))
    }
  }, [selectedApp])

  useEffect(() => {
    if (selectedVersion) {
      sessionStorage.setItem('asc-selected-version', JSON.stringify({ id: selectedVersion.id, versionString: selectedVersion.versionString }))
    }
  }, [selectedVersion])

  // Localizations
  const [versionLocalizations, setVersionLocalizations] = useState([])
  const [appInfoLocalizations, setAppInfoLocalizations] = useState({ appInfoId: null, localizations: [] })
  const [isLoadingLocalizations, setIsLoadingLocalizations] = useState(false)

  // Previous version localizations (for copying What's New / Promo Text)
  const [previousVersionLocalizations, setPreviousVersionLocalizations] = useState([])
  const [isCopyingFromPrevious, setIsCopyingFromPrevious] = useState(false)

  // Inline editing for app info (name, subtitle, privacyPolicyUrl)
  const [editedAppInfo, setEditedAppInfo] = useState({}) // { [locId]: { name?, subtitle?, privacyPolicyUrl? } }
  const [isSavingAppInfo, setIsSavingAppInfo] = useState(false)
  const [isTranslatingAppInfo, setIsTranslatingAppInfo] = useState(null) // locale being translated or 'all'
  const [appInfoProtectedWords, setAppInfoProtectedWords] = useState('') // comma-separated words to keep untranslated

  // Translation state
  const [sourceLocale, setSourceLocale] = useState('en-US')
  const [targetLocales, setTargetLocales] = useState([])
  const [fieldsToTranslate, setFieldsToTranslate] = useState(['description', 'whatsNew', 'promotionalText', 'keywords'])
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0, status: '' })

  // Edit dialog
  const [editDialog, setEditDialog] = useState({
    open: false,
    locale: '',
    localization: null,
    type: 'version' // 'version' or 'appInfo'
  })

  // Create version dialog
  const [createVersionDialog, setCreateVersionDialog] = useState({
    open: false,
    versionString: '',
    platform: 'IOS',
    isCreating: false,
  })

  // Translation complete alert
  const [translationAlert, setTranslationAlert] = useState({
    show: false,
    success: true,
    message: '',
    errorCount: 0,
  })

  // ASO Keywords generation
  const [generatingKeywordsFor, setGeneratingKeywordsFor] = useState(null) // locale code being generated
  const [asoExpandedLocales, setAsoExpandedLocales] = useState([])
  const [editingKeywordsFor, setEditingKeywordsFor] = useState(null) // locale code being edited
  const [editedKeywords, setEditedKeywords] = useState('') // current edited keywords text
  const [isSavingKeywords, setIsSavingKeywords] = useState(false)

  // Screenshots
  const [screenshotsByLocale, setScreenshotsByLocale] = useState({})
  const [isLoadingScreenshots, setIsLoadingScreenshots] = useState(false)
  const [expandedScreenshotLocales, setExpandedScreenshotLocales] = useState([])
  const [screenshotPreview, setScreenshotPreview] = useState({ open: false, screenshot: null, locale: '', deviceType: '' })

  // Screenshot upload
  const [isDraggingScreenshots, setIsDraggingScreenshots] = useState(false)
  const [screenshotUploadQueue, setScreenshotUploadQueue] = useState([]) // { locale, files: File[], status }
  const [isUploadingScreenshots, setIsUploadingScreenshots] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, currentFile: '' })
  const [selectedDisplayType, setSelectedDisplayType] = useState('APP_IPHONE_67')
  const [deleteExistingScreenshots, setDeleteExistingScreenshots] = useState(true)

  // Logs
  const [logs, setLogs] = useState([])

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-100), { message, type, timestamp }])
    
    // Show toast for errors and success
    if (type === 'error') {
      toast.error(message)
    } else if (type === 'success') {
      toast.success(message)
    }
  }, [])

  // Get current AI config values
  const currentAiApiKey = aiConfig.apiKeys[aiConfig.provider] || ''
  const currentAiModel = aiConfig.models[aiConfig.provider] || PROVIDERS[aiConfig.provider]?.defaultModel || ''

  // Auto-connect on mount if we have a valid cached JWT token
  useEffect(() => {
    const canAutoConnect = credentials.keyId && credentials.issuerId && hasValidToken(credentials.keyId, credentials.issuerId)
    
    if (canAutoConnect && apps.length === 0 && !isConnecting && !isLoadingApps) {
      console.log('[Auto-connect] Valid JWT found, connecting automatically...')
      // Small delay to let the UI render first
      const timer = setTimeout(() => {
        handleAutoConnect()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, []) // Run once on mount

  // Auto-connect function (doesn't show error toasts on failure)
  const handleAutoConnect = async () => {
    setIsConnecting(true)
    try {
      const result = await testConnection(credentials)
      if (result.success) {
        setConnectionStatus(result)
        // Load apps
        const appsList = await listApps(credentials)
        setApps(appsList)
        addLog(`Auto-connected! Loaded ${appsList.length} apps`, 'success')
        
        // Restore previously selected app
        const savedApp = sessionStorage.getItem('asc-selected-app')
        if (savedApp) {
          try {
            const appData = JSON.parse(savedApp)
            const foundApp = appsList.find(a => a.id === appData.id)
            if (foundApp) {
              setSelectedApp(foundApp)
              
              // Load versions for this app
              const versionsList = await listVersions(credentials, foundApp.id)
              setVersions(versionsList)
              
              // Restore previously selected version
              const savedVersion = sessionStorage.getItem('asc-selected-version')
              if (savedVersion) {
                const versionData = JSON.parse(savedVersion)
                const foundVersion = versionsList.find(v => v.id === versionData.id)
                if (foundVersion) {
                  setSelectedVersion(foundVersion)
                  
                  // Load localizations
                  const [versionLocs, appInfoLocs] = await Promise.all([
                    getVersionLocalizations(credentials, foundVersion.id),
                    getAppInfoLocalizations(credentials, foundApp.id)
                  ])
                  setVersionLocalizations(versionLocs)
                  setAppInfoLocalizations(appInfoLocs)
                  addLog(`Restored selection: ${foundApp.name} v${foundVersion.versionString}`, 'success')
                }
              }
            }
          } catch (e) {
            console.log('[Auto-connect] Could not restore selection:', e)
          }
        }
      }
    } catch (error) {
      console.log('[Auto-connect] Failed:', error.message)
    }
    setIsConnecting(false)
  }

  // Test connection
  const handleTestConnection = async () => {
    // Allow connection if we have credentials + privateKey OR if we have a valid cached token
    const hasPrivateKey = credentials.privateKey && credentials.privateKey.trim() !== ''
    const hasCachedToken = hasValidToken(credentials.keyId, credentials.issuerId)
    
    if (!credentials.keyId || !credentials.issuerId) {
      addLog('Please fill in Key ID and Issuer ID', 'error')
      return
    }
    
    if (!hasPrivateKey && !hasCachedToken) {
      addLog('Please upload your .p8 key or wait for a valid session', 'error')
      return
    }

    setIsConnecting(true)
    setConnectionStatus(null)

    const result = await testConnection(credentials)
    setConnectionStatus(result)

    if (result.success) {
      addLog('Successfully connected to App Store Connect!', 'success')
      // Auto-load apps
      loadApps()
    } else {
      addLog(`Connection failed: ${result.message}`, 'error')
    }

    setIsConnecting(false)
  }

  // Load apps
  const loadApps = async () => {
    setIsLoadingApps(true)
    try {
      const appsList = await listApps(credentials)
      setApps(appsList)
      addLog(`Loaded ${appsList.length} apps`, 'success')
    } catch (error) {
      addLog(`Error loading apps: ${error.message}`, 'error')
    }
    setIsLoadingApps(false)
  }

  // Load versions when app is selected
  const handleAppSelect = async (appId) => {
    const app = apps.find(a => a.id === appId)
    setSelectedApp(app)
    setSelectedVersion(null)
    setVersionLocalizations([])
    setAppInfoLocalizations({ appInfoId: null, localizations: [] })

    if (!app) return

    setIsLoadingVersions(true)
    try {
      const versionsList = await listVersions(credentials, appId)
      setVersions(versionsList)
      addLog(`Loaded ${versionsList.length} versions for ${app.name}`, 'success')
    } catch (error) {
      addLog(`Error loading versions: ${error.message}`, 'error')
    }
    setIsLoadingVersions(false)
  }

  // Load localizations when version is selected
  const handleVersionSelect = async (versionId) => {
    const version = versions.find(v => v.id === versionId)
    setSelectedVersion(version)
    setPreviousVersionLocalizations([])

    if (!version) return

    setIsLoadingLocalizations(true)
    try {
      const [versionLocs, appInfoLocs] = await Promise.all([
        getVersionLocalizations(credentials, versionId),
        getAppInfoLocalizations(credentials, selectedApp.id)
      ])
      setVersionLocalizations(versionLocs)
      setAppInfoLocalizations(appInfoLocs)
      addLog(`Loaded localizations for v${version.versionString}`, 'success')

      // Try to load previous version's localizations for copying What's New/Promo Text
      const versionIndex = versions.findIndex(v => v.id === versionId)
      if (versionIndex < versions.length - 1) {
        const previousVersion = versions[versionIndex + 1]
        try {
          const prevLocs = await getVersionLocalizations(credentials, previousVersion.id)
          setPreviousVersionLocalizations(prevLocs)
          addLog(`Loaded previous version (v${previousVersion.versionString}) for copying`, 'info')
        } catch {
          // Silently fail - previous version may not have localizations
        }
      }
    } catch (error) {
      addLog(`Error loading localizations: ${error.message}`, 'error')
    }
    setIsLoadingLocalizations(false)
  }

  // Copy What's New and Promo Text from previous version
  const handleCopyFromPreviousVersion = async () => {
    if (previousVersionLocalizations.length === 0) {
      addLog('No previous version localizations available', 'error')
      return
    }

    setIsCopyingFromPrevious(true)
    let copiedCount = 0
    let errorCount = 0

    for (const currentLoc of versionLocalizations) {
      const prevLoc = previousVersionLocalizations.find(p => p.locale === currentLoc.locale)
      if (!prevLoc) continue

      // Check if current version has empty What's New or Promo Text
      const needsWhatsNew = !currentLoc.whatsNew && prevLoc.whatsNew
      const needsPromoText = !currentLoc.promotionalText && prevLoc.promotionalText

      if (needsWhatsNew || needsPromoText) {
        const updateData = {}
        if (needsWhatsNew) updateData.whatsNew = prevLoc.whatsNew
        if (needsPromoText) updateData.promotionalText = prevLoc.promotionalText

        try {
          await updateVersionLocalization(credentials, currentLoc.id, updateData)
          copiedCount++
          addLog(`Copied to ${currentLoc.locale}: ${needsWhatsNew ? 'What\'s New' : ''}${needsWhatsNew && needsPromoText ? ' & ' : ''}${needsPromoText ? 'Promo Text' : ''}`, 'success')
        } catch (error) {
          errorCount++
          addLog(`Failed to copy to ${currentLoc.locale}: ${error.message}`, 'error')
        }
      }
    }

    // Reload localizations to reflect changes
    if (copiedCount > 0) {
      const versionLocs = await getVersionLocalizations(credentials, selectedVersion.id)
      setVersionLocalizations(versionLocs)
    }

    addLog(`Copied content to ${copiedCount} locale(s)${errorCount > 0 ? `, ${errorCount} error(s)` : ''}`, copiedCount > 0 ? 'success' : 'error')
    setIsCopyingFromPrevious(false)
  }

  // Check if any localizations need copying (have empty What's New or Promo Text)
  const localesNeedingCopy = versionLocalizations.filter(loc => {
    const prevLoc = previousVersionLocalizations.find(p => p.locale === loc.locale)
    if (!prevLoc) return false
    return (!loc.whatsNew && prevLoc.whatsNew) || (!loc.promotionalText && prevLoc.promotionalText)
  })

  // Generate optimized ASO keywords for a specific locale
  const handleGenerateASOKeywords = async (locale) => {
    if (!currentAiApiKey) {
      addLog('Please configure your AI provider API key', 'error')
      return
    }

    const localization = versionLocalizations.find(l => l.locale === locale)
    if (!localization) {
      addLog(`No localization found for ${locale}`, 'error')
      return
    }

    // Get source description (prefer locale's own, fall back to source locale)
    const description = localization.description || versionLocalizations.find(l => l.locale === sourceLocale)?.description
    if (!description) {
      addLog(`No description found to generate keywords from`, 'error')
      return
    }

    const localeInfo = ASC_LOCALES.find(l => l.code === locale)
    const localeName = localeInfo?.name || locale
    const country = localeInfo?.country || localeName

    setGeneratingKeywordsFor(locale)
    addLog(`Generating optimized keywords for ${localeName}...`, 'info')

    try {
      const { translateText } = await import('@/services/translationService')

      const asoPrompt = `You are an App Store Optimization (ASO) expert. Generate keywords for an iOS/macOS app.

CRITICAL: You MUST use between 95-100 characters total (including commas). This is mandatory - do not use less than 95 characters.

RULES:
1. Language: ${localeName} (${country} market)
2. Format: comma-separated, NO spaces after commas
3. Character count: MUST be 95-100 characters total. Count carefully!
4. Use high-search-volume terms users would search for
5. Mix short keywords with longer phrases to fill the space
6. NO app name, NO generic words (app, best, free), NO trademarks
7. NO duplicate words across keywords

APP DESCRIPTION:
${description}

${localization.keywords ? `CURRENT KEYWORDS (improve these, but use 95-100 chars):
${localization.keywords}` : ''}

IMPORTANT: Count your characters! You have 100 max, use at least 95. Add more keywords if under 95 chars.

Respond with ONLY the keywords, nothing else:`

      const config = {
        provider: aiConfig.provider,
        apiKey: currentAiApiKey,
        model: currentAiModel,
        region: aiConfig.region,
        endpoint: aiConfig.endpoint
      }

      const generatedKeywords = await translateText(asoPrompt, 'en-US', locale, config)

      if (!generatedKeywords) {
        throw new Error('No keywords generated from AI')
      }

      // Clean and validate keywords
      let cleanedKeywords = generatedKeywords
        .replace(/^["']|["']$/g, '') // Remove surrounding quotes
        .replace(/\n/g, ',') // Replace newlines with commas
        .replace(/\s*,\s*/g, ',') // Remove spaces around commas
        .replace(/,+/g, ',') // Remove duplicate commas
        .replace(/^,|,$/g, '') // Remove leading/trailing commas
        .trim()

      // Ensure under 100 chars
      if (cleanedKeywords.length > 100) {
        const keywords = cleanedKeywords.split(',')
        cleanedKeywords = ''
        for (const kw of keywords) {
          const newLength = cleanedKeywords ? cleanedKeywords.length + 1 + kw.length : kw.length
          if (newLength <= 100) {
            cleanedKeywords = cleanedKeywords ? `${cleanedKeywords},${kw}` : kw
          } else {
            break
          }
        }
      }

      // Log warning if under 95 chars
      const charCount = cleanedKeywords.length
      if (charCount < 95) {
        addLog(`Warning: Only ${charCount}/100 chars used for ${localeName}. Consider adding more keywords manually.`, 'error')
      }

      // Update the localization with new keywords
      await updateVersionLocalization(credentials, localization.id, { keywords: cleanedKeywords })
      addLog(`Generated keywords for ${localeName} (${charCount}/100 chars): ${cleanedKeywords}`, 'success')

      // Reload localizations
      const versionLocs = await getVersionLocalizations(credentials, selectedVersion.id)
      setVersionLocalizations(versionLocs)

    } catch (error) {
      addLog(`Error generating keywords for ${localeName}: ${error.message}`, 'error')
    }

    setGeneratingKeywordsFor(null)
  }

  // Toggle ASO expanded locale
  const toggleAsoLocale = (locale) => {
    setAsoExpandedLocales(prev =>
      prev.includes(locale) ? prev.filter(l => l !== locale) : [...prev, locale]
    )
  }

  // Start editing keywords for a locale
  const startEditingKeywords = (locale, currentKeywords) => {
    setEditingKeywordsFor(locale)
    setEditedKeywords(currentKeywords || '')
  }

  // Cancel editing keywords
  const cancelEditingKeywords = () => {
    setEditingKeywordsFor(null)
    setEditedKeywords('')
  }

  // Save edited keywords
  const saveEditedKeywords = async (locale) => {
    const localization = versionLocalizations.find(l => l.locale === locale)
    if (!localization) return

    setIsSavingKeywords(true)
    try {
      // Clean keywords: remove extra spaces, ensure proper comma separation
      const cleanedKeywords = editedKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0)
        .join(',')

      await updateVersionLocalization(credentials, localization.id, { keywords: cleanedKeywords })
      addLog(`Saved keywords for ${ASC_LOCALES.find(l => l.code === locale)?.name || locale}`, 'success')

      // Reload localizations
      const versionLocs = await getVersionLocalizations(credentials, selectedVersion.id)
      setVersionLocalizations(versionLocs)

      setEditingKeywordsFor(null)
      setEditedKeywords('')
    } catch (error) {
      addLog(`Error saving keywords: ${error.message}`, 'error')
    }
    setIsSavingKeywords(false)
  }

  // Load screenshots for all localizations
  const handleLoadScreenshots = async () => {
    if (versionLocalizations.length === 0) return

    setIsLoadingScreenshots(true)
    addLog('Loading screenshots for all localizations...', 'info')

    try {
      const screenshots = await getAllScreenshotsForVersion(credentials, versionLocalizations)
      setScreenshotsByLocale(screenshots)

      const totalScreenshots = Object.values(screenshots).reduce((sum, loc) => sum + loc.totalScreenshots, 0)
      addLog(`Loaded ${totalScreenshots} screenshots across ${Object.keys(screenshots).length} locales`, 'success')
    } catch (error) {
      addLog(`Error loading screenshots: ${error.message}`, 'error')
    }

    setIsLoadingScreenshots(false)
  }

  // Toggle screenshot locale expansion
  const toggleScreenshotLocale = (locale) => {
    setExpandedScreenshotLocales(prev =>
      prev.includes(locale) ? prev.filter(l => l !== locale) : [...prev, locale]
    )
  }

  // Get device icon for screenshot type
  const getDeviceIcon = (displayType) => {
    if (displayType.includes('IPHONE')) return Smartphone
    if (displayType.includes('IPAD')) return Tablet
    if (displayType.includes('DESKTOP') || displayType.includes('MAC')) return Monitor
    if (displayType.includes('WATCH')) return Watch
    return Smartphone
  }

  // Handle screenshot folder drop
  const handleScreenshotDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingScreenshots(false)

    const items = e.dataTransfer.items
    const queue = []

    // Process dropped items
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.()
        if (entry) {
          if (entry.isDirectory) {
            // It's a folder - check if it's a language folder or contains language folders
            const files = await readDirectoryRecursive(entry)

            // Group files by their parent folder (language)
            const filesByLocale = {}
            for (const { file, path } of files) {
              // Extract locale from path (first folder name)
              const pathParts = path.split('/')
              const localeFolder = pathParts.length > 1 ? pathParts[0] : entry.name
              const normalizedLocale = normalizeLocaleCode(localeFolder)

              if (!filesByLocale[normalizedLocale]) {
                filesByLocale[normalizedLocale] = []
              }
              if (file.type.startsWith('image/')) {
                filesByLocale[normalizedLocale].push(file)
              }
            }

            // Add to queue
            for (const [locale, files] of Object.entries(filesByLocale)) {
              if (files.length > 0) {
                // Sort files by name
                files.sort((a, b) => a.name.localeCompare(b.name))
                queue.push({ locale, files, status: 'pending' })
              }
            }
          } else {
            // Single file - we'll need to ask for locale
            const file = item.getAsFile()
            if (file?.type.startsWith('image/')) {
              const locale = sourceLocale || 'en-US'
              const existing = queue.find(q => q.locale === locale)
              if (existing) {
                existing.files.push(file)
              } else {
                queue.push({ locale, files: [file], status: 'pending' })
              }
            }
          }
        }
      }
    }

    if (queue.length > 0) {
      setScreenshotUploadQueue(queue)
      addLog(`Detected ${queue.length} locale(s) with screenshots to upload`, 'info')
    } else {
      addLog('No valid screenshot images found in dropped items', 'error')
    }
  }

  // Recursively read directory entries
  const readDirectoryRecursive = async (dirEntry, path = '') => {
    const files = []
    const reader = dirEntry.createReader()

    const readEntries = () => new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })

    let entries = await readEntries()
    while (entries.length > 0) {
      for (const entry of entries) {
        const entryPath = path ? `${path}/${entry.name}` : entry.name
        if (entry.isFile) {
          const file = await new Promise((resolve) => entry.file(resolve))
          files.push({ file, path: entryPath })
        } else if (entry.isDirectory) {
          const subFiles = await readDirectoryRecursive(entry, entryPath)
          files.push(...subFiles)
        }
      }
      entries = await readEntries()
    }

    return files
  }

  // Remove locale from upload queue
  const removeFromUploadQueue = (locale) => {
    setScreenshotUploadQueue(prev => prev.filter(q => q.locale !== locale))
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Start uploading screenshots
  const handleUploadScreenshots = async () => {
    if (screenshotUploadQueue.length === 0) return

    setIsUploadingScreenshots(true)
    const totalFiles = screenshotUploadQueue.reduce((sum, q) => sum + q.files.length, 0)
    let uploadedCount = 0

    for (const queueItem of screenshotUploadQueue) {
      const { locale, files } = queueItem

      // Find the localization for this locale
      const localization = versionLocalizations.find(l => l.locale === locale)
      if (!localization) {
        addLog(`Locale ${locale} not found in current version, skipping`, 'error')
        setScreenshotUploadQueue(prev =>
          prev.map(q => q.locale === locale ? { ...q, status: 'error' } : q)
        )
        continue
      }

      setScreenshotUploadQueue(prev =>
        prev.map(q => q.locale === locale ? { ...q, status: 'uploading' } : q)
      )

      try {
        // Get existing screenshot sets for this locale
        const existingSets = await getScreenshotSets(credentials, localization.id)
        let screenshotSetId = existingSets.find(s => s.displayType === selectedDisplayType)?.id

        // Create screenshot set if it doesn't exist
        if (!screenshotSetId) {
          addLog(`Creating screenshot set for ${locale} (${SCREENSHOT_DISPLAY_TYPES[selectedDisplayType]?.name})...`, 'info')
          screenshotSetId = await createScreenshotSet(credentials, localization.id, selectedDisplayType)
        } else if (deleteExistingScreenshots) {
          // Delete existing screenshots in the set
          const existingSet = existingSets.find(s => s.displayType === selectedDisplayType)
          if (existingSet && existingSet.screenshots.length > 0) {
            addLog(`Deleting ${existingSet.screenshots.length} existing screenshot(s) for ${locale}...`, 'info')
            const deletedCount = await deleteAllScreenshotsInSet(credentials, screenshotSetId)
            addLog(`Deleted ${deletedCount} screenshot(s) for ${locale}`, 'success')
          }
        }

        // Upload each file
        for (const file of files) {
          setUploadProgress({ current: uploadedCount + 1, total: totalFiles, currentFile: file.name })

          addLog(`Uploading ${file.name} to ${locale} (${formatFileSize(file.size)})...`, 'info')

          const result = await uploadScreenshot(credentials, screenshotSetId, file, (progress) => {
            if (progress.status === 'error') {
              addLog(`Error uploading ${file.name}: ${progress.error}`, 'error')
            }
          })

          if (result.success) {
            addLog(`Uploaded ${file.name} to ${locale}`, 'success')
          } else {
            addLog(`Failed to upload ${file.name}: ${result.error}`, 'error')
          }

          uploadedCount++
        }

        setScreenshotUploadQueue(prev =>
          prev.map(q => q.locale === locale ? { ...q, status: 'done' } : q)
        )
      } catch (error) {
        addLog(`Error uploading to ${locale}: ${error.message}`, 'error')
        setScreenshotUploadQueue(prev =>
          prev.map(q => q.locale === locale ? { ...q, status: 'error' } : q)
        )
      }
    }

    setIsUploadingScreenshots(false)
    setUploadProgress({ current: 0, total: 0, currentFile: '' })
    addLog(`Screenshot upload complete! ${uploadedCount} files uploaded.`, 'success')

    // Reload screenshots
    handleLoadScreenshots()
  }

  // Toggle target locale
  const handleLocaleToggle = (localeCode) => {
    setTargetLocales(prev =>
      prev.includes(localeCode)
        ? prev.filter(l => l !== localeCode)
        : [...prev, localeCode]
    )
  }

  // Toggle field to translate
  const handleFieldToggle = (field) => {
    setFieldsToTranslate(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    )
  }

  // Translate all selected locales
  const handleTranslate = async () => {
    if (!currentAiApiKey) {
      addLog('Please configure your AI provider API key', 'error')
      return
    }

    if (targetLocales.length === 0) {
      addLog('Please select at least one target language', 'error')
      return
    }

    if (fieldsToTranslate.length === 0) {
      addLog('Please select at least one field to translate', 'error')
      return
    }

    // Find source localization
    const sourceLoc = versionLocalizations.find(l => l.locale === sourceLocale)
    if (!sourceLoc) {
      addLog(`No source localization found for ${sourceLocale}`, 'error')
      return
    }

    setIsTranslating(true)
    setTranslationAlert({ show: false, success: true, message: '', errorCount: 0 })
    const totalLocales = targetLocales.length
    let currentLocale = 0
    let totalErrors = 0
    let successCount = 0

    const config = {
      provider: aiConfig.provider,
      apiKey: currentAiApiKey,
      model: currentAiModel,
      region: aiConfig.region,
      endpoint: aiConfig.endpoint
    }

    for (const targetLocale of targetLocales) {
      currentLocale++
      setTranslationProgress({
        current: currentLocale,
        total: totalLocales,
        status: `Translating to ${ASC_LOCALES.find(l => l.code === targetLocale)?.name || targetLocale}...`
      })

      addLog(`Translating to ${targetLocale}...`, 'info')

      try {
        const { results: translatedFields, errors: translationErrors } = await translateAllFields(
          sourceLoc,
          targetLocale,
          config,
          fieldsToTranslate,
          (progress) => {
            setTranslationProgress(prev => ({
              ...prev,
              status: `${targetLocale}: ${progress.field} (${progress.current}/${progress.total})${progress.error ? ' - ERROR' : ''}`
            }))
            if (progress.error) {
              addLog(`  ${progress.field}: ${progress.error}`, 'error')
            }
          }
        )

        // Log any translation errors
        if (translationErrors && translationErrors.length > 0) {
          addLog(`${targetLocale}: ${translationErrors.length} field(s) failed to translate (kept original)`, 'error')
          totalErrors += translationErrors.length
        }

        // Check if localization exists
        const existingLoc = versionLocalizations.find(l => l.locale === targetLocale)

        if (existingLoc) {
          // Update existing
          await updateVersionLocalization(credentials, existingLoc.id, translatedFields)
          addLog(`Updated ${targetLocale} localization`, 'success')
        } else {
          // Create new version localization
          await createVersionLocalization(credentials, selectedVersion.id, targetLocale, translatedFields)
          addLog(`Created ${targetLocale} localization`, 'success')

          // Also create app info localization with privacy URL copied from source
          if (appInfoLocalizations.appInfoId) {
            const existingAppInfoLoc = appInfoLocalizations.localizations.find(l => l.locale === targetLocale)
            if (!existingAppInfoLoc) {
              const sourceAppInfoLoc = appInfoLocalizations.localizations.find(l => l.locale === sourceLocale)
              if (sourceAppInfoLoc?.privacyPolicyUrl) {
                try {
                  await createAppInfoLocalization(credentials, appInfoLocalizations.appInfoId, targetLocale, {
                    privacyPolicyUrl: sourceAppInfoLoc.privacyPolicyUrl,
                  })
                  addLog(`Copied privacy policy URL to ${targetLocale}`, 'success')
                } catch (appInfoError) {
                  addLog(`Note: Could not copy privacy URL to ${targetLocale}: ${appInfoError.message}`, 'info')
                }
              }
            }
          }
        }
        successCount++
      } catch (error) {
        addLog(`Error translating ${targetLocale}: ${error.message}`, 'error')
        totalErrors++
      }

      // Add a small delay between locales to avoid overwhelming the API
      if (currentLocale < totalLocales) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Reload localizations
    await handleVersionSelect(selectedVersion.id)

    setIsTranslating(false)
    setTranslationProgress({ current: 0, total: 0, status: '' })

    // Show completion alert
    if (totalErrors === 0) {
      setTranslationAlert({
        show: true,
        success: true,
        message: `Successfully translated to ${successCount} language${successCount !== 1 ? 's' : ''}!`,
        errorCount: 0,
      })
    } else {
      setTranslationAlert({
        show: true,
        success: false,
        message: `Translation completed with ${totalErrors} error${totalErrors !== 1 ? 's' : ''}. Some fields kept original text.`,
        errorCount: totalErrors,
      })
    }
    addLog('Translation completed!', 'success')
  }

  // Create new version
  const handleCreateVersion = async () => {
    if (!createVersionDialog.versionString.trim()) {
      addLog('Please enter a version number', 'error')
      return
    }

    setCreateVersionDialog(prev => ({ ...prev, isCreating: true }))

    try {
      const newVersion = await createVersion(
        credentials,
        selectedApp.id,
        createVersionDialog.versionString.trim(),
        createVersionDialog.platform
      )

      addLog(`Created version ${newVersion.versionString} (${newVersion.platform})`, 'success')

      // Reload versions and select the new one
      const versionsList = await listVersions(credentials, selectedApp.id)
      setVersions(versionsList)
      setSelectedVersion(newVersion)

      // Load localizations for the new version
      await handleVersionSelect(newVersion.id)

      setCreateVersionDialog({ open: false, versionString: '', platform: 'IOS', isCreating: false })
    } catch (error) {
      addLog(`Error creating version: ${error.message}`, 'error')
      setCreateVersionDialog(prev => ({ ...prev, isCreating: false }))
    }
  }

  // Open edit dialog
  const handleEditLocalization = (localization, type = 'version') => {
    setEditDialog({
      open: true,
      locale: localization.locale,
      localization: { ...localization },
      type
    })
  }

  // Save edited localization
  const handleSaveEdit = async () => {
    if (!editDialog.localization) return

    try {
      if (editDialog.type === 'version') {
        await updateVersionLocalization(credentials, editDialog.localization.id, {
          description: editDialog.localization.description,
          keywords: editDialog.localization.keywords,
          promotionalText: editDialog.localization.promotionalText,
          whatsNew: editDialog.localization.whatsNew,
          supportUrl: editDialog.localization.supportUrl,
          marketingUrl: editDialog.localization.marketingUrl,
        })
      } else {
        await updateAppInfoLocalization(credentials, editDialog.localization.id, {
          name: editDialog.localization.name,
          subtitle: editDialog.localization.subtitle,
          privacyPolicyUrl: editDialog.localization.privacyPolicyUrl,
        })
      }

      addLog(`Saved ${editDialog.locale} localization`, 'success')

      // Reload
      await handleVersionSelect(selectedVersion.id)
    } catch (error) {
      addLog(`Error saving: ${error.message}`, 'error')
    }

    setEditDialog({ open: false, locale: '', localization: null, type: 'version' })
  }

  // Copy Support URL from source locale to all other locales
  const [isCopyingSupportUrl, setIsCopyingSupportUrl] = useState(false)
  
  const handleCopySupportUrl = async () => {
    const sourceLoc = versionLocalizations.find(l => l.locale === sourceLocale)
    if (!sourceLoc?.supportUrl) {
      addLog(`No Support URL found in source locale (${sourceLocale})`, 'error')
      return
    }

    setIsCopyingSupportUrl(true)
    let copiedCount = 0
    let errorCount = 0

    for (const loc of versionLocalizations) {
      if (loc.locale === sourceLocale) continue // Skip source
      if (loc.supportUrl === sourceLoc.supportUrl) continue // Already same

      try {
        await updateVersionLocalization(credentials, loc.id, {
          supportUrl: sourceLoc.supportUrl
        })
        copiedCount++
      } catch (error) {
        errorCount++
        addLog(`Failed to copy Support URL to ${loc.locale}: ${error.message}`, 'error')
      }
    }

    if (copiedCount > 0) {
      addLog(`Copied Support URL to ${copiedCount} locale(s)`, 'success')
      // Reload localizations
      const versionLocs = await getVersionLocalizations(credentials, selectedVersion.id)
      setVersionLocalizations(versionLocs)
    }

    if (errorCount > 0) {
      addLog(`${errorCount} error(s) while copying Support URL`, 'error')
    }

    setIsCopyingSupportUrl(false)
  }

  // Handle inline app info field change
  const handleAppInfoChange = (locId, field, value) => {
    setEditedAppInfo(prev => ({
      ...prev,
      [locId]: {
        ...(prev[locId] || {}),
        [field]: value
      }
    }))
  }

  // Get the current value for an app info field (edited or original)
  const getAppInfoValue = (loc, field) => {
    if (editedAppInfo[loc.id]?.hasOwnProperty(field)) {
      return editedAppInfo[loc.id][field]
    }
    return loc[field] || ''
  }

  // Check if a specific field is edited
  const isFieldEdited = (locId, field) => {
    return editedAppInfo[locId]?.hasOwnProperty(field)
  }

  // Check if there are any unsaved app info changes
  const hasAppInfoChanges = Object.keys(editedAppInfo).length > 0

  // Count total edited fields
  const editedFieldsCount = Object.values(editedAppInfo).reduce(
    (count, fields) => count + Object.keys(fields).length, 0
  )

  // Save all edited app info
  const handleSaveAllAppInfo = async () => {
    if (!hasAppInfoChanges) return

    setIsSavingAppInfo(true)
    let savedFields = 0
    let failedFields = 0

    for (const [locId, fields] of Object.entries(editedAppInfo)) {
      const localeInfo = appInfoLocalizations.localizations.find(l => l.id === locId)
      const localeName = ASC_LOCALES.find(l => l.code === localeInfo?.locale)?.name || localeInfo?.locale || locId

      // Try each field separately to handle partial failures
      for (const [field, value] of Object.entries(fields)) {
        try {
          await updateAppInfoLocalization(credentials, locId, { [field]: value })
          savedFields++
        } catch (error) {
          failedFields++
          if (error.message.includes('can not be modified')) {
            addLog(`${localeName}: "${field}" locked (app not in editable state)`, 'error')
          } else {
            addLog(`${localeName}: Failed to save "${field}" - ${error.message}`, 'error')
          }
        }
      }
    }

    if (savedFields > 0) {
      addLog(`Saved ${savedFields} field(s)${failedFields > 0 ? `, ${failedFields} failed` : ''}`, savedFields > 0 ? 'success' : 'error')
    }

    // Clear edited state and reload
    setEditedAppInfo({})
    await handleVersionSelect(selectedVersion.id)
    setIsSavingAppInfo(false)
  }

  // Translate App Info (Name & Subtitle) for one or all locales - fills fields locally without saving
  const handleTranslateAppInfo = async (targetLocaleCode = null) => {
    if (!currentAiApiKey) {
      addLog('Please configure your AI provider API key', 'error')
      return
    }

    const sourceLoc = appInfoLocalizations.localizations.find(l => l.locale === sourceLocale)
    if (!sourceLoc) {
      addLog(`No source App Info found for ${sourceLocale}`, 'error')
      return
    }

    if (!sourceLoc.name && !sourceLoc.subtitle) {
      addLog('Source locale has no name or subtitle to translate', 'error')
      return
    }

    // Parse protected words
    const protectedWords = appInfoProtectedWords
      .split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0)

    const protectedWordsInstruction = protectedWords.length > 0
      ? `\nCRITICAL: Do NOT translate these words, keep them exactly as-is: ${protectedWords.join(', ')}`
      : ''

    setIsTranslatingAppInfo(targetLocaleCode || 'all')
    
    const localestoTranslate = targetLocaleCode
      ? appInfoLocalizations.localizations.filter(l => l.locale === targetLocaleCode)
      : appInfoLocalizations.localizations.filter(l => l.locale !== sourceLocale)

    if (localestoTranslate.length === 0) {
      setIsTranslatingAppInfo(null)
      return
    }

    addLog(`Translating App Info to ${localestoTranslate.length} locale(s)...`, 'info')

    const config = {
      provider: aiConfig.provider,
      apiKey: currentAiApiKey,
      model: currentAiModel,
      region: aiConfig.region,
      endpoint: aiConfig.endpoint
    }

    const { translateText } = await import('@/services/translationService')

    // Rate limiting delays per provider (in ms)
    const providerDelays = {
      github: 1500,
      openai: 200,
      azure: 200,
      bedrock: 300,
      anthropic: 200,
    }
    const requestDelay = providerDelays[config.provider] || 200

    let successCount = 0
    let errorCount = 0

    // Process sequentially to avoid rate limits
    for (const targetLoc of localestoTranslate) {
      if (targetLoc.locale === sourceLocale) continue

      const localeInfo = ASC_LOCALES.find(l => l.code === targetLoc.locale)
      const localeName = localeInfo?.name || targetLoc.locale

      try {
        const updates = {}

        // Translate name + subtitle in a single prompt for efficiency
        if (sourceLoc.name || sourceLoc.subtitle) {
          const prompt = `Translate to ${localeName}. Max 30 chars each. Keep short & catchy.${protectedWordsInstruction}
Return ONLY a JSON object like: {"name": "...", "subtitle": "..."}

${sourceLoc.name ? `Name: ${sourceLoc.name}` : ''}
${sourceLoc.subtitle ? `Subtitle: ${sourceLoc.subtitle}` : ''}`

          const result = await translateText(prompt, sourceLocale, targetLoc.locale, config)
          
          // Parse JSON response
          let parsed
          try {
            const jsonMatch = result.match(/\{[\s\S]*\}/)
            parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
          } catch {
            parsed = {}
          }

          if (parsed.name && sourceLoc.name) {
            updates.name = parsed.name.replace(/^["']|["']$/g, '').trim().substring(0, 30)
          }
          if (parsed.subtitle && sourceLoc.subtitle) {
            updates.subtitle = parsed.subtitle.replace(/^["']|["']$/g, '').trim().substring(0, 30)
          }
        }

        if (Object.keys(updates).length > 0) {
          setEditedAppInfo(prev => ({
          ...prev,
          [targetLoc.id]: {
            ...(prev[targetLoc.id] || {}),
            ...updates
          }
        }))
        addLog(`Translated App Info for ${localeName}`, 'success')
        successCount++
      } else {
        errorCount++
      }

      // Add delay between requests to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, requestDelay))
      } catch (error) {
        addLog(`Error translating App Info for ${localeName}: ${error.message}`, 'error')
        errorCount++
      }
    }

    setIsTranslatingAppInfo(null)
    if (successCount > 0) {
      addLog(`Done! ${successCount} locale(s) ready for review. Click "Save All Changes" to confirm.`, 'info')
    }
    if (errorCount > 0) {
      addLog(`${errorCount} locale(s) failed to translate`, 'error')
    }
  }

  // Get available locales that aren't already translated
  const availableTargetLocales = ASC_LOCALES.filter(
    locale => locale.code !== sourceLocale
  )

  // Get existing locales from current localizations
  const existingLocales = versionLocalizations.map(l => l.locale)

  const TRANSLATABLE_FIELDS = [
    { key: 'description', label: 'Description', limit: 4000 },
    { key: 'whatsNew', label: "What's New", limit: 4000 },
    { key: 'promotionalText', label: 'Promotional Text', limit: 170 },
    { key: 'keywords', label: 'Keywords', limit: 100 },
  ]

  const isCredentialsComplete = credentials.keyId && credentials.issuerId && credentials.privateKey
  
  // Check if we have a valid cached token (can connect without .p8 key)
  const hasCachedSession = credentials.keyId && credentials.issuerId && hasValidToken(credentials.keyId, credentials.issuerId)
  const canConnect = isCredentialsComplete || hasCachedSession

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl gradient-card border border-border/50 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg">
                <Store className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">App Store Connect</h1>
                <p className="text-sm text-muted-foreground">Translate your app metadata</p>
              </div>
            </div>
            <p className="text-muted-foreground max-w-xl">
              Connect to Apple's App Store Connect API to automatically translate your app descriptions,
              what's new, keywords, and promotional text across all locales.
            </p>
          </div>
          {apps.length > 0 && (
            <div className="flex gap-4">
              <div className="text-center px-4 py-3 rounded-xl bg-background/50 border border-border/50">
                <div className="text-2xl font-bold text-blue-500">{apps.length}</div>
                <div className="text-xs text-muted-foreground">Apps</div>
              </div>
              {selectedVersion && (
                <div className="text-center px-4 py-3 rounded-xl bg-background/50 border border-border/50">
                  <div className="text-2xl font-bold text-emerald-500">{versionLocalizations.length}</div>
                  <div className="text-xs text-muted-foreground">Locales</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Connection Status */}
      <Card id="asc-connection" className="border-border/50 shadow-sm card-hover scroll-mt-6">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Link2 className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Connect to App Store</CardTitle>
              <CardDescription>Configure credentials in the sidebar, then connect</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {credentials.keyId ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Key ID set
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                No Key ID
              </div>
            )}
            {credentials.issuerId ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Issuer ID set
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                No Issuer ID
              </div>
            )}
            {credentials.privateKey ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Private key loaded
              </div>
            ) : hasStoredKey ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 text-xs font-medium">
                <Clock className="h-3.5 w-3.5" />
                Key encrypted
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                No .p8 key
              </div>
            )}
          </div>
          
          {/* Unlock encrypted key inline */}
          {!credentials.privateKey && hasStoredKey && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <Input
                type="password"
                placeholder="Enter password to unlock key..."
                value={unlockPassword}
                onChange={(e) => {
                  setUnlockPassword(e.target.value)
                  setUnlockError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlockKey()}
                className="h-9 text-sm flex-1 max-w-[250px]"
              />
              <Button
                size="sm"
                onClick={handleUnlockKey}
                disabled={isUnlocking}
                className="h-9"
              >
                {isUnlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unlock'}
              </Button>
              {unlockError && <span className="text-xs text-red-500">{unlockError}</span>}
            </div>
          )}
          
          <div className="flex items-center gap-3">
            <Button
              onClick={handleTestConnection}
              disabled={isConnecting || !canConnect}
              className={apps.length > 0 ? '' : 'gradient-primary border-0'}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : apps.length > 0 ? 'Reconnect' : 'Connect to App Store'}
            </Button>
            {connectionStatus && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${connectionStatus.success ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                {connectionStatus.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <span className="text-sm font-medium">{connectionStatus.message}</span>
              </div>
            )}
            {sessionTimeLeft > 0 && !credentials.privateKey && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-medium font-mono">
                <Clock className="h-3.5 w-3.5" />
                {formatTimeLeft(sessionTimeLeft)}
              </div>
            )}
          </div>
          {!canConnect && (
            <p className="text-sm text-muted-foreground px-4 py-3 rounded-lg bg-muted/30 border border-border/50">
              Configure your App Store Connect credentials in the sidebar to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* App & Version Selection */}
      {apps.length > 0 && (
        <Card id="asc-app-version" className="border-border/50 shadow-sm card-hover scroll-mt-6">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              {selectedApp?.iconUrl ? (
                <img 
                  src={selectedApp.iconUrl} 
                  alt={selectedApp.name}
                  className="h-10 w-10 rounded-xl shadow-sm"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                  <AppWindow className="h-5 w-5 text-violet-500" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">Select App & Version</CardTitle>
                <CardDescription>Choose which app version to translate</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">App</Label>
                <select
                  value={selectedApp?.id || ''}
                  onChange={(e) => handleAppSelect(e.target.value)}
                  disabled={isLoadingApps}
                  className="w-full h-10 rounded-lg border border-input bg-background px-4 text-sm font-medium focus:border-primary/50 focus:outline-none transition-colors"
                >
                  <option value="">Select an app...</option>
                  {apps.map(app => (
                    <option key={app.id} value={app.id}>
                      {app.name} ({app.bundleId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Version</Label>
                <div className="flex gap-2">
                  <select
                    value={selectedVersion?.id || ''}
                    onChange={(e) => handleVersionSelect(e.target.value)}
                    disabled={isLoadingVersions || !selectedApp}
                    className="flex-1 h-10 rounded-lg border border-input bg-background px-4 text-sm font-medium focus:border-primary/50 focus:outline-none transition-colors"
                  >
                    <option value="">Select a version...</option>
                    {versions.map(version => (
                      <option key={version.id} value={version.id}>
                        v{version.versionString} ({version.platform}) - {version.state}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateVersionDialog(prev => ({ ...prev, open: true }))}
                    disabled={!selectedApp}
                    className="h-10 w-10 p-0"
                    title="Create new version"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Localizations */}
      {selectedVersion && (
        <Card id="asc-localizations" className="border-border/50 shadow-sm scroll-mt-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Layers className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Current Localizations</CardTitle>
                  <CardDescription>
                    View and edit existing localizations for v{selectedVersion.versionString}
                  </CardDescription>
                </div>
              </div>
              {/* Copy from Previous Version Button */}
              {localesNeedingCopy.length > 0 && (
                <Button
                  onClick={handleCopyFromPreviousVersion}
                  disabled={isCopyingFromPrevious}
                  variant="outline"
                  size="sm"
                  className="h-9"
                >
                  {isCopyingFromPrevious ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Copying...
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy from Previous ({localesNeedingCopy.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingLocalizations ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-3" />
                <span>Loading localizations...</span>
              </div>
            ) : versionLocalizations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Globe className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium">No localizations found</p>
                <p className="text-sm">Add translations using the section below</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Copy from Previous Version Banner */}
                {localesNeedingCopy.length > 0 && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Copy className="h-5 w-5 text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-500">
                        {localesNeedingCopy.length} locale(s) have empty What's New or Promo Text
                      </p>
                      <p className="text-xs text-amber-500/70 mt-0.5">
                        Content available from previous version can be copied
                      </p>
                    </div>
                  </div>
                )}

                {/* Version Localizations Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      Version Content
                    </h4>
                    {/* Copy Support URL button */}
                    {versionLocalizations.find(l => l.locale === sourceLocale)?.supportUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopySupportUrl}
                        disabled={isCopyingSupportUrl}
                        className="gap-2"
                      >
                        {isCopyingSupportUrl ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Copying...
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy Support URL to all
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-[150px] font-semibold">Locale</TableHead>
                          <TableHead className="font-semibold">Description</TableHead>
                          <TableHead className="w-[120px] font-semibold">What's New</TableHead>
                          <TableHead className="w-[100px] font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {versionLocalizations.map(loc => {
                          const localeInfo = ASC_LOCALES.find(l => l.code === loc.locale)
                          return (
                            <TableRow key={loc.id} className="group hover:bg-muted/20">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{localeInfo?.flag || '🌐'}</span>
                                  <span className="font-medium text-sm">{localeInfo?.name || loc.locale}</span>
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[300px]">
                                <span className="text-sm text-muted-foreground truncate block">
                                  {loc.description ? loc.description.substring(0, 80) + '...' : <span className="italic text-muted-foreground/50">No description</span>}
                                </span>
                              </TableCell>
                              <TableCell>
                                {loc.whatsNew ? (
                                  <div className="flex items-center gap-1.5 text-emerald-500">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span className="text-xs font-medium">Added</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground/50 italic">Empty</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditLocalization(loc, 'version')}
                                  className="h-8 px-3 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* App Info Localizations Table (Name, Subtitle, Privacy URL) */}
                {appInfoLocalizations.localizations.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <AppWindow className="h-4 w-4 text-muted-foreground" />
                        App Info (Name, Subtitle, Privacy Policy URL)
                      </h4>
                      <div className="flex items-center gap-2">
                        {hasAppInfoChanges && (
                          <Button
                            size="sm"
                            onClick={handleSaveAllAppInfo}
                            disabled={isSavingAppInfo}
                            className="gradient-primary border-0"
                          >
                            {isSavingAppInfo ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Save All Changes ({editedFieldsCount})
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Protected words + Translate All */}
                    <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-2 flex-1">
                        <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Protected words:</Label>
                        <Input
                          placeholder="Chill, Pro, Plus..."
                          value={appInfoProtectedWords}
                          onChange={(e) => setAppInfoProtectedWords(e.target.value)}
                          className="h-8 text-sm flex-1 max-w-[200px]"
                        />
                        <span className="text-xs text-muted-foreground">Won't be translated</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTranslateAppInfo()}
                        disabled={isTranslatingAppInfo || !currentAiApiKey}
                        className="gap-2"
                      >
                        {isTranslatingAppInfo === 'all' ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Translating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Translate All
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="rounded-xl border border-border/50 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="w-[140px] font-semibold">Locale</TableHead>
                            <TableHead className="w-[180px] font-semibold">Name (30)</TableHead>
                            <TableHead className="w-[200px] font-semibold">Subtitle (30)</TableHead>
                            <TableHead className="w-[180px] font-semibold">Privacy URL</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {appInfoLocalizations.localizations.map(loc => {
                            const localeInfo = ASC_LOCALES.find(l => l.code === loc.locale)
                            const hasAnyEdit = editedAppInfo.hasOwnProperty(loc.id)
                            const isSource = loc.locale === sourceLocale
                            const isTranslatingThis = isTranslatingAppInfo === loc.locale
                            return (
                              <TableRow key={loc.id} className={hasAnyEdit ? 'bg-amber-500/5' : 'hover:bg-muted/20'}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{localeInfo?.flag || '🌐'}</span>
                                    <span className="font-medium text-sm">{localeInfo?.name || loc.locale}</span>
                                    {isSource && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Source</Badge>}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    placeholder="App Name"
                                    value={getAppInfoValue(loc, 'name')}
                                    onChange={(e) => handleAppInfoChange(loc.id, 'name', e.target.value)}
                                    maxLength={30}
                                    className={`text-sm h-9 ${isFieldEdited(loc.id, 'name') ? 'border-amber-500 bg-amber-500/5' : ''}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    placeholder="Subtitle"
                                    value={getAppInfoValue(loc, 'subtitle')}
                                    onChange={(e) => handleAppInfoChange(loc.id, 'subtitle', e.target.value)}
                                    maxLength={30}
                                    className={`text-sm h-9 ${isFieldEdited(loc.id, 'subtitle') ? 'border-amber-500 bg-amber-500/5' : ''}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="url"
                                    placeholder="https://..."
                                    value={getAppInfoValue(loc, 'privacyPolicyUrl')}
                                    onChange={(e) => handleAppInfoChange(loc.id, 'privacyPolicyUrl', e.target.value)}
                                    className={`text-sm h-9 ${isFieldEdited(loc.id, 'privacyPolicyUrl') ? 'border-amber-500 bg-amber-500/5' : ''}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  {!isSource && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleTranslateAppInfo(loc.locale)}
                                      disabled={isTranslatingAppInfo || !currentAiApiKey}
                                      className="h-8 w-8 p-0"
                                      title="Translate this locale"
                                    >
                                      {isTranslatingThis ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Sparkles className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ASO Keywords Tool */}
      {selectedVersion && versionLocalizations.length > 0 && (
        <Card id="asc-aso-keywords" className="border-border/50 shadow-sm scroll-mt-6">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">ASO Keywords</CardTitle>
                <CardDescription>Optimize keywords for each locale using AI</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20">
              <Search className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Smart Keyword Generation</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate optimized, country-specific keywords based on your app description.
                  Keywords are tailored for each market, not just translated.
                </p>
              </div>
            </div>

            {/* Keywords by locale */}
            <div className="space-y-2">
              {versionLocalizations.map(loc => {
                const localeInfo = ASC_LOCALES.find(l => l.code === loc.locale)
                const isExpanded = asoExpandedLocales.includes(loc.locale)
                const isGenerating = generatingKeywordsFor === loc.locale
                const keywordCount = loc.keywords ? loc.keywords.split(',').length : 0
                const charCount = loc.keywords?.length || 0

                return (
                  <div
                    key={loc.id}
                    className="rounded-xl border border-border/50 overflow-hidden transition-all duration-200 hover:border-border"
                  >
                    {/* Locale header */}
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleAsoLocale(loc.locale)}
                    >
                      <span className="text-xl">{localeInfo?.flag || '🌐'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{localeInfo?.name || loc.locale}</span>
                          {loc.keywords ? (
                            <Badge variant="outline" className="text-xs">
                              {keywordCount} keywords
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs text-muted-foreground">
                              No keywords
                            </Badge>
                          )}
                        </div>
                        {loc.keywords && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {loc.keywords}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {loc.keywords && (
                          <span className={`text-xs font-mono ${charCount > 90 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            {charCount}/100
                          </span>
                        )}
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-border/50 bg-muted/20">
                        <div className="space-y-3">
                          {/* Keywords display or edit mode */}
                          {editingKeywordsFor === loc.locale ? (
                            /* Edit mode */
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs font-medium text-muted-foreground">Edit Keywords</Label>
                                  <span className={`text-xs font-mono ${editedKeywords.length > 90 ? 'text-amber-500' : editedKeywords.length > 100 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                    {editedKeywords.length}/100
                                  </span>
                                </div>
                                <Textarea
                                  value={editedKeywords}
                                  onChange={(e) => setEditedKeywords(e.target.value)}
                                  placeholder="keyword1,keyword2,keyword3"
                                  className="min-h-[80px] text-sm font-mono resize-none"
                                  maxLength={100}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Separate keywords with commas. No spaces after commas.
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    saveEditedKeywords(loc.locale)
                                  }}
                                  disabled={isSavingKeywords || editedKeywords.length > 100}
                                  size="sm"
                                  className="flex-1 h-9"
                                >
                                  {isSavingKeywords ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Save Keywords
                                    </>
                                  )}
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    cancelEditingKeywords()
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="h-9"
                                  disabled={isSavingKeywords}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* View mode */
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-muted-foreground">Current Keywords</Label>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    startEditingKeywords(loc.locale, loc.keywords)
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                >
                                  <Edit3 className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                              {loc.keywords ? (
                                <div
                                  className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-background/50 border border-border/30 cursor-pointer hover:border-primary/30 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    startEditingKeywords(loc.locale, loc.keywords)
                                  }}
                                >
                                  {loc.keywords.split(',').map((keyword, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2.5 py-1 rounded-lg bg-background border border-border/50 text-xs font-medium hover:border-primary/50 hover:bg-primary/5 transition-colors"
                                    >
                                      {keyword.trim()}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div
                                  className="p-4 rounded-lg bg-background/50 border border-dashed border-border/50 cursor-pointer hover:border-primary/30 transition-colors text-center"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    startEditingKeywords(loc.locale, '')
                                  }}
                                >
                                  <p className="text-sm text-muted-foreground">No keywords set</p>
                                  <p className="text-xs text-muted-foreground/70 mt-1">Click to add keywords</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Generate button - only show when not editing */}
                          {editingKeywordsFor !== loc.locale && (
                            <>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleGenerateASOKeywords(loc.locale)
                                }}
                                disabled={isGenerating || !currentAiApiKey}
                                variant="outline"
                                size="sm"
                                className="w-full h-9"
                              >
                                {isGenerating ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Generating optimized keywords...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    {loc.keywords ? 'AI Regenerate Keywords' : 'AI Generate Keywords'}
                                  </>
                                )}
                              </Button>

                              {!currentAiApiKey && (
                                <p className="text-xs text-amber-500 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Configure AI API key in sidebar
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Generate all button */}
            <div className="pt-2">
              <Button
                onClick={async () => {
                  for (const loc of versionLocalizations) {
                    await handleGenerateASOKeywords(loc.locale)
                  }
                }}
                disabled={generatingKeywordsFor !== null || !currentAiApiKey}
                className="w-full h-11 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 border-0"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Generate Keywords for All Locales ({versionLocalizations.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Screenshots */}
      {selectedVersion && versionLocalizations.length > 0 && (
        <Card id="asc-screenshots" className="border-border/50 shadow-sm scroll-mt-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg">
                  <Image className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Screenshots</CardTitle>
                  <CardDescription>View screenshots for each locale</CardDescription>
                </div>
              </div>
              <Button
                onClick={handleLoadScreenshots}
                disabled={isLoadingScreenshots}
                variant={Object.keys(screenshotsByLocale).length > 0 ? "outline" : "default"}
                size="sm"
                className={Object.keys(screenshotsByLocale).length > 0 ? "h-9" : "h-9 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 border-0"}
              >
                {isLoadingScreenshots ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : Object.keys(screenshotsByLocale).length > 0 ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </>
                ) : (
                  <>
                    <Image className="h-4 w-4 mr-2" />
                    Load Screenshots
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {Object.keys(screenshotsByLocale).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Image className="h-10 w-10 mb-3 opacity-30" />
                <p className="font-medium">No screenshots loaded</p>
                <p className="text-sm mt-1">Click "Load Screenshots" to view all locale screenshots</p>
              </div>
            ) : (
              <div className="space-y-2">
                {versionLocalizations.map(loc => {
                  const localeInfo = ASC_LOCALES.find(l => l.code === loc.locale)
                  const screenshotData = screenshotsByLocale[loc.locale]
                  const isExpanded = expandedScreenshotLocales.includes(loc.locale)
                  const totalCount = screenshotData?.totalScreenshots || 0

                  return (
                    <div
                      key={loc.id}
                      className="rounded-xl border border-border/50 overflow-hidden transition-all duration-200 hover:border-border"
                    >
                      {/* Locale header */}
                      <div
                        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => toggleScreenshotLocale(loc.locale)}
                      >
                        <span className="text-xl">{localeInfo?.flag || '🌐'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{localeInfo?.name || loc.locale}</span>
                            {totalCount > 0 ? (
                              <Badge variant="outline" className="text-xs">
                                {totalCount} screenshot{totalCount !== 1 ? 's' : ''}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs text-muted-foreground">
                                No screenshots
                              </Badge>
                            )}
                          </div>
                          {screenshotData?.sets?.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {screenshotData.sets.length} device type{screenshotData.sets.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>

                      {/* Expanded content */}
                      {isExpanded && screenshotData && (
                        <div className="px-4 pb-4 pt-2 border-t border-border/50 bg-muted/20">
                          {screenshotData.error ? (
                            <div className="flex items-center gap-2 text-red-500 text-sm">
                              <AlertCircle className="h-4 w-4" />
                              <span>{screenshotData.error}</span>
                            </div>
                          ) : screenshotData.sets.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No screenshot sets found</p>
                          ) : (
                            <div className="space-y-4">
                              {screenshotData.sets.map(set => {
                                const DeviceIcon = getDeviceIcon(set.displayType)
                                return (
                                  <div key={set.id} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <DeviceIcon className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-medium">{set.displayInfo.name}</span>
                                      <span className="text-xs text-muted-foreground">({set.displayInfo.device})</span>
                                      <Badge variant="outline" className="text-xs ml-auto">
                                        {set.screenshots.length}
                                      </Badge>
                                    </div>
                                    {set.screenshots.length > 0 && (
                                      <div className="flex gap-2 overflow-x-auto pb-2">
                                        {set.screenshots.map((screenshot, idx) => (
                                          <div
                                            key={screenshot.id}
                                            className="flex-shrink-0 relative group cursor-pointer"
                                            onClick={() => setScreenshotPreview({
                                              open: true,
                                              screenshot,
                                              locale: localeInfo?.name || loc.locale,
                                              deviceType: set.displayInfo.name
                                            })}
                                          >
                                            {screenshot.imageAsset?.templateUrl ? (
                                              <img
                                                src={screenshot.imageAsset.templateUrl
                                                  .replace('{w}', '150')
                                                  .replace('{h}', '300')
                                                  .replace('{f}', 'png')}
                                                alt={screenshot.fileName}
                                                className="h-32 w-auto rounded-lg border border-border/50 object-cover hover:border-primary/50 hover:scale-105 transition-all duration-200"
                                              />
                                            ) : (
                                              <div className="h-32 w-16 rounded-lg border border-border/50 bg-muted/50 flex items-center justify-center">
                                                <Image className="h-6 w-6 text-muted-foreground/50" />
                                              </div>
                                            )}
                                            <div className="absolute bottom-1 left-1 right-1 text-center">
                                              <span className="text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                                                {idx + 1}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Upload Screenshots Section */}
            <div className="mt-6 pt-6 border-t border-border/50">
              <div className="flex items-center gap-3 mb-4">
                <Upload className="h-5 w-5 text-pink-500" />
                <div>
                  <h4 className="font-medium text-sm">Upload Screenshots</h4>
                  <p className="text-xs text-muted-foreground">Drag & drop a folder with language subfolders (en, fr, de...)</p>
                </div>
              </div>

              {/* Device type selector */}
              <div className="mb-4">
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">Target Device</Label>
                <select
                  value={selectedDisplayType}
                  onChange={(e) => setSelectedDisplayType(e.target.value)}
                  className="w-full h-9 rounded-lg bg-muted/30 border border-border/50 px-3 text-sm focus:border-primary/50 focus:outline-none transition-colors"
                >
                  {Object.entries(SCREENSHOT_DISPLAY_TYPES).map(([key, info]) => (
                    <option key={key} value={key}>{info.name} - {info.device}</option>
                  ))}
                </select>
              </div>

              {/* Upload options */}
              <div className="mb-4 p-3 rounded-lg bg-muted/20 border border-border/30">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteExistingScreenshots}
                    onChange={(e) => setDeleteExistingScreenshots(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-pink-500 focus:ring-pink-500"
                  />
                  <span className="text-sm">Replace existing screenshots</span>
                </label>
                {deleteExistingScreenshots && (
                  <p className="text-xs text-amber-500 flex items-center gap-1 mt-2">
                    <AlertCircle className="h-3 w-3" />
                    Existing screenshots for the selected device type will be deleted before uploading
                  </p>
                )}
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingScreenshots(true) }}
                onDragLeave={(e) => { e.preventDefault(); setIsDraggingScreenshots(false) }}
                onDrop={handleScreenshotDrop}
                className={`
                  relative rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200
                  ${isDraggingScreenshots
                    ? 'border-pink-500 bg-pink-500/10 scale-[1.02]'
                    : 'border-border/50 hover:border-pink-500/50 hover:bg-muted/30'
                  }
                `}
              >
                <FolderOpen className={`h-10 w-10 mx-auto mb-3 ${isDraggingScreenshots ? 'text-pink-500' : 'text-muted-foreground/50'}`} />
                <p className={`font-medium ${isDraggingScreenshots ? 'text-pink-500' : 'text-muted-foreground'}`}>
                  {isDraggingScreenshots ? 'Drop your folder here!' : 'Drop screenshot folder here'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Folder structure: /en/*.png, /fr/*.png, /de/*.png...
                </p>
              </div>

              {/* Upload queue */}
              {screenshotUploadQueue.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-medium">Upload Queue</h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setScreenshotUploadQueue([])}
                      disabled={isUploadingScreenshots}
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Clear all
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {screenshotUploadQueue.map(({ locale, files, status }) => {
                      const localeInfo = ASC_LOCALES.find(l => l.code === locale)
                      const localization = versionLocalizations.find(l => l.locale === locale)

                      return (
                        <div
                          key={locale}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            status === 'done' ? 'bg-emerald-500/10 border-emerald-500/30' :
                            status === 'error' ? 'bg-red-500/10 border-red-500/30' :
                            status === 'uploading' ? 'bg-pink-500/10 border-pink-500/30' :
                            'bg-muted/30 border-border/50'
                          }`}
                        >
                          <span className="text-xl">{localeInfo?.flag || '🌐'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{localeInfo?.name || locale}</span>
                              <Badge variant="outline" className="text-xs">
                                {files.length} file{files.length !== 1 ? 's' : ''}
                              </Badge>
                              {!localization && (
                                <Badge variant="destructive" className="text-xs">
                                  Not in version
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {files.map(f => f.name).join(', ')}
                            </p>
                          </div>
                          {status === 'uploading' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
                          ) : status === 'done' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : status === 'error' ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <button
                              onClick={() => removeFromUploadQueue(locale)}
                              className="p-1 rounded hover:bg-muted transition-colors"
                            >
                              <X className="h-4 w-4 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Upload progress */}
                  {isUploadingScreenshots && uploadProgress.total > 0 && (
                    <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/30">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-pink-500 font-medium">Uploading...</span>
                        <span className="text-muted-foreground">{uploadProgress.current}/{uploadProgress.total}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-pink-500 transition-all duration-300"
                          style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 truncate">{uploadProgress.currentFile}</p>
                    </div>
                  )}

                  {/* Upload button */}
                  <Button
                    onClick={handleUploadScreenshots}
                    disabled={isUploadingScreenshots || screenshotUploadQueue.every(q => q.status === 'done')}
                    className="w-full h-10 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 border-0"
                  >
                    {isUploadingScreenshots ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload {screenshotUploadQueue.reduce((sum, q) => sum + q.files.length, 0)} Screenshots
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Translation Settings */}
      {selectedVersion && versionLocalizations.length > 0 && (
        <Card id="asc-translation" className="border-border/50 shadow-sm scroll-mt-6">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Translation</CardTitle>
                <CardDescription>Auto-translate metadata to other languages</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* AI Provider Info */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
              <span className="text-sm text-muted-foreground">Using:</span>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background">
                <span className="text-sm font-medium">{PROVIDERS[aiConfig.provider]?.name || aiConfig.provider}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-sm text-muted-foreground">
                  {currentAiModel?.includes('inference-profile/')
                    ? currentAiModel.split('/').pop().replace('global.anthropic.', '').replace(/-v\d+:\d+$/, '')
                    : currentAiModel || 'No model'}
                </span>
              </div>
              {!currentAiApiKey && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-medium ml-auto">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Configure API key in sidebar
                </div>
              )}
            </div>

            {/* Source Locale */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Source Language</Label>
              <select
                value={sourceLocale}
                onChange={(e) => setSourceLocale(e.target.value)}
                className="w-full h-10 rounded-lg border border-input bg-background px-4 text-sm font-medium max-w-xs focus:border-primary/50 focus:outline-none transition-colors"
              >
                {versionLocalizations.map(loc => {
                  const localeInfo = ASC_LOCALES.find(l => l.code === loc.locale)
                  return (
                    <option key={loc.locale} value={loc.locale}>
                      {localeInfo?.flag} {localeInfo?.name || loc.locale}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Fields to translate */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Fields to Translate</Label>
              <div className="flex flex-wrap gap-2">
                {TRANSLATABLE_FIELDS.map(field => {
                  const isSelected = fieldsToTranslate.includes(field.key)
                  return (
                    <button
                      key={field.key}
                      onClick={() => handleFieldToggle(field.key)}
                      className={`
                        flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200
                        ${isSelected
                          ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                          : 'border-border/50 bg-background hover:border-border hover:bg-muted/30'
                        }
                      `}
                    >
                      <div className={`
                        flex h-4 w-4 items-center justify-center rounded border-2 transition-all
                        ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}
                      `}>
                        {isSelected && (
                          <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span>{field.label}</span>
                      <span className="text-xs text-muted-foreground">({field.limit})</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Target Locales */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Target Languages</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (targetLocales.length === availableTargetLocales.length) {
                      setTargetLocales([])
                    } else {
                      setTargetLocales(availableTargetLocales.map(l => l.code))
                    }
                  }}
                  className="h-9"
                >
                  {targetLocales.length === availableTargetLocales.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {availableTargetLocales.map(locale => {
                  const exists = existingLocales.includes(locale.code)
                  const isSelected = targetLocales.includes(locale.code)
                  return (
                    <button
                      key={locale.code}
                      onClick={() => handleLocaleToggle(locale.code)}
                      className={`
                        flex items-center gap-2 p-3 rounded-xl border text-left transition-all duration-200
                        ${isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : exists
                            ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                            : 'border-border/50 bg-background hover:border-border hover:bg-muted/30'
                        }
                      `}
                    >
                      <div className={`
                        flex h-4 w-4 items-center justify-center rounded border-2 transition-all
                        ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}
                      `}>
                        {isSelected && (
                          <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-lg">{locale.flag}</span>
                      <span className="text-sm font-medium flex-1">{locale.name}</span>
                      {exists && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                          <CheckCircle2 className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Translate Button */}
            <Button
              onClick={handleTranslate}
              disabled={isTranslating || !currentAiApiKey || targetLocales.length === 0 || fieldsToTranslate.length === 0}
              className="w-full h-12 text-base font-semibold gradient-primary border-0"
              size="lg"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Translate to {targetLocales.length} language{targetLocales.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>

            {/* Progress */}
            {isTranslating && (
              <div className="space-y-4 p-5 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm font-medium">Translation in progress</span>
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">{translationProgress.current} / {translationProgress.total}</span>
                </div>
                <div className="relative h-3 rounded-full bg-background overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full gradient-primary transition-all duration-300"
                    style={{ width: `${(translationProgress.current / translationProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{translationProgress.status}</p>
              </div>
            )}

            {/* Translation Complete Alert */}
            {translationAlert.show && (
              <div className={`relative flex items-start gap-3 p-4 rounded-xl border ${translationAlert.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                {translationAlert.success ? <CheckCircle2 className="h-5 w-5 mt-0.5" /> : <AlertCircle className="h-5 w-5 mt-0.5" />}
                <div className="flex-1">
                  <p className="font-semibold">{translationAlert.success ? 'Success!' : 'Completed with errors'}</p>
                  <p className="text-sm opacity-80">{translationAlert.message}</p>
                </div>
                <button
                  onClick={() => setTranslationAlert(prev => ({ ...prev, show: false }))}
                  className="p-1 rounded-lg hover:bg-background/50 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      <Card id="asc-logs" className="border-border/50 shadow-sm scroll-mt-6">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10">
              <Terminal className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Activity Log</CardTitle>
              <CardDescription>Track API calls and events</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48 rounded-xl border border-border/50 bg-muted/20">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Terminal className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No activity yet</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 text-sm py-1.5 px-3 rounded-lg transition-colors ${
                      log.type === 'error' ? 'bg-red-500/10' :
                      log.type === 'success' ? 'bg-emerald-500/10' :
                      'hover:bg-muted/50'
                    }`}
                  >
                    <span className={`mt-0.5 ${
                      log.type === 'error' ? 'text-red-500' :
                      log.type === 'success' ? 'text-emerald-500' :
                      'text-muted-foreground'
                    }`}>
                      {log.type === 'error' ? <AlertCircle className="h-4 w-4" /> :
                       log.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> :
                       <Clock className="h-4 w-4" />}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground shrink-0 pt-0.5">{log.timestamp}</span>
                    <span className={`break-all ${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'success' ? 'text-emerald-400' :
                      'text-foreground'
                    }`}>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ ...editDialog, open: false })}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Localization</DialogTitle>
            <DialogDescription>
              {ASC_LOCALES.find(l => l.code === editDialog.locale)?.flag}{' '}
              {ASC_LOCALES.find(l => l.code === editDialog.locale)?.name || editDialog.locale}
            </DialogDescription>
          </DialogHeader>
          {editDialog.localization && editDialog.type === 'version' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Description (max 4000 chars)</Label>
                <Textarea
                  value={editDialog.localization.description}
                  onChange={(e) => setEditDialog(prev => ({
                    ...prev,
                    localization: { ...prev.localization, description: e.target.value }
                  }))}
                  rows={6}
                  maxLength={4000}
                />
                <span className="text-xs text-muted-foreground">
                  {editDialog.localization.description?.length || 0}/4000
                </span>
              </div>
              <div className="space-y-2">
                <Label>What's New (max 4000 chars)</Label>
                <Textarea
                  value={editDialog.localization.whatsNew}
                  onChange={(e) => setEditDialog(prev => ({
                    ...prev,
                    localization: { ...prev.localization, whatsNew: e.target.value }
                  }))}
                  rows={4}
                  maxLength={4000}
                />
                <span className="text-xs text-muted-foreground">
                  {editDialog.localization.whatsNew?.length || 0}/4000
                </span>
              </div>
              <div className="space-y-2">
                <Label>Promotional Text (max 170 chars)</Label>
                <Textarea
                  value={editDialog.localization.promotionalText}
                  onChange={(e) => setEditDialog(prev => ({
                    ...prev,
                    localization: { ...prev.localization, promotionalText: e.target.value }
                  }))}
                  rows={2}
                  maxLength={170}
                />
                <span className="text-xs text-muted-foreground">
                  {editDialog.localization.promotionalText?.length || 0}/170
                </span>
              </div>
              <div className="space-y-2">
                <Label>Keywords (max 100 chars, comma-separated)</Label>
                <Input
                  value={editDialog.localization.keywords}
                  onChange={(e) => setEditDialog(prev => ({
                    ...prev,
                    localization: { ...prev.localization, keywords: e.target.value }
                  }))}
                  maxLength={100}
                />
                <span className="text-xs text-muted-foreground">
                  {editDialog.localization.keywords?.length || 0}/100
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Support URL</Label>
                  <Input
                    type="url"
                    placeholder="https://example.com/support"
                    value={editDialog.localization.supportUrl || ''}
                    onChange={(e) => setEditDialog(prev => ({
                      ...prev,
                      localization: { ...prev.localization, supportUrl: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Marketing URL</Label>
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    value={editDialog.localization.marketingUrl || ''}
                    onChange={(e) => setEditDialog(prev => ({
                      ...prev,
                      localization: { ...prev.localization, marketingUrl: e.target.value }
                    }))}
                  />
                </div>
              </div>
            </div>
          )}
          {editDialog.localization && editDialog.type === 'appInfo' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>App Name (max 30 chars)</Label>
                <Input
                  value={editDialog.localization.name}
                  onChange={(e) => setEditDialog(prev => ({
                    ...prev,
                    localization: { ...prev.localization, name: e.target.value }
                  }))}
                  maxLength={30}
                />
              </div>
              <div className="space-y-2">
                <Label>Subtitle (max 30 chars)</Label>
                <Input
                  value={editDialog.localization.subtitle}
                  onChange={(e) => setEditDialog(prev => ({
                    ...prev,
                    localization: { ...prev.localization, subtitle: e.target.value }
                  }))}
                  maxLength={30}
                />
              </div>
              <div className="space-y-2">
                <Label>Privacy Policy URL</Label>
                <Input
                  type="url"
                  placeholder="https://example.com/privacy"
                  value={editDialog.localization.privacyPolicyUrl}
                  onChange={(e) => setEditDialog(prev => ({
                    ...prev,
                    localization: { ...prev.localization, privacyPolicyUrl: e.target.value }
                  }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ ...editDialog, open: false })}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save to App Store Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Version Dialog */}
      <Dialog open={createVersionDialog.open} onOpenChange={(open) => !open && setCreateVersionDialog(prev => ({ ...prev, open: false }))}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New Version</DialogTitle>
            <DialogDescription>
              Create a new App Store version for {selectedApp?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Version Number</Label>
              <Input
                placeholder="1.0.0"
                value={createVersionDialog.versionString}
                onChange={(e) => setCreateVersionDialog(prev => ({ ...prev, versionString: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <select
                value={createVersionDialog.platform}
                onChange={(e) => setCreateVersionDialog(prev => ({ ...prev, platform: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="IOS">iOS</option>
                <option value="MAC_OS">macOS</option>
                <option value="TV_OS">tvOS</option>
                <option value="VISION_OS">visionOS</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateVersionDialog({ open: false, versionString: '', platform: 'IOS', isCreating: false })}
              disabled={createVersionDialog.isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateVersion}
              disabled={createVersionDialog.isCreating || !createVersionDialog.versionString.trim()}
            >
              {createVersionDialog.isCreating ? 'Creating...' : 'Create Version'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screenshot Preview Dialog */}
      <Dialog open={screenshotPreview.open} onOpenChange={(open) => !open && setScreenshotPreview({ open: false, screenshot: null, locale: '', deviceType: '' })}>
        <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[900px] max-h-[90vh] p-0 overflow-hidden">
          <div className="relative">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-black/40 border-white/20 text-white">
                  {screenshotPreview.locale}
                </Badge>
                <Badge variant="outline" className="bg-black/40 border-white/20 text-white">
                  {screenshotPreview.deviceType}
                </Badge>
              </div>
              <button
                onClick={() => setScreenshotPreview({ open: false, screenshot: null, locale: '', deviceType: '' })}
                className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image */}
            <div className="flex items-center justify-center bg-black/95 min-h-[60vh]">
              {screenshotPreview.screenshot?.imageAsset?.templateUrl ? (
                <img
                  src={screenshotPreview.screenshot.imageAsset.templateUrl
                    .replace('{w}', '1200')
                    .replace('{h}', '2400')
                    .replace('{f}', 'png')}
                  alt={screenshotPreview.screenshot.fileName}
                  className="max-h-[85vh] w-auto object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-white/50 py-20">
                  <Image className="h-16 w-16 mb-4" />
                  <p>Image not available</p>
                </div>
              )}
            </div>

            {/* Footer with filename */}
            {screenshotPreview.screenshot?.fileName && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-white/80 text-sm text-center truncate">
                  {screenshotPreview.screenshot.fileName}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
