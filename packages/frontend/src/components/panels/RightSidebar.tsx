import { FileDown, FileUp, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PropertyPanel } from '@/components/panels/PropertyPanel';
import { YamlPreview } from '@/components/panels/YamlPreview';
import { AutomationTraceViewer } from '@/components/simulator/AutomationTraceViewer';
import { SpeedControl } from '@/components/simulator/SpeedControl';
import { TraceSimulator } from '@/components/simulator/TraceSimulator';
import { Button } from '@/components/ui/button';
import { ResizablePanel } from '@/components/ui/resizable-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFlowGraphImportExport } from '@/hooks/useFlowGraphImportExport';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store/flow-store';

interface RightSidebarProps {
  isCompactLayout: boolean;
}

type RightPanelTab = 'properties' | 'yaml' | 'simulator';
const RIGHT_PANEL_TABS: ReadonlyArray<RightPanelTab> = ['properties', 'yaml', 'simulator'];

function isRightPanelTab(value: string): value is RightPanelTab {
  return RIGHT_PANEL_TABS.some((tab) => tab === value);
}

export function RightSidebar({
  isCompactLayout,
}: RightSidebarProps) {
  const { t } = useTranslation(['common', 'errors']);
  const {
    selectedNodeId,
    clearCanvasSelection,
    rightPanelExpanded,
    setRightPanelExpanded,
    toggleRightPanelExpanded,
    simulationSpeed,
    setSimulationSpeed,
  } = useFlowStore();
  const { importFromJsonFile, exportToJsonFile } = useFlowGraphImportExport();
  const [rightTab, setRightTab] = useState<RightPanelTab>('properties');

  useEffect(() => {
    if (selectedNodeId !== null) {
      setRightPanelExpanded(true);
    }
  }, [selectedNodeId, setRightPanelExpanded]);

  const handleCollapse = () => {
    setRightPanelExpanded(false);
    clearCanvasSelection();
  };

  const handleRightTabChange = (value: string) => {
    if (isRightPanelTab(value)) {
      setRightTab(value);
    }
  };

  const expandLabel =
    selectedNodeId !== null
      ? t('buttons.expandPropertiesPanel')
      : t('buttons.selectNodeToOpenPropertiesPanel');

  const collapseLabel = t('buttons.collapsePropertiesPanel');

  const closeButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCollapse}
      aria-label={collapseLabel}
      title={collapseLabel}
    >
      <PanelRightClose className="h-4 w-4" />
    </Button>
  );

  const panelContent = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-end border-b px-4 py-3">{closeButton}</div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Tabs
          value={rightTab}
          onValueChange={handleRightTabChange}
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
                        onClick={importFromJsonFile}
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={t('buttons.importJson')}
                      >
                        <FileUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        onClick={exportToJsonFile}
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
    </div>
  );

  return (
    <>
      <div
        className={cn(
          'pointer-events-none absolute top-0 right-0 bottom-0 z-40 flex min-h-0 flex-col overflow-hidden transition-transform duration-300',
          isCompactLayout ? 'w-full' : 'w-[320px] max-w-[85vw] shadow-xl',
          rightPanelExpanded ? 'pointer-events-auto translate-x-0' : 'translate-x-full'
        )}
      >
        {isCompactLayout ? (
          <div className="h-full border-border border-l bg-card">{panelContent}</div>
        ) : (
          <ResizablePanel
            defaultWidth={320}
            minWidth={280}
            maxWidth={600}
            side="right"
            className="h-full border-border border-l bg-card"
          >
            {panelContent}
          </ResizablePanel>
        )}
      </div>

      <div
        className={cn(
          'absolute right-0 z-40 transition-opacity',
          isCompactLayout ? 'top-1/2 -translate-y-1/2' : 'top-3',
          rightPanelExpanded
            ? 'pointer-events-none opacity-0'
            : 'pointer-events-auto opacity-100'
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'border border-r-0 border-border bg-card shadow-sm',
            isCompactLayout
              ? 'h-14 w-8 rounded-l-lg rounded-r-none bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80'
              : 'h-10 w-10 rounded-l-md rounded-r-none'
          )}
          onClick={toggleRightPanelExpanded}
          aria-label={expandLabel}
          title={expandLabel}
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
