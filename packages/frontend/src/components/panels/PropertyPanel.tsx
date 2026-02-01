import type { FlowNode } from '@cafe/shared';
import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getHandledProperties } from '@/config/handledProperties';
import { useHass } from '@/contexts/HassContext';
import { useFlowStore } from '@/store/flow-store';
import type { HassEntity } from '@/types/hass';
import { Separator } from '../ui/separator';
import { AutomationSettingsPanel } from './AutomationSettingsPanel';
import { NodeFields } from './NodeFields';
import { PropertyEditor } from './PropertyEditor';

/**
 * Refactored PropertyPanel component.
 * Reduced from 1,248 lines to ~80 lines by extracting components and logic.
 */
export function PropertyPanel() {
  const { t } = useTranslation(['common', 'nodes']);
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const nodes = useFlowStore((s) => s.nodes);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const removeNode = useFlowStore((s) => s.removeNode);
  const { hass, entities } = useHass();

  // Use entities from hass object directly
  const effectiveEntities = useMemo(() => {
    if (hass?.states && Object.keys(hass.states).length > 0) {
      return Object.values(hass.states).map((state: HassEntity) => ({
        entity_id: state.entity_id,
        state: state.state,
        attributes: state.attributes || {},
        last_changed: state.last_changed || '',
        last_updated: state.last_updated || '',
        context: state.context,
      }));
    }
    return entities;
  }, [hass, entities]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  // Get handled properties for this node type - must be before early return
  // For device triggers/conditions, we need to exclude ALL current node properties to prevent duplicates
  // since device field components handle them dynamically based on API metadata
  const handledProperties = useMemo(() => {
    if (!selectedNode) {
      return getHandledProperties('trigger', []);
    }

    const baseHandled = getHandledProperties(selectedNode.type || 'trigger', []);
    const nodeData = selectedNode.data;

    // Check if this is a device-based node (trigger or condition with device_id)
    const triggerType = typeof nodeData.trigger === 'string' ? nodeData.trigger : '';
    const deviceId = typeof nodeData.device_id === 'string' ? nodeData.device_id : '';
    const isDeviceNode = triggerType === 'device' || deviceId;

    // For device nodes, exclude ALL properties to prevent duplicates with API-driven fields
    if (isDeviceNode && (selectedNode.type === 'trigger' || selectedNode.type === 'condition')) {
      const allNodeProperties = Object.keys(nodeData);
      const handledSet = new Set([...baseHandled, ...allNodeProperties]);
      return handledSet;
    }

    return baseHandled;
  }, [selectedNode]);

  if (!selectedNode) {
    return <AutomationSettingsPanel />;
  }

  const handleChange = (key: string, value: unknown) => {
    updateNodeData(selectedNode.id, { [key]: value });
  };

  const handleDeleteProperty = (key: string) => {
    updateNodeData(selectedNode.id, { [key]: undefined });
  };

  return (
    <div className="h-full flex-1 space-y-4 overflow-y-auto p-4">
      {/* Header with delete button */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">
          {selectedNode.type
            ? // @ts-expect-error -- TS cannot infer that type exists here
              t(`nodes:types.${selectedNode.type}`)
            : t('nodes:types.node')}{' '}
          {t('nodes:panel.properties')}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeNode(selectedNode.id)}
          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <FormField label={t('labels.alias')}>
        <Input
          type="text"
          value={typeof selectedNode.data.alias === 'string' ? selectedNode.data.alias : ''}
          onChange={(e) => handleChange('alias', e.target.value)}
          placeholder={t('placeholders.optionalDisplayName')}
        />
      </FormField>

      {/* ID field - not applicable for action nodes */}
      {selectedNode.type !== 'action' && (
        <FormField label={t('labels.id')}>
          <Input
            type="text"
            value={typeof selectedNode.data.id === 'string' ? selectedNode.data.id : ''}
            onChange={(e) => handleChange('id', e.target.value || undefined)}
            placeholder={t('placeholders.optionalUniqueId')}
            className="font-mono"
          />
        </FormField>
      )}

      {/* Enabled toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="node-enabled" className="text-sm">
          {t('labels.enabled')}
        </Label>
        <Switch
          id="node-enabled"
          checked={selectedNode.data.enabled !== false}
          onCheckedChange={(checked) => handleChange('enabled', checked ? undefined : false)}
        />
      </div>

      <Separator />

      {/* Node-specific fields */}
      <NodeFields
        node={selectedNode as FlowNode}
        onChange={handleChange}
        entities={effectiveEntities}
      />

      {/* Additional properties editor */}
      <PropertyEditor
        node={selectedNode as FlowNode}
        handledProperties={handledProperties}
        onChange={handleChange}
        onDelete={handleDeleteProperty}
      />

      {/* Node ID footer */}
      <div className="pt-2 text-muted-foreground text-xs">
        {t('nodes:panel.nodeId', { id: selectedNode.id })}
      </div>
    </div>
  );
}
