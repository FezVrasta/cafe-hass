import { ReactFlowProvider } from '@xyflow/react';
import {
  AlertCircle,
  ChevronDown,
  DiamondPlus,
  FileCode,
  FileDown,
  FileUp,
  Info,
  Loader2,
  Save,
  Settings,
  Wifi,
} from 'lucide-react';
import { createContext, useContext, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { CSSInjector } from '@/components/CSSInjector';
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
import { PortalContainer } from '@/contexts/PortalContainer';
import { ErrorBoundary } from 'react-error-boundary';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ResizablePanel } from '@/components/ui/resizable-panel';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type HassAPI, useHass } from '@/hooks/useHass';
// import { getHomeAssistantAPI } from '@/lib/ha-api';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store/flow-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Home Assistant context for passing data from custom element
interface HassContextValue {
  hass?: unknown;
  narrow?: boolean;
  route?: unknown;
  panel?: unknown;
}

const HassContext = createContext<HassContextValue>({});

export const useHassContext = () => useContext(HassContext);

interface AppProps {
  hass?: unknown;
  narrow?: boolean;
  route?: unknown;
  panel?: unknown;
}

type RightPanelTab = 'properties' | 'yaml' | 'simulator';

function App({ hass: externalHass, narrow = false, route, panel }: AppProps = {}) {
  // Determine if we're in standalone context (no external hass = opening HTML directly)
  const isStandaloneContext = !externalHass;

  // Only use the useHass hook if no external hass is provided
  const {
    hass: hookHass,
    isRemote,
    isLoading,
    connectionError,
    config,
    setConfig,
  } = useHass(isStandaloneContext ? 'remote' : undefined);

  // Determine mode based on hass source
  const isExternalHass = !!externalHass;
  const effectiveHass = externalHass || hookHass;

  logger.debug('Hass object determination', {
    isExternalHass,
    hasHookHass: !!hookHass,
    hasEffectiveHass: !!effectiveHass,
    effectiveHassStatesCount: (effectiveHass as HassAPI)?.states
      ? Object.keys((effectiveHass as HassAPI).states).length
      : 0,
    hookHassMode: { isRemote, isLoading, hasError: !!connectionError },
  });

  // Override mode detection when external hass is provided (custom panel mode)
  const actualIsRemote = isExternalHass ? false : isRemote;
  const actualIsLoading = isExternalHass ? false : isLoading;
  const actualConnectionError = isExternalHass ? null : connectionError;

  // Initialize or update the API instance with current hass
  useEffect(() => {
    if (effectiveHass) {
      const hassApi = effectiveHass as HassAPI;
      logger.debug('Setting global hass instance', {
        source: isExternalHass ? 'external' : 'hook',
        statesCount: hassApi?.states ? Object.keys(hassApi.states).length : 0,
        servicesCount: hassApi?.services ? Object.keys(hassApi.services).length : 0,
        hasConnection: !!hassApi?.connection,
        hasCallApi: !!hassApi?.callApi,
        hasCallService: !!hassApi?.callService,
      });

      // Set the global hass instance for use by the store
      import('@/hooks/useHass').then(({ setGlobalHass }) => {
        setGlobalHass(effectiveHass);
        logger.success('Global hass instance set successfully');
      });

      // const api = getHomeAssistantAPI(effectiveHass);
    } else {
      logger.warn('No effective hass available to set globally');
    }
  }, [effectiveHass, isExternalHass]);

  const {
    flowName,
    setFlowName,
    toFlowGraph,
    fromFlowGraph,
    reset,
    automationId,
    hasUnsavedChanges,
    isSaving,
    simulationSpeed,
    setSimulationSpeed,
  } = useFlowStore();
  const [rightTab, setRightTab] = useState<RightPanelTab>('properties');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importYamlOpen, setImportYamlOpen] = useState(false);
  const [automationImportOpen, setAutomationImportOpen] = useState(false);
  const [importDropdownOpen, setImportDropdownOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

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
        alert('Failed to import flow. Please check the file format.');
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
        label: 'Connecting...',
        className: 'bg-blue-100 text-blue-700',
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
      };
    }
    if (actualConnectionError) {
      return {
        label: 'Connection Error',
        className: 'bg-red-100 text-red-700',
        icon: <AlertCircle className="h-3 w-3" />,
      };
    }
    if (actualIsRemote) {
      return {
        label: 'Connected',
        className: 'bg-green-100 text-green-700',
        icon: <Wifi className="h-3 w-3" />,
      };
    }
    if (isExternalHass) {
      return null;
    }
    return null;
  };

  const status = getConnectionStatus();

  return (
    <CSSInjector>
      <PortalContainer>
        <ErrorBoundary
          FallbackComponent={({ error, resetErrorBoundary }) => (
            <Dialog open={true} onOpenChange={resetErrorBoundary}>
              <DialogContent className="flex w-[90vw] max-w-full flex-col">
                <DialogHeader>
                  <DialogTitle>Unexpected Error</DialogTitle>
                </DialogHeader>

                <DialogDescription>
                  An unexpected error occurred in the application. Please see the details below.
                </DialogDescription>

                <div className="space-y-4">
                  <pre className="max-h-60 overflow-auto rounded bg-red-100 p-4 text-red-800 text-sm">
                    {error.message}
                    <br />
                    {error.stack}
                  </pre>
                  <div>
                    Please try refreshing the page. If the problem persists, consider reporting the
                    issue on our GitHub repository.
                  </div>
                  <Button onClick={resetErrorBoundary}>Refresh</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        >
          <HassContext.Provider value={{ hass: effectiveHass, narrow, route, panel }}>
            <ReactFlowProvider>
              <div className="flex h-screen flex-col bg-background">
                {/* Header */}
                <header className="flex h-16 items-center justify-between gap-4 border-border border-b bg-card px-4 shadow-sm">
                  <div className="flex flex-1 items-center gap-4">
                    <h1
                      className="font-bold text-foreground text-lg"
                      title="Complex Automation Flow Editor"
                    >
                      ☕ C.A.F.E.
                    </h1>
                    <Input
                      type="text"
                      value={flowName}
                      onChange={(e) => setFlowName(e.target.value)}
                      className="min-w-32 max-w-96 flex-1"
                      placeholder="Automation name"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {status && (
                      <Badge
                        onClick={() => setSettingsOpen(true)}
                        className={cn(
                          'flex cursor-pointer items-center gap-1.5 transition-opacity hover:opacity-80',
                          status.className
                        )}
                        title="Click to configure Home Assistant connection"
                        variant="outline"
                      >
                        {status.icon}
                        {status.label}
                      </Badge>
                    )}

                    {isExternalHass && (
                      <Button
                        onClick={() => setSettingsOpen(true)}
                        variant="ghost"
                        size="icon"
                        title="Settings"
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
                        <DiamondPlus className="mr-2 h-4 w-4" />
                        Open Automation
                      </Button>

                      {/* Dropdown Toggle */}
                      <DropdownMenu open={importDropdownOpen} onOpenChange={setImportDropdownOpen}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="default" className="rounded-l-none border-l px-2">
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleImport}>
                            <FileUp className="mr-2 h-4 w-4" />
                            Import from JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setImportYamlOpen(true)}>
                            <FileCode className="mr-2 h-4 w-4" />
                            Import from YAML
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <Button
                      onClick={() => setSaveDialogOpen(true)}
                      variant={hasUnsavedChanges ? 'default' : 'ghost'}
                      size="icon"
                      title={
                        automationId
                          ? 'Update automation in Home Assistant'
                          : 'Save automation to Home Assistant'
                      }
                      disabled={isSaving}
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
                      title="Export flow as JSON"
                    >
                      <FileDown className="h-5 w-5" />
                    </Button>

                    <Button onClick={reset} variant="ghost" size="icon" title="New flow">
                      <DiamondPlus className="h-5 w-5" />
                    </Button>
                  </div>
                </header>

                {/* Main content */}
                <div className="flex flex-1 overflow-hidden">
                  {/* Left sidebar - Node palette */}
                  <aside className="flex w-56 flex-col border-border border-r bg-card">
                    <NodePalette />
                    <div className="border-t p-4">
                      <h4 className="mb-2 font-medium text-muted-foreground text-xs">Quick Help</h4>
                      <ul className="space-y-1 text-muted-foreground text-xs">
                        <li>Click nodes to add</li>
                        <li>Drag to connect</li>
                        <li>Delete to remove</li>
                        <li>Backspace/Delete key</li>
                      </ul>
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
                        <TabsTrigger value="properties">Properties</TabsTrigger>
                        <TabsTrigger value="yaml">YAML</TabsTrigger>
                        <TabsTrigger value="simulator">Debug</TabsTrigger>
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
                                Debug Controls
                              </h4>
                              <SpeedControl
                                speed={simulationSpeed}
                                onSpeedChange={setSimulationSpeed}
                              />
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

                {/* Footer */}
                <footer className="flex h-8 items-center justify-between border-border border-t bg-card px-4 text-muted-foreground text-xs">
                  <div className="flex items-center gap-4">
                    <span>C.A.F.E. v0.1.8</span>
                    {actualIsRemote && config.url && (
                      <span className="text-green-600">
                        Connected to {new URL(config.url).hostname}
                      </span>
                    )}
                    {isExternalHass && (
                      <span className="text-green-600">Connected via Home Assistant panel</span>
                    )}
                    {actualConnectionError && (
                      <span className="text-red-600">{actualConnectionError}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Info className="h-3 w-3" />
                    <span>Complex Automation Flow Editor</span>
                  </div>
                </footer>
              </div>

              {/* Settings modal - Only show when not in panel mode */}
              <HassSettings
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                config={config}
                onSave={setConfig}
              />

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
          </HassContext.Provider>
        </ErrorBoundary>
      </PortalContainer>
    </CSSInjector>
  );
}

export default App;
