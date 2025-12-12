import { useState, useCallback, useMemo, useEffect } from 'react'
import WelcomeScreen from './components/WelcomeScreen'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
import { translateStrings, testApiConnection, SUPPORTED_LANGUAGES, PROVIDERS, DEFAULT_CONCURRENT_REQUESTS, DEFAULT_TEXTS_PER_BATCH } from './services/translationService'
import { parseXCStrings, generateXCStrings, getTranslationStats } from './utils/xcstringsParser'
import AppStoreConnect from './components/AppStoreConnect'
import { AppSidebar } from './components/AppSidebar'
import { Languages, Store, Upload, Sparkles, FileText, Download, Search, Edit3, Shield, Zap, Terminal, CheckCircle2, AlertCircle, Clock, X, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

const PROVIDER_CONFIG_KEY = 'xcstrings-localizer-provider-config'
const ASC_CONFIG_KEY = 'asc-localizer-config'
const PROTECTED_WORDS_KEY = 'xcstrings-localizer-protected-words'
const ACTIVE_PAGE_KEY = 'xcstrings-localizer-active-page'
const WELCOME_SHOWN_KEY = 'xcstrings-localizer-welcome-shown'

function App() {
  // Welcome screen state - show only once per session
  const [showWelcome, setShowWelcome] = useState(() => {
    return !sessionStorage.getItem(WELCOME_SHOWN_KEY)
  })

  const handleWelcomeComplete = () => {
    sessionStorage.setItem(WELCOME_SHOWN_KEY, 'true')
    setShowWelcome(false)
  }

  // Page navigation state
  const [activePage, setActivePage] = useState(() => {
    return localStorage.getItem(ACTIVE_PAGE_KEY) || 'xcstrings'
  })

  // Save active page to localStorage
  useEffect(() => {
    localStorage.setItem(ACTIVE_PAGE_KEY, activePage)
  }, [activePage])

  // Provider config state - with separate API keys per provider
  const [providerConfig, setProviderConfig] = useState(() => {
    const saved = localStorage.getItem(PROVIDER_CONFIG_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.apiKey && !parsed.apiKeys) {
          parsed.apiKeys = { [parsed.provider]: parsed.apiKey }
          delete parsed.apiKey
        }
        const provider = PROVIDERS[parsed.provider] ? parsed.provider : 'openai'
        return {
          provider,
          apiKeys: parsed.apiKeys || {},
          models: parsed.models || {},
          region: parsed.region || 'us-east-1'
        }
      } catch { /* ignore */ }
    }
    return { provider: 'openai', apiKeys: {}, models: {}, region: 'us-east-1' }
  })

  // ASC Credentials state (shared between sidebar and AppStoreConnect)
  const [ascCredentials, setAscCredentials] = useState(() => {
    const saved = localStorage.getItem(ASC_CONFIG_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch { /* ignore */ }
    }
    return { keyId: '', issuerId: '', privateKey: '' }
  })

  // Helper to get current provider's API key
  const currentApiKey = providerConfig.apiKeys[providerConfig.provider] || ''
  const currentModel = providerConfig.models[providerConfig.provider] || PROVIDERS[providerConfig.provider].defaultModel
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // { success: boolean, message: string }
  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENT_REQUESTS)
  const [batchSize, setBatchSize] = useState(DEFAULT_TEXTS_PER_BATCH)
  const [xcstringsData, setXcstringsData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [selectedLanguages, setSelectedLanguages] = useState([])
  const [isTranslating, setIsTranslating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, currentText: '' })
  const [stats, setStats] = useState(null)
  const [logs, setLogs] = useState([])

  // Editor state
  const [editDialog, setEditDialog] = useState({ open: false, key: '', lang: '', value: '' })
  const [filterLang, setFilterLang] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const ITEMS_PER_PAGE = 50

  // Protected words (do not translate)
  const [protectedWords, setProtectedWords] = useState(() => {
    const saved = localStorage.getItem(PROTECTED_WORDS_KEY)
    return saved ? JSON.parse(saved) : ['MyAppName']
  })
  const [newProtectedWord, setNewProtectedWord] = useState('')

  // Save provider config to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(PROVIDER_CONFIG_KEY, JSON.stringify(providerConfig))
  }, [providerConfig])

  // Save ASC credentials (without private key for security)
  useEffect(() => {
    const toSave = { keyId: ascCredentials.keyId, issuerId: ascCredentials.issuerId, privateKey: '' }
    localStorage.setItem(ASC_CONFIG_KEY, JSON.stringify(toSave))
  }, [ascCredentials.keyId, ascCredentials.issuerId])

  // Test API connection
  const handleTestConnection = async () => {
    if (!currentApiKey) {
      setTestResult({ success: false, message: 'Please enter an API key first' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    const config = {
      provider: providerConfig.provider,
      apiKey: currentApiKey,
      model: currentModel,
      region: providerConfig.region
    }

    const result = await testApiConnection(config)
    setTestResult(result)
    setIsTesting(false)

    if (result.success) {
      addLog(`${PROVIDERS[providerConfig.provider].name} API test successful!`, 'success')
    } else {
      addLog(`${PROVIDERS[providerConfig.provider].name} API test failed: ${result.message}`, 'error')
    }
  }

  // Save protected words to localStorage
  useEffect(() => {
    localStorage.setItem(PROTECTED_WORDS_KEY, JSON.stringify(protectedWords))
  }, [protectedWords])

  const addProtectedWord = () => {
    const word = newProtectedWord.trim()
    if (word && !protectedWords.includes(word)) {
      setProtectedWords([...protectedWords, word])
      setNewProtectedWord('')
      addLog(`Added "${word}" to protected words`, 'success')
    }
  }

  const removeProtectedWord = (word) => {
    setProtectedWords(protectedWords.filter(w => w !== word))
    addLog(`Removed "${word}" from protected words`, 'info')
  }

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-100), { message, type, timestamp }])
  }, [])

  const processFile = async (file) => {
    if (!file) return

    if (!file.name.endsWith('.xcstrings')) {
      addLog('Please upload a .xcstrings file', 'error')
      return
    }

    try {
      const text = await file.text()
      const data = parseXCStrings(text)
      setXcstringsData(data)
      setFileName(file.name)
      const fileStats = getTranslationStats(data)
      setStats(fileStats)
      addLog(`Loaded ${file.name} with ${fileStats.totalStrings} strings`, 'success')
    } catch (error) {
      addLog(`Error loading file: ${error.message}`, 'error')
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    await processFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      await processFile(files[0])
    }
  }

  const handleLanguageToggle = (langCode) => {
    setSelectedLanguages(prev =>
      prev.includes(langCode)
        ? prev.filter(l => l !== langCode)
        : [...prev, langCode]
    )
  }

  const handleSelectAll = () => {
    if (selectedLanguages.length === SUPPORTED_LANGUAGES.length) {
      setSelectedLanguages([])
    } else {
      setSelectedLanguages(SUPPORTED_LANGUAGES.map(l => l.code))
    }
  }

  const handleTranslate = async () => {
    if (!currentApiKey) {
      addLog(`Please enter your ${PROVIDERS[providerConfig.provider].name} API key`, 'error')
      return
    }
    if (!xcstringsData) {
      addLog('Please load an .xcstrings file first', 'error')
      return
    }
    if (selectedLanguages.length === 0) {
      addLog('Please select at least one language', 'error')
      return
    }

    setIsTranslating(true)
    setProgress({ current: 0, total: 0, currentText: 'Starting...' })

    const config = {
      provider: providerConfig.provider,
      apiKey: currentApiKey,
      model: currentModel,
      region: providerConfig.region
    }

    try {
      const result = await translateStrings(
        xcstringsData,
        selectedLanguages,
        config,
        protectedWords,
        (progressInfo) => {
          setProgress(progressInfo)
          if (progressInfo.log) {
            addLog(progressInfo.log, progressInfo.logType || 'info')
          }
        },
        concurrency,
        batchSize
      )

      setXcstringsData(result)
      const newStats = getTranslationStats(result)
      setStats(newStats)
      addLog('Translation completed!', 'success')
    } catch (error) {
      addLog(`Translation error: ${error.message}`, 'error')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleSave = () => {
    if (!xcstringsData) {
      addLog('No data to save', 'error')
      return
    }

    try {
      const jsonString = generateXCStrings(xcstringsData)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'Localizable.xcstrings'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      addLog(`Saved ${fileName || 'Localizable.xcstrings'}`, 'success')
    } catch (error) {
      addLog(`Error saving file: ${error.message}`, 'error')
    }
  }

  // Edit translation handler
  const handleEditTranslation = (key, lang, currentValue) => {
    setEditDialog({
      open: true,
      key,
      lang,
      value: currentValue || ''
    })
  }

  const handleSaveEdit = () => {
    if (!xcstringsData || !editDialog.key) return

    const newData = JSON.parse(JSON.stringify(xcstringsData))

    if (!newData.strings[editDialog.key]) {
      newData.strings[editDialog.key] = {}
    }
    if (!newData.strings[editDialog.key].localizations) {
      newData.strings[editDialog.key].localizations = {}
    }

    newData.strings[editDialog.key].localizations[editDialog.lang] = {
      stringUnit: {
        state: 'translated',
        value: editDialog.value
      }
    }

    setXcstringsData(newData)
    const newStats = getTranslationStats(newData)
    setStats(newStats)
    setEditDialog({ open: false, key: '', lang: '', value: '' })
    addLog(`Updated ${editDialog.lang} translation for "${editDialog.key}"`, 'success')
  }

  // Get available languages from current data
  const availableLanguages = useMemo(() => {
    if (!stats) return []
    return stats.languages.filter(l => l !== 'en')
  }, [stats])

  // Filter and prepare translations for display
  const filteredTranslations = useMemo(() => {
    if (!xcstringsData?.strings) return []

    const entries = Object.entries(xcstringsData.strings)
      .map(([key, value]) => {
        const localizations = value?.localizations || {}
        const englishText = localizations.en?.stringUnit?.value || key

        return {
          key,
          english: englishText,
          translations: localizations
        }
      })
      .filter(item => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          const matchesKey = item.key.toLowerCase().includes(query)
          const matchesEnglish = item.english.toLowerCase().includes(query)
          const matchesTranslation = Object.values(item.translations).some(t =>
            t?.stringUnit?.value?.toLowerCase().includes(query)
          )
          if (!matchesKey && !matchesEnglish && !matchesTranslation) return false
        }

        // Language filter
        if (filterLang !== 'all') {
          if (!item.translations[filterLang]?.stringUnit?.value) return false
        }

        return true
      })
      .sort((a, b) => a.key.localeCompare(b.key))

    return entries
  }, [xcstringsData, searchQuery, filterLang])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(0)
  }, [searchQuery, filterLang])

  // Paginated translations
  const paginatedTranslations = useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE
    return filteredTranslations.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredTranslations, currentPage])

  const totalPages = Math.ceil(filteredTranslations.length / ITEMS_PER_PAGE)

  // Truncate text helper
  const truncateText = (text, maxLength = 100) => {
    if (!text || text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const progressPercent = progress.total ? (progress.current / progress.total) * 100 : 0

  // Show welcome screen
  if (showWelcome) {
    return <WelcomeScreen onComplete={handleWelcomeComplete} />
  }

  return (
    <div className="dark min-h-svh bg-background">
      <SidebarProvider>
        <AppSidebar
          activePage={activePage}
          onPageChange={setActivePage}
          providerConfig={providerConfig}
          onProviderConfigChange={setProviderConfig}
          ascCredentials={ascCredentials}
          onAscCredentialsChange={setAscCredentials}
        />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border/50 bg-background/80 px-6 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />

            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50">
              <button
                onClick={() => setActivePage('xcstrings')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${activePage === 'xcstrings'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                <Languages className="h-4 w-4" />
                <span className="hidden sm:inline">XCStrings</span>
              </button>
              <button
                onClick={() => setActivePage('appstore')}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${activePage === 'appstore'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                <Store className="h-4 w-4" />
                <span className="hidden sm:inline">App Store Connect</span>
              </button>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-500">Local-first</span>
              </div>
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <Shield className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-primary">Secure</span>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 md:p-8 lg:p-10">
            <div className="mx-auto max-w-6xl space-y-8">
              {/* App Store Connect Page */}
              {activePage === 'appstore' && (
                <AppStoreConnect
                  credentials={ascCredentials}
                  aiConfig={providerConfig}
                />
              )}

              {/* XCStrings Page */}
              {activePage === 'xcstrings' && (
              <div className="space-y-8">
              {/* Hero Section */}
              <div className="relative overflow-hidden rounded-2xl gradient-card border border-border/50 p-8 shadow-xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-lg">
                        <Languages className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Localizer <span className="text-muted-foreground font-normal text-lg">by Fayhe</span></h1>
                        <p className="text-sm text-muted-foreground">AI-powered translation for iOS & macOS</p>
                      </div>
                    </div>
                    <p className="text-muted-foreground max-w-xl">
                      Upload your <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono text-foreground">.xcstrings</code> file,
                      translate to 20+ languages with AI, and export back to Xcode instantly.
                    </p>
                  </div>
                  {stats && (
                    <div className="flex gap-4">
                      <div className="text-center px-4 py-3 rounded-xl bg-background/50 border border-border/50">
                        <div className="text-2xl font-bold text-primary">{stats.totalStrings}</div>
                        <div className="text-xs text-muted-foreground">Strings</div>
                      </div>
                      <div className="text-center px-4 py-3 rounded-xl bg-background/50 border border-border/50">
                        <div className="text-2xl font-bold text-emerald-500">{stats.languages.length}</div>
                        <div className="text-xs text-muted-foreground">Languages</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Tabs defaultValue="translate" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="translate" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Translate
            </TabsTrigger>
            <TabsTrigger value="editor" disabled={!xcstringsData} className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              View & Edit {stats && <Badge variant="secondary" className="ml-1 text-xs">{stats.totalStrings}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Translate Tab */}
          <TabsContent value="translate" className="space-y-6">
            {/* AI Provider Status */}
            <Card className="overflow-hidden border-border/50 shadow-sm card-hover">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">AI Provider</CardTitle>
                    <CardDescription>Configure your AI service in the sidebar</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">{PROVIDERS[providerConfig.provider]?.name}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-sm text-muted-foreground">
                      {currentModel?.includes('inference-profile/')
                        ? currentModel.split('/').pop().replace('global.anthropic.', '').replace(/-v\d+:\d+$/, '')
                        : currentModel || 'No model'}
                    </span>
                  </div>
                  {currentApiKey ? (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Ready</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-500">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">No API key</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={isTesting || !currentApiKey}
                    className="ml-auto"
                  >
                    {isTesting ? (
                      <>
                        <span className="animate-spin mr-2">
                          <svg className="h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </span>
                        Testing...
                      </>
                    ) : 'Test Connection'}
                  </Button>
                </div>
                {testResult && (
                  <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${testResult.success ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <span className="text-sm font-medium">{testResult.message}</span>
                  </div>
                )}
                <div className="flex items-center gap-6 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Texts per batch</Label>
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={batchSize}
                      onChange={(e) => setBatchSize(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                      className="w-20 h-9 text-center"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Parallel requests</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={concurrency}
                      onChange={(e) => setConcurrency(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                      className="w-20 h-9 text-center"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Protected Words */}
            <Card className="border-border/50 shadow-sm card-hover">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                    <Shield className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Protected Words</CardTitle>
                    <CardDescription>Brand names, app names, or terms that should stay untranslated</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter a word to protect..."
                    value={newProtectedWord}
                    onChange={(e) => setNewProtectedWord(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addProtectedWord()}
                    className="flex-1 h-10"
                  />
                  <Button onClick={addProtectedWord} size="sm" className="h-10 px-4">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[48px] p-3 rounded-lg bg-muted/30 border border-border/50">
                  {protectedWords.map(word => (
                    <button
                      key={word}
                      onClick={() => removeProtectedWord(word)}
                      className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background border border-border/50 text-sm font-medium hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-500 transition-all"
                    >
                      {word}
                      <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                    </button>
                  ))}
                  {protectedWords.length === 0 && (
                    <span className="text-sm text-muted-foreground italic">No protected words added yet</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* File Upload */}
            <Card className="border-border/50 shadow-sm card-hover">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                    <Upload className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Upload File</CardTitle>
                    <CardDescription>Load your Xcode localization file to get started</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="file"
                  accept=".xcstrings"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-input"
                />
                <Label
                  htmlFor="file-input"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    relative flex flex-col items-center justify-center h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300
                    ${isDragging
                      ? 'border-primary bg-primary/10 scale-[1.02]'
                      : fileName
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/30'
                    }
                  `}
                >
                  {fileName ? (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 mb-3">
                        <FileText className="h-6 w-6 text-emerald-500" />
                      </div>
                      <span className="text-sm font-medium text-emerald-500">{fileName}</span>
                      <span className="text-xs text-muted-foreground mt-1">Click to replace</span>
                    </>
                  ) : isDragging ? (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3 animate-bounce">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-primary">Drop your file here</span>
                    </>
                  ) : (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium">Click to upload or drag and drop</span>
                      <span className="text-xs text-muted-foreground mt-1">.xcstrings files only</span>
                    </>
                  )}
                </Label>
                {stats && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{stats.totalStrings} strings</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background">
                      <Languages className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{stats.languages.length} languages</span>
                    </div>
                    {selectedLanguages.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 text-amber-500 ml-auto">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {selectedLanguages.reduce((acc, lang) => {
                            const missing = stats.totalStrings - (stats.translationCounts[lang] || 0)
                            return acc + missing
                          }, 0)} translations needed
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Language Selection */}
            <Card className="border-border/50 shadow-sm card-hover">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                      <Languages className="h-5 w-5 text-violet-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Target Languages</CardTitle>
                      <CardDescription>Select languages to translate your content into</CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSelectAll} className="h-9">
                    {selectedLanguages.length === SUPPORTED_LANGUAGES.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {SUPPORTED_LANGUAGES.map(lang => {
                    const translated = stats?.translationCounts?.[lang.code] || 0
                    const missing = stats ? stats.totalStrings - translated : 0
                    const isComplete = stats && missing === 0
                    const isSelected = selectedLanguages.includes(lang.code)

                    return (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageToggle(lang.code)}
                        className={`
                          relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200
                          ${isSelected
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : isComplete
                              ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                              : 'border-border/50 bg-background hover:border-border hover:bg-muted/30'
                          }
                        `}
                      >
                        <div className={`
                          flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all
                          ${isSelected
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground/30'
                          }
                        `}>
                          {isSelected && (
                            <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-lg">{lang.flag}</span>
                        <span className="text-sm font-medium flex-1">{lang.name}</span>
                        {stats && (
                          <span className={`
                            text-xs font-medium px-2 py-0.5 rounded-full
                            ${isComplete
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-amber-500/10 text-amber-500'
                            }
                          `}>
                            {isComplete ? <CheckCircle2 className="h-3 w-3" /> : missing}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Translate & Export</CardTitle>
                    <CardDescription>Run AI translation and download your localized file</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex gap-3">
                  <Button
                    onClick={handleTranslate}
                    disabled={isTranslating || !xcstringsData || !currentApiKey || selectedLanguages.length === 0}
                    className="flex-1 h-12 text-base font-semibold gradient-primary hover:opacity-90 border-0"
                    size="lg"
                  >
                    {isTranslating ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Translating...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        Translate {selectedLanguages.length > 0 && `(${selectedLanguages.length} languages)`}
                      </span>
                    )}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!xcstringsData}
                    variant="outline"
                    className="h-12 px-6"
                    size="lg"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Export
                  </Button>
                </div>
                {isTranslating && (
                  <div className="space-y-4 p-5 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-sm font-medium">Translation in progress</span>
                      </div>
                      <span className="text-sm font-mono text-muted-foreground">{progress.current} / {progress.total}</span>
                    </div>
                    <div className="relative h-3 rounded-full bg-background overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full gradient-primary transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{progress.currentText}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Logs */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10">
                    <Terminal className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Activity Log</CardTitle>
                    <CardDescription>Track translation progress and events</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 rounded-xl border border-border/50 bg-muted/20">
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
                          <span className="font-mono text-xs text-muted-foreground shrink-0 pt-0.5">
                            {log.timestamp}
                          </span>
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
          </TabsContent>

          {/* Editor Tab */}
          <TabsContent value="editor" className="space-y-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                    <Edit3 className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Translations Editor</CardTitle>
                    <CardDescription>Browse, search, and edit all your translations</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Filters */}
                <div className="flex gap-3 flex-wrap items-center p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search strings, keys, or translations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-10 bg-background"
                    />
                  </div>
                  <select
                    value={filterLang}
                    onChange={(e) => setFilterLang(e.target.value)}
                    className="h-10 rounded-lg border border-input bg-background px-4 text-sm font-medium min-w-[160px]"
                  >
                    <option value="all">All Languages</option>
                    {availableLanguages.map(lang => {
                      const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === lang)
                      return (
                        <option key={lang} value={lang}>
                          {langInfo ? `${langInfo.flag} ${langInfo.name}` : lang}
                        </option>
                      )
                    })}
                  </select>
                  <Button onClick={handleSave} variant="outline" className="h-10">
                    <Download className="h-4 w-4 mr-2" />
                    Export File
                  </Button>
                </div>

                {/* Translations Table */}
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="w-[180px] font-semibold">Key</TableHead>
                        <TableHead className="w-[250px] font-semibold">English</TableHead>
                        <TableHead className="font-semibold">Translations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTranslations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-16">
                            <div className="flex flex-col items-center text-muted-foreground">
                              <Search className="h-10 w-10 mb-3 opacity-30" />
                              <p className="text-sm font-medium">
                                {xcstringsData ? 'No matching strings found' : 'Load a file to see translations'}
                              </p>
                              <p className="text-xs mt-1">
                                {xcstringsData ? 'Try adjusting your search or filters' : 'Upload a .xcstrings file to get started'}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedTranslations.map(item => (
                          <TableRow key={item.key} className="group hover:bg-muted/20">
                            <TableCell className="font-mono text-xs align-top py-3">
                              <div className="max-w-[150px] truncate text-muted-foreground group-hover:text-foreground transition-colors" title={item.key}>
                                {item.key}
                              </div>
                            </TableCell>
                            <TableCell className="align-top py-3 min-w-[200px] max-w-[300px]">
                              <div className="text-sm whitespace-pre-wrap break-words">
                                {item.english}
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex flex-wrap gap-2">
                                {(filterLang === 'all' ? availableLanguages : [filterLang]).map(lang => {
                                  const translation = item.translations[lang]?.stringUnit?.value
                                  const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === lang)

                                  return (
                                    <button
                                      key={lang}
                                      onClick={() => handleEditTranslation(item.key, lang, translation)}
                                      title={translation || 'Click to add translation'}
                                      className={`
                                        group/btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
                                        ${translation
                                          ? 'bg-muted/50 hover:bg-muted border border-transparent hover:border-border'
                                          : 'bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-500'
                                        }
                                      `}
                                    >
                                      <span className="shrink-0 text-sm">{langInfo?.flag || lang}</span>
                                      <span className="max-w-[100px] truncate">
                                        {translation ? truncateText(translation, 25) : <span className="italic">Add</span>}
                                      </span>
                                      <Edit3 className="h-3 w-3 opacity-0 group-hover/btn:opacity-50 transition-opacity" />
                                    </button>
                                  )
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{filteredTranslations.length > 0 ? currentPage * ITEMS_PER_PAGE + 1 : 0}-{Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredTranslations.length)}</span> of <span className="font-medium text-foreground">{filteredTranslations.length}</span> strings
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                        className="h-9 w-9 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1 px-2">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum
                          if (totalPages <= 5) {
                            pageNum = i
                          } else if (currentPage < 3) {
                            pageNum = i
                          } else if (currentPage > totalPages - 4) {
                            pageNum = totalPages - 5 + i
                          } else {
                            pageNum = currentPage - 2 + i
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`h-9 w-9 rounded-lg text-sm font-medium transition-all ${
                                currentPage === pageNum
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {pageNum + 1}
                            </button>
                          )
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage >= totalPages - 1}
                        className="h-9 w-9 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
        )}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* Edit Dialog (xcstrings only) */}
      {activePage === 'xcstrings' && (
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ ...editDialog, open: false })}>
        <DialogContent className="sm:max-w-[550px] gap-0 p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{SUPPORTED_LANGUAGES.find(l => l.code === editDialog.lang)?.flag}</span>
              <div>
                <DialogTitle className="text-xl">Edit Translation</DialogTitle>
                <DialogDescription>
                  {SUPPORTED_LANGUAGES.find(l => l.code === editDialog.lang)?.name || editDialog.lang}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Key</Label>
                <p className="font-mono text-sm break-all mt-1 text-muted-foreground">{editDialog.key}</p>
              </div>
              <div className="pt-2 border-t border-border/50">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Original (English)</Label>
                <p className="text-sm mt-1">
                  {xcstringsData?.strings?.[editDialog.key]?.localizations?.en?.stringUnit?.value || editDialog.key}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="translation" className="text-sm font-medium">Translation</Label>
              <Textarea
                id="translation"
                value={editDialog.value}
                onChange={(e) => setEditDialog({ ...editDialog, value: e.target.value })}
                rows={5}
                placeholder="Enter your translation here..."
                className="resize-none text-base"
              />
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t border-border/50 bg-muted/20">
            <Button variant="ghost" onClick={() => setEditDialog({ ...editDialog, open: false })}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="gradient-primary border-0">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Save Translation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
  )
}

export default App
