import { ReactFlowProvider } from '@xyflow/react';
import {
  AlertCircle,
  ArrowLeft,
  BrushCleaning,
  ChevronDown,
  DiamondPlus,
  FileCode,
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
import { NodePaletteSidebar } from '@/components/panels/NodePaletteSidebar';
import { RightSidebar } from '@/components/panels/RightSidebar';
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
import { COMPACT_NODE_PALETTE_COLLAPSED_WIDTH } from './components/panels/layout';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useHass } from './contexts/HassContext';
import { useDarkMode } from './hooks/useDarkMode';
import { useLanguage } from './hooks/useLanguage';
import { useFlowStore } from './store/flow-store';

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
    reset,
    automationId,
    hasUnsavedChanges,
    isSaving,
    hasRealChanges,
  } = useFlowStore();
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

  const handlePaletteToggle = () => {
    if (isCompactLayout) {
      setMobilePaletteExpanded((previous) => !previous);
      return;
    }

    setDesktopPaletteExpanded((previous) => !previous);
  };

  const paletteExpanded = isCompactLayout ? mobilePaletteExpanded : desktopPaletteExpanded;
  const paletteLayout = isCompactLayout ? 'compact' : 'desktop';

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
                  aria-label={t('buttons.toggleSidebar')}
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
            <NodePaletteSidebar
              expanded={paletteExpanded}
              onToggle={handlePaletteToggle}
              layout={paletteLayout}
              isRemote={actualIsRemote}
              configUrl={config.url}
              connectionError={actualConnectionError}
            />

            {/* Canvas */}
            <main
              className={cn(
                'flex min-h-0 flex-1 flex-col transition-[margin] duration-300',
              )}
              style={isCompactLayout ? { marginLeft: COMPACT_NODE_PALETTE_COLLAPSED_WIDTH } : undefined}
            >
              <FlowCanvas />
            </main>

            <RightSidebar isCompactLayout={isCompactLayout} />
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
