import { ReactFlowProvider } from '@xyflow/react';
import {
  AlertCircle,
  ArrowLeft,
  BrushCleaning,
  ChevronDown,
  DiamondPlus,
  FileCode,
  FileDown,
  FileUp,
  FolderOpenDotIcon,
  Loader2,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Settings,
  Wifi,
  X,
} from 'lucide-react';

import { useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';
import './index.css';
import { FlowCanvas } from '@/components/canvas/FlowCanvas';
import { AutomationImportDialog } from '@/components/panels/AutomationImportDialog';
import { AutomationSaveDialog } from '@/components/panels/AutomationSaveDialog';
import { HassSettings } from '@/components/panels/HassSettings';
import { ImportYamlDialog } from '@/components/panels/ImportYamlDialog';
import { NodePalette } from '@/components/panels/NodePalette';
import { PropertyPanel } from '@/components/panels/PropertyPanel';
import { YamlPreview } from '@/components/panels/YamlPreview';
import { AutomationTraceViewer } from '@/components/simulator/AutomationTraceViewer';
import { SpeedControl } from '@/components/simulator/SpeedControl';
import { TraceSimulator } from '@/components/simulator/TraceSimulator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResizablePanel } from '@/components/ui/resizable-panel';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { version } from '../../../custom_components/cafe/manifest.json';
import { useHass } from './contexts/HassContext';
import { useDarkMode } from './hooks/useDarkMode';
import { useLanguage } from './hooks/useLanguage';
import { useFlowStore } from './store/flow-store';

type RightPanelTab = 'properties' | 'yaml' | 'simulator';

function App() {
  const { t } = useTranslation(['common', 'errors', 'dialogs']);

  // Sidebar toggle button handler
  const handleSidebarToggle = () => {
    window.parent.postMessage({ type: 'CAFE_TOGGLE_SIDEBAR' }, '*');
  };

  // Navigate back to Home Assistant (only in panel mode, i.e. not remote)
  const handleBackToHA = () => {
    window.parent.history.back();
  };

  const {
    hass,
    isRemote: actualIsRemote,
    isLoading: actualIsLoading,
    connectionError: actualConnectionError,
    config,
    setConfig,
  } = useHass();

  const {
    flowName,
    fromFlowGraph,
    reset,
    automationId,
    selectedNodeId,
    clearCanvasSelection,
    hasUnsavedChanges,
    isSaving,
    simulationSpeed,
    setSimulationSpeed,
    hasRealChanges,
  } = useFlowStore();
  const [rightTab, setRightTab] = useState<RightPanelTab>('properties');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importYamlOpen, setImportYamlOpen] = useState(false);
  const [automationImportOpen, setAutomationImportOpen] = useState(false);
  const [importDropdownOpen, setImportDropdownOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [mobilePaletteExpanded, setMobilePaletteExpanded] = useState(false);
  const [desktopPaletteExpanded, setDesktopPaletteExpanded] = useState(true);
  const [parentWidth, setParentWidth] = useState(() => {
    const win = window.parent ?? window;
    return win.innerWidth;
  });
  const isCompactLayout = parentWidth <= 870;
  const forceSettingsOpen = actualIsRemote && (config.url === '' || config.token === '');
  const isDark = useDarkMode();

  // Sync language with Home Assistant
  useLanguage();

  useEffect(() => {
    document.body.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    const win = window.parent ?? window;
    const handleResize = () => {
      setParentWidth(win.innerWidth);
    };

    win.addEventListener('resize', handleResize);
    return () => win.removeEventListener('resize', handleResize);
  }, []);

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const graph = JSON.parse(text);
        fromFlowGraph(graph);
      } catch (error) {
        console.error('Failed to import:', error);
        alert(t('errors:import.fileReadFailed'));
      }
    };
    input.click();
  };

  const handleExport = () => {
    const graph = useFlowStore.getState().toFlowGraph();
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${flowName || 'automation'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Determine connection status display
  const getConnectionStatus = () => {
    if (actualIsLoading) {
      return {
        label: t('status.connecting'),
        className: 'bg-muted text-muted-foreground',
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
      };
    }
    if (actualConnectionError) {
      return {
        label: t('status.connectionError'),
        className: 'bg-red-100 text-red-700',
        icon: <AlertCircle className="h-3 w-3" />,
      };
    }
    if (actualIsRemote && hass?.connected) {
      return {
        label: t('status.connected'),
        className: 'bg-green-100 text-green-700',
        icon: <Wifi className="h-3 w-3" />,
      };
    }
    if (!actualIsRemote) {
      return null;
    }
    return null;
  };

  const status = getConnectionStatus();

  const reloadApp = () => {
    window.location.reload();
  };

  const rightPanelContent = (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className={cn('font-semibold text-sm', isCompactLayout && 'invisible')}>
          {t('labels.properties')}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={clearCanvasSelection}
          aria-label={t('buttons.close')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Tabs
          value={rightTab}
          onValueChange={(value) => setRightTab(value as RightPanelTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="grid w-full grid-cols-3 rounded-none border-b">
            <TabsTrigger value="properties">{t('labels.properties')}</TabsTrigger>
            <TabsTrigger value="yaml">{t('labels.yaml')}</TabsTrigger>
            <TabsTrigger value="simulator">{t('labels.debug')}</TabsTrigger>
          </TabsList>

          <div className="flex flex-1 flex-col overflow-hidden">
            <TabsContent value="properties" className="mt-0 flex-1 overflow-hidden">
              <PropertyPanel />
            </TabsContent>
            <TabsContent value="yaml" className="mt-0 flex-1 overflow-hidden">
              <YamlPreview />
            </TabsContent>
            <TabsContent value="simulator" className="mt-0 flex-1 overflow-hidden">
              <div className="flex h-full flex-col">
                <div className="border-b p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-medium text-muted-foreground text-xs">
                      {t('labels.debugControls')}
                    </h4>
                    <div className="flex gap-1">
                      <Button
                        onClick={handleImport}
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={t('buttons.importJson')}
                      >
                        <FileUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        onClick={handleExport}
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={t('titles.exportJson')}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <SpeedControl speed={simulationSpeed} onSpeedChange={setSimulationSpeed} />
                </div>

                <div className="flex-1 border-b">
                  <TraceSimulator />
                </div>

                <div className="flex-1">
                  <AutomationTraceViewer />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </>
  );

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <Dialog open={true} onOpenChange={reloadApp}>
          <DialogContent className="flex w-[90vw] max-w-full flex-col">
            <DialogHeader>
              <DialogTitle>{t('dialogs:error.title')}</DialogTitle>
            </DialogHeader>

            <DialogDescription>{t('dialogs:error.description')}</DialogDescription>

            <div className="space-y-4">
              <pre className="max-h-60 overflow-auto rounded bg-red-100 p-4 text-red-800 text-sm">
                {error.message}
                <br />
                {error.stack}
              </pre>
              <div>{t('dialogs:error.refreshPrompt')}</div>
              <Button onClick={reloadApp}>{t('buttons.refresh')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    >
      <ReactFlowProvider>
        <div className="flex h-screen flex-col bg-background">
          {/* Header */}
          <header
            className={cn(
              'flex h-14 min-w-0 items-center justify-between border-border border-b bg-card px-4 shadow-sm',
              isCompactLayout ? 'gap-2 overflow-hidden' : 'gap-4'
            )}
          >
            <div
              className={cn(
                'flex min-w-0 flex-1 items-center',
                isCompactLayout ? 'gap-2' : 'gap-4'
              )}
            >
              {/* Back to HA button — only in panel mode (not remote) */}
              {!actualIsRemote && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:bg-accent"
                  onClick={handleBackToHA}
                  title={t('titles.backToHA')}
                  aria-label={t('titles.backToHA')}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              {/* Sidebar toggle button, only visible when parent window width <= 870px */}
              {isCompactLayout ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onClick={handleSidebarToggle}
                  aria-label="Toggle sidebar"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              ) : (
                <h1
                  className="whitespace-nowrap font-bold text-foreground text-lg"
                  title={t('titles.appFullName')}
                >
                  {'☕ '}
                  {t('titles.appName')}
                </h1>
              )}
              <span className="mx-1 h-5 w-px bg-border" />
              <span
                className={cn(
                  'max-w-96 flex-1 truncate font-semibold text-foreground',
                  isCompactLayout ? 'hidden' : 'min-w-32'
                )}
              >
                {flowName || (
                  <span className="font-normal text-muted-foreground">
                    {t('placeholders.automationName')}
                  </span>
                )}
              </span>
            </div>

            <div className={cn('flex items-center', isCompactLayout ? 'gap-1' : 'gap-2')}>
              {!isCompactLayout && status && (
                <Badge
                  onClick={() => setSettingsOpen(true)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 transition-opacity hover:opacity-80',
                    status.className
                  )}
                  title={t('titles.clickToConfigure')}
                  variant="outline"
                >
                  {status.icon}
                  {status.label}
                </Badge>
              )}

              {actualIsRemote && (
                <Button
                  onClick={() => setSettingsOpen(true)}
                  variant="ghost"
                  size="icon"
                  title={t('titles.settings')}
                >
                  <Settings className="h-5 w-5" />
                </Button>
              )}

              {!isCompactLayout && <Separator orientation="vertical" className="h-6" />}

              {/* Open Automation Button with Import Dropdown */}
              <div className="flex">
                {/* Main Open Button */}
                <Button
                  onClick={() => {
                    setAutomationImportOpen(true);
                  }}
                  className="rounded-r-none"
                >
                  <FolderOpenDotIcon className={cn('h-4 w-4', !isCompactLayout && 'mr-2')} />
                  {!isCompactLayout && t('buttons.openAutomation')}
                </Button>

                {/* Dropdown Toggle */}
                <DropdownMenu open={importDropdownOpen} onOpenChange={setImportDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" className="rounded-l-none border-l px-2">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={reset}>
                      <DiamondPlus className="mr-2 size-4" />
                      {t('buttons.newAutomation')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setImportYamlOpen(true)}>
                      <FileCode className="mr-2 h-4 w-4" />
                      {t('buttons.importYaml')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Button
                onClick={() => setClearConfirmOpen(true)}
                variant="ghost"
                size="icon"
                title={t('titles.clearAutomation')}
              >
                <BrushCleaning className="h-5 w-5" />
              </Button>

              <Button
                onClick={() => setSaveDialogOpen(true)}
                variant={hasUnsavedChanges ? 'default' : 'ghost'}
                size="icon"
                title={automationId ? t('titles.updateAutomation') : t('titles.saveAutomation')}
                disabled={isSaving}
                className={cn(
                  hasUnsavedChanges && hasRealChanges() && !isSaving && 'save-button-unsaved'
                )}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
              </Button>
            </div>
          </header>

          {/* Main content */}
          <div className="relative flex flex-1 overflow-hidden">
            {/* Left sidebar - Node palette */}
            {!isCompactLayout && (
              <aside
                className={cn(
                  'flex h-full min-h-0 flex-col border-border border-r bg-card transition-[width] duration-300',
                  desktopPaletteExpanded ? 'w-72' : 'w-20'
                )}
              >
                <div className="flex h-14 items-center justify-between border-b px-4">
                  {desktopPaletteExpanded ? (
                    <>
                      <h3 className="shrink-0 whitespace-nowrap font-semibold text-sm">
                        {t('labels.addNode')}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDesktopPaletteExpanded(false)}
                        aria-label="Collapse menu"
                        title="Collapse menu"
                      >
                        <PanelLeftClose className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="w-0" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDesktopPaletteExpanded(true)}
                        aria-label="Expand menu"
                        title="Expand menu"
                      >
                        <PanelLeftOpen className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                <div
                  className={cn(
                    'min-h-0 flex-1',
                    desktopPaletteExpanded ? 'overflow-auto' : 'overflow-hidden'
                  )}
                >
                  <NodePalette iconOnly={!desktopPaletteExpanded} />
                  {desktopPaletteExpanded && (
                    <div className="border-t p-4">
                      <h4 className="mb-2 font-medium text-muted-foreground text-xs">
                        {t('labels.quickHelp')}
                      </h4>
                      <ul className="space-y-1 text-muted-foreground text-xs">
                        <li>{t('help.clickNodesToAdd')}</li>
                        <li>{t('help.dragToConnect')}</li>
                        <li>{t('help.deleteToRemove')}</li>
                        <li>{t('help.backspaceDeleteKey')}</li>
                      </ul>
                    </div>
                  )}
                </div>
                {!desktopPaletteExpanded && (
                  <div className="flex flex-col items-center gap-2 border-t px-2 py-3">
                    {actualIsRemote && config.url && (
                      <span
                        role="img"
                        title={t('status.connectedTo', { hostname: new URL(config.url).hostname })}
                        aria-label={t('status.connectedTo', {
                          hostname: new URL(config.url).hostname,
                        })}
                      >
                        <Wifi className="h-4 w-4 text-green-600" />
                      </span>
                    )}
                    <span className="font-medium text-[10px] text-muted-foreground">
                      {`v${version}`}
                    </span>
                  </div>
                )}
                {desktopPaletteExpanded && (
                  <div className="flex flex-col gap-2 border-t p-4">
                    <div className="flex items-center gap-4">
                      {actualIsRemote && config.url && (
                        <span className="text-green-600 text-xs">
                          {t('status.connectedTo', { hostname: new URL(config.url).hostname })}
                        </span>
                      )}
                      {actualConnectionError && (
                        <span className="text-red-600 text-xs">{actualConnectionError}</span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      <span>
                        {t('titles.appName')} {`v${version}`}
                      </span>
                    </div>
                  </div>
                )}
              </aside>
            )}

            {/* Canvas */}
            <main
              className={cn(
                'flex min-h-0 flex-1 flex-col transition-[margin] duration-300',
                isCompactLayout && 'ml-16'
              )}
            >
              <FlowCanvas />
            </main>

            {isCompactLayout && (
              <aside
                className={cn(
                  'absolute top-0 bottom-0 left-0 z-40 flex min-h-0 flex-col border-border border-r transition-[width] duration-300',
                  mobilePaletteExpanded ? 'w-full bg-card' : 'w-16 bg-card'
                )}
              >
                <div className="flex h-14 items-center justify-between border-b px-4">
                  {mobilePaletteExpanded ? (
                    <>
                      <h3 className="shrink-0 whitespace-nowrap font-semibold text-sm">
                        {t('labels.addNode')}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobilePaletteExpanded(false)}
                        aria-label="Collapse menu"
                        title="Collapse menu"
                      >
                        <PanelLeftClose className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="w-0" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobilePaletteExpanded(true)}
                        aria-label="Expand menu"
                        title="Expand menu"
                      >
                        <PanelLeftOpen className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>

                <div
                  className={cn(
                    'min-h-0 flex-1',
                    mobilePaletteExpanded ? 'overflow-auto' : 'overflow-hidden'
                  )}
                >
                  <NodePalette iconOnly={!mobilePaletteExpanded} />
                  {mobilePaletteExpanded && (
                    <div className="border-t p-4">
                      <h4 className="mb-2 font-medium text-muted-foreground text-xs">
                        {t('labels.quickHelp')}
                      </h4>
                      <ul className="space-y-1 text-muted-foreground text-xs">
                        <li>{t('help.clickNodesToAdd')}</li>
                        <li>{t('help.dragToConnect')}</li>
                        <li>{t('help.deleteToRemove')}</li>
                        <li>{t('help.backspaceDeleteKey')}</li>
                      </ul>
                    </div>
                  )}
                </div>
                {!mobilePaletteExpanded && (
                  <div className="flex flex-col items-center gap-2 border-t px-2 py-3">
                    {actualIsRemote && config.url && (
                      <span
                        role="img"
                        title={t('status.connectedTo', { hostname: new URL(config.url).hostname })}
                        aria-label={t('status.connectedTo', {
                          hostname: new URL(config.url).hostname,
                        })}
                      >
                        <Wifi className="h-4 w-4 text-green-600" />
                      </span>
                    )}
                    <span className="font-medium text-[10px] text-muted-foreground">
                      {`v${version}`}
                    </span>
                  </div>
                )}
              </aside>
            )}

            {/* Right sidebar - Properties/YAML/Simulator */}
            <div
              className={cn(
                'pointer-events-none absolute top-0 right-0 bottom-0 z-40 flex min-h-0 flex-col overflow-hidden transition-transform duration-300',
                isCompactLayout ? 'w-full' : 'w-[320px] max-w-[85vw] shadow-xl',
                selectedNodeId !== null ? 'pointer-events-auto translate-x-0' : 'translate-x-full'
              )}
            >
              {isCompactLayout ? (
                <div className="flex h-full min-h-0 flex-col border-border border-l bg-card">
                  {rightPanelContent}
                </div>
              ) : (
                <ResizablePanel
                  defaultWidth={320}
                  minWidth={280}
                  maxWidth={600}
                  side="right"
                  className="h-full border-border border-l bg-card"
                >
                  {rightPanelContent}
                </ResizablePanel>
              )}
            </div>
          </div>
        </div>

        {/* Settings modal - Only show when not in panel mode */}
        {actualIsRemote && (
          <HassSettings
            isOpen={settingsOpen || forceSettingsOpen}
            onClose={() => setSettingsOpen(false)}
            config={config}
            onSave={setConfig}
          />
        )}

        {/* Import YAML dialog */}
        <ImportYamlDialog isOpen={importYamlOpen} onClose={() => setImportYamlOpen(false)} />

        <AutomationImportDialog
          isOpen={automationImportOpen}
          onClose={() => {
            setAutomationImportOpen(false);
          }}
        />

        {/* Save Automation dialog */}
        <AutomationSaveDialog
          isOpen={saveDialogOpen}
          onClose={() => setSaveDialogOpen(false)}
          onSaved={() => {
            /* TODO: Handle automation save */
          }}
        />

        {/* Clear confirm dialog */}
        <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('dialogs:import.discardTitle')}</DialogTitle>
              <DialogDescription>{t('dialogs:import.discardDescription')}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setClearConfirmOpen(false)}>
                {t('buttons.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  reset();
                  setClearConfirmOpen(false);
                }}
              >
                {t('dialogs:import.confirmDiscard')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Toaster />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}

export default App;
