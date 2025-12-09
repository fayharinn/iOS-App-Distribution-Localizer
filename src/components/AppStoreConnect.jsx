import { useState, useCallback } from 'react'
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
import {
  testConnection,
  listApps,
  listVersions,
  getVersionLocalizations,
  getAppInfoLocalizations,
  updateVersionLocalization,
  createVersionLocalization,
  updateAppInfoLocalization,
  translateAllFields,
  createVersion,
  ASC_LOCALES,
} from '@/services/appStoreConnectService'
import { PROVIDERS } from '@/services/translationService'

export default function AppStoreConnect({ credentials, aiConfig }) {

  // Connection state
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(null)

  // Apps & Versions
  const [apps, setApps] = useState([])
  const [selectedApp, setSelectedApp] = useState(null)
  const [versions, setVersions] = useState([])
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [isLoadingApps, setIsLoadingApps] = useState(false)
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)

  // Localizations
  const [versionLocalizations, setVersionLocalizations] = useState([])
  const [appInfoLocalizations, setAppInfoLocalizations] = useState({ appInfoId: null, localizations: [] })
  const [isLoadingLocalizations, setIsLoadingLocalizations] = useState(false)

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

  // Logs
  const [logs, setLogs] = useState([])

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-100), { message, type, timestamp }])
  }, [])

  // Get current AI config values
  const currentAiApiKey = aiConfig.apiKeys[aiConfig.provider] || ''
  const currentAiModel = aiConfig.models[aiConfig.provider] || PROVIDERS[aiConfig.provider]?.defaultModel || ''

  // Test connection
  const handleTestConnection = async () => {
    if (!credentials.keyId || !credentials.issuerId || !credentials.privateKey) {
      addLog('Please fill in Key ID, Issuer ID, and upload your .p8 key', 'error')
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
    } catch (error) {
      addLog(`Error loading localizations: ${error.message}`, 'error')
    }
    setIsLoadingLocalizations(false)
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
      region: aiConfig.region
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
          // Create new
          await createVersionLocalization(credentials, selectedVersion.id, targetLocale, translatedFields)
          addLog(`Created ${targetLocale} localization`, 'success')
        }
        successCount++
      } catch (error) {
        addLog(`Error translating ${targetLocale}: ${error.message}`, 'error')
        totalErrors++
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
        })
      } else {
        await updateAppInfoLocalization(credentials, editDialog.localization.id, {
          name: editDialog.localization.name,
          subtitle: editDialog.localization.subtitle,
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

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Connect to App Store</CardTitle>
          <CardDescription>Configure credentials in the sidebar, then connect</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {credentials.keyId ? (
                <Badge variant="outline" className="text-green-500 border-green-500/50">Key ID set</Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">No Key ID</Badge>
              )}
              {credentials.issuerId ? (
                <Badge variant="outline" className="text-green-500 border-green-500/50">Issuer ID set</Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">No Issuer ID</Badge>
              )}
              {credentials.privateKey ? (
                <Badge variant="outline" className="text-green-500 border-green-500/50">Key loaded</Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">No .p8 key</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleTestConnection}
              disabled={isConnecting || !isCredentialsComplete}
            >
              {isConnecting ? 'Connecting...' : apps.length > 0 ? 'Reconnect' : 'Connect'}
            </Button>
            {connectionStatus && (
              <span className={`text-sm ${connectionStatus.success ? 'text-green-500' : 'text-red-500'}`}>
                {connectionStatus.success ? '✓ ' : '✗ '}
                {connectionStatus.message}
              </span>
            )}
          </div>
          {!isCredentialsComplete && (
            <p className="text-sm text-muted-foreground">
              Configure your App Store Connect credentials in the sidebar to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* App & Version Selection */}
      {apps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Select App & Version</CardTitle>
            <CardDescription>Choose the app and version to translate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>App</Label>
                <select
                  value={selectedApp?.id || ''}
                  onChange={(e) => handleAppSelect(e.target.value)}
                  disabled={isLoadingApps}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                <Label>Version</Label>
                <div className="flex gap-2">
                  <select
                    value={selectedVersion?.id || ''}
                    onChange={(e) => handleVersionSelect(e.target.value)}
                    disabled={isLoadingVersions || !selectedApp}
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                    className="h-9 px-3"
                    title="Create new version"
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Localizations */}
      {selectedVersion && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. Current Localizations</CardTitle>
            <CardDescription>
              View and edit existing localizations for v{selectedVersion.versionString}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingLocalizations ? (
              <p className="text-muted-foreground">Loading localizations...</p>
            ) : versionLocalizations.length === 0 ? (
              <p className="text-muted-foreground">No localizations found</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Locale</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[150px]">What's New</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versionLocalizations.map(loc => {
                      const localeInfo = ASC_LOCALES.find(l => l.code === loc.locale)
                      return (
                        <TableRow key={loc.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{localeInfo?.flag || '🌐'}</span>
                              <span className="font-medium">{localeInfo?.name || loc.locale}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <span className="text-sm text-muted-foreground truncate block">
                              {loc.description ? loc.description.substring(0, 100) + '...' : '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {loc.whatsNew ? '✓' : '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditLocalization(loc, 'version')}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Translation Settings */}
      {selectedVersion && versionLocalizations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">4. Translate</CardTitle>
            <CardDescription>Auto-translate to other languages using AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AI Provider Info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>Using:</span>
              <Badge variant="secondary">{PROVIDERS[aiConfig.provider]?.name || aiConfig.provider}</Badge>
              <Badge variant="outline">
                {currentAiModel?.includes('inference-profile/')
                  ? currentAiModel.split('/').pop().replace('global.anthropic.', '').replace(/-v\d+:\d+$/, '')
                  : currentAiModel || 'No model selected'}
              </Badge>
              {!currentAiApiKey && (
                <span className="text-yellow-500">- Configure API key in sidebar</span>
              )}
            </div>

            {/* Source Locale */}
            <div className="space-y-2">
              <Label>Source Language</Label>
              <select
                value={sourceLocale}
                onChange={(e) => setSourceLocale(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm max-w-xs"
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
            <div className="space-y-2">
              <Label>Fields to Translate</Label>
              <div className="flex flex-wrap gap-2">
                {TRANSLATABLE_FIELDS.map(field => (
                  <div
                    key={field.key}
                    onClick={() => handleFieldToggle(field.key)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors
                      ${fieldsToTranslate.includes(field.key)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <Checkbox
                      checked={fieldsToTranslate.includes(field.key)}
                      onCheckedChange={() => handleFieldToggle(field.key)}
                    />
                    <span className="text-sm">{field.label}</span>
                    <span className="text-xs text-muted-foreground">({field.limit} chars)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Locales */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Target Languages</Label>
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
                >
                  {targetLocales.length === availableTargetLocales.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {availableTargetLocales.map(locale => {
                  const exists = existingLocales.includes(locale.code)
                  return (
                    <div
                      key={locale.code}
                      onClick={() => handleLocaleToggle(locale.code)}
                      className={`
                        flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
                        ${targetLocales.includes(locale.code)
                          ? 'bg-primary/10 border border-primary'
                          : exists
                            ? 'bg-green-500/10 border border-green-500/30 hover:bg-green-500/20'
                            : 'bg-muted/50 border border-transparent hover:bg-muted'
                        }
                      `}
                    >
                      <Checkbox
                        checked={targetLocales.includes(locale.code)}
                        onCheckedChange={() => handleLocaleToggle(locale.code)}
                      />
                      <span className="text-lg">{locale.flag}</span>
                      <span className="text-sm flex-1">{locale.name}</span>
                      {exists && (
                        <Badge variant="outline" className="text-xs text-green-500 border-green-500/50">
                          exists
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Translate Button */}
            <div className="flex gap-4">
              <Button
                onClick={handleTranslate}
                disabled={isTranslating || !currentAiApiKey || targetLocales.length === 0 || fieldsToTranslate.length === 0}
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
                ) : `Translate to ${targetLocales.length} language${targetLocales.length !== 1 ? 's' : ''}`}
              </Button>
            </div>

            {/* Progress */}
            {isTranslating && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Translation in progress...</span>
                  <span className="text-muted-foreground">{translationProgress.current} / {translationProgress.total}</span>
                </div>
                <Progress value={(translationProgress.current / translationProgress.total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground">{translationProgress.status}</p>
              </div>
            )}

            {/* Translation Complete Alert */}
            {translationAlert.show && (
              <Alert variant={translationAlert.success ? 'default' : 'destructive'} className="relative">
                <AlertTitle>{translationAlert.success ? 'Success!' : 'Completed with errors'}</AlertTitle>
                <AlertDescription>{translationAlert.message}</AlertDescription>
                <button
                  onClick={() => setTranslationAlert(prev => ({ ...prev, show: false }))}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-muted transition-colors"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48 rounded-md border p-4">
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
                    <span className="font-mono text-xs opacity-60 shrink-0">{log.timestamp}</span>
                    <span className="break-all">{log.message}</span>
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
    </div>
  )
}
