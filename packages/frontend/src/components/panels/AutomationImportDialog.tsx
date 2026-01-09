import { Clock, DiamondPlus, Download, Search, ToggleLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { type HassEntity, useHass } from '@/hooks/useHass';
import { convertAutomationConfigToNodes } from '@/lib/automation-converter';
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
  };
  state: 'on' | 'off';
}

export function AutomationImportDialog({ isOpen, onClose }: AutomationImportDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { hass, config: hassConfig } = useHass();
  const { setFlowName, setAutomationId, reset } = useFlowStore();

  // Get all automations from HA
  const automations = useMemo(() => {
    if (!hass?.states) {
      return [];
    }

    const automationEntities = Object.values(hass.states).filter((entity: HassEntity) =>
      entity.entity_id.startsWith('automation.')
    );

    return automationEntities.map((entity: HassEntity) => ({
      entity_id: entity.entity_id,
      attributes: entity.attributes || {},
      state: entity.state,
    })) as HaAutomation[];
  }, [hass]);

  // Filter automations based on search term
  const filteredAutomations = useMemo(() => {
    if (!searchTerm) return automations;

    const search = searchTerm.toLowerCase();
    return automations.filter(
      (automation) =>
        automation.entity_id.toLowerCase().includes(search) ||
        automation.attributes.friendly_name?.toLowerCase().includes(search) ||
        automation.attributes.description?.toLowerCase().includes(search)
    );
  }, [automations, searchTerm]);

  const handleImportAutomation = async (automation: HaAutomation) => {
    try {
      // Try to get the numeric ID from attributes, fallback to entity_id without prefix
      const automationId =
        automation.attributes.id || automation.entity_id.replace('automation.', '');

      // Get API instance and update with current hass and config
      const api = getHomeAssistantAPI(hass, hassConfig);

      if (!api.isConnected()) {
        throw new Error('No Home Assistant connection available');
      }

      // Get automation configuration with fallbacks
      const config = await api.getAutomationConfigWithFallback(
        automationId,
        automation.attributes.friendly_name
      );

      // Reset current flow and set name and ID
      reset();
      setFlowName(automation.attributes.friendly_name || automationId);
      setAutomationId(automationId); // Set the automation ID for future updates

      if (config) {
        // Convert automation config to visual nodes

        const { nodes, edges } = convertAutomationConfigToNodes(config);
        const { addNode, onConnect } = useFlowStore.getState();

        // Create all nodes
        for (const node of nodes) {
          addNode(node);
        }

        // Create all edges
        for (const edge of edges) {
          onConnect({
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: null,
          });
        }

        toast.success(
          `Automation "${automation.attributes.friendly_name || automationId}" imported successfully!`
        );
      } else {
        // Even if we couldn't fetch config, still set the automation ID
        // so that if user creates a flow with the same name, it will update instead of create new
        setAutomationId(automationId);

        toast.warning(
          `Automation "${automation.attributes.friendly_name || automationId}" opened!`,
          {
            description:
              'Could not fetch configuration automatically. You can now create a new flow with the same name.',
          }
        );
      }

      onClose();
    } catch (error) {
      console.error('C.A.F.E.: Failed to open automation:', error);
      toast.error(`Failed to import automation: ${(error as Error).message}`);
    }
  };

  const formatLastTriggered = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle>Open Automation</DialogTitle>
              <DialogDescription>Open an existing automation or create a new one</DialogDescription>
            </div>
            <Button
              onClick={() => {
                // Create new automation
                reset();
                setFlowName('New Automation');
                onClose();
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <DiamondPlus className="mr-2 h-4 w-4" />
              Create New
            </Button>
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="space-y-4 border-b p-6">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search automations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Found {filteredAutomations.length} automation
            {filteredAutomations.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Automation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredAutomations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {automations.length === 0 ? (
                <div className="space-y-2">
                  <p>No Home Assistant connection</p>
                  <p className="text-xs">
                    Configure your Home Assistant connection in Settings to view automations
                  </p>
                </div>
              ) : (
                'No automations match your search'
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredAutomations.map((automation) => (
                <div key={automation.entity_id} className="p-6 transition-colors hover:bg-muted/50">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            automation.state === 'on' ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        />
                        <h3 className="truncate font-medium text-foreground">
                          {automation.attributes.friendly_name ||
                            automation.entity_id.replace('automation.', '')}
                        </h3>
                        <Badge
                          variant={automation.state === 'on' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          <ToggleLeft className="mr-1 h-3 w-3" />
                          {automation.state === 'on' ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>

                      {automation.attributes.description && (
                        <p className="mb-2 text-muted-foreground text-sm">
                          {automation.attributes.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-muted-foreground text-xs">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last triggered:{' '}
                          {formatLastTriggered(automation.attributes.last_triggered)}
                        </span>
                        <span>ID: {automation.entity_id}</span>
                        {automation.attributes.mode && (
                          <span>Mode: {automation.attributes.mode}</span>
                        )}
                      </div>
                    </div>

                    <Button onClick={() => handleImportAutomation(automation)} className="ml-4">
                      <Download className="mr-2 h-4 w-4" />
                      Open
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/20 p-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Opening will replace your current automation design
            </p>
            <Button onClick={onClose} variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
