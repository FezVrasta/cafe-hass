import { transpiler } from '@cafe/transpiler';
import { useReactFlow } from '@xyflow/react';
import { dump as yamlDump } from 'js-yaml';
import { ArrowDown, ArrowUp, ArrowUpDown, DiamondPlus, Download, Search } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useHass } from '@/contexts/HassContext';

interface AreaRegistryEntry {
  area_id: string;
  name: string;
}

interface EntityRegistryEntry {
  entity_id: string;
  area_id?: string;
}

import { getHomeAssistantAPI } from '@/lib/ha-api';
import { useFlowStore } from '@/store/flow-store';

interface AutomationImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HaAutomation {
  entity_id: string;
  attributes: {
    id?: string;
    friendly_name?: string;
    description?: string;
    last_triggered?: string;
    mode?: string;
    current?: number;
    max?: number;
    tags?: string[] | string;
  };
  state: 'on' | 'off';
}

type SortColumn = 'name' | 'lastTriggered' | 'enabled';
type SortDirection = 'asc' | 'desc';

export function AutomationImportDialog({ isOpen, onClose }: AutomationImportDialogProps) {
  const { t } = useTranslation(['common', 'dialogs', 'errors']);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [areas, setAreas] = useState<AreaRegistryEntry[]>([]);
  const [entityRegistry, setEntityRegistry] = useState<EntityRegistryEntry[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const { hass, config: hassConfig, entities } = useHass();
  const { setFlowName, setAutomationId, reset, fromFlowGraph, hasRealChanges } = useFlowStore();
  const { fitView } = useReactFlow();

  const confirmAction = (action: () => void) => {
    if (hasRealChanges()) {
      setPendingAction(() => action);
      setShowConfirmDialog(true);
    } else {
      action();
    }
  };

  const handleConfirm = () => {
    if (pendingAction) {
      pendingAction();
    }
    setShowConfirmDialog(false);
    setPendingAction(null);
  };

  const handleCancelConfirm = () => {
    setShowConfirmDialog(false);
    setPendingAction(null);
  };

  // Fetch areas and entity registry on open
  useEffect(() => {
    if (!isOpen || !hass) return;
    const api = getHomeAssistantAPI(hass, hassConfig);
    let cancelled = false;
    (async () => {
      try {
        const [areasRes, entitiesRes] = await Promise.all([api.getAreas(), api.getEntities()]);
        if (!cancelled) {
          setAreas(Array.isArray(areasRes) ? areasRes : []);
          setEntityRegistry(Array.isArray(entitiesRes) ? entitiesRes : []);
        }
      } catch {
        setAreas([]);
        setEntityRegistry([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, hass, hassConfig]);

  // Get all automations from HA
  const automations = useMemo(() => {
    const automationEntities = entities.filter((entity) =>
      entity.entity_id.startsWith('automation.')
    );
    return automationEntities.map((entity) => ({
      entity_id: entity.entity_id,
      attributes: entity.attributes || {},
      state: entity.state,
    })) as HaAutomation[];
  }, [entities]);

  // Map entity_id to area_id using entityRegistry
  const entityIdToAreaId = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const entry of entityRegistry) {
      if (entry.entity_id && entry.area_id) {
        map[entry.entity_id] = entry.area_id;
      }
    }
    return map;
  }, [entityRegistry]);

  // Map area_id to area name
  const areaIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const area of areas) {
      if (area.area_id && area.name) {
        map[area.area_id] = area.name;
      }
    }
    return map;
  }, [areas]);

  // Sort automations
  const sortedAutomations = useMemo(() => {
    if (!sortColumn) return automations;

    return [...automations].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'name': {
          const nameA = (a.attributes.friendly_name || a.entity_id).toLowerCase();
          const nameB = (b.attributes.friendly_name || b.entity_id).toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case 'lastTriggered': {
          const dateA = a.attributes.last_triggered
            ? new Date(a.attributes.last_triggered).getTime()
            : 0;
          const dateB = b.attributes.last_triggered
            ? new Date(b.attributes.last_triggered).getTime()
            : 0;
          comparison = dateA - dateB;
          break;
        }
        case 'enabled': {
          const enabledA = a.state === 'on' ? 1 : 0;
          const enabledB = b.state === 'on' ? 1 : 0;
          comparison = enabledA - enabledB;
          break;
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [automations, sortColumn, sortDirection]);

  // Group automations by area
  const automationsByArea = useMemo(() => {
    const groups: Record<string, HaAutomation[]> = {};
    for (const automation of sortedAutomations) {
      const areaId = entityIdToAreaId[automation.entity_id];
      const areaName = areaId
        ? areaIdToName[areaId] || t('dialogs:import.otherArea')
        : t('dialogs:import.noArea');
      if (!groups[areaName]) groups[areaName] = [];
      groups[areaName].push(automation);
    }
    return groups;
  }, [sortedAutomations, entityIdToAreaId, areaIdToName, t]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  const handleImportAutomation = async (automation: HaAutomation) => {
    try {
      // Try to get the numeric ID from attributes, fallback to entity_id without prefix
      const automationId =
        automation.attributes.id || automation.entity_id.replace('automation.', '');

      // Get API instance and update with current hass and config
      const api = getHomeAssistantAPI(hass, hassConfig);

      if (!api.isConnected()) {
        throw new Error(t('errors:connection.noConnection'));
      }

      // Get automation configuration with fallbacks
      const config = await api.getAutomationConfigWithFallback(
        automationId,
        automation.attributes.friendly_name
      );

      // Reset current flow
      reset();

      if (config) {
        // Convert automation config to YAML and use the transpiler for parsing
        // This handles both native and state-machine formats with ELK layout
        const yamlString = yamlDump(config, {
          indent: 2,
          lineWidth: -1,
          quotingType: '"',
          forceQuotes: false,
        });

        const result = await transpiler.fromYaml(yamlString);

        if (!result.success) {
          throw new Error(result.errors?.join('\n') || t('errors:import.parseFailed'));
        }

        if (result.graph) {
          fromFlowGraph(result.graph);

          // Center the viewport on the imported nodes
          setTimeout(() => {
            fitView({
              padding: 0.2,
              duration: 300,
            });
          }, 50);
        }

        // Set name and ID AFTER fromFlowGraph (which resets automationId)
        setFlowName(automation.attributes.friendly_name || automationId);
        setAutomationId(automationId);

        toast.success(
          t('dialogs:import.importSuccess', {
            name: automation.attributes.friendly_name || automationId,
          })
        );
      } else {
        // Set the automation ID so that if user creates a flow, it will update instead of create new
        setFlowName(automation.attributes.friendly_name || automationId);
        setAutomationId(automationId);

        toast.warning(
          t('dialogs:import.openedWarning', {
            name: automation.attributes.friendly_name || automationId,
          }),
          {
            description: t('dialogs:import.openedWarningDescription'),
          }
        );
      }

      onClose();
    } catch (error) {
      console.error('C.A.F.E.: Failed to open automation:', error);
      toast.error(t('dialogs:import.importFailed', { message: (error as Error).message }));
    }
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

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle>{t('dialogs:import.title')}</DialogTitle>
              <DialogDescription>{t('dialogs:import.descriptionFull')}</DialogDescription>
            </div>
            <Button
              onClick={() => {
                confirmAction(() => {
                  reset();
                  setFlowName(t('defaults.newAutomation'));
                  onClose();
                });
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <DiamondPlus className="mr-2 h-4 w-4" />
              {t('dialogs:import.createNew')}
            </Button>
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="flex min-h-0 flex-col">
          <div className="relative mb-4">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('dialogs:import.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="max-h-[70vh] overflow-auto rounded-t-md">
            <div className="min-w-full">
              <div className="sticky top-0 z-20 bg-background before:absolute before:-top-px before:right-0 before:left-0 before:h-px before:bg-background">
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="flex-1 cursor-pointer whitespace-nowrap border-b bg-muted px-3 py-2 text-left font-semibold text-muted-foreground text-xs hover:bg-muted/80"
                  >
                    {t('dialogs:import.columns.name')}
                    {getSortIcon('name')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSort('lastTriggered')}
                    className="w-[120px] cursor-pointer whitespace-nowrap border-b bg-muted px-3 py-2 text-left font-semibold text-muted-foreground text-xs hover:bg-muted/80"
                  >
                    {t('dialogs:import.columns.lastTriggered')}
                    {getSortIcon('lastTriggered')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSort('enabled')}
                    className="w-[80px] cursor-pointer whitespace-nowrap border-b bg-muted px-3 py-2 text-center font-semibold text-muted-foreground text-xs hover:bg-muted/80"
                  >
                    {t('dialogs:import.columns.enabled')}
                    {getSortIcon('enabled')}
                  </button>
                  <div className="w-[60px] border-b bg-muted px-3 py-2 text-center font-semibold text-muted-foreground text-xs">
                    {t('dialogs:import.columns.action')}
                  </div>
                </div>
              </div>
              <div>
                {Object.entries(automationsByArea).flatMap(([areaName, automations]) => {
                  const filteredAutomations = searchTerm
                    ? automations.filter(
                        (automation) =>
                          automation.entity_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          automation.attributes.friendly_name
                            ?.toLowerCase()
                            .includes(searchTerm.toLowerCase()) ||
                          automation.attributes.description
                            ?.toLowerCase()
                            .includes(searchTerm.toLowerCase())
                      )
                    : automations;

                  if (filteredAutomations.length === 0) {
                    return [];
                  }

                  const areaRows = [
                    <div
                      key={areaName}
                      className="sticky top-[32px] z-10 -mt-1 flex border-b bg-accent"
                    >
                      <div className="flex-1 px-3 py-2 font-bold text-accent-foreground text-xs">
                        {areaName}
                      </div>
                    </div>,
                  ];

                  const automationRows = filteredAutomations.map((automation) => (
                    <div key={automation.entity_id} className="flex border-b last:border-0">
                      <div className="flex-1 px-3 py-2 align-top">
                        {/* Name (with tags below) */}
                        <div className="max-w-[180px] font-medium">
                          {automation.attributes.friendly_name || automation.entity_id}
                        </div>
                        {automation.attributes.description && (
                          <div className="mt-1 max-w-[180px] truncate text-muted-foreground text-xs">
                            {automation.attributes.description}
                          </div>
                        )}
                        {/* Tags under name/description */}
                        {Array.isArray(automation.attributes.tags) &&
                          automation.attributes.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {automation.attributes.tags.map((tag: string) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        {automation.attributes.tags &&
                          typeof automation.attributes.tags === 'string' && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge variant="secondary" className="text-xs">
                                {automation.attributes.tags}
                              </Badge>
                            </div>
                          )}
                        <div className="mt-1 truncate text-muted-foreground text-xs">
                          {t('dialogs:import.ID', { id: automation.attributes.id || '' })}
                        </div>
                        {automation.attributes.mode && (
                          <div className="text-muted-foreground text-xs">
                            {t('dialogs:import.mode', { mode: automation.attributes.mode })}
                          </div>
                        )}
                      </div>
                      <div className="w-[120px] max-w-[120px] px-3 py-2 align-top">
                        {automation.attributes.last_triggered ? (
                          <span className="whitespace-nowrap text-xs">
                            {formatLastTriggered(automation.attributes.last_triggered)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {t('dialogs:import.never')}
                          </span>
                        )}
                      </div>
                      <div className="w-[80px] px-3 py-2 text-center align-top">
                        <Switch
                          checked={automation.state === 'on'}
                          onCheckedChange={async (checked) => {
                            try {
                              const api = getHomeAssistantAPI(hass, hassConfig);
                              await api.setAutomationState(automation.entity_id, checked);
                              toast.success(
                                checked
                                  ? t('dialogs:import.automationEnabled')
                                  : t('dialogs:import.automationDisabled')
                              );
                            } catch {
                              toast.error(t('dialogs:import.updateStateFailed'));
                            }
                          }}
                          aria-label={
                            automation.state === 'on'
                              ? t('dialogs:import.columns.enabled')
                              : t('dialogs:import.disabled')
                          }
                        />
                      </div>
                      <div className="w-[60px] px-3 py-2 text-center align-top">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => confirmAction(() => handleImportAutomation(automation))}
                          title={t('dialogs:import.importAutomation')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ));
                  return (
                    <React.Fragment key={areaName}>
                      {areaRows.concat(automationRows)}
                    </React.Fragment>
                  );
                })}
                {automations.length > 0 &&
                  !Object.values(automationsByArea).some((automations) =>
                    searchTerm
                      ? automations.some(
                          (automation) =>
                            automation.entity_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            automation.attributes.friendly_name
                              ?.toLowerCase()
                              .includes(searchTerm.toLowerCase()) ||
                            automation.attributes.description
                              ?.toLowerCase()
                              .includes(searchTerm.toLowerCase())
                        )
                      : automations.length > 0
                  ) && (
                    <div className="flex">
                      <div className="flex-1 py-8 text-center text-muted-foreground">
                        {t('dialogs:import.noAutomations')}
                      </div>
                    </div>
                  )}
                {automations.length === 0 && (
                  <div className="flex">
                    <div className="flex-1 py-8 text-center text-muted-foreground">
                      {t('dialogs:import.noAutomations')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/20 p-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">{t('dialogs:import.openingWarning')}</p>
            <Button onClick={onClose} variant="ghost">
              {t('buttons.cancel')}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={handleCancelConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dialogs:import.discardTitle')}</DialogTitle>
            <DialogDescription>{t('dialogs:import.discardDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleCancelConfirm}>
              {t('buttons.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirm}>
              {t('dialogs:import.confirmDiscard')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
