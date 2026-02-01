import { ReactFlowProvider } from '@xyflow/react';
import {
  AlertCircle,
  ChevronDown,
  DiamondPlus,
  FileCode,
  FileDown,
  FileUp,
  FolderOpenDotIcon,
  Loader2,
  Menu,
  Save,
  Settings,
  Wifi,
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
    toFlowGraph,
    fromFlowGraph,
    reset,
    automationId,
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
  const [parentWidth, setParentWidth] = useState(() => {
    const win = window.parent ?? window;
    return win.innerWidth;
  });
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
    const graph = toFlowGraph();
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
        className: 'bg-blue-100 text-blue-700',
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
          <header className="flex h-14 items-center justify-between gap-4 border-border border-b bg-card px-4 shadow-sm">
            <div className="flex flex-1 items-center gap-4">
              {/* Sidebar toggle button, only visible when parent window width <= 870px */}
              {parentWidth <= 870 ? (
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
              <span className="min-w-32 max-w-96 flex-1 truncate font-semibold text-foreground">
                {flowName || (
                  <span className="font-normal text-muted-foreground">
                    {t('placeholders.automationName')}
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {status && (
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

              <Separator orientation="vertical" className="h-6" />

              {/* Open Automation Button with Import Dropdown */}
              <div className="flex">
                {/* Main Open Button */}
                <Button
                  onClick={() => {
                    setAutomationImportOpen(true);
                  }}
                  className="rounded-r-none"
                >
                  <FolderOpenDotIcon className="mr-2 h-4 w-4" />
                  {t('buttons.openAutomation')}
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
                    <DropdownMenuItem onClick={handleImport}>
                      <FileUp className="mr-2 h-4 w-4" />
                      {t('buttons.importJson')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setImportYamlOpen(true)}>
                      <FileCode className="mr-2 h-4 w-4" />
                      {t('buttons.importYaml')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

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

              <Button
                onClick={handleExport}
                variant="ghost"
                size="icon"
                title={t('titles.exportJson')}
              >
                <FileDown className="h-5 w-5" />
              </Button>
            </div>
          </header>

          {/* Main content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar - Node palette */}
            <aside className="flex w-56 flex-col border-border border-r bg-card">
              <NodePalette />
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

              <div className="mt-auto flex flex-col gap-2 p-4">
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
            </aside>

            {/* Canvas */}
            <main className="flex-1">
              <FlowCanvas />
            </main>

            {/* Right sidebar - Properties/YAML/Simulator */}
            <ResizablePanel
              defaultWidth={320}
              minWidth={280}
              maxWidth={600}
              side="right"
              className="border-border border-l bg-card"
            >
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
                      {/* Shared Speed Control */}
                      <div className="border-b p-4">
                        <h4 className="mb-2 font-medium text-muted-foreground text-xs">
                          {t('labels.debugControls')}
                        </h4>
                        <SpeedControl speed={simulationSpeed} onSpeedChange={setSimulationSpeed} />
                      </div>

                      {/* Simulation Section */}
                      <div className="flex-1 border-b">
                        <TraceSimulator />
                      </div>

                      {/* Trace Section */}
                      <div className="flex-1">
                        <AutomationTraceViewer />
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </ResizablePanel>
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

        <Toaster />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}

export default App;
