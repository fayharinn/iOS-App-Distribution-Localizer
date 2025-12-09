import { useState } from 'react'
import { FileText, Globe, ChevronDown, Key, Cpu, Trash2, ExternalLink } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { PROVIDERS } from '@/services/translationService'

export function AppSidebar({
  activePage,
  onPageChange,
  providerConfig,
  onProviderConfigChange,
  ascCredentials,
  onAscCredentialsChange
}) {
  const [isDraggingKey, setIsDraggingKey] = useState(false)
  const [aiSettingsOpen, setAiSettingsOpen] = useState(true)
  const [ascSettingsOpen, setAscSettingsOpen] = useState(true)

  const currentApiKey = providerConfig.apiKeys[providerConfig.provider] || ''
  const currentModel = providerConfig.models[providerConfig.provider] || PROVIDERS[providerConfig.provider]?.defaultModel || ''

  // Handlers
  const handleProviderChange = (newProvider) => {
    onProviderConfigChange(prev => ({ ...prev, provider: newProvider }))
  }

  const handleApiKeyChange = (newKey) => {
    onProviderConfigChange(prev => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [prev.provider]: newKey }
    }))
  }

  const handleModelChange = (newModel) => {
    onProviderConfigChange(prev => ({
      ...prev,
      models: { ...prev.models, [prev.provider]: newModel }
    }))
  }

  // Handle .p8 file
  const processKeyFile = async (file) => {
    if (!file) return
    if (!file.name.endsWith('.p8')) return
    try {
      const content = await file.text()
      onAscCredentialsChange(prev => ({ ...prev, privateKey: content }))
    } catch { /* ignore */ }
  }

  const handleKeyUpload = async (event) => {
    await processKeyFile(event.target.files[0])
  }

  const handleKeyDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingKey(true)
  }

  const handleKeyDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingKey(false)
  }

  const handleKeyDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingKey(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      await processKeyFile(files[0])
    }
  }

  const getModelDisplayName = (model) => {
    if (!model) return 'Select model'
    if (model.includes('inference-profile/')) {
      return model.split('/').pop().replace('global.anthropic.', '').replace(/-v\d+:\d+$/, '')
    }
    return model
  }

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
            <Globe className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Localizer</span>
            <span className="text-xs text-muted-foreground">iOS/macOS Tools</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activePage === 'xcstrings'}
                  onClick={() => onPageChange('xcstrings')}
                  tooltip="XCStrings Translator"
                >
                  <FileText className="h-4 w-4" />
                  <span>XCStrings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activePage === 'appstore'}
                  onClick={() => onPageChange('appstore')}
                  tooltip="App Store Connect"
                >
                  <Globe className="h-4 w-4" />
                  <span>App Store Connect</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* AI Provider Settings */}
        <Collapsible open={aiSettingsOpen} onOpenChange={setAiSettingsOpen}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between [&[data-state=open]>svg]:rotate-180">
                <div className="flex items-center gap-2">
                  <Cpu className="h-3 w-3" />
                  <span>AI Provider</span>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="px-2 pt-2 space-y-3">
                {/* Provider Pills */}
                <div className="flex flex-wrap gap-1">
                  {Object.entries(PROVIDERS).map(([key, provider]) => (
                    <button
                      key={key}
                      onClick={() => handleProviderChange(key)}
                      className={`
                        px-2 py-1 rounded-full text-xs font-medium transition-all
                        ${providerConfig.provider === key
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80'
                        }
                      `}
                    >
                      {provider.name}
                    </button>
                  ))}
                </div>

                {/* API Key */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">API Key</Label>
                  <Input
                    type="password"
                    placeholder={providerConfig.provider === 'openai' ? 'sk-...' : 'Enter key...'}
                    value={currentApiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    className="h-8 text-xs bg-sidebar-accent border-0"
                  />
                </div>

                {/* Model */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Model</Label>
                  <select
                    value={currentModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full h-8 rounded-md bg-sidebar-accent border-0 px-2 text-xs"
                  >
                    {PROVIDERS[providerConfig.provider]?.models.map(model => (
                      <option key={model} value={model}>{getModelDisplayName(model)}</option>
                    ))}
                  </select>
                </div>

                {/* Region for Bedrock */}
                {PROVIDERS[providerConfig.provider]?.needsRegion && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Region</Label>
                    <Input
                      placeholder="us-east-1"
                      value={providerConfig.region}
                      onChange={(e) => onProviderConfigChange(prev => ({ ...prev, region: e.target.value }))}
                      className="h-8 text-xs bg-sidebar-accent border-0"
                    />
                  </div>
                )}

                {/* Status */}
                {currentApiKey ? (
                  <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-0 text-xs">
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    No API key
                  </Badge>
                )}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <SidebarSeparator />

        {/* App Store Connect Settings */}
        <Collapsible open={ascSettingsOpen} onOpenChange={setAscSettingsOpen}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between [&[data-state=open]>svg]:rotate-180">
                <div className="flex items-center gap-2">
                  <Key className="h-3 w-3" />
                  <span>App Store Connect</span>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="px-2 pt-2 space-y-3">
                {/* Link to create API key */}
                <a
                  href="https://appstoreconnect.apple.com/access/integrations/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Create API Key</span>
                </a>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Key ID</Label>
                  <Input
                    placeholder="XXXXXXXXXX"
                    value={ascCredentials.keyId}
                    onChange={(e) => onAscCredentialsChange(prev => ({ ...prev, keyId: e.target.value }))}
                    className="h-8 text-xs bg-sidebar-accent border-0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Issuer ID</Label>
                  <Input
                    placeholder="xxxxxxxx-xxxx-..."
                    value={ascCredentials.issuerId}
                    onChange={(e) => onAscCredentialsChange(prev => ({ ...prev, issuerId: e.target.value }))}
                    className="h-8 text-xs bg-sidebar-accent border-0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Private Key (.p8)</Label>
                  <Input
                    type="file"
                    accept=".p8"
                    onChange={handleKeyUpload}
                    className="hidden"
                    id="sidebar-p8-input"
                  />
                  <label
                    htmlFor="sidebar-p8-input"
                    onDragOver={handleKeyDragOver}
                    onDragLeave={handleKeyDragLeave}
                    onDrop={handleKeyDrop}
                    className={`
                      flex h-16 items-center justify-center rounded-md border-2 border-dashed cursor-pointer transition-all text-xs
                      ${isDraggingKey
                        ? 'border-primary bg-primary/10 text-primary'
                        : ascCredentials.privateKey
                          ? 'border-green-500/50 bg-green-500/10 text-green-500'
                          : 'border-sidebar-border hover:border-primary/50 text-muted-foreground'
                      }
                    `}
                  >
                    {isDraggingKey
                      ? 'Drop here...'
                      : ascCredentials.privateKey
                        ? 'Key loaded'
                        : 'Drop .p8 file here'
                    }
                  </label>
                </div>

                {/* Status & Clear */}
                <div className="flex items-center justify-between">
                  {ascCredentials.keyId && ascCredentials.issuerId && ascCredentials.privateKey ? (
                    <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-0 text-xs">
                      Ready to connect
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Incomplete
                    </Badge>
                  )}
                  {(ascCredentials.keyId || ascCredentials.issuerId || ascCredentials.privateKey) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Clear ASC Credentials?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will clear your Key ID, Issuer ID, and loaded private key. You'll need to enter them again to connect.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onAscCredentialsChange({ keyId: '', issuerId: '', privateKey: '' })}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Clear
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-3">
          <p className="text-xs text-muted-foreground text-center">
            Made with care by Fayhe
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
