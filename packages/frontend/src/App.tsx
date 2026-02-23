import { ReactFlowProvider } from '@xyflow/react';
import { transpiler } from '@cafe/transpiler';
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
  Minus,
  Plus,
  Search,
  Save,
  Settings,
  Wifi,
} from 'lucide-react';

import { dump as yamlDump } from 'js-yaml';
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
import { Input } from '@/components/ui/input';
import type { ExplorerAutomationItem } from '@/hooks/useAutomationExplorer';
import { useAutomationExplorer } from '@/hooks/useAutomationExplorer';
import { getHomeAssistantAPI } from '@/lib/ha-api';
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
    entities,
    config,
    setConfig,
  } = useHass();

  const {
    flowName,
    fromFlowGraph,
    reset,
    automationId,
    setFlowName,
    setAutomationId,
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
  const [leftTab, setLeftTab] = useState<'automations' | 'nodes'>('automations');
  const [explorerSearchTerm, setExplorerSearchTerm] = useState('');
  const [collapsedAreaIds, setCollapsedAreaIds] = useState<Record<string, boolean>>({});
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
    const graph = useFlowStore.getState().toFlowGraph();
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${flowName || 'automation'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { areaSections, zoneSections, unassigned } = useAutomationExplorer({
    hass,
    hassConfig: config,
    entities,
    searchTerm: explorerSearchTerm,
    labels: {
      noArea: t('dialogs:import.noArea'),
      otherArea: t('dialogs:import.otherArea'),
    },
  });

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

  const formatLastTriggered = (timestamp?: string) => {
    if (!timestamp) return t('dialogs:import.never');
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('dialogs:import.justNow');
    if (diffMins < 60) return t('dialogs:import.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('dialogs:import.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('dialogs:import.daysAgo', { count: diffDays });
    return date.toLocaleDateString();
  };

  const openAutomationFromExplorer = async (automation: ExplorerAutomationItem) => {
    try {
      if (
        hasRealChanges() &&
        !window.confirm(
          `${t('dialogs:import.discardTitle')}\n\n${t('dialogs:import.discardDescription')}`
        )
      ) {
        return;
      }

      const api = getHomeAssistantAPI(hass, config);
      if (!api.isConnected()) {
        throw new Error(t('errors:connection.noConnection'));
      }

      const automationConfig = await api.getAutomationConfigWithFallback(
        automation.automation_id,
        automation.friendly_name
      );

      reset();

      if (automationConfig) {
        const yamlString = yamlDump(automationConfig, {
          indent: 2,
          lineWidth: -1,
          quotingType: '"',
          forceQuotes: false,
        });

        const result = await transpiler.fromYaml(yamlString);
        if (!result.success || !result.graph) {
          throw new Error(result.errors?.join('\n') || t('errors:import.parseFailed'));
        }

        fromFlowGraph(result.graph);
      }

      setFlowName(automation.friendly_name || automation.automation_id);
      setAutomationId(automation.automation_id);
    } catch (error) {
      console.error('C.A.F.E.: Failed to open automation from explorer:', error);
    }
  };

  const isAreaCollapsed = (areaId: string) => collapsedAreaIds[areaId] ?? true;

  const toggleAreaCollapsed = (areaId: string) => {
    setCollapsedAreaIds((current) => ({
      ...current,
      [areaId]: !(current[areaId] ?? true),
    }));
  };

  const renderExplorerItem = (automation: ExplorerAutomationItem) => (
    <div
      key={automation.entity_id}
      className="flex items-center justify-between rounded border border-border bg-card p-2"
    >
      <div className="min-w-0">
        <div className="truncate font-medium text-xs">{automation.friendly_name}</div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              automation.enabled ? 'bg-green-500' : 'bg-slate-400'
            )}
          />
          <span className="truncate">{formatLastTriggered(automation.last_triggered)}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => void openAutomationFromExplorer(automation)}
        title={t('dialogs:import.openSingle')}
      >
        <FolderOpenDotIcon className="h-4 w-4" />
      </Button>
    </div>
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
            </div>
          </header>

          {/* Main content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar - Explorer / Node palette */}
            <aside className="flex h-full min-h-0 w-72 flex-col border-border border-r bg-card">
              <Tabs
                value={leftTab}
                onValueChange={(value) => setLeftTab(value as 'automations' | 'nodes')}
                className="flex min-h-0 flex-1 flex-col"
              >
                <TabsList className="m-3 grid h-auto grid-cols-2 rounded-md p-1">
                  <TabsTrigger value="automations">{t('labels.automations')}</TabsTrigger>
                  <TabsTrigger value="nodes">{t('labels.nodes')}</TabsTrigger>
                </TabsList>

                <TabsContent value="automations" className="mt-0 flex min-h-0 flex-1 flex-col">
                  <div className="flex-1 space-y-3 overflow-auto px-3 pb-3">
                    <div className="relative">
                      <Search className="absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={explorerSearchTerm}
                        onChange={(event) => setExplorerSearchTerm(event.target.value)}
                        placeholder={t('placeholders.searchAutomations')}
                        className="h-8 pl-7 text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t('labels.areas')}
                      </h4>
                      {areaSections.length > 0 ? (
                        areaSections.map((section) => (
                          <div key={section.id} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <button
                                type="button"
                                onClick={() => toggleAreaCollapsed(section.id)}
                                className="flex min-w-0 items-center gap-1 text-left hover:text-foreground"
                                title={section.label}
                              >
                                {isAreaCollapsed(section.id) ? (
                                  <Plus className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                  <Minus className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span className="truncate">{section.label}</span>
                              </button>
                              <Badge variant="secondary" className="h-4 shrink-0 px-1 text-[10px]">
                                {section.automations.length}
                              </Badge>
                            </div>
                            {!isAreaCollapsed(section.id) && (
                              <div className="space-y-1">
                                {section.automations.map((automation) => renderExplorerItem(automation))}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          {t('dialogs:import.noAutomations')}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t('labels.zones')}
                      </h4>
                      {zoneSections.length > 0 ? (
                        zoneSections.map((section) => (
                          <div key={section.id} className="space-y-1">
                            <div className="text-[11px] text-muted-foreground">{section.label}</div>
                            <div className="space-y-1">
                              {section.automations.map((automation) => renderExplorerItem(automation))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          {t('dialogs:import.noAutomations')}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t('labels.unassigned')}
                      </h4>
                      {unassigned.length > 0 ? (
                        <div className="space-y-1">
                          {unassigned.map((automation) => renderExplorerItem(automation))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          {t('dialogs:import.noAutomations')}
                        </p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="nodes" className="mt-0 flex min-h-0 flex-1 flex-col">
                  <div className="flex-1 overflow-auto">
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
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-auto flex flex-col gap-2 border-t p-4">
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
            <main className="flex min-h-0 flex-1 flex-col">
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
