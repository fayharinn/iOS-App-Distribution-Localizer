import { useState, useCallback, useMemo, useEffect } from 'react'
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

const PROVIDER_CONFIG_KEY = 'xcstrings-localizer-provider-config'
const ASC_CONFIG_KEY = 'asc-localizer-config'
const PROTECTED_WORDS_KEY = 'xcstrings-localizer-protected-words'
const ACTIVE_PAGE_KEY = 'xcstrings-localizer-active-page'

function App() {
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

  return (
    <div className="dark">
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
          <header className="flex h-14 items-center gap-4 border-b px-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-lg font-semibold">
                {activePage === 'xcstrings' ? 'XCStrings Localizer' : 'App Store Connect'}
              </h1>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6">
            <div className="mx-auto max-w-5xl space-y-6">
              {/* App Store Connect Page */}
              {activePage === 'appstore' && (
                <AppStoreConnect
                  credentials={ascCredentials}
                  aiConfig={providerConfig}
                />
              )}

              {/* XCStrings Page */}
              {activePage === 'xcstrings' && (
              <Tabs defaultValue="translate" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="translate">Translate</TabsTrigger>
            <TabsTrigger value="editor" disabled={!xcstringsData}>
              View & Edit {stats && `(${stats.totalStrings})`}
            </TabsTrigger>
          </TabsList>

          {/* Translate Tab */}
          <TabsContent value="translate" className="space-y-6">
            {/* AI Provider Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1. AI Provider</CardTitle>
                <CardDescription>Configure in the sidebar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{PROVIDERS[providerConfig.provider]?.name}</Badge>
                    <Badge variant="outline">
                      {currentModel?.includes('inference-profile/')
                        ? currentModel.split('/').pop().replace('global.anthropic.', '').replace(/-v\d+:\d+$/, '')
                        : currentModel || 'No model'}
                    </Badge>
                    {currentApiKey ? (
                      <Badge variant="outline" className="text-green-500 border-green-500/50">Ready</Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">No API key</Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={isTesting || !currentApiKey}
                  >
                    {isTesting ? 'Testing...' : 'Test'}
                  </Button>
                  {testResult && (
                    <span className={`text-sm ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
                      {testResult.success ? '✓' : '✗'} {testResult.message}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Texts/batch:</Label>
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={batchSize}
                      onChange={(e) => setBatchSize(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                      className="w-16 h-8"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Parallel:</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={concurrency}
                      onChange={(e) => setConcurrency(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                      className="w-16 h-8"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Protected Words */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">2. Protected Words</CardTitle>
                <CardDescription>Words that should never be translated (brand names, app names, etc.)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a word..."
                    value={newProtectedWord}
                    onChange={(e) => setNewProtectedWord(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addProtectedWord()}
                    className="flex-1"
                  />
                  <Button onClick={addProtectedWord} variant="outline" size="sm">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {protectedWords.map(word => (
                    <Badge
                      key={word}
                      variant="secondary"
                      className="px-3 py-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      onClick={() => removeProtectedWord(word)}
                    >
                      {word}
                      <span className="ml-2 opacity-60">×</span>
                    </Badge>
                  ))}
                  {protectedWords.length === 0 && (
                    <span className="text-sm text-muted-foreground">No protected words</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">3. Load .xcstrings File</CardTitle>
                <CardDescription>Upload your localization file</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
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
                      flex-1 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all
                      ${isDragging
                        ? 'border-primary bg-primary/10 scale-[1.02]'
                        : 'border-border hover:border-primary'
                      }
                    `}
                  >
                    <span className={`text-sm ${isDragging ? 'text-primary' : 'text-muted-foreground'}`}>
                      {isDragging
                        ? 'Drop file here...'
                        : fileName || 'Click or drag & drop .xcstrings file'
                      }
                    </span>
                    {!fileName && !isDragging && (
                      <span className="text-xs text-muted-foreground/60 mt-1">
                        Supports .xcstrings files
                      </span>
                    )}
                  </Label>
                </div>
                {stats && (
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">
                      {stats.totalStrings} strings
                    </Badge>
                    <Badge variant="secondary">
                      {stats.languages.length} languages
                    </Badge>
                    {selectedLanguages.length > 0 && (
                      <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
                        {selectedLanguages.reduce((acc, lang) => {
                          const missing = stats.totalStrings - (stats.translationCounts[lang] || 0)
                          return acc + missing
                        }, 0)} translations needed
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Language Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">4. Select Languages</CardTitle>
                <CardDescription className="flex items-center justify-between">
                  <span>Choose target languages for translation</span>
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    {selectedLanguages.length === SUPPORTED_LANGUAGES.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {SUPPORTED_LANGUAGES.map(lang => {
                    const translated = stats?.translationCounts?.[lang.code] || 0
                    const missing = stats ? stats.totalStrings - translated : 0
                    const isComplete = stats && missing === 0

                    return (
                      <div
                        key={lang.code}
                        className={`flex items-center space-x-3 p-3 rounded-lg transition-colors cursor-pointer ${
                          isComplete
                            ? 'bg-green-500/10 hover:bg-green-500/20'
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                        onClick={() => handleLanguageToggle(lang.code)}
                      >
                        <Checkbox
                          id={lang.code}
                          checked={selectedLanguages.includes(lang.code)}
                          onCheckedChange={() => handleLanguageToggle(lang.code)}
                        />
                        <Label htmlFor={lang.code} className="cursor-pointer flex items-center gap-2 flex-1">
                          <span className="text-lg">{lang.flag}</span>
                          <span className="text-sm">{lang.name}</span>
                        </Label>
                        {stats && (
                          <span className={`text-xs ${isComplete ? 'text-green-500' : 'text-yellow-500'}`}>
                            {isComplete ? '✓' : missing}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">5. Translate & Save</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    onClick={handleTranslate}
                    disabled={isTranslating || !xcstringsData || !currentApiKey || selectedLanguages.length === 0}
                    className="flex-1"
                  >
                    {isTranslating ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Translating...
                      </span>
                    ) : 'Translate'}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!xcstringsData}
                    variant="outline"
                    className="flex-1"
                  >
                    Save File
                  </Button>
                </div>
                {isTranslating && (
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Translation in progress...</span>
                      <span className="text-muted-foreground">{progress.current} / {progress.total}</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                    <p className="text-xs text-muted-foreground truncate">
                      {progress.currentText}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 rounded-md border p-4">
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground text-center">No logs yet</p>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((log, index) => (
                        <div
                          key={index}
                          className={`flex gap-3 text-sm ${
                            log.type === 'error' ? 'text-red-400' :
                            log.type === 'success' ? 'text-green-400' :
                            'text-muted-foreground'
                          }`}
                        >
                          <span className="font-mono text-xs opacity-60 shrink-0">
                            {log.timestamp}
                          </span>
                          <span className="break-all">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Editor Tab */}
          <TabsContent value="editor" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Translations Editor</CardTitle>
                <CardDescription>View and edit all translations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Search strings..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <select
                    value={filterLang}
                    onChange={(e) => setFilterLang(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                  <Button onClick={handleSave} variant="outline">
                    Save File
                  </Button>
                </div>

                {/* Translations Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px] align-top">Key</TableHead>
                        <TableHead className="w-[250px] align-top">English</TableHead>
                        <TableHead className="align-top">Translations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTranslations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            {xcstringsData ? 'No matching strings found' : 'Load a file to see translations'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedTranslations.map(item => (
                          <TableRow key={item.key}>
                            <TableCell className="font-mono text-xs align-top py-2">
                              <div className="max-w-[150px] truncate text-muted-foreground" title={item.key}>
                                {item.key}
                              </div>
                            </TableCell>
                            <TableCell className="align-top py-2 min-w-[200px] max-w-[300px]">
                              <div className="text-sm whitespace-pre-wrap break-words">
                                {item.english}
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="flex flex-wrap gap-1.5">
                                {(filterLang === 'all' ? availableLanguages : [filterLang]).map(lang => {
                                  const translation = item.translations[lang]?.stringUnit?.value
                                  const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === lang)

                                  return (
                                    <div
                                      key={lang}
                                      onClick={() => handleEditTranslation(item.key, lang, translation)}
                                      title={translation || 'Click to add'}
                                      className={`
                                        flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors text-xs
                                        ${translation
                                          ? 'bg-muted/50 hover:bg-muted'
                                          : 'bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20'
                                        }
                                      `}
                                    >
                                      <span className="shrink-0">{langInfo?.flag || lang}</span>
                                      <span className="max-w-[100px] truncate">
                                        {translation ? truncateText(translation, 25) : <span className="text-yellow-500 italic">Missing</span>}
                                      </span>
                                    </div>
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
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {currentPage * ITEMS_PER_PAGE + 1}-{Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredTranslations.length)} of {filteredTranslations.length} strings
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage + 1} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage >= totalPages - 1}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        )}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* Edit Dialog (xcstrings only) */}
      {activePage === 'xcstrings' && (
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ ...editDialog, open: false })}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Translation</DialogTitle>
            <DialogDescription>
              {SUPPORTED_LANGUAGES.find(l => l.code === editDialog.lang)?.flag}{' '}
              {SUPPORTED_LANGUAGES.find(l => l.code === editDialog.lang)?.name || editDialog.lang}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-xs">Key</Label>
              <p className="font-mono text-sm break-all">{editDialog.key}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">English</Label>
              <p className="text-sm">
                {xcstringsData?.strings?.[editDialog.key]?.localizations?.en?.stringUnit?.value || editDialog.key}
              </p>
            </div>
            <div>
              <Label htmlFor="translation">Translation</Label>
              <Textarea
                id="translation"
                value={editDialog.value}
                onChange={(e) => setEditDialog({ ...editDialog, value: e.target.value })}
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ ...editDialog, open: false })}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
  )
}

export default App
